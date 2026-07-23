import type { FillVietnamResult } from "./run";

export type VietnamBrowserChannel = "msedge" | "chrome" | undefined;
export const MAX_VIETNAM_PORTAL_ATTEMPTS = 3;

export function buildVietnamBrowserAttempts(
  rawChannels = "bundled,msedge,chrome",
  maxAttempts = MAX_VIETNAM_PORTAL_ATTEMPTS,
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

export function isRetryableVietnamResult(result: FillVietnamResult): boolean {
  if (result.status === "action_required") {
    return result.actionType === "layout_changed" || result.actionType === "official_portal_error";
  }
  if (result.status !== "failed") return false;

  const message = typeof result.error?.message === "string" ? result.error.message : "";
  const code = typeof result.error?.code === "string" ? result.error.code : "";
  return (
    /target page, context or browser has been closed|execution context was destroyed|navigation|timeout|net::err_/i.test(message) ||
    /^official_portal/i.test(code) ||
    result.checkpoint === "white_screen" ||
    result.checkpoint === "network_blocked" ||
    result.checkpoint === "portal_error" ||
    result.checkpoint === "layout_changed"
  );
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
