/**
 * UK Standard Visitor visa orchestrator.
 *
 * Walks the pre-auth flow (language → country → VAC → visa-type-start) to
 * prove the stealth session reaches the registration page. Post-auth
 * pages are not yet selector-mapped; the orchestrator stops at the
 * registration page and returns a `handoffReady=false` result with a
 * clear reason. Selectors for post-auth pages are harvested via
 * `form-recon.ts` and plugged into `field-mappings.ts`.
 */

import type { Page } from "@playwright/test";
import { UK_PAGE_SELECTORS, UK_SUBMIT_SELECTOR } from "./selectors";
import { detectPage, type UkPageIdentity } from "./pages";
import { assertNoGate } from "./gates";
import { UkNavigationError, UkWidgetFillError } from "./errors";
import { tryCaptureScreenshot, type UkScreenshotArtifact } from "./diagnostics";
import type { UkSession } from "./session";

export interface UkOrchestrateOptions {
  /** Flattened application answers keyed by seed field_name. */
  answers: Record<string, string>;
  /** Biometrics country (ISO-3 alpha). Usually the applicant's country of
   *  residence. Defaults to the first country we can derive from answers. */
  biometricsCountryIso3?: string;
  /** Runtime identifier for structured logging. */
  runId?: string;
  /** Navigation wait timeout per step (ms). Default 30_000. */
  navigationTimeoutMs?: number;
  /** Where to write failure screenshots. If unset, no screenshots. */
  outputDir?: string;
}

export interface UkOrchestrateResult {
  /** True once the full form has been filled up to the payment step.
   *  Always false today — post-auth pages are not yet mapped. */
  handoffReady: boolean;
  /** Terminal page identity. */
  stoppedAt: UkPageIdentity;
  /** Pages successfully traversed in this run (in order). */
  pagesVisited: string[];
  /** Reason the run stopped (human-readable). */
  reason: string;
  /** Failure screenshot if one was captured. */
  failureScreenshot?: UkScreenshotArtifact | null;
}

/** Drive the UK flow from language selection up to the registration page.
 *
 *  Does NOT submit the registration form — that creates a real UKVI
 *  account. Stops with `handoffReady=false` and `stoppedAt.id =
 *  "registration"` so the caller can hand off to a human, or (once
 *  post-auth selectors are mapped) continue into the 222-field form. */
export async function orchestrateUkFill(
  session: UkSession,
  options: UkOrchestrateOptions,
): Promise<UkOrchestrateResult> {
  const { page } = session;
  const navTimeout = options.navigationTimeoutMs ?? 30_000;
  const visited: string[] = [];

  try {
    // ── Page 1: language selection ──────────────────────────────────
    await assertNoGate(page);
    await selectRadio(page, UK_PAGE_SELECTORS.language_selection.languageCode.selector, "en");
    await clickNext(page, navTimeout, "language_selection");
    visited.push("language_selection");

    // ── Page 2: country for biometrics ──────────────────────────────
    await assertNoGate(page);
    const countryIso = options.biometricsCountryIso3
      ?? deriveBiometricsCountry(options.answers)
      ?? "USA";
    await selectOption(page, UK_PAGE_SELECTORS.country_selection.countryCode.selector, countryIso);
    await clickNext(page, navTimeout, "country_selection");
    visited.push("country_selection");

    // ── Page 3: VAC availability confirm ────────────────────────────
    await assertNoGate(page);
    await selectRadio(page, UK_PAGE_SELECTORS.vac_information.vacAvailabilityConfirmed.selector, "true");
    await clickNext(page, navTimeout, "vac_information");
    visited.push("vac_information");

    // ── Page 4: visa-type start (no fields, just Start now) ─────────
    await assertNoGate(page);
    await clickNext(page, navTimeout, "visa_type_start");
    visited.push("visa_type_start");

    // ── Page 5: registration — STOP HERE ────────────────────────────
    // Submitting this form creates a real UKVI account. Don't submit
    // until post-auth selectors are mapped AND the applicant has an
    // enrolled email account we can use for verification.
    await assertNoGate(page);
    const identity = await detectPage(page);

    return {
      handoffReady: false,
      stoppedAt: identity,
      pagesVisited: visited,
      reason:
        identity.id === "registration"
          ? "Reached registration page. Post-auth form selectors are not yet mapped — " +
            "run src/uk/form-recon.ts against a logged-in browser session to harvest them, " +
            "then extend UK_FIELD_DEFINITIONS in field-mappings.ts."
          : `Unexpected terminal page: ${identity.id} (url=${identity.url})`,
    };
  } catch (err) {
    // Best-effort screenshot for the operator. Doesn't mask the real
    // error — we capture, then re-throw.
    let failureScreenshot: UkScreenshotArtifact | null = null;
    if (options.outputDir) {
      failureScreenshot = await tryCaptureScreenshot(page, {
        outputDir: options.outputDir,
        runId: options.runId ?? "unknown",
        label: `failure-after-${visited[visited.length - 1] ?? "bootstrap"}`,
      });
    }
    // Attach the screenshot path to the error if it's a UkError so the
    // caller can include it in the queue payload.
    if (failureScreenshot && typeof err === "object" && err !== null && "context" in err) {
      const ctx = (err as { context: Record<string, unknown> }).context;
      ctx.details = { ...(ctx.details as Record<string, unknown> ?? {}), failureScreenshot: failureScreenshot.path };
    }
    throw err;
  }
}

// ── helpers ───────────────────────────────────────────────────────────

async function selectRadio(page: Page, selector: string, value: string): Promise<void> {
  const primary = `${selector}[value="${value}"]`;
  try {
    await page.locator(primary).first().check({ timeout: 5_000 });
  } catch (err) {
    throw new UkWidgetFillError(`Pre-auth radio fill failed (${selector}=${value})`, {
      details: { selector: primary, cause: err instanceof Error ? err.message : String(err) },
    });
  }
}

async function selectOption(page: Page, selector: string, value: string): Promise<void> {
  try {
    await page.locator(selector).first().selectOption(value, { timeout: 5_000 });
  } catch (err) {
    throw new UkWidgetFillError(`Pre-auth select fill failed (${selector}=${value})`, {
      details: { selector, value, cause: err instanceof Error ? err.message : String(err) },
    });
  }
}

async function clickNext(page: Page, navTimeout: number, fromPage: string): Promise<void> {
  try {
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: navTimeout }),
      page.locator(UK_SUBMIT_SELECTOR).first().click({ timeout: 10_000 }),
    ]);
  } catch (err) {
    throw new UkNavigationError(`Navigation after ${fromPage} failed`, {
      details: { fromPage, cause: err instanceof Error ? err.message : String(err) },
    });
  }
}

/** Best-effort: pull a biometrics country from the applicant's answer
 *  set. The seed doesn't have an explicit `biometrics_country` field
 *  today, so we fall back to home-address or nationality. Returns the
 *  value verbatim — caller is responsible for ISO-3 normalization. */
function deriveBiometricsCountry(answers: Record<string, string>): string | undefined {
  return (
    answers.biometrics_country ??
    answers.home_address_country ??
    answers.current_residence_country ??
    answers.nationality ??
    undefined
  );
}
