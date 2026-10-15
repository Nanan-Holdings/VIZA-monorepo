/**
 * Browser capture helper for the product event taxonomy (OBS-001).
 *
 * Every fire site must use a name from EVENT with its typed property shape
 * (see ./taxonomy.ts for what may and may not go into properties).
 *
 * Transport and privacy settings live in ./posthog.ts. A missing
 * NEXT_PUBLIC_POSTHOG_KEY, a non-production host or a rejected cookie choice
 * turns `track` into a no-op.
 */
import { captureEvent, toRoutePath } from "./posthog";
import type { EventName, EventProperties } from "./taxonomy";

export * from "./taxonomy";

export function track<N extends EventName>(name: N, properties: EventProperties[N]): void {
  try {
    captureEvent(name, { ...properties });
  } catch {
    // Analytics must never break the user action that triggered it.
  }
}

/** The current route with ids replaced, for use as an event `source`. */
export function currentRoute(): string {
  if (typeof window === "undefined") return "server";
  return toRoutePath(window.location.pathname);
}
