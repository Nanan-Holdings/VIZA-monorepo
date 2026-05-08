/**
 * Per-page error catalog for Sri Lanka ETA runner (AUTO-LK-02).
 * Mirrors the KH/LA shape with `lk.*` codes.
 */

export type LkErrorCode =
  | "lk.anti_bot.cloudflare"
  | "lk.anti_bot.ratelimit"
  | "lk.validation.passport_invalid"
  | "lk.validation.nationality_unsupported"
  | "lk.validation.payment_declined"
  | "lk.session.expired"
  | "lk.portal.unreachable"
  | "lk.portal.maintenance"
  | "lk.unknown_state";

export interface LkRunnerError {
  code: LkErrorCode;
  message: string;
  disposition: "retry" | "human" | "fail";
}

const CATALOG: Record<LkErrorCode, { disposition: LkRunnerError["disposition"] }> = {
  "lk.anti_bot.cloudflare": { disposition: "human" },
  "lk.anti_bot.ratelimit": { disposition: "retry" },
  "lk.validation.passport_invalid": { disposition: "fail" },
  "lk.validation.nationality_unsupported": { disposition: "fail" },
  "lk.validation.payment_declined": { disposition: "human" },
  "lk.session.expired": { disposition: "retry" },
  "lk.portal.unreachable": { disposition: "retry" },
  "lk.portal.maintenance": { disposition: "retry" },
  "lk.unknown_state": { disposition: "human" },
};

export function makeLkError(code: LkErrorCode, message: string): LkRunnerError {
  return { code, message, disposition: CATALOG[code].disposition };
}

export interface PageHints {
  title: string;
  bodyText: string;
  httpStatus?: number;
}

export function classifyPage(hints: PageHints): LkRunnerError | null {
  const t = hints.title.toLowerCase();
  const b = hints.bodyText.toLowerCase();
  if (t.includes("just a moment") || b.includes("checking your browser")) {
    return makeLkError("lk.anti_bot.cloudflare", "Cloudflare interstitial");
  }
  if (b.includes("too many requests") || hints.httpStatus === 429) {
    return makeLkError("lk.anti_bot.ratelimit", "Rate-limited");
  }
  if (b.includes("session has expired") || b.includes("session expired")) {
    return makeLkError("lk.session.expired", "Session expired");
  }
  if (b.includes("invalid passport") || b.includes("passport number is invalid")) {
    return makeLkError("lk.validation.passport_invalid", "Passport rejected by portal");
  }
  if (b.includes("nationality is not eligible") || b.includes("ineligible nationality")) {
    return makeLkError("lk.validation.nationality_unsupported", "Nationality ineligible");
  }
  if (b.includes("payment declined") || b.includes("card declined")) {
    return makeLkError("lk.validation.payment_declined", "Card declined");
  }
  if (b.includes("under maintenance") || b.includes("scheduled maintenance")) {
    return makeLkError("lk.portal.maintenance", "Portal in maintenance");
  }
  if (hints.httpStatus && hints.httpStatus >= 500) {
    return makeLkError("lk.portal.unreachable", `Portal returned ${hints.httpStatus}`);
  }
  return null;
}
