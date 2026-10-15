/**
 * PostHog browser client for the applicant portal (app.viza.it.com).
 *
 * The portal handles passport scans, photos and identity answers, so this
 * client is deliberately narrower than the marketing site's:
 *
 * - Session replay is disabled outright (`disable_session_recording`), and the
 *   recorder could not load anyway: `disable_external_dependency_loading`
 *   stops the SDK from fetching any lazy script (recorder, surveys, toolbar,
 *   exception and web-vitals bundles) from us-assets.i.posthog.com.
 * - Autocapture, rage clicks, dead clicks, heatmaps, exception capture and
 *   network performance capture are all off. Only explicit funnel events and
 *   pageviews are sent. `mask_all_text` and `mask_all_element_attributes` stay
 *   on as a second fence in case autocapture is ever re-enabled.
 * - Every URL-like property passes through `toRouteUrl`: query strings and
 *   hashes are dropped and id-like path segments become `:id`, so a pageview
 *   for /client/application/<uuid>?step=3 is sent as /client/application/:id.
 * - People are created only on identify (`person_profiles: identified_only`),
 *   and identify carries the Supabase auth uid plus `role` / `is_staff`. No
 *   email, name or other profile field is ever sent.
 * - Nothing loads unless NEXT_PUBLIC_POSTHOG_KEY is set, the page is served
 *   from the production host, and the visitor has not rejected analytics
 *   cookies (`viza_cookie_consent=reject|configure`).
 */
import type { CaptureResult, PostHog, PostHogConfig, Properties } from "posthog-js";

/** Hosts allowed to send data. Preview deployments and localhost never load PostHog. */
const PRODUCTION_HOSTS = new Set(["app.viza.it.com"]);

const DEFAULT_API_HOST = "https://us.i.posthog.com";
const DEFAULT_UI_HOST = "https://us.posthog.com";

const CONSENT_COOKIE = "viza_cookie_consent";

/** `users.role` values that belong to VIZA staff rather than applicants. */
const STAFF_ROLES = new Set(["admin", "staff", "doctor", "consultant"]);

/* Path segments that look like identifiers: UUIDs, long hex strings, pure
   numbers, and long tokens that contain a digit. Route words such as
   "bilingual-review-preview" contain no digit and never match. */
const ID_SEGMENT =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}|\d+|(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{20,})$/i;

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
let staffSession = false;

function readKey(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
}

function readApiHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_API_HOST;
}

/** True when the visitor explicitly declined analytics cookies. */
export function hasDeclinedAnalytics(): boolean {
  if (typeof document === "undefined") return false;
  const entry = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!entry) return false;
  const value = decodeURIComponent(entry.slice(CONSENT_COOKIE.length + 1));
  return value === "reject" || value === "configure";
}

export function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!readKey()) return false;
  if (!PRODUCTION_HOSTS.has(window.location.hostname)) return false;
  return !hasDeclinedAnalytics();
}

export function isStaffRole(role: string | null | undefined): boolean {
  return Boolean(role && STAFF_ROLES.has(role));
}

/** Replace id-like segments of a pathname with `:id`. */
export function toRoutePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => (segment && ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

/**
 * Reduce a URL to origin + route path: no query string, no hash, no ids.
 * Non-URL markers such as PostHog's "$direct" referrer pass through.
 */
export function toRouteUrl(value: string): string {
  if (!value || value.startsWith("$")) return value;
  try {
    const url = new URL(value);
    return `${url.origin}${toRoutePath(url.pathname)}`;
  } catch {
    const path = value.split(/[?#]/, 1)[0] ?? "";
    return path.startsWith("/") ? toRoutePath(path) : "";
  }
}

function isUrlProperty(key: string): boolean {
  const k = key.toLowerCase();
  return k.endsWith("url") || k.endsWith("referrer") || k.endsWith("pathname");
}

function sanitizeProperties(props: Properties | undefined): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && isUrlProperty(key)) {
      props[key] = toRouteUrl(value);
    }
  }
}

/** `before_send` hook: strips ids and query strings and tags portal events. */
export function sanitizeEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  if (hasDeclinedAnalytics()) return null;
  sanitizeProperties(event.properties);
  sanitizeProperties(event.$set);
  sanitizeProperties(event.$set_once);
  event.properties.app = "portal";
  if (staffSession) event.properties.is_staff = true;
  return event;
}

export function buildPostHogConfig(): Partial<PostHogConfig> {
  return {
    api_host: readApiHost(),
    ui_host: DEFAULT_UI_HOST,
    defaults: "2026-08-30",
    person_profiles: "identified_only",
    // Pageviews on pathname change only; before_send reduces the URL to a route.
    capture_pageview: "history_change",
    capture_pageleave: false,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    enable_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      recordHeaders: false,
      recordBody: false,
    },
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    before_send: sanitizeEvent,
  };
}

/** Load and initialise posthog-js once. Resolves to null when disabled or on failure. */
export function loadPostHog(): Promise<PostHog | null> {
  if (client) return Promise.resolve(client);
  if (!isAnalyticsEnabled()) return Promise.resolve(null);
  if (!loading) {
    loading = import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(readKey(), buildPostHogConfig());
        client = posthog;
        return posthog;
      })
      .catch(() => {
        loading = null;
        return null;
      });
  }
  return loading;
}

export interface AnalyticsIdentity {
  userId: string;
  role: string | null;
}

/**
 * Attach the session to the Supabase auth uid. Only the uid, the `users.role`
 * value and the derived staff flag are sent.
 */
export async function identifyUser(identity: AnalyticsIdentity, forceStaff = false): Promise<void> {
  const ph = await loadPostHog();
  if (!ph) return;
  const isStaff = forceStaff || isStaffRole(identity.role);
  staffSession = isStaff;
  if (ph.get_distinct_id() === identity.userId) return;
  if (ph.get_property("$user_state") === "identified") ph.reset();
  ph.identify(identity.userId, { role: identity.role ?? "applicant", is_staff: isStaff });
}

/** Forget the identified person, for sign-out. Safe to call when PostHog never loaded. */
export function resetAnalytics(): void {
  staffSession = false;
  if (!client) return;
  try {
    if (client.get_property("$user_state") === "identified") client.reset();
  } catch {
    // Analytics must never block sign-out.
  }
}

/** True when this browser currently holds an identified PostHog person. */
export function isIdentified(): boolean {
  return Boolean(client && client.get_property("$user_state") === "identified");
}

/** Fire-and-forget capture. Never throws and never delays the caller. */
export function captureEvent(name: string, properties: Properties): void {
  void loadPostHog()
    .then((ph) => {
      ph?.capture(name, properties);
    })
    .catch(() => undefined);
}

/** Test-only: drop module state between tests. */
export function __resetPostHogStateForTests(): void {
  client = null;
  loading = null;
  staffSession = false;
}
