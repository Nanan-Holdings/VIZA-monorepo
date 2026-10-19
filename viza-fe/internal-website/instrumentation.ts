/**
 * Next.js instrumentation hook (PROV-003 / FIX-006).
 *
 * Boots Sentry on the server and edge runtimes when SENTRY_DSN (or
 * NEXT_PUBLIC_SENTRY_DSN) is set; without one Sentry stays off.
 *
 * See lib/observability/sentry.ts for the shared init options and
 * docs/operations/sentry.md for the wiring contract.
 */

import { buildSentryInitOptions } from "./lib/observability/sentry";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.VIZA_PORTAL_READ_METRICS === "true") {
    const { startPortalReadRuntimeMetrics } = await import("./lib/observability/portal-read");
    startPortalReadRuntimeMetrics();
  }
  const opts = buildSentryInitOptions();
  if (!opts.dsn) {
    // No DSN — leave Sentry uninitialised so dev runs are quiet.
    return;
  }
  /* Static imports so the bundler ships @sentry/nextjs with each runtime. The
     old loader built the import from a string at run time, which no bundler
     can see, so Sentry never started even with a DSN set. */
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

/* Errors thrown while rendering or in route handlers. */
export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>): Promise<void> {
  if (!buildSentryInitOptions().dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
