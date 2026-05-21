/**
 * Structured errors for Australia Subclass 600 ImmiAccount automation.
 *
 * Shape parallels france-visas/errors.ts and ceac/errors.ts so alerting,
 * retry policy, and dashboards can treat all three submission flows
 * through a single taxonomy.
 */

import type { AuPageId } from "./pages";

export type AuErrorCode =
  | "UNEXPECTED_PAGE"
  | "SESSION_EXPIRED"
  | "NAVIGATION_FAILED"
  | "VALIDATION_FAILED"
  | "SESSION_BOOTSTRAP_FAILED"
  | "MFA_REQUIRED"
  | "NATIONALITY_INELIGIBLE"
  | "GATE_DETECTED";

export interface AuErrorContext {
  expected?: AuPageId | AuPageId[];
  detected?: AuPageId | "unknown";
  url?: string;
  validationMessages?: string[];
  details?: Record<string, unknown>;
}

export class AuError extends Error {
  readonly code: AuErrorCode;
  readonly context: AuErrorContext;

  constructor(code: AuErrorCode, message: string, context: AuErrorContext = {}) {
    super(message);
    this.name = "AuError";
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

export class UnexpectedPageError extends AuError {
  constructor(message: string, context: AuErrorContext) {
    super("UNEXPECTED_PAGE", message, context);
    this.name = "AuUnexpectedPageError";
  }
}

export class SessionExpiredError extends AuError {
  constructor(message: string, context: AuErrorContext = {}) {
    super("SESSION_EXPIRED", message, context);
    this.name = "AuSessionExpiredError";
  }
}

export class NavigationError extends AuError {
  constructor(message: string, context: AuErrorContext = {}) {
    super("NAVIGATION_FAILED", message, context);
    this.name = "AuNavigationError";
  }
}

export class ValidationFailedError extends AuError {
  constructor(message: string, context: AuErrorContext) {
    super("VALIDATION_FAILED", message, context);
    this.name = "AuValidationFailedError";
  }
}

export class SessionBootstrapError extends AuError {
  constructor(message: string, context: AuErrorContext = {}) {
    super("SESSION_BOOTSTRAP_FAILED", message, context);
    this.name = "AuSessionBootstrapError";
  }
}

export class MfaRequiredError extends AuError {
  constructor(message: string, context: AuErrorContext = {}) {
    super("MFA_REQUIRED", message, context);
    this.name = "AuMfaRequiredError";
  }
}

/**
 * Subclass 600 enforces a server-side passport-country eligibility
 * check at the critical-data confirmation step. Submitting a
 * 651-eligible (eVisitor) or 601-eligible (ETA) passport country is
 * rejected with: "Based on the passport details, ... is not eligible
 * to apply using this online service."
 */
export class NationalityIneligibleError extends AuError {
  constructor(message: string, context: AuErrorContext = {}) {
    super("NATIONALITY_INELIGIBLE", message, context);
    this.name = "AuNationalityIneligibleError";
  }
}

export class GateDetectedError extends AuError {
  constructor(message: string, context: AuErrorContext = {}) {
    super("GATE_DETECTED", message, context);
    this.name = "AuGateDetectedError";
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
