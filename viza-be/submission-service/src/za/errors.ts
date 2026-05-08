/**
 * Per-page error catalog for South Africa eVisa runner (AUTO-ZA-02).
 * Mirrors the KH/LA/LK shape with `za.*` codes.
 */

export type ZaErrorCode =
  | "za.anti_bot.cloudflare"
  | "za.anti_bot.ratelimit"
  | "za.validation.passport_invalid"
  | "za.validation.nationality_unsupported"
  | "za.validation.payment_declined"
  | "za.session.expired"
  | "za.portal.unreachable"
  | "za.portal.maintenance"
  | "za.unknown_state";

export interface ZaRunnerError {
  code: ZaErrorCode;
  message: string;
  disposition: "retry" | "human" | "fail";
}

const CATALOG: Record<ZaErrorCode, { disposition: ZaRunnerError["disposition"] }> = {
  "za.anti_bot.cloudflare": { disposition: "human" },
  "za.anti_bot.ratelimit": { disposition: "retry" },
  "za.validation.passport_invalid": { disposition: "fail" },
  "za.validation.nationality_unsupported": { disposition: "fail" },
  "za.validation.payment_declined": { disposition: "human" },
  "za.session.expired": { disposition: "retry" },
  "za.portal.unreachable": { disposition: "retry" },
  "za.portal.maintenance": { disposition: "retry" },
  "za.unknown_state": { disposition: "human" },
};

export function makeZaError(code: ZaErrorCode, message: string): ZaRunnerError {
  return { code, message, disposition: CATALOG[code].disposition };
}

export interface PageHints {
  title: string;
  bodyText: string;
  httpStatus?: number;
}

export function classifyPage(hints: PageHints): ZaRunnerError | null {
  const t = hints.title.toLowerCase();
  const b = hints.bodyText.toLowerCase();
  if (t.includes("just a moment") || b.includes("checking your browser")) {
    return makeZaError("za.anti_bot.cloudflare", "Cloudflare interstitial");
  }
  if (b.includes("too many requests") || hints.httpStatus === 429) {
    return makeZaError("za.anti_bot.ratelimit", "Rate-limited");
  }
  if (b.includes("session has expired") || b.includes("session expired")) {
    return makeZaError("za.session.expired", "Session expired");
  }
  if (b.includes("invalid passport") || b.includes("passport number is invalid")) {
    return makeZaError("za.validation.passport_invalid", "Passport rejected by portal");
  }
  if (b.includes("nationality is not eligible") || b.includes("ineligible nationality")) {
    return makeZaError("za.validation.nationality_unsupported", "Nationality ineligible");
  }
  if (b.includes("payment declined") || b.includes("card declined")) {
    return makeZaError("za.validation.payment_declined", "Card declined");
  }
  if (b.includes("under maintenance") || b.includes("scheduled maintenance")) {
    return makeZaError("za.portal.maintenance", "Portal in maintenance");
  }
  if (hints.httpStatus && hints.httpStatus >= 500) {
    return makeZaError("za.portal.unreachable", `Portal returned ${hints.httpStatus}`);
  }
  return null;
}
