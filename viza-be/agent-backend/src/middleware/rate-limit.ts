/**
 * Minimal in-memory per-IP sliding-window rate limiter.
 *
 * Dependency-free and intentionally simple. NOTE: state lives in this process
 * only, so with more than one instance behind a load balancer each instance
 * enforces the limit independently (the effective global limit is
 * limit * instanceCount). For real distributed limiting move this to a shared
 * store (e.g. Redis). This is a first-line abuse brake for AI/unauthenticated
 * routes, not a precise quota.
 */

import type { NextFunction, Request, Response } from "express";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;
// Bound memory: forget IPs we have not seen in a while. Swept lazily.
const IDLE_EVICTION_MS = 5 * 60_000;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  /** Distinguishes buckets when several limiters share one process. */
  bucket?: string;
}

interface Hits {
  /** Timestamps (ms) of requests still inside the window. */
  timestamps: number[];
  lastSeen: number;
}

function clientIp(req: Request): string {
  // Express sets req.ip (honours trust proxy). Fall back to socket address.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Create an Express middleware enforcing `max` requests per `windowMs` per IP.
 * Window and limit are overridable via RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX,
 * with the passed options taking precedence over the defaults.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs =
    options.windowMs ?? readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
  const max = options.max ?? readPositiveIntEnv("RATE_LIMIT_MAX", DEFAULT_MAX);

  const buckets = new Map<string, Hits>();
  let lastSweep = Date.now();

  function sweep(now: number): void {
    if (now - lastSweep < IDLE_EVICTION_MS) return;
    lastSweep = now;
    for (const [key, hits] of buckets) {
      if (now - hits.lastSeen > IDLE_EVICTION_MS) buckets.delete(key);
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    sweep(now);

    const key = clientIp(req);
    const windowStart = now - windowMs;

    let hits = buckets.get(key);
    if (!hits) {
      hits = { timestamps: [], lastSeen: now };
      buckets.set(key, hits);
    }

    // Drop timestamps that have aged out of the window.
    hits.timestamps = hits.timestamps.filter((ts) => ts > windowStart);
    hits.lastSeen = now;

    if (hits.timestamps.length >= max) {
      const oldest = hits.timestamps[0];
      const retryAfterMs = Math.max(0, oldest + windowMs - now);
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
      res.status(429).json({
        error: true,
        code: "rate_limited",
        message: "Too many requests. Please slow down and try again shortly.",
      });
      return;
    }

    hits.timestamps.push(now);
    next();
  };
}
