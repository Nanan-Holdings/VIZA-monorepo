/**
 * Per-page error catalog for Laos e-Visa runner (AUTO-LA-02).
 *
 * Mirrors the KH catalog shape with `la.*` codes. Catalog membership
 * + disposition are intentionally identical so the queue worker can
 * route both flows through the same retry / takeover logic.
 */

export type LaErrorCode =
  | "la.anti_bot.cloudflare"
  | "la.anti_bot.ratelimit"
  | "la.validation.passport_invalid"
  | "la.validation.nationality_unsupported"
  | "la.validation.payment_declined"
  | "la.session.expired"
  | "la.portal.unreachable"
  | "la.portal.maintenance"
  | "la.unknown_state";

export interface LaRunnerError {
  code: LaErrorCode;
  message: string;
  disposition: "retry" | "human" | "fail";
}

const CATALOG: Record<LaErrorCode, { disposition: LaRunnerError["disposition"] }> = {
  "la.anti_bot.cloudflare": { disposition: "human" },
  "la.anti_bot.ratelimit": { disposition: "retry" },
  "la.validation.passport_invalid": { disposition: "fail" },
  "la.validation.nationality_unsupported": { disposition: "fail" },
  "la.validation.payment_declined": { disposition: "human" },
  "la.session.expired": { disposition: "retry" },
  "la.portal.unreachable": { disposition: "retry" },
  "la.portal.maintenance": { disposition: "retry" },
  "la.unknown_state": { disposition: "human" },
};

export function makeLaError(code: LaErrorCode, message: string): LaRunnerError {
  return { code, message, disposition: CATALOG[code].disposition };
}

export interface PageHints {
  title: string;
  bodyText: string;
  httpStatus?: number;
}

export function classifyPage(hints: PageHints): LaRunnerError | null {
  const t = hints.title.toLowerCase();
  const b = hints.bodyText.toLowerCase();
  if (t.includes("just a moment") || b.includes("checking your browser")) {
    return makeLaError("la.anti_bot.cloudflare", "Cloudflare interstitial");
  }
  if (b.includes("too many requests") || hints.httpStatus === 429) {
    return makeLaError("la.anti_bot.ratelimit", "Rate-limited");
  }
  if (b.includes("session has expired") || b.includes("session expired")) {
    return makeLaError("la.session.expired", "Session expired");
  }
  if (b.includes("invalid passport") || b.includes("passport number is invalid")) {
    return makeLaError("la.validation.passport_invalid", "Passport rejected by portal");
  }
  if (b.includes("nationality is not eligible") || b.includes("ineligible nationality")) {
    return makeLaError("la.validation.nationality_unsupported", "Nationality ineligible");
  }
  if (b.includes("payment declined") || b.includes("card declined")) {
    return makeLaError("la.validation.payment_declined", "Card declined");
  }
  if (b.includes("under maintenance") || b.includes("scheduled maintenance")) {
    return makeLaError("la.portal.maintenance", "Portal in maintenance");
  }
  if (hints.httpStatus && hints.httpStatus >= 500) {
    return makeLaError("la.portal.unreachable", `Portal returned ${hints.httpStatus}`);
  }
  return null;
}
