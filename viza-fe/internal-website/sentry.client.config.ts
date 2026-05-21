/**
 * Client-side Sentry init (PROV-003 / FIX-006).
 *
 * Next.js convention: this file is auto-discovered. We lazy-import
 * `@sentry/nextjs` so type-check passes without the package and
 * silently no-op when no DSN is set (dev environment).
 */

import { buildSentryInitOptions } from "./lib/observability/sentry";

const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  // eslint-disable-next-line no-new-func
  new Function("s", "return import(s)")(specifier) as Promise<unknown>;

void (async () => {
  const opts = buildSentryInitOptions();
  if (!opts.dsn) return;
  try {
    const mod = (await dynamicRequire("@sentry/nextjs")) as {
      init: (opts: Record<string, unknown>) => void;
    };
    mod.init({
      ...(opts as Record<string, unknown>),
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0,
    });
  } catch (err) {
    console.error("[sentry-client] init failed:", err instanceof Error ? err.message : String(err));
  }
})();
