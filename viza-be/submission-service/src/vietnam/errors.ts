/**
 * Per-page error catalog for Vietnam e-Visa runner (AUTO-VN-02).
 * Mirrors the per-country shape with `vn.*` codes.
 */

export type VnErrorCode =
  | "vn.anti_bot.cloudflare"
  | "vn.anti_bot.ratelimit"
  | "vn.validation.passport_invalid"
  | "vn.validation.nationality_unsupported"
  | "vn.validation.payment_declined"
  | "vn.validation.captcha_required"
  | "vn.session.expired"
  | "vn.portal.unreachable"
  | "vn.portal.maintenance"
  | "vn.unknown_state";

export interface VnRunnerError {
  code: VnErrorCode;
  message: string;
  disposition: "retry" | "human" | "fail";
}

const CATALOG: Record<VnErrorCode, { disposition: VnRunnerError["disposition"] }> = {
  "vn.anti_bot.cloudflare": { disposition: "human" },
  "vn.anti_bot.ratelimit": { disposition: "retry" },
  "vn.validation.passport_invalid": { disposition: "fail" },
  "vn.validation.nationality_unsupported": { disposition: "fail" },
  "vn.validation.payment_declined": { disposition: "human" },
  "vn.validation.captcha_required": { disposition: "human" },
  "vn.session.expired": { disposition: "retry" },
  "vn.portal.unreachable": { disposition: "retry" },
  "vn.portal.maintenance": { disposition: "retry" },
  "vn.unknown_state": { disposition: "human" },
};

export function makeVnError(code: VnErrorCode, message: string): VnRunnerError {
  return { code, message, disposition: CATALOG[code].disposition };
}

export interface PageHints {
  title: string;
  bodyText: string;
  httpStatus?: number;
}

export function classifyPage(hints: PageHints): VnRunnerError | null {
  const t = hints.title.toLowerCase();
  const b = hints.bodyText.toLowerCase();
  if (t.includes("just a moment") || b.includes("checking your browser")) {
    return makeVnError("vn.anti_bot.cloudflare", "Cloudflare interstitial");
  }
  if (b.includes("too many requests") || hints.httpStatus === 429) {
    return makeVnError("vn.anti_bot.ratelimit", "Rate-limited");
  }
  if (b.includes("captcha") && b.includes("required")) {
    return makeVnError("vn.validation.captcha_required", "Captcha challenge surfaced");
  }
  if (b.includes("session has expired") || b.includes("session expired")) {
    return makeVnError("vn.session.expired", "Session expired");
  }
  if (b.includes("invalid passport") || b.includes("passport number is invalid")) {
    return makeVnError("vn.validation.passport_invalid", "Passport rejected by portal");
  }
  if (b.includes("nationality is not eligible") || b.includes("ineligible nationality")) {
    return makeVnError("vn.validation.nationality_unsupported", "Nationality ineligible");
  }
  if (b.includes("payment declined") || b.includes("transaction failed")) {
    return makeVnError("vn.validation.payment_declined", "Card declined");
  }
  if (b.includes("under maintenance") || b.includes("scheduled maintenance")) {
    return makeVnError("vn.portal.maintenance", "Portal in maintenance");
  }
  if (hints.httpStatus && hints.httpStatus >= 500) {
    return makeVnError("vn.portal.unreachable", `Portal returned ${hints.httpStatus}`);
  }
  return null;
}
