/**
 * Structured errors for the Italy-VFS-CN corridor.
 *
 * Shape parallels ceac/errors.ts and france-visas/errors.ts so alerting,
 * retry policy, and dashboards can treat all submission flows through a
 * single taxonomy. Translates to queue-item statuses
 * (`it_blocked` vs `it_prefill_failed`) once the dispatcher is wired.
 */

import type { ItVfsPageId } from "./pages";

export type ItVfsErrorCode =
  | "UNEXPECTED_PAGE"
  | "SESSION_EXPIRED"
  | "NAVIGATION_FAILED"
  | "VALIDATION_FAILED"
  | "SESSION_BOOTSTRAP_FAILED"
  | "GATE_DETECTED"
  | "LOGIN_FAILED"
  | "CORRIDOR_INELIGIBLE";

export interface ItVfsErrorContext {
  expected?: ItVfsPageId | ItVfsPageId[];
  detected?: ItVfsPageId | "unknown";
  url?: string;
  validationMessages?: string[];
  details?: Record<string, unknown>;
}

export class ItVfsError extends Error {
  readonly code: ItVfsErrorCode;
  readonly context: ItVfsErrorContext;

  constructor(code: ItVfsErrorCode, message: string, context: ItVfsErrorContext = {}) {
    super(message);
    this.name = "ItVfsError";
    this.code = code;
    this.context = context;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

export class UnexpectedPageError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext) {
    super("UNEXPECTED_PAGE", message, context);
    this.name = "ItVfsUnexpectedPageError";
  }
}

export class SessionExpiredError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext = {}) {
    super("SESSION_EXPIRED", message, context);
    this.name = "ItVfsSessionExpiredError";
  }
}

export class NavigationError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext = {}) {
    super("NAVIGATION_FAILED", message, context);
    this.name = "ItVfsNavigationError";
  }
}

export class ValidationFailedError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext) {
    super("VALIDATION_FAILED", message, context);
    this.name = "ItVfsValidationFailedError";
  }
}

export class SessionBootstrapError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext = {}) {
    super("SESSION_BOOTSTRAP_FAILED", message, context);
    this.name = "ItVfsSessionBootstrapError";
  }
}

export class GateDetectedError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext = {}) {
    super("GATE_DETECTED", message, context);
    this.name = "ItVfsGateDetectedError";
  }
}

export class LoginFailedError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext = {}) {
    super("LOGIN_FAILED", message, context);
    this.name = "ItVfsLoginFailedError";
  }
}

/**
 * Pre-flight: applicant residency or destination doesn't fit the China-Italy
 * corridor (e.g. residency != CN, or destination != IT). Caller should route
 * to a different corridor adapter rather than retrying.
 */
export class CorridorIneligibleError extends ItVfsError {
  constructor(message: string, context: ItVfsErrorContext = {}) {
    super("CORRIDOR_INELIGIBLE", message, context);
    this.name = "ItVfsCorridorIneligibleError";
  }
}

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
