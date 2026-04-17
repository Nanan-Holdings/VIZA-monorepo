/**
 * Structured errors for CEAC DS-160 automation.
 *
 * Every unexpected CEAC state should throw one of these instead of a generic
 * Error so callers (worker loop, alerting, retry policy) can branch on the
 * failure class without string-matching.
 */

import type { CeacPageId } from "./pages";

export type CeacErrorCode =
  | "UNEXPECTED_PAGE"
  | "SESSION_EXPIRED"
  | "NAVIGATION_FAILED"
  | "VALIDATION_FAILED"
  | "SESSION_BOOTSTRAP_FAILED";

export interface CeacErrorContext {
  /** The page identity the worker expected to be on. */
  expected?: CeacPageId | CeacPageId[];
  /** The page identity the worker actually detected (if any). */
  detected?: CeacPageId | "unknown";
  /** Current URL when the error was raised. */
  url?: string;
  /** Inline validation messages surfaced by CEAC, when applicable. */
  validationMessages?: string[];
  /** Arbitrary diagnostic details. */
  details?: Record<string, unknown>;
}

/**
 * Base class for all CEAC automation errors. Always include a `code` and a
 * `context` so logs and alerts can be structured consistently.
 */
export class CeacError extends Error {
  readonly code: CeacErrorCode;
  readonly context: CeacErrorContext;

  constructor(code: CeacErrorCode, message: string, context: CeacErrorContext = {}) {
    super(message);
    this.name = "CeacError";
    this.code = code;
    this.context = context;
  }

  /**
   * Serialize for structured logging. Avoids leaking the Node stack by default.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Raised when a page identity check fails — e.g. after clicking Next we
 * expected to be on "Travel Information" but detected "Personal Information 1".
 */
export class UnexpectedPageError extends CeacError {
  constructor(message: string, context: CeacErrorContext) {
    super("UNEXPECTED_PAGE", message, context);
    this.name = "UnexpectedPageError";
  }
}

/**
 * Raised when the CEAC session has expired (e.g. the 20-minute inactivity
 * timeout) and the worker lands back on the Default / session-expired page.
 */
export class SessionExpiredError extends CeacError {
  constructor(message: string, context: CeacErrorContext = {}) {
    super("SESSION_EXPIRED", message, context);
    this.name = "SessionExpiredError";
  }
}

/**
 * Raised when a navigation attempt (Next / back / jump) does not produce a
 * new page load within the expected budget, or when the destination page
 * identity does not match.
 */
export class NavigationError extends CeacError {
  constructor(message: string, context: CeacErrorContext = {}) {
    super("NAVIGATION_FAILED", message, context);
    this.name = "NavigationError";
  }
}

/**
 * Raised when CEAC rejects a page submission with validation errors and the
 * worker stays on the same page. `context.validationMessages` carries the
 * inline messages surfaced by CEAC.
 */
export class ValidationFailedError extends CeacError {
  constructor(message: string, context: CeacErrorContext) {
    super("VALIDATION_FAILED", message, context);
    this.name = "ValidationFailedError";
  }
}

/**
 * Raised when the initial session bootstrap fails — e.g. the start page never
 * loads, the embassy selector is missing, or CAPTCHA shows up before the
 * worker can proceed.
 */
export class SessionBootstrapError extends CeacError {
  constructor(message: string, context: CeacErrorContext = {}) {
    super("SESSION_BOOTSTRAP_FAILED", message, context);
    this.name = "SessionBootstrapError";
  }
}

/**
 * Shape-preserving serialization of an unknown error value for structured
 * logging and diagnostic payloads.
 *
 * Used on failure paths (see `preserveRecoveryOnFailure`, failure diagnostics
 * in `diagnostics.ts`) so the same error contract lands in every artifact.
 * Never throws — a garbage input returns a stringified `raw` field.
 */
export function serializeError(err: unknown): Record<string, unknown> | null {
  if (err === undefined || err === null) return null;
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    const code = (err as { code?: unknown }).code;
    if (code !== undefined) out.code = code;
    const context = (err as { context?: unknown }).context;
    if (context !== undefined) out.context = context;
    return out;
  }
  return { raw: String(err) };
}
