/**
 * CEAC DS-160 page-by-page fill orchestration (US-012).
 *
 * Drives the new CEAC runtime path through the DS-160 form: detects the
 * current page, fills any fields that have matching answer mappings, advances
 * to the next page, and repeats until the Sign and Submit page is reached.
 *
 * Key contracts:
 *   - No code path enters the passport-signature field, solves the final
 *     CAPTCHA, or clicks the final "Sign and Submit Application" button.
 *   - Failure paths preserve recovery metadata (Application ID, last
 *     checkpoint, `.dat` artifact) through the typed result contract.
 *   - Checkpoint and `.dat` capture are wired at natural section boundaries.
 */

import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FormFieldMapping } from "../form-mappings";
import {
  DS160_MAPPING_GROUPS,
  ds160PersonalInfo2Mappings,
  ds160TravelCompanionsMappings,
  ds160PreviousUsTravelMappings,
  ds160UsContactMappings,
  ds160FamilyRelativesMappings,
  ds160FamilySpouseMappings,
  ds160WorkPreviousMappings,
  ds160WorkAdditionalMappings,
} from "../ds160-form-mappings";
import { detectPage, type CeacPageId } from "./pages";
import { advance, saveCurrent } from "./navigator";
import {
  recordSectionCheckpoint,
  type CheckpointEmitOptions,
} from "./checkpoints";
import {
  captureDatArtifact,
  type RecoveryTracker,
  type DatArtifact,
} from "./artifacts";
import {
  stopAtSignAndSubmit,
  detectSignAndSubmit,
  type HandoffReadyOutcome,
} from "./stop-at-sign";
import {
  preserveRecoveryOnFailure,
  type PreservedRecovery,
} from "./artifacts";
import { buildSuccessResult, buildFailureResult, type CeacRunResult } from "./result";
import { serializeError } from "./errors";
import type { CeacSession } from "./session";
import { tryCaptureScreenshot } from "./diagnostics";

/**
 * Map from CeacPageId to the DS160_MAPPING_GROUPS entry that should be
 * filled on that page. Pages without mappings are advanced past without
 * filling.
 */
const PAGE_FILL_MAP: Partial<Record<CeacPageId, Record<string, FormFieldMapping>>> = {
  personal_information_1: DS160_MAPPING_GROUPS[0].mappings,
  personal_information_2: ds160PersonalInfo2Mappings,
  travel_information: DS160_MAPPING_GROUPS[2].mappings,
  travel_companions: ds160TravelCompanionsMappings,
  previous_us_travel: ds160PreviousUsTravelMappings,
  address_and_phone: DS160_MAPPING_GROUPS[6].mappings,
  passport: DS160_MAPPING_GROUPS[5].mappings,
  us_contact: ds160UsContactMappings,
  family_relatives: ds160FamilyRelativesMappings,
  family_spouse: ds160FamilySpouseMappings,
  work_education_present: DS160_MAPPING_GROUPS[10].mappings,
  work_education_previous: ds160WorkPreviousMappings,
  work_education_additional: ds160WorkAdditionalMappings,
  // Security Background Parts 1–5: pass-through — these pages contain only
  // yes/no radio buttons. The dynamic form supplies answers, but radio-button
  // fill requires a different selector strategy than text/select fields.
  // TODO(US-follow-up): implement radio-button fill for security pages.
};

/**
 * Pages that the orchestrator navigates through in order. The DS-160 flow
 * is linear from personal_information_1 through sign_and_submit. Some pages
 * are conditional (e.g. family_spouse depends on marital status) — the
 * orchestrator handles this by detecting the actual current page rather than
 * assuming a rigid sequence.
 */
const TERMINAL_PAGES: ReadonlySet<CeacPageId> = new Set([
  "sign_and_submit",
  "confirmation",
  "session_expired",
]);

/** Maximum pages to traverse before aborting (safety valve). */
const MAX_PAGE_TRANSITIONS = 30;

