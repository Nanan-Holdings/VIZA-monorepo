import "server-only";

const buckets = new Map<string, number[]>();

export function consumeFormAssistantRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((value) => now - value < options.windowMs);
  if (recent.length >= options.limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 2_000) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((value) => now - value >= options.windowMs)) buckets.delete(bucketKey);
    }
  }
  return true;
}
