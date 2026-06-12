/**
 * Top-level France-Visas autofill runner.
 *
 * `fillFranceVisasApplication()` is the single entry point callers use to
 * run the end-to-end autofill. Given credentials and a normalized answer
 * set, it:
 *
 *   1. Signs in (Keycloak → accueil.xhtml)
 *   2. Starts a new application (accueil → step1.xhtml)
 *   3. Fills step 1-5 using the captured per-step fill functions
 *   4. Between steps: advances via the localized "Next" / "Verify" / "Continue"
 *      button and auto-confirms any Yes/No confirmation modal
 *   5. Advances past the informational step 6
 *   6. Returns a result payload — success=reached-end-of-form, or failure
 *      with recovery context (current step, validation messages, URL)
 *
 * The runner does NOT submit the application — it stops at the end of
 * step 6, which returns to the accueil dashboard with the draft saved.
 * Final submission requires biometrics booking at a VAC and happens outside
 * this automation.
 */

import type { Page } from "@playwright/test";
import { signInWithPassword, type FvSignInInput, type FvSessionHandles } from "./sign-in";
import { startNewApplication, finalizeAndDownloadPdf } from "./accueil";
import { fillStep1, fillStep2, fillStep3, fillStep4, fillStep5 } from "./fill-steps";
import { waitForPage, detectPage, type FvPageId } from "./pages";
import { readValidationMessages } from "./navigator";
import { waitForJsfIdle } from "./primefaces-ajax";
import { NavigationError, serializeError } from "./errors";
import type { FvApplicationAnswers } from "./field-mappings";

export interface FillFranceVisasInput {
  credentials: FvSignInInput;
  answers: FvApplicationAnswers;
}

export interface FillFranceVisasOptions {
  /** Run Chromium headless. Default true. */
  headless?: boolean;
  /** Optional run id for correlation in logs. */
  runId?: string;
  /** Per-step advance timeout. Default 60s (JSF postbacks can be slow). */
  stepTimeoutMs?: number;
  /**
   * After step 6 lands on accueil, click the group's Finalize button and
   * download the completed CERFA PDF. Default true. Set false for a
   * "save draft only" mode that lets the applicant review before finalizing.
   */
  finalize?: boolean;
  /** Where to save the downloaded PDF. Default: a fresh temp dir. */
  pdfOutputDir?: string;
  /** Optional heartbeat invoked once a signed-in official portal page is open. */
  onOfficialPortalOpened?: (info: { url: string }) => Promise<void> | void;
}

export type FillFranceVisasResult =
  | {
      status: "prefilled";
      runId?: string;
      landedOn: FvPageId | "unknown";
      stepsCompleted: FvPageId[];
      /**
       * The 13-digit France-Visas internal draft reference (like
       * "2026705103880") visible on accueil immediately after the draft
       * is saved. Useful for finding the row in the dashboard.
       */
      draftReference: string | null;
      /**
       * The FRA-format application reference (like "FRA1PE20267040548")
       * assigned after Finalize. Country code + city code + sequential
       * number — this is the reference applicants quote to the consulate
       * and the VAC. Null when finalize was skipped or did not run.
       */
      applicationReference: string | null;
      /**
       * Local path to the downloaded CERFA PDF (the official Schengen
       * visa application form, prefilled with the applicant's data).
       * Null when finalize was skipped or did not run.
       */
      pdfPath: string | null;
    }
  | {
      status: "failed";
      runId?: string;
      failedStep: FvPageId | "unknown";
      validationMessages: string[];
      error: Record<string, unknown> | null;
      url: string;
    };

const DEFAULT_STEP_TIMEOUT_MS = 60_000;

/**
 * Run one end-to-end France-Visas autofill. Returns a typed result the
 * caller can persist and surface to ops/applicant.
 */