export interface OrchestrateOptions {
  /** Answers from visa_application_answers keyed by field_name. */
  answers: Record<string, string>;
  /** Applicant profile for fallback field values. */
  profile: Record<string, unknown>;
  /** Recovery tracker to accumulate checkpoints and Application ID. */
  tracker: RecoveryTracker;
  /** Run identifier for structured logging. */
  runId?: string;
  /** Directory for .dat and screenshot artifacts. */
  outputDir?: string;
}

export interface SectionCoverage {
  /** Sections that had mappings and were filled. */
  filled: string[];
  /** Sections that were advanced past without filling. */
  skipped: string[];
}

export interface OrchestrateResult {
  /** The typed CEAC run result (handoff_ready or failed). */
  result: CeacRunResult;
  /** .dat artifact if captured during the run. */
  datArtifact: DatArtifact | null;
  /** Which DS-160 sections were filled vs skipped during the run. */
  sectionCoverage: SectionCoverage;
}

/**
 * Drive the DS-160 form page-by-page from the current page through to the
 * Sign and Submit page.
 *
 * The caller should have already bootstrapped a CEAC session and navigated
 * past the start page to the first form page (personal_information_1).
 * This function fills fields on each page using the answer mappings, advances
 * through the form, and stops at the Sign and Submit page.
 *
 * Returns a `CeacRunResult` — either `handoff_ready` (reached sign page) or
 * `failed` (error during fill/navigation).
 */
export async function orchestrateFill(
  session: CeacSession,
  options: OrchestrateOptions,
): Promise<OrchestrateResult> {
  const { answers, profile, tracker, runId } = options;
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "ceac-orch-"));
  const page = session.page;

  const checkpointOpts: CheckpointEmitOptions = {
    sink: tracker,
    runId,
  };

  let datArtifact: DatArtifact | null = null;
  let transitions = 0;
  const sectionsFilled: string[] = [];
  const sectionsSkipped: string[] = [];

  try {
    // Fill-and-advance loop: detect current page, fill if we have mappings,
    // advance to the next page. Stop when we reach a terminal page.
    while (transitions < MAX_PAGE_TRANSITIONS) {
      const probe = await detectPage(page);
      const currentPageId = probe.id;

      // Check for sign-and-submit page — terminal stop
      if (currentPageId === "sign_and_submit") {
        const signIdentity = await detectSignAndSubmit(page);
        if (signIdentity) {
          const outcome = await stopAtSignAndSubmit(page, {
            tracker,
            runId,
            screenshotDir: outputDir,
          });

          // Capture .dat before building the success result if we haven't yet
          if (!datArtifact) {
            try {
              datArtifact = await captureDatArtifact(page, { outputDir });
            } catch {
              // .dat capture is best-effort at the sign page
            }
          }

          const result = buildSuccessResult(outcome);
          return { result, datArtifact, sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped } };
        }
      }

      // Check for other terminal states
      if (currentPageId === "session_expired") {
        throw new Error("CEAC session expired during fill orchestration");
      }

      if (currentPageId === "confirmation") {
        throw new Error("Unexpectedly reached confirmation page — submission should not have occurred");
      }

      // Fill fields if we have mappings for this page
      const mappings = currentPageId !== "unknown"
        ? PAGE_FILL_MAP[currentPageId]
        : undefined;

      if (mappings) {
        console.log(`[orchestrator] Filling page: ${currentPageId}`);
        await fillPageFields(page, mappings, answers, profile);
        sectionsFilled.push(currentPageId);
      } else {
        console.log(`[orchestrator] No mappings for page: ${currentPageId} — advancing`);
        if (currentPageId !== "unknown") {
          sectionsSkipped.push(currentPageId);
        }
      }

      // Record section checkpoint after filling
      await recordSectionCheckpoint(page, {
        ...checkpointOpts,
        details: { section: currentPageId, filled: !!mappings },
      });

      // Capture .dat at strategic points (after passport and work/education)
      if (currentPageId === "passport" || currentPageId === "work_education_present") {
        try {
          datArtifact = await captureDatArtifact(page, { outputDir });
          console.log(`[orchestrator] .dat captured at ${currentPageId}`);
        } catch {
          console.warn(`[orchestrator] .dat capture failed at ${currentPageId} — continuing`);
        }
      }

      // Determine next page and advance.
      // We don't hardcode the expected destination since CEAC may skip
      // conditional pages. Instead we accept any known DS-160 page.
      const nextPageCandidates = getExpectedNextPages(currentPageId);

      try {
        await advance(page, {
          from: currentPageId !== "unknown" ? currentPageId : "start",
          to: nextPageCandidates,
        });
      } catch (navErr) {
        // Navigation failed — check if we accidentally landed on sign page
        const recheck = await detectPage(page);
        if (recheck.id === "sign_and_submit") {
          continue; // Loop back to handle sign page at top
        }
        throw navErr;
      }

      transitions++;
    }

    // Safety valve: too many transitions without reaching sign page
    throw new Error(
      `Fill orchestration exceeded ${MAX_PAGE_TRANSITIONS} page transitions without reaching Sign and Submit`,
    );
  } catch (err) {
    // Preserve recovery metadata on any failure
    const recovery = await preserveRecoveryOnFailure({
      tracker,
      error: err,
      page,
      screenshotDir: outputDir,
    });

    const result = buildFailureResult(recovery, {
      error: serializeError(err),
      failureScreenshot: recovery.failureScreenshot,
    });

    return { result, datArtifact, sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped } };
  }
}

