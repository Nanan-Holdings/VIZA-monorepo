const MAX_QUEUE_BACKOFF_MS = 60_000;
const MAX_ERROR_SUMMARY_LENGTH = 320;

export function calculateQueueErrorBackoffMs(
  pollMs: number,
  consecutiveFailures: number,
  random: () => number = Math.random,
): number {
  const baseMs = Math.max(250, pollMs);
  const exponent = Math.min(Math.max(0, consecutiveFailures - 1), 6);
  const exponentialMs = Math.min(MAX_QUEUE_BACKOFF_MS, baseMs * (2 ** exponent));
  const jitterMultiplier = 0.8 + Math.min(1, Math.max(0, random())) * 0.4;
  return Math.min(MAX_QUEUE_BACKOFF_MS, Math.round(exponentialMs * jitterMultiplier));
}

export function summarizeQueueError(error: unknown): string {
  const record = typeof error === "object" && error !== null
    ? error as Record<string, unknown>
    : null;
  const parts = [
    record && typeof record.name === "string" ? record.name : "Error",
    record && typeof record.code === "string" ? `code=${record.code}` : "",
    record && typeof record.status === "number" ? `status=${record.status}` : "",
    error instanceof Error ? error.message : String(error),
  ].filter(Boolean);
  const normalized = parts.join(" ").replace(/\s+/g, " ").trim();
  return normalized.length <= MAX_ERROR_SUMMARY_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_ERROR_SUMMARY_LENGTH - 1)}…`;
}
