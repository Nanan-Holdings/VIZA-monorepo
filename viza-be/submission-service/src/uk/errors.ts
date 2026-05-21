/**
 * Structured errors for UK Standard Visitor automation.
 *
 * Mirrors the CEAC error system so the worker loop, alerting, and retry
 * policy can branch on failure class without string-matching messages.
 */

import type { UkPageId } from "./pages";

export type UkErrorCode =
  | "UNEXPECTED_PAGE"
  | "SESSION_EXPIRED"
  | "NAVIGATION_FAILED"
  | "VALIDATION_FAILED"
  | "SESSION_BOOTSTRAP_FAILED"
  | "GATE_DETECTED"
  | "FIELD_NOT_MAPPED"
  | "WIDGET_FILL_FAILED";

export interface UkErrorContext {
  expected?: UkPageId | UkPageId[];
  detected?: UkPageId | "unknown";
  url?: string;
  /** Per-field validation messages surfaced by govuk-frontend error summary. */
  validationMessages?: string[];
  /** Field name (from seed) that triggered FIELD_NOT_MAPPED / WIDGET_FILL_FAILED. */
  fieldName?: string;
  details?: Record<string, unknown>;
}

export class UkError extends Error {
  readonly code: UkErrorCode;
  readonly context: UkErrorContext;

  constructor(code: UkErrorCode, message: string, context: UkErrorContext = {}) {
    super(message);
    this.name = "UkError";
    this.code = code;
    this.context = context;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, context: this.context };
  }
}

export class UkUnexpectedPageError extends UkError {
  constructor(message: string, context: UkErrorContext) {
    super("UNEXPECTED_PAGE", message, context);
    this.name = "UkUnexpectedPageError";
  }
}

export class UkSessionExpiredError extends UkError {
  constructor(message: string, context: UkErrorContext = {}) {
    super("SESSION_EXPIRED", message, context);
    this.name = "UkSessionExpiredError";
  }
}

export class UkNavigationError extends UkError {
  constructor(message: string, context: UkErrorContext = {}) {
    super("NAVIGATION_FAILED", message, context);
    this.name = "UkNavigationError";
  }
}

export class UkValidationError extends UkError {
  constructor(message: string, context: UkErrorContext = {}) {
    super("VALIDATION_FAILED", message, context);
    this.name = "UkValidationError";
  }
}

export class UkSessionBootstrapError extends UkError {
  constructor(message: string, context: UkErrorContext = {}) {
    super("SESSION_BOOTSTRAP_FAILED", message, context);
    this.name = "UkSessionBootstrapError";
  }
}

export class UkGateDetectedError extends UkError {
  constructor(message: string, context: UkErrorContext = {}) {
    super("GATE_DETECTED", message, context);
    this.name = "UkGateDetectedError";
  }
}

/** Raised when the worker is asked to fill a field that has no entry in
 *  UK_FIELD_DEFINITIONS. Distinct from WIDGET_FILL_FAILED so the
 *  operator can immediately tell "we need to extend the mapping" vs
 *  "the selector is wrong / page changed". */
export class UkFieldNotMappedError extends UkError {
  constructor(fieldName: string, context: UkErrorContext = {}) {
    super(
      "FIELD_NOT_MAPPED",
      `No UK field definition for "${fieldName}". Add it to UK_FIELD_DEFINITIONS in field-mappings.ts.`,
      { ...context, fieldName },
    );
    this.name = "UkFieldNotMappedError";
  }
}

export class UkWidgetFillError extends UkError {
  constructor(message: string, context: UkErrorContext = {}) {
    super("WIDGET_FILL_FAILED", message, context);
    this.name = "UkWidgetFillError";
  }
}

export function isUkGateError(err: unknown): err is UkGateDetectedError {
  return err instanceof UkGateDetectedError;
}

export function serializeUkError(err: unknown): Record<string, unknown> {
  if (err instanceof UkError) return err.toJSON();
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { message: String(err) };
}