/**
 * Fill fields on the current page using the provided mappings and answer data.
 * Fields without matching answers are silently skipped.
 */
async function fillPageFields(
  page: Page,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
  profile: Record<string, unknown>,
): Promise<void> {
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    const value = answers[fieldName]
      ?? (profile[fieldName] as string | undefined)
      ?? null;

    if (!value) continue;

    const selectors = mapping.selector.split(",").map((s) => s.trim());
    let filled = false;

    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        const count = await el.count();
        if (count === 0) continue;

        if (mapping.type === "select") {
          await el.selectOption(value, { timeout: 5_000 });
        } else {
          await el.fill(value, { timeout: 5_000 });
        }

        filled = true;
        break;
      } catch {
        // Try next selector
      }
    }

    if (!filled) {
      console.warn(`[orchestrator] Could not fill "${mapping.label}" on current page`);
    }
  }
}

/**
 * Return a broad set of expected next pages based on the current page.
 * The DS-160 flow is mostly linear but some pages are conditional, so we
 * accept multiple possible destinations rather than one rigid target.
 */
function getExpectedNextPages(current: CeacPageId | "unknown"): CeacPageId[] {
  // Ordered DS-160 page progression (simplified — conditional pages may be skipped)
  const pageOrder: CeacPageId[] = [
    "start",
    "personal_information_1",
    "personal_information_2",
    "travel_information",
    "travel_companions",
    "previous_us_travel",
    "address_and_phone",
    "passport",
    "us_contact",
    "family_relatives",
    "family_spouse",
    "work_education_present",
    "work_education_previous",
    "work_education_additional",
    "security_background_1",
    "security_background_2",
    "security_background_3",
    "security_background_4",
    "security_background_5",
    "review",
    "sign_and_submit",
  ];

  const currentIdx = pageOrder.indexOf(current as CeacPageId);

  if (currentIdx === -1 || currentIdx >= pageOrder.length - 1) {
    // Unknown page or at the end — accept any page after personal_information_1
    return pageOrder.slice(1);
  }

  // Accept the next 3 pages (to handle skipped conditional pages)
  return pageOrder.slice(currentIdx + 1, currentIdx + 4);
}
