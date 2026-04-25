/**
 * France-Visas step1-step12 fill orchestration.
 *
 * Drives the JSF Schengen Type C form: detects the current step, fills any
 * fields that have Annex I mappings, advances to the next step, repeats
 * until the review/confirmation surface is reached.
 *
 * Shape parallels ceac/orchestrator.ts. The `PAGE_FILL_MAP` is intentionally
 * empty — downstream work (the Playwright walk output) populates it with
 * the selectors harvested for each Annex I field.
 */

import type { Page } from "@playwright/test";
import type { FormFieldMapping } from "../form-mappings";
import type { FvSession } from "./session";
import { detectPage, type FvPageId } from "./pages";
import { advance } from "./navigator";
import { NavigationError, serializeError } from "./errors";

/**
 * Map from FvPageId to the Annex I field mappings filled on that step.
 * France-Visas uses 6 steps (confirmed via live walk 2026-04-24), not the
 * 12 logical sections in the Annex I seed. Each FR step consolidates
 * several seed groupings:
 *
 *   step1 — "Your plans"       nationality + travel document + purpose triage
 *                              (Annex I 6, 11-16, 17-18, 23 + France-specific:
 *                              deposit-country, deposit-town, destination,
 *                              stayDuration). "Verify" button triggers
 *                              eligibility check; "Next" appears after.
 *   step2 — "Your information" personal details (likely Annex I 1-9 + 19-20)
 *   step3 — TBD
 *   step4 — TBD
 *   step5 — TBD
 *   step6 — TBD (walk interrupted; step2-step6 schema capture pending
 *           a second authenticated session)
 *
 * IMPORTANT: most step1 selects are CASCADING — selecting one triggers a
 * JSF AJAX postback that populates downstream options. The fill loop
 * must call the PrimeFaces widget's `triggerChange()` after every
 * `selectValue()` (or click through the UI) so the server rebuilds the
 * dependent dropdowns. A naive bulk-fill leaves purposeCategory/purpose/
 * authority/travel-document/deposit-town empty.
 */
const PAGE_FILL_MAP: Partial<Record<FvPageId, Record<string, FormFieldMapping>>> = {
  // step1: fvStep1Mappings,  // Your plans — see FV_STEP1_FIELDS in selectors.ts
  // step2: fvStep2Mappings,  // Your information — schema TBD
  // step3: fvStep3Mappings,
  // step4: fvStep4Mappings,
  // step5: fvStep5Mappings,
  // step6: fvStep6Mappings,
};

/**
 * Pages that terminate the fill loop. The worker reaches review or
 * confirmation and stops before any irreversible submission action —
 * final submission is the applicant's responsibility.
 */
const TERMINAL_PAGES: ReadonlySet<FvPageId> = new Set([
  "review",
  "confirmation",
  "session_expired",
]);

const MAX_PAGE_TRANSITIONS = 30;

export interface FvOrchestrateOptions {
  /** Answers from visa_application_answers keyed by field_name. */
  answers: Record<string, string>;
  /** Applicant profile for fallback field values. */
  profile: Record<string, unknown>;
  /** Run identifier for structured logging. */
  runId?: string;
}

export interface FvSectionCoverage {
  filled: FvPageId[];
  skipped: FvPageId[];
}

export interface FvOrchestrateResult {
  status: "review_reached" | "failed";
  terminalPage: FvPageId | "unknown";
  sectionCoverage: FvSectionCoverage;
  error: Record<string, unknown> | null;
}

/**
 * Drive the France-Visas form step-by-step from the current page to the
 * review surface. Caller must have already bootstrapped a session and
 * navigated past accueil.xhtml so the first detected page is step1.
 *
 * Implementation sketch (mirrors ceac/orchestrator.ts `orchestrateFill`):
 *   while (transitions < MAX):
 *     probe = detectPage(page)
 *     if probe.id in TERMINAL_PAGES: return { status: "review_reached", ... }
 *     mappings = PAGE_FILL_MAP[probe.id]
 *     if mappings: fillPageFields(page, mappings, answers, profile)
 *     advance(page, { from: probe.id, to: getExpectedNext(probe.id) })
 *     transitions++
 */
export async function orchestrateFvFill(
  session: FvSession,
  options: FvOrchestrateOptions,
): Promise<FvOrchestrateResult> {
  const page = session.page;
  const sectionsFilled: FvPageId[] = [];
  const sectionsSkipped: FvPageId[] = [];

  try {
    let transitions = 0;
    while (transitions < MAX_PAGE_TRANSITIONS) {
      const probe = await detectPage(page);

      if (probe.id !== "unknown" && TERMINAL_PAGES.has(probe.id)) {
        return {
          status: "review_reached",
          terminalPage: probe.id,
          sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped },
          error: null,
        };
      }

      if (probe.id === "unknown") {
        throw new NavigationError(
          `France-Visas orchestrator landed on an unknown page`,
          {
            detected: "unknown",
            url: probe.url,
            details: { heading: probe.heading, transitions },
          },
        );
      }

      const mappings = PAGE_FILL_MAP[probe.id];
      if (mappings) {
        await fillPageFields(page, mappings, options.answers, options.profile);
        sectionsFilled.push(probe.id);
      } else {
        sectionsSkipped.push(probe.id);
      }

      await advance(page, {
        from: probe.id,
        to: getExpectedNextPages(probe.id),
      });
      transitions += 1;
    }

    throw new NavigationError(
      `France-Visas orchestrator exceeded ${MAX_PAGE_TRANSITIONS} transitions without reaching review`,
      { details: { transitions } },
    );
  } catch (err) {
    return {
      status: "failed",
      terminalPage: "unknown",
      sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped },
      error: serializeError(err),
    };
  }
}

async function fillPageFields(
  page: Page,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
  profile: Record<string, unknown>,
): Promise<void> {
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    const value =
      answers[fieldName] ?? (profile[fieldName] as string | undefined) ?? null;
    if (!value) continue;

    const selectors = mapping.selector.split(",").map((s) => s.trim());
    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        if ((await el.count()) === 0) continue;

        if (mapping.type === "radio") {
          const radio = page.locator(`${selector}[value="${value}"]`).first();
          if ((await radio.count()) > 0) {
            await radio.click({ timeout: 5_000 });
            break;
          }
        } else if (mapping.type === "select") {
          await el.selectOption(value, { timeout: 5_000 });
          break;
        } else {
          await el.fill(value, { timeout: 5_000 });
          break;
        }
      } catch {
        // try next selector
      }
    }
  }
}

/**
 * Return the set of expected next pages from the current page. The
 * Schengen flow is mostly linear, but some conditional steps are skipped
 * (e.g. step2 parental authority applies only to minors) — accept a few
 * downstream possibilities rather than one rigid target.
 */
function getExpectedNextPages(current: FvPageId): FvPageId[] {
  const order: FvPageId[] = [
    "step1", "step2", "step3", "step4", "step5", "step6",
    "review", "confirmation",
  ];
  const idx = order.indexOf(current);
  if (idx === -1 || idx >= order.length - 1) return order.slice(1);
  return order.slice(idx + 1, idx + 4);
}
