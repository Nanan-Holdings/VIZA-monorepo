/**
 * Product event taxonomy (OBS-001).
 *
 * Every fire-site must use one of these constants — drift between caller
 * strings is the #1 cause of dashboards that lie. Add to the enum here
 * before adding the call site.
 */

export const EVENT = {
  signup_started: "signup_started",
  signup_verified: "signup_verified",
  application_created: "application_created",
  application_step_completed: "application_step_completed",
  payment_intent_created: "payment_intent_created",
  payment_succeeded: "payment_succeeded",
  doc_uploaded: "doc_uploaded",
  face_match_decided: "face_match_decided",
  identity_verified: "identity_verified",
  application_submitted: "application_submitted",
  application_delivered: "application_delivered",
  refund_requested: "refund_requested",
  refund_decided: "refund_decided",
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

export interface AnalyticsEvent {
  name: EventName;
  properties: Record<string, string | number | boolean | null>;
  userId?: string;
}

const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  // eslint-disable-next-line no-new-func
  new Function("s", "return import(s)")(specifier) as Promise<unknown>;

interface PosthogModule {
  default: {
    init: (key: string, opts: Record<string, unknown>) => void;
    capture: (name: string, props: Record<string, unknown>) => void;
  };
}

let cachedPosthog: PosthogModule | null = null;

async function getClient(): Promise<PosthogModule | null> {
  if (cachedPosthog) return cachedPosthog;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  const mod = (await dynamicRequire("posthog-js")) as PosthogModule;
  mod.default.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    autocapture: false,
  });
  cachedPosthog = mod;
  return mod;
}

export async function track(event: AnalyticsEvent): Promise<void> {
  // Cookie-consent gate — analytics only fires when applicant accepted.
  if (typeof document !== "undefined") {
    const choice = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("viza_cookie_consent="));
    if (!choice || !choice.endsWith("=accept")) return;
  }
  const client = await getClient();
  if (!client) return;
  client.default.capture(event.name, { ...event.properties, distinct_id: event.userId });
}
