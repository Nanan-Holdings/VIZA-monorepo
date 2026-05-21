/**
 * Per-page error catalog for Cambodia e-Visa runner (AUTO-KH-02).
 *
 * Stable error codes the runner emits when a portal-side condition
 * blocks progress. The queue worker uses the code to decide whether
 * to retry, mark the job 'failed', or escalate to operator takeover.
 */

export type KhErrorCode =
  | "kh.anti_bot.cloudflare"
  | "kh.anti_bot.ratelimit"
  | "kh.validation.passport_invalid"
  | "kh.validation.nationality_unsupported"
  | "kh.validation.payment_declined"
  | "kh.session.expired"
  | "kh.portal.unreachable"
  | "kh.portal.maintenance"
  | "kh.unknown_state";

export interface KhRunnerError {
  code: KhErrorCode;
  /** Human-readable message lifted from the page. */
  message: string;
  /** "retry" — re-queue with backoff. "human" — escalate to takeover. "fail" — terminal. */
  disposition: "retry" | "human" | "fail";
}

const CATALOG: Record<KhErrorCode, { disposition: KhRunnerError["disposition"] }> = {
  "kh.anti_bot.cloudflare": { disposition: "human" },
  "kh.anti_bot.ratelimit": { disposition: "retry" },
  "kh.validation.passport_invalid": { disposition: "fail" },
  "kh.validation.nationality_unsupported": { disposition: "fail" },
  "kh.validation.payment_declined": { disposition: "human" },
  "kh.session.expired": { disposition: "retry" },
  "kh.portal.unreachable": { disposition: "retry" },
  "kh.portal.maintenance": { disposition: "retry" },
  "kh.unknown_state": { disposition: "human" },
};

export function makeKhError(code: KhErrorCode, message: string): KhRunnerError {
  return { code, message, disposition: CATALOG[code].disposition };
}

export interface PageHints {
  /** document.title at the time of detection. */
  title: string;
  /** Visible body text snippet (≤ ~1 KB). */
  bodyText: string;
  httpStatus?: number;
}

/**
 * Inspect a page's title + body text and classify into a known error
 * code. Returns null when the page looks healthy.
 */
export function classifyPage(hints: PageHints): KhRunnerError | null {
  const t = hints.title.toLowerCase();
  const b = hints.bodyText.toLowerCase();

  if (t.includes("just a moment") || b.includes("checking your browser")) {
    return makeKhError(
      "kh.anti_bot.cloudflare",
      "Cloudflare interstitial blocked the request",
    );
  }
  if (b.includes("too many requests") || hints.httpStatus === 429) {
    return makeKhError("kh.anti_bot.ratelimit", "Portal rate-limited the runner");
  }
  if (b.includes("session has expired") || b.includes("session expired")) {
    return makeKhError("kh.session.expired", "Portal session expired mid-flow");
  }
  if (
    b.includes("invalid passport") ||
    b.includes("passport number is invalid")
  ) {
    return makeKhError(
      "kh.validation.passport_invalid",
      "Portal rejected the passport number",
    );
  }
  if (b.includes("nationality is not eligible") || b.includes("ineligible nationality")) {
    return makeKhError(
      "kh.validation.nationality_unsupported",
      "Applicant nationality is not eligible for KH e-Visa",
    );
  }
  if (b.includes("payment declined") || b.includes("card declined")) {
    return makeKhError(
      "kh.validation.payment_declined",
      "Payment processor declined the runner card",
    );
  }
  if (b.includes("under maintenance") || b.includes("scheduled maintenance")) {
    return makeKhError("kh.portal.maintenance", "Portal in scheduled maintenance");
  }
  if (hints.httpStatus && hints.httpStatus >= 500) {
    return makeKhError("kh.portal.unreachable", `Portal returned ${hints.httpStatus}`);
  }
  return null;
}
