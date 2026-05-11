/**
 * Next.js instrumentation hook (PROV-003 / FIX-006).
 *
 * Boots Sentry on the server + edge runtimes. `@sentry/nextjs` is a
 * heavy native dep — it is loaded dynamically so type-check passes
 * even when the package isn't installed (the build target will fail
 * loudly at runtime instead, surfacing the unwired deploy).
 *
 * See lib/observability/sentry.ts for the shared init options and
 * docs/operations/sentry.md for the wiring contract.
 */

import { buildSentryInitOptions } from "./lib/observability/sentry";

const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  // eslint-disable-next-line no-new-func
  new Function("s", "return import(s)")(specifier) as Promise<unknown>;

export async function register(): Promise<void> {
  const opts = buildSentryInitOptions();
  if (!opts.dsn) {
    // No DSN — leave Sentry uninitialised so dev runs are quiet.
    return;
  }
  const runtime = process.env.NEXT_RUNTIME;
  try {
    if (runtime === "nodejs") {
      const mod = (await dynamicRequire("@sentry/nextjs")) as {
        init: (opts: Record<string, unknown>) => void;
      };
      mod.init(opts as Record<string, unknown>);
    }
    if (runtime === "edge") {
      const mod = (await dynamicRequire("@sentry/nextjs")) as {
        init: (opts: Record<string, unknown>) => void;
      };
      mod.init(opts as Record<string, unknown>);
    }
  } catch (err) {
    console.error("[sentry] failed to init:", err instanceof Error ? err.message : String(err));
  }
}
