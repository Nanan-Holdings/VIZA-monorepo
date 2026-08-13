/**
 * Structured errors for Taiwan Online Entry Permit automation
 * (旅居海外大陸地區人民申請來臺觀光入境許可).
 *
 * Mirrors src/uk/errors.ts so the worker loop, alerting, and retry policy
 * can branch on failure class without string-matching messages.
 */

export type TwErrorCode =
  | "UNEXPECTED_PAGE"
  | "NAVIGATION_FAILED"
  | "SESSION_BOOTSTRAP_FAILED"
  | "GATE_DETECTED"
  | "TERMS_MODAL_FAILED"
  | "OFFICIAL_LOGIN_NOT_CONFIGURED"
  | "OFFICIAL_LOGIN_FAILED"
  | "EMAIL_VERIFICATION_FAILED"
  | "FIELD_NOT_MAPPED"
  | "WIDGET_FILL_FAILED"
  | "FIELD_VERIFICATION_FAILED"
  | "FILE_UPLOAD_FAILED"
  | "VALIDATION_FAILED"
  | "DUPLICATE_RUN_BLOCKED"
  | "NORMALIZATION_FAILED";

export interface TwErrorContext {
  url?: string;
  /** Field name (from the seed contract) that triggered FIELD_NOT_MAPPED / WIDGET_FILL_FAILED. */
  fieldName?: string;
  details?: Record<string, unknown>;
}

export class TwError extends Error {
  readonly code: TwErrorCode;
  readonly context: TwErrorContext;

  constructor(code: TwErrorCode, message: string, context: TwErrorContext = {}) {
    super(message);
    this.name = "TwError";
    this.code = code;
    this.context = context;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, context: this.context };
  }
}

export class TwUnexpectedPageError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("UNEXPECTED_PAGE", message, context);
    this.name = "TwUnexpectedPageError";
  }
}

export class TwNavigationError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("NAVIGATION_FAILED", message, context);
    this.name = "TwNavigationError";
  }
}

export class TwSessionBootstrapError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("SESSION_BOOTSTRAP_FAILED", message, context);
    this.name = "TwSessionBootstrapError";
  }
}

export class TwGateDetectedError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("GATE_DETECTED", message, context);
    this.name = "TwGateDetectedError";
  }
}

/** Raised when the "移民署同意條款" entry modal can't be accepted (checkbox
 *  or 確定 button not found/clickable) — distinct from a generic unexpected
 *  page so the operator immediately knows this is the very first gate. */
export class TwTermsModalError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("TERMS_MODAL_FAILED", message, context);
    this.name = "TwTermsModalError";
  }
}

export class TwOfficialLoginConfigurationError extends TwError {
  constructor(message = "TW official login provider is not configured", context: TwErrorContext = {}) {
    super("OFFICIAL_LOGIN_NOT_CONFIGURED", message, context);
    this.name = "TwOfficialLoginConfigurationError";
  }
}

export class TwOfficialLoginError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("OFFICIAL_LOGIN_FAILED", message, context);
    this.name = "TwOfficialLoginError";
  }
}

/** Raised when the `/apply/verify` email-OTP step can't be completed
 *  (send-code failed, inbox timeout, code not extractable, or the portal
 *  never flips to "xxx@gmail.com 已認證"). */
export class TwEmailVerificationError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("EMAIL_VERIFICATION_FAILED", message, context);
    this.name = "TwEmailVerificationError";
  }
}

/** Raised when the worker is asked to fill a field with no entry in the
 *  seed contract (viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts). */
export class TwFieldNotMappedError extends TwError {
  constructor(fieldName: string, context: TwErrorContext = {}) {
    super(
      "FIELD_NOT_MAPPED",
      `No TW field definition for "${fieldName}". Add it to the seed contract and src/tw/apply.ts.`,
      { ...context, fieldName },
    );
    this.name = "TwFieldNotMappedError";
  }
}

export class TwWidgetFillError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("WIDGET_FILL_FAILED", message, context);
    this.name = "TwWidgetFillError";
  }
}

export class TwFieldVerificationError extends TwError {
  constructor(fieldName: string, reason: string, context: TwErrorContext = {}) {
    super("FIELD_VERIFICATION_FAILED", `TW field verification failed for "${fieldName}": ${reason}`, {
      ...context,
      fieldName,
    });
    this.name = "TwFieldVerificationError";
  }
}

export class TwFileUploadError extends TwError {
  constructor(fieldName: string, reason: string, context: TwErrorContext = {}) {
    super("FILE_UPLOAD_FAILED", `TW file upload verification failed for "${fieldName}": ${reason}`, {
      ...context,
      fieldName,
    });
    this.name = "TwFileUploadError";
  }
}

export class TwOfficialValidationError extends TwError {
  readonly validationKeys: string[];

  constructor(validationKeys: string[], context: TwErrorContext = {}) {
    const keys = [...new Set(validationKeys.filter(Boolean))].slice(0, 50);
    super(
      "VALIDATION_FAILED",
      `Taiwan official form validation failed${keys.length ? ` (${keys.join(",")})` : ""}`,
      { ...context, details: { ...context.details, validationKeys: keys } },
    );
    this.name = "TwOfficialValidationError";
    this.validationKeys = keys;
  }
}

export class TwDuplicateRunError extends TwError {
  constructor(message: string, context: TwErrorContext = {}) {
    super("DUPLICATE_RUN_BLOCKED", message, context);
    this.name = "TwDuplicateRunError";
  }
}

/** Raised by normalizeTwAnswers when a present answer value can't be
 *  confidently translated into the seed wire-shape the fillers consume
 *  (e.g. an unrecognized enum, or a required identity field is missing).
 *  Mirrors UkNormalizationError so runTwHalt can map it to NeedsHumanError
 *  rather than submit garbage to a real government portal. */
export class TwNormalizationError extends TwError {
  readonly field: string;
  constructor(field: string, message: string, context: TwErrorContext = {}) {
    super("NORMALIZATION_FAILED", `[${field}] ${message}`, { ...context, fieldName: field });
    this.name = "TwNormalizationError";
    this.field = field;
  }
}

export function isTwGateError(err: unknown): err is TwGateDetectedError {
  return err instanceof TwGateDetectedError;
}

export function serializeTwError(err: unknown): Record<string, unknown> {
  if (err instanceof TwError) return err.toJSON();
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { message: String(err) };
}
