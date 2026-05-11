/**
 * Server-side Sentry init for agent-backend (PROV-003 / FIX-006).
 *
 * `@sentry/node` is lazy-loaded so type-check passes without the
 * package. No-ops when SENTRY_DSN is unset.
 */

export const SENTRY_RELEASE = process.env.SENTRY_RELEASE || "dev";

interface SentryInitArgs {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  // eslint-disable-next-line no-new-func
  new Function("s", "return import(s)")(specifier) as Promise<unknown>;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const mod = (await dynamicRequire("@sentry/node")) as {
      init: (opts: SentryInitArgs) => void;
    };
    mod.init({
      dsn,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || "development",
      release: SENTRY_RELEASE,
      tracesSampleRate: 0.1,
    });
    console.log(`[sentry] initialised release=${SENTRY_RELEASE}`);
  } catch (err) {
    console.error("[sentry] init failed:", err instanceof Error ? err.message : String(err));
  }
}