export async function fillFranceVisasApplication(
  input: FillFranceVisasInput,
  options: FillFranceVisasOptions = {},
): Promise<FillFranceVisasResult> {
  const runId = options.runId;
  const stepTimeoutMs = options.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const stepsCompleted: FvPageId[] = [];
  let session: FvSessionHandles | null = null;
  let currentStep: FvPageId | "unknown" = "unknown";

  try {
    // ── Sign in ───────────────────────────────────────────────────────────
    session = await signInWithPassword(input.credentials, {
      headless: options.headless ?? true,
      runId,
    });
    await options.onOfficialPortalOpened?.({ url: session.page.url() });

    // ── Start a fresh application ────────────────────────────────────────
    await startNewApplication(session.page, { timeoutMs: stepTimeoutMs });
    currentStep = "step1";

    // ── Step 1 — Your plans ──────────────────────────────────────────────
    await fillStep1(session.page, input.answers.step1);
    await advanceStep(session.page, "step1", "step2", stepTimeoutMs);
    stepsCompleted.push("step1");
    currentStep = "step2";

    // ── Step 2 — Your information ────────────────────────────────────────
    await fillStep2(session.page, input.answers.step2);
    await advanceStep(session.page, "step2", "step3", stepTimeoutMs);
    stepsCompleted.push("step2");
    currentStep = "step3";

    // ── Step 3 — Your last visa ──────────────────────────────────────────
    await fillStep3(session.page, input.answers.step3);
    await advanceStep(session.page, "step3", "step4", stepTimeoutMs);
    stepsCompleted.push("step3");
    currentStep = "step4";

    // ── Step 4 — Your stay ───────────────────────────────────────────────
    await fillStep4(session.page, input.answers.step4);
    await advanceStep(session.page, "step4", "step5", stepTimeoutMs);
    stepsCompleted.push("step4");
    currentStep = "step5";

    // ── Step 5 — Your contacts ───────────────────────────────────────────
    await fillStep5(session.page, input.answers.step5);
    await advanceStep(session.page, "step5", "step6", stepTimeoutMs);
    stepsCompleted.push("step5");
    currentStep = "step6";

    // ── Step 6 — Supporting documents (informational, "Continue") ────────
    // Step 6 is informational with no fillable fields; just advance via the
    // localized "Continue" button. Use the same polling loop in case an
    // interstitial appears.
    await advanceStep(session.page, "step6", "accueil", stepTimeoutMs);
    stepsCompleted.push("step6");

    const landed = await detectPage(session.page);
    const draftReference = await captureLatestApplicationReference(session.page);

    // ── Finalize + download PDF (optional but on by default) ────────────
    let applicationReference: string | null = null;
    let pdfPath: string | null = null;
    if (options.finalize !== false) {
      currentStep = "accueil";
      const finalized = await finalizeAndDownloadPdf(session.page, {
        outputDir: options.pdfOutputDir,
        timeoutMs: stepTimeoutMs,
        draftReference: draftReference ?? undefined,
      });
      applicationReference = finalized.applicationReference;
      pdfPath = finalized.pdfPath;
    }

    return {
      status: "prefilled",
      runId,
      landedOn: landed.id,
      stepsCompleted,
      draftReference,
      applicationReference,
      pdfPath,
    };
  } catch (err) {
    const url = session?.page.url() ?? "";
    let validationMessages: string[] = [];
    if (session) {
      try {
        const report = await readValidationMessages(session.page);
        validationMessages = report.all;
      } catch {
        // best-effort
      }
    }
    return {
      status: "failed",
      runId,
      failedStep: currentStep,
      validationMessages,
      error: serializeError(err),
      url,
    };
  } finally {
    if (session) {
      await session.close().catch(() => undefined);
    }
  }
}

/**
 * Drive forward from `from` to `to` until either the destination page is
 * reached or the timeout expires. France-Visas advance flows have several
 * shapes that a fixed click sequence can't cover reliably:
 *
 *   - Plain step (2→3, 3→4, 4→5, 5→6): single Next click.
 *   - Step 1: Verify → wait for eligibility → Next → Yes/No modal → step 2.
 *   - Step 6: Continue (sometimes followed by an interstitial).
 *
 * A polling loop that, on each tick, (1) clicks any visible advance-button
 * AND (2) clicks any visible confirmation-Yes converges on the target
 * without per-step branching, and survives the modal/eligibility races.
 */
