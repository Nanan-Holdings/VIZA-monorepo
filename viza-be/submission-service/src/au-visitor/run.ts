/**
 * Top-level entry point for the Subclass 600 prefill assistant. Drives
 * the full pipeline:
 *
 *   1. Bootstrap stealth-patched Chromium (handled by the caller via
 *      `viza-be/submission-service/src/stealth-browser.ts`).
 *   2. Login to ImmiAccount (username + password + TOTP MFA).
 *   3. Open a fresh "Visitor Visa (600)" application or resume by TRN.
 *   4. Walk all 20 form pages, filling answers from the normalised
 *      answer map. Stop on the Review page.
 *   5. Capture the TRN + a screenshot of the Review page for the
 *      submission-queue artifact.
 *
 * Mirrors the shape of `france-visas/run.ts` and `ceac/orchestrator.ts`
 * so the queue worker can dispatch all three flows through one
 * polymorphic interface.
 */

import type { BrowserContext } from "playwright";
import { loginToImmiAccount, resumeApplicationByTrn, startNewVisitor600Application } from "./session";
import type { AuLoginCredentials } from "./session";
import { runVisitor600Application } from "./orchestrator";
import type { RunOptions, RunResult } from "./orchestrator";
import { isLikelyIneligibleForSubclass600, normalize } from "./normalize";
import type { AnswerMap } from "./normalize";
import { NationalityIneligibleError, serializeError } from "./errors";

export interface FillVisitor600Args {
  context: BrowserContext;
  credentials: AuLoginCredentials;
  /** Seed-schema answer map keyed by `AU_VISITOR_600` field names. */
  answers: AnswerMap;
  /** Optional TRN if resuming an existing draft. */
  resumeTrn?: string | null;
  /** Run options forwarded to the orchestrator. */
  options?: RunOptions;
}

export interface FillVisitor600Result {
  outcome: "review_reached" | "stopped_early" | "failed";
  result: RunResult | null;
  error: Record<string, unknown> | null;
}

export async function fillVisitor600Application(
  args: FillVisitor600Args,
): Promise<FillVisitor600Result> {
  const { context, credentials, answers, resumeTrn, options } = args;

  const passportCountry = answers.passport_country_of_issue as string | undefined;
  if (!resumeTrn && isLikelyIneligibleForSubclass600(passportCountry)) {
    const err = new NationalityIneligibleError(
      `Passport country ${passportCountry} is eligible for eVisitor 651 / ETA 601 — submitting to Subclass 600 will be rejected.`,
      { details: { passportCountry } },
    );
    return { outcome: "failed", result: null, error: serializeError(err) };
  }

  try {
    const { page } = await loginToImmiAccount(context, credentials);
    if (resumeTrn) {
      await resumeApplicationByTrn(page, resumeTrn);
    } else {
      await startNewVisitor600Application(page);
    }

    const normalised = normalize(answers);
    const result = await runVisitor600Application(page, normalised, options ?? {});

    if (result.reachedPage === "review_page" || result.reachedPage === "payment") {
      return { outcome: "review_reached", result, error: null };
    }
    return { outcome: "stopped_early", result, error: null };
  } catch (err) {
    return { outcome: "failed", result: null, error: serializeError(err) };
  }
}

export { runVisitor600Application } from "./orchestrator";
export { loginToImmiAccount, startNewVisitor600Application, resumeApplicationByTrn, URLS } from "./session";
export { normalize, formatAuDate, digitsOnly, isLikelyIneligibleForSubclass600 } from "./normalize";
export type { AnswerMap } from "./normalize";
export type { AuPageId } from "./pages";
export type { RunOptions, RunResult } from "./orchestrator";
export {
  AuError,
  NationalityIneligibleError,
  MfaRequiredError,
  SessionExpiredError,
  ValidationFailedError,
  serializeError,
} from "./errors";
