import "server-only";

/**
 * Shared, best-effort abuse controls for public / lightly-authenticated API
 * routes that proxy a paid upstream (Google, an LLM provider, …).
 *
 * These are intentionally lightweight and process-local — the same sliding
 * window used by the form-assistant limiter. They are NOT a substitute for a
 * real edge WAF, but they raise the bar enough to stop a single client (or a
 * cross-site browser) from draining a metered upstream:
 *
 *   - `consumeRateLimit`  — per-key sliding window (key by IP and/or user).
 *   - `getClientIp`       — best-effort caller IP from proxy headers.
 *   - `isSameOrigin`      — lenient CSRF-style guard: blocks a *declared*
 *                           cross-origin browser call, allows header-less
 *                           callers (same-origin navigations, tests, S2S).
 *   - `exceedsBodyLimit`  — reject oversized payloads by Content-Length.
 */

const buckets = new Map<string, number[]>();

export function consumeRateLimit(
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
  if (buckets.size > 5_000) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((value) => now - value >= options.windowMs)) buckets.delete(bucketKey);
    }
  }
  return true;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Returns false only when the request carries an Origin (or, failing that, a
 * Referer) whose host does not match the request host — i.e. a browser call
 * mounted from another site. A header-less request (server-to-server, a
 * same-origin top-level navigation, a unit test, or an `<img>` whose referrer
 * was stripped) is treated as same-origin so legitimate callers never break.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return true;
  const declared = request.headers.get("origin") ?? request.headers.get("referer");
  if (!declared) return true;
  try {
    return new URL(declared).host === host;
  } catch {
    return false;
  }
}

/**
 * True when the request declares a Content-Length larger than `maxBytes`.
 * Cheap first line of defence before `request.json()` buffers the body.
 */
export function exceedsBodyLimit(request: Request, maxBytes: number): boolean {
  const declared = request.headers.get("content-length");
  if (!declared) return false;
  const length = Number.parseInt(declared, 10);
  return Number.isFinite(length) && length > maxBytes;
}

/**
 * Combined abuse guard for public / lightly-authenticated proxy routes that
 * forward to a metered upstream. Returns a ready-to-send `Response` when the
 * request should be rejected, or `null` when it may proceed. Layers:
 *   1. same-origin guard (blocks declared cross-origin browser calls),
 *   2. body-size cap (POST routes that pass `maxBytes`),
 *   3. per-IP sliding-window rate limit.
 * All layers are lenient toward header-less callers so legitimate in-app
 * requests (guest funnel or authenticated) are never broken.
 */
export function guardApiAbuse(
  request: Request,
  options: {
    routeKey: string;
    limit: number;
    windowMs: number;
    maxBytes?: number;
    requireSameOrigin?: boolean;
  },
): Response | null {
  if (options.requireSameOrigin !== false && !isSameOrigin(request)) {
    return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }
  if (options.maxBytes !== undefined && exceedsBodyLimit(request, options.maxBytes)) {
    return Response.json({ error: "Payload too large." }, { status: 413 });
  }
  if (
    !consumeRateLimit(`${options.routeKey}:${getClientIp(request)}`, {
      limit: options.limit,
      windowMs: options.windowMs,
    })
  ) {
    return Response.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }
  return null;
}
