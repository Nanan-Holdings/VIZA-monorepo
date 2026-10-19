/* Sentry in the browser. NEXT_PUBLIC_SENTRY_DSN is inlined at build time;
   without it nothing starts. No session replay: applicants type passport
   details into these pages. No IPs or cookies (sendDefaultPii false). */
import * as Sentry from "@sentry/nextjs";
import { buildSentryInitOptions } from "./lib/observability/sentry";

const options = buildSentryInitOptions({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
if (options.dsn) Sentry.init(options);

export const onRouterTransitionStart = options.dsn ? Sentry.captureRouterTransitionStart : undefined;
