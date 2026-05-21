/**
 * Structured errors for France-Visas automation.
 *
 * Shape parallels ceac/errors.ts so alerting, retry policy, and dashboards
 * can treat both submission flows through a single taxonomy.
 */

import type { FvPageId } from "./pages";

export type FvErrorCode =
  | "UNEXPECTED_PAGE"
  | "SESSION_EXPIRED"
  | "NAVIGATION_FAILED"
  | "VALIDATION_FAILED"
  | "SESSION_BOOTSTRAP_FAILED"
  | "REGISTRATION_FAILED"
  | "INBOX_TIMEOUT"
  | "GATE_DETECTED";

export interface FvErrorContext {
  expected?: FvPageId | FvPageId[];
  detected?: FvPageId | "unknown";
  url?: string;
  validationMessages?: string[];
  details?: Record<string, unknown>;
}

export class FvError extends Error {
  readonly code: FvErrorCode;
  readonly context: FvErrorContext;

  constructor(code: FvErrorCode, message: string, context: FvErrorContext = {}) {
    super(message);
    this.name = "FvError";
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

export class UnexpectedPageError extends FvError {
  constructor(message: string, context: FvErrorContext) {
    super("UNEXPECTED_PAGE", message, context);
    this.name = "FvUnexpectedPageError";
  }
}

export class SessionExpiredError extends FvError {
  constructor(message: string, context: FvErrorContext = {}) {
    super("SESSION_EXPIRED", message, context);
    this.name = "FvSessionExpiredError";
  }
}

export class NavigationError extends FvError {
  constructor(message: string, context: FvErrorContext = {}) {
    super("NAVIGATION_FAILED", message, context);
    this.name = "FvNavigationError";
  }
}

export class ValidationFailedError extends FvError {
  constructor(message: string, context: FvErrorContext) {
    super("VALIDATION_FAILED", message, context);
    this.name = "FvValidationFailedError";
  }
}

export class SessionBootstrapError extends FvError {
  constructor(message: string, context: FvErrorContext = {}) {
    super("SESSION_BOOTSTRAP_FAILED", message, context);
    this.name = "FvSessionBootstrapError";
  }
}

export class RegistrationFailedError extends FvError {
  constructor(message: string, context: FvErrorContext = {}) {
    super("REGISTRATION_FAILED", message, context);
    this.name = "FvRegistrationFailedError";
  }
}

export class InboxTimeoutError extends FvError {
  constructor(message: string, context: FvErrorContext = {}) {
    super("INBOX_TIMEOUT", message, context);
    this.name = "FvInboxTimeoutError";
  }
}

export class GateDetectedError extends FvError {
  constructor(message: string, context: FvErrorContext = {}) {
    super("GATE_DETECTED", message, context);
    this.name = "FvGateDetectedError";
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
