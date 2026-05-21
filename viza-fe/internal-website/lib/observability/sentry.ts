/**
 * Sentry release tagging (ALERT-001).
 *
 * Reads the deploy-time SHA from SENTRY_RELEASE (CI sets it; locally it
 * falls back to "dev"). Wired into Sentry's init() everywhere we boot
 * the SDK so symbolicated stack traces resolve against the right
 * release artifact set.
 */

export const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE || "dev";

export interface SentryInitOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

export function buildSentryInitOptions(extra: Partial<SentryInitOptions> = {}): SentryInitOptions {
  return {
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.SENTRY_ENV || process.env.VERCEL_ENV || "development",
    release: SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    ...extra,
  };
}
