# Portal Observability

`portal-read.ts` provides opt-in, Node-only diagnostics for authenticated reads.
`VIZA_PORTAL_READ_METRICS=true` enables per-request timing and ten-second process
samples; default-off behavior must preserve the original fetch results/errors.
`instrumentation.ts` starts the unref'ed runtime sampler.

Use only fixed operation/stage/resource labels and random correlation IDs. Never
log URLs, filters, SQL parameters, headers, cookies, JWTs, user identifiers,
profile data, raw exceptions or response bodies. Keep metrics bounded and report
dropped diagnostic records if the log limit is reached. This module is not a
cache and must never retain or share user data between requests.

Supabase client factories inject `observePortalFetch()` into the retry wrapper
so each actual network attempt is counted. The shared browser-compatible retry
wrapper must not import Node-only code. HTTP timing ends at response headers;
loader-stage timing includes body parsing. Neither metric is full browser paint.

`portal-read.test.ts` verifies request isolation, privacy, bounded labels and log
volume, disabled behavior and preservation of fetch streams/errors.
`sentry.ts` retains the existing optional Sentry configuration.
