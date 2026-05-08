/**
 * Per-page error catalog for Australia Subclass 600 runner (AUTO-AU-02).
 * Mirrors the KH/LA/LK/ZA/IN shape with `au.*` codes.
 */

export type AuErrorCode =
  | "au.anti_bot.cloudflare"
  | "au.anti_bot.ratelimit"
  | "au.auth.invalid_credentials"
  | "au.auth.account_locked"
  | "au.validation.passport_invalid"
  | "au.validation.nationality_unsupported"
  | "au.validation.payment_declined"
  | "au.session.expired"
  | "au.portal.unreachable"
  | "au.portal.maintenance"
  | "au.unknown_state";

export interface AuRunnerError {
  code: AuErrorCode;
  message: string;
  disposition: "retry" | "human" | "fail";
}

const CATALOG: Record<AuErrorCode, { disposition: AuRunnerError["disposition"] }> = {
  "au.anti_bot.cloudflare": { disposition: "human" },
  "au.anti_bot.ratelimit": { disposition: "retry" },
  "au.auth.invalid_credentials": { disposition: "human" },
  "au.auth.account_locked": { disposition: "human" },
  "au.validation.passport_invalid": { disposition: "fail" },
  "au.validation.nationality_unsupported": { disposition: "fail" },
  "au.validation.payment_declined": { disposition: "human" },
  "au.session.expired": { disposition: "retry" },
  "au.portal.unreachable": { disposition: "retry" },
  "au.portal.maintenance": { disposition: "retry" },
  "au.unknown_state": { disposition: "human" },
};

export function makeAuError(code: AuErrorCode, message: string): AuRunnerError {
  return { code, message, disposition: CATALOG[code].disposition };
}

export interface PageHints {
  title: string;
  bodyText: string;
  httpStatus?: number;
}

export function classifyPage(hints: PageHints): AuRunnerError | null {
  const t = hints.title.toLowerCase();
  const b = hints.bodyText.toLowerCase();
  if (t.includes("just a moment") || b.includes("checking your browser")) {
    return makeAuError("au.anti_bot.cloudflare", "Cloudflare interstitial");
  }
  if (b.includes("too many requests") || hints.httpStatus === 429) {
    return makeAuError("au.anti_bot.ratelimit", "Rate-limited");
  }
  if (b.includes("invalid username or password") || b.includes("login details are incorrect")) {
    return makeAuError("au.auth.invalid_credentials", "ImmiAccount login rejected");
  }
  if (b.includes("account has been locked")) {
    return makeAuError("au.auth.account_locked", "ImmiAccount locked");
  }
  if (b.includes("session has expired") || b.includes("session expired")) {
    return makeAuError("au.session.expired", "Session expired");
  }
  if (b.includes("invalid passport") || b.includes("passport number is invalid")) {
    return makeAuError("au.validation.passport_invalid", "Passport rejected by portal");
  }
  if (b.includes("nationality is not eligible") || b.includes("ineligible nationality")) {
    return makeAuError("au.validation.nationality_unsupported", "Nationality ineligible");
  }
  if (b.includes("payment declined") || b.includes("card declined")) {
    return makeAuError("au.validation.payment_declined", "Card declined");
  }
  if (b.includes("under maintenance") || b.includes("scheduled maintenance")) {
    return makeAuError("au.portal.maintenance", "Portal in maintenance");
  }
  if (hints.httpStatus && hints.httpStatus >= 500) {
    return makeAuError("au.portal.unreachable", `Portal returned ${hints.httpStatus}`);
  }
  return null;
}
