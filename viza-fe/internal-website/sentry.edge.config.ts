/* Sentry for the portal's edge runtime. Loaded by instrumentation.ts only
   when a DSN is configured. No IPs, cookies or headers are sent
   (sendDefaultPii false): the portal handles passport data. */
import * as Sentry from "@sentry/nextjs";
import { buildSentryInitOptions } from "./lib/observability/sentry";

Sentry.init(buildSentryInitOptions());
