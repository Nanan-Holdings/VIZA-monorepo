/**
 * Shared runner-dispatch types + error classes (QUE-001).
 *
 * This is a LEAF module — it imports nothing from the runner graph, so
 * per-country runners can import the error classes / DispatchOutcome from
 * here without creating an import cycle with dispatch.ts (which imports
 * every runner). dispatch.ts re-exports these for back-compat.
 */

/** Thrown when no runner is wired for a country — worker dead-letters. */
export class UnsupportedCountryError extends Error {
  constructor(public readonly country: string) {
    super(`No runner implemented for country '${country}'`);
    this.name = "UnsupportedCountryError";
  }
}

/** Retryable portal failure (blocked / anti-bot). Worker retries to max_attempts. */
export class RetryableRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableRunnerError";
  }
}

/** Applicant intervention required (e.g. bad credentials, manual review). */
export class NeedsHumanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedsHumanError";
  }
}

export interface DispatchOutcome {
  outcome: "halted_before_pay" | "submitted_pending_pay" | "paper_ready";
  reachedStep: string;
  artefacts: string[];
}

export type RunOne = (applicationId: string, jobId?: string) => Promise<DispatchOutcome>;