async function advanceStep(
  page: Page,
  from: FvPageId,
  to: FvPageId,
  timeoutMs: number,
): Promise<void> {
  void from;
  const deadline = Date.now() + timeoutMs;
  const tickIntervalMs = 1500;

  while (Date.now() < deadline) {
    const probe = await detectPage(page);
    if (probe.id === to) return;
    if (probe.id === "session_expired") {
      throw new NavigationError("Session expired during advance", {
        expected: to,
        detected: "session_expired",
        url: probe.url,
      });
    }

    // Try a confirmation-Yes click first — if a modal is open it must be
    // dismissed before any other button receives focus.
    const clickedYes = await clickIfVisible(page, /^(yes|oui)$/i);
    if (!clickedYes) {
      await clickIfVisible(page, /^(next|suivant|verify|vérifier|continue|continuer)$/i);
    }

    await page.waitForTimeout(tickIntervalMs);
  }

  // Final identity check before throwing — gives the page a last beat to
  // settle if the navigation fired right at the deadline.
  await waitForPage(page, to, { timeoutMs: 5_000 });
}

async function clickIfVisible(page: Page, labelPattern: RegExp): Promise<boolean> {
  const source = labelPattern.source;
  const flags = labelPattern.flags;
  return page.evaluate(`(() => {
      const source = ${JSON.stringify(source)};
      const flags = ${JSON.stringify(flags)};
      const re = new RegExp(source, flags);
      const visible = (e) => e.offsetParent !== null;
      const label = (b) => ((b.value || b.textContent || "") + "").trim();
      const btn = Array.from(
        document.querySelectorAll('button, input[type="submit"]'),
      )
        .filter(visible)
        .find((b) => re.test(label(b)));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
}

/**
 * Click whichever advance-button is visible on the current step: "Next",
 * "Verify" (step 1 eligibility), "Suivant" (FR), or "Continue" (step 6).
 */
async function clickAdvanceButton(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    const btn = Array.from(
      document.querySelectorAll('button, input[type="submit"]'),
    )
      .filter((b) => b.offsetParent !== null)
      .find((b) => {
        const label = (
          b.value ||
          b.textContent ||
          ""
        )
          .trim()
          .toLowerCase();
        return (
          label === "next" ||
          label === "suivant" ||
          label === "verify" ||
          label === "vérifier" ||
          label === "continue" ||
          label === "continuer"
        );
      });
    if (btn) btn.click();
  })()`);
  await waitForJsfIdle(page);
}

/**
 * If a Yes/No confirmation dialog appeared (observed after step 1 "Next"),
 * click Yes. No-op when no dialog is visible.
 */
async function confirmModalIfPresent(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    const yes = Array.from(
      document.querySelectorAll('button, input[type="submit"]'),
    )
      .filter((b) => b.offsetParent !== null)
      .find((b) => {
        const label = (
          b.value ||
          b.textContent ||
          ""
        ).trim();
        return /^(yes|oui)$/i.test(label);
      });
    if (yes) yes.click();
  })()`);
  await waitForJsfIdle(page);
}

/**
 * On the accueil dashboard, France-Visas renders the application reference
 * (e.g. "2026705103880") inside the applications table/list. We scan the
 * visible DOM for the 13-digit reference pattern and return the first match
 * — callers submitting a fresh draft will see exactly one row, so "first"
 * is also "latest".
 *
 * Returns null if no reference is found (e.g. the list didn't render in
 * time). Non-fatal — the run is still successful without it.
 */
async function captureLatestApplicationReference(page: Page): Promise<string | null> {
  return page.evaluate(`(() => {
    const text = document.body?.innerText ?? "";
    const match = text.match(/\b(202\d{10,12})\b/);
    return match ? match[1] : null;
  })()`);
}
