/**
 * Per-page error catalog for India e-Visa runner (AUTO-IN-02).
 * Mirrors the KH/LA/LK/ZA shape with `in.*` codes.
 */

export type InErrorCode =
  | "in.anti_bot.cloudflare"
  | "in.anti_bot.ratelimit"
  | "in.validation.passport_invalid"
  | "in.validation.nationality_unsupported"
  | "in.validation.payment_declined"
  | "in.session.expired"
  | "in.portal.unreachable"
  | "in.portal.maintenance"
  | "in.unknown_state";

export interface InRunnerError {
  code: InErrorCode;
  message: string;
  disposition: "retry" | "human" | "fail";
}

const CATALOG: Record<InErrorCode, { disposition: InRunnerError["disposition"] }> = {
  "in.anti_bot.cloudflare": { disposition: "human" },
  "in.anti_bot.ratelimit": { disposition: "retry" },
  "in.validation.passport_invalid": { disposition: "fail" },
  "in.validation.nationality_unsupported": { disposition: "fail" },
  "in.validation.payment_declined": { disposition: "human" },
  "in.session.expired": { disposition: "retry" },
  "in.portal.unreachable": { disposition: "retry" },
  "in.portal.maintenance": { disposition: "retry" },
  "in.unknown_state": { disposition: "human" },
};

export function makeInError(code: InErrorCode, message: string): InRunnerError {
  return { code, message, disposition: CATALOG[code].disposition };
}

export interface PageHints {
  title: string;
  bodyText: string;
  httpStatus?: number;
}

export function classifyPage(hints: PageHints): InRunnerError | null {
  const t = hints.title.toLowerCase();
  const b = hints.bodyText.toLowerCase();
  if (t.includes("just a moment") || b.includes("checking your browser")) {
    return makeInError("in.anti_bot.cloudflare", "Cloudflare interstitial");
  }
  if (b.includes("too many requests") || hints.httpStatus === 429) {
    return makeInError("in.anti_bot.ratelimit", "Rate-limited");
  }
  if (b.includes("session has expired") || b.includes("session expired")) {
    return makeInError("in.session.expired", "Session expired");
  }
  if (b.includes("invalid passport") || b.includes("passport number is invalid")) {
    return makeInError("in.validation.passport_invalid", "Passport rejected by portal");
  }
  if (b.includes("nationality is not eligible") || b.includes("ineligible nationality")) {
    return makeInError("in.validation.nationality_unsupported", "Nationality ineligible");
  }
  if (b.includes("payment declined") || b.includes("transaction failed")) {
    return makeInError("in.validation.payment_declined", "Card declined");
  }
  if (b.includes("under maintenance") || b.includes("scheduled maintenance")) {
    return makeInError("in.portal.maintenance", "Portal in maintenance");
  }
  if (hints.httpStatus && hints.httpStatus >= 500) {
    return makeInError("in.portal.unreachable", `Portal returned ${hints.httpStatus}`);
  }
  return null;
}
