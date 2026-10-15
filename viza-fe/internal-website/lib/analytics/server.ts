import "server-only";

import { PostHog } from "posthog-node";
import type { EventName, EventProperties } from "./taxonomy";

/**
 * Server-side funnel capture for events that have no browser, such as a visa
 * outcome posted by the external submission service.
 *
 * The distinct id is always the applicant's Supabase auth uid, so these events
 * join the person the browser identified. Only the typed, coarse properties
 * from EventProperties are sent. Capture runs only on the production Vercel
 * deployment and is a no-op without NEXT_PUBLIC_POSTHOG_KEY.
 *
 * Serverless functions can freeze as soon as the response is sent, so each
 * call uses a short-lived client and awaits `shutdown()`, which flushes the
 * queue. Callers should run this inside `after()` so the response is not
 * delayed, and it never throws.
 */
export function isServerAnalyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) && process.env.VERCEL_ENV === "production";
}

export async function captureServerEvent<N extends EventName>(
  distinctId: string,
  name: N,
  properties: EventProperties[N],
): Promise<void> {
  if (!distinctId || !isServerAnalyticsEnabled()) return;
  const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!.trim(), {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    disableGeoip: true,
  });
  try {
    client.capture({
      distinctId,
      event: name,
      properties: { ...properties, app: "portal" },
    });
  } catch {
    // Analytics must never fail the request that triggered it.
  } finally {
    await client.shutdown().catch(() => undefined);
  }
}
