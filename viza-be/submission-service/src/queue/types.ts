/**
 * Shared runner-dispatch types + error classes (QUE-001).
 *
 * This is a LEAF module — it imports nothing from the runner graph, so
 * per-country runners can import the error classes / DispatchOutcome from
 * here without creating an import cycle with dispatch.ts (which imports
 * every runner). dispatch.ts re-exports these for back-compat.
 */
import type { RunnerExecutionContext } from "./execution-context.js";

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

const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'`]+/giu;
const MAX_RUNNER_ERROR_NAME_LENGTH = 120;
const MAX_RUNNER_ERROR_MESSAGE_LENGTH = 2_000;

/**
 * Remove every HTTP(S) destination from runner errors before they cross a
 * logging, database, or alert boundary. Hosts are intentionally omitted too:
 * an untrusted host can itself contain applicant data or a secret subdomain.
 */
export function redactRunnerErrorUrls(value: string): string {
  return value.replace(HTTP_URL_PATTERN, "[redacted-url]");
}

export interface SanitizedRunnerError {
  name: string;
  message: string;
  summary: string;
}

/** Return a bounded, stack-free error description safe for persistence/logs. */
export function sanitizeRunnerError(error: unknown): SanitizedRunnerError {
  let rawName = "Error";
  let rawMessage: string;
  if (error instanceof Error) {
    rawName = error.name || "Error";
    rawMessage = error.message;
  } else {
    try {
      rawMessage = String(error);
    } catch {
      rawMessage = "Unknown runner error";
    }
  }

  const name = redactRunnerErrorUrls(rawName)
    .slice(0, MAX_RUNNER_ERROR_NAME_LENGTH)
    .trim() || "Error";
  const message = redactRunnerErrorUrls(rawMessage)
    .slice(0, MAX_RUNNER_ERROR_MESSAGE_LENGTH)
    .trim() || "Unknown runner error";
  return { name, message, summary: `${name}: ${message}` };
}

export interface DispatchOutcome {
  outcome: "halted_before_pay" | "submitted_pending_pay" | "paper_ready";
  reachedStep: string;
  artefacts: string[];
}

export type RunOne = (
  applicationId: string,
  jobId?: string,
  execution?: RunnerExecutionContext,
) => Promise<DispatchOutcome>;
