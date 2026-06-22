import type { FillVietnamResult } from "./run";

export type VietnamBrowserChannel = "msedge" | "chrome" | undefined;

export function buildVietnamBrowserAttempts(
  rawChannels = "bundled,msedge,chrome",
  maxAttempts = 3,
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
  return unique.slice(0, Math.max(1, maxAttempts));
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
