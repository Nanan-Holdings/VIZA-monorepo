import type { FillVietnamResult } from "./run";

export type VietnamBrowserChannel = "msedge" | "chrome" | undefined;
export const DEFAULT_VIETNAM_PORTAL_ATTEMPTS = 5;
export const MAX_VIETNAM_PORTAL_ATTEMPTS = 6;
export const MAX_VIETNAM_QUEUE_ATTEMPTS = 3;
export const DEFAULT_VIETNAM_PORTAL_RETRY_BACKOFF_MS = 5_000;
export const DEFAULT_VIETNAM_PORTAL_RETRY_MAX_BACKOFF_MS = 60_000;

export function nextVietnamQueueAttemptCount(input: {
  currentAttempts: number;
  officialPortalFailure: boolean;
  consumedOneTimeCardAuthorization: boolean;
  maxAttempts?: number;
}): number {
  const maxAttempts = Math.max(1, input.maxAttempts ?? MAX_VIETNAM_QUEUE_ATTEMPTS);
  if (input.officialPortalFailure || input.consumedOneTimeCardAuthorization) {
    return maxAttempts;
  }
  return Math.min(input.currentAttempts + 1, maxAttempts);
}

export function buildVietnamBrowserAttempts(
  rawChannels = "bundled,msedge,chrome",
  maxAttempts = DEFAULT_VIETNAM_PORTAL_ATTEMPTS,
): VietnamBrowserChannel[] {
  const channels = rawChannels
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .map<VietnamBrowserChannel | null>((value) => {
      if (value === "bundled" || value === "chromium" || value === "") return undefined;
      if (value === "msedge") return "msedge";
      if (value === "chrome") return "chrome";
      return null;
    })
    .filter((value): value is VietnamBrowserChannel => value !== null);

  const unique: VietnamBrowserChannel[] = [];
  for (const channel of channels) {
    if (!unique.includes(channel)) unique.push(channel);
  }
  if (unique.length === 0) unique.push(undefined);

  const boundedAttemptCount = Math.min(
    Math.max(1, Math.floor(maxAttempts)),
    MAX_VIETNAM_PORTAL_ATTEMPTS,
  );
  return Array.from(
    { length: boundedAttemptCount },
    (_, index) => unique[index % unique.length],
  );
}

export function computeVietnamPortalRetryDelayMs(input: {
  completedAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  randomValue?: number;
}): number {
  const completedAttempts = Math.max(1, Math.floor(input.completedAttempts));
  const baseDelayMs = Math.max(
    250,
    Math.floor(input.baseDelayMs ?? DEFAULT_VIETNAM_PORTAL_RETRY_BACKOFF_MS),
  );
  const maxDelayMs = Math.max(
    baseDelayMs,
    Math.floor(input.maxDelayMs ?? DEFAULT_VIETNAM_PORTAL_RETRY_MAX_BACKOFF_MS),
  );
  const jitterRatio = Math.min(0.5, Math.max(0, input.jitterRatio ?? 0.2));
  const randomValue = Math.min(1, Math.max(0, input.randomValue ?? Math.random()));
  const exponentialDelay = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** (completedAttempts - 1),
  );
  const jitterMultiplier = 1 - jitterRatio + randomValue * jitterRatio * 2;
  return Math.max(250, Math.round(exponentialDelay * jitterMultiplier));
}

export function isRetryableVietnamResult(result: FillVietnamResult): boolean {
  if (hasReachedVietnamNoRetryBoundary(result)) return false;
  if (result.status === "action_required") {
    return result.actionType === "layout_changed" || result.actionType === "official_portal_error";
  }
  if (result.status !== "failed") return false;

  const message = typeof result.error?.message === "string" ? result.error.message : "";
  const code = typeof result.error?.code === "string" ? result.error.code : "";
  // CAPTCHA already has its own bounded refresh/solve loop. A provider timeout
  // in that error message must not be mistaken for a browser/navigation
  // timeout, otherwise the runner refills the entire official application up
  // to five more times before returning the same checkpoint.
  if (code === "captcha_automatic_failed") return false;
  return (
    /target page, context or browser has been closed|execution context was destroyed|navigation|timeout|net::err_/i.test(message) ||
    /^official_portal/i.test(code) ||
    result.checkpoint === "white_screen" ||
    result.checkpoint === "network_blocked" ||
    result.checkpoint === "portal_error" ||
    result.checkpoint === "layout_changed"
  );
}

function hasReachedVietnamNoRetryBoundary(result: FillVietnamResult): boolean {
  const checkpoint = "checkpoint" in result ? result.checkpoint : undefined;
  if (
    checkpoint === "payment_page_visible" ||
    checkpoint === "final_submit_visible" ||
    checkpoint === "registration_code_visible"
  ) {
    return true;
  }
  if (result.status !== "failed") return false;
  return /payment|3ds|otp|bank|receipt|registration/i.test(result.failedStep);
}

export function finalizeVietnamResultAfterRetries(
  result: FillVietnamResult,
  attempts: number,
): FillVietnamResult {
  if (!isTransientVietnamPortalError(result)) return result;

  const boundedAttempts = Math.min(
    Math.max(1, Math.floor(attempts)),
    MAX_VIETNAM_PORTAL_ATTEMPTS,
  );
  const url =
    "url" in result && typeof result.url === "string"
      ? result.url
      : "https://evisa.gov.vn/";
  const diagnostics = "diagnostics" in result ? result.diagnostics : undefined;
  const runId = "runId" in result ? result.runId : undefined;

  return {
    status: "failed",
    runId,
    failedStep: "portal_error",
    error: {
      code: "official_portal_unavailable_after_retries",
      message:
        `The official Vietnam e-Visa portal returned a temporary server error after ${boundedAttempts} attempts. ` +
        "VIZA stopped before filling the application and did not attempt payment. Please retry later.",
    },
    url,
    checkpoint: "portal_error",
    diagnostics,
  };
}

function isTransientVietnamPortalError(result: FillVietnamResult): boolean {
  if (result.status === "failed") {
    const code = typeof result.error?.code === "string" ? result.error.code : "";
    return (
      /^official_portal/i.test(code) ||
      result.checkpoint === "white_screen" ||
      result.checkpoint === "network_blocked" ||
      result.checkpoint === "portal_error"
    );
  }
  if (result.status !== "action_required") return false;
  if (result.actionType === "official_portal_error") return true;
  if (result.actionType !== "layout_changed") return false;

  const snapshot = result.diagnostics?.lastSnapshot;
  const diagnosticText = [
    ...(result.diagnostics?.consoleErrors ?? []),
    ...(result.diagnostics?.failedRequests ?? []),
  ].join(" ");
  return (
    snapshot?.title.trim().toLowerCase() === "error" ||
    /\b(?:502|503|504|bad gateway|service unavailable|gateway timeout)\b/i.test(diagnosticText)
  );
}
