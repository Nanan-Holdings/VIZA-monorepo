/**
 * Server-side Sentry init for agent-backend (PROV-003 / FIX-006).
 *
 * No-ops when SENTRY_DSN is unset. @sentry/node is a real dependency now:
 * the earlier loader imported it from a string at run time and the package
 * was never installed, so Sentry never started. No IPs, cookies or headers
 * are sent (sendDefaultPii false): this service handles applicant data.
 */
import * as Sentry from "@sentry/node";

export const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || "dev";

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || "development",
      release: SENTRY_RELEASE,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    console.log(`[sentry] initialised release=${SENTRY_RELEASE}`);
  } catch (err) {
    console.error("[sentry] init failed:", err instanceof Error ? err.message : String(err));
  }
}
