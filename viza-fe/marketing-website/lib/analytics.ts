"use client";

/* Every event here goes to GA4 through window.dataLayer and is mirrored to
   PostHog by components/PostHogAnalytics.tsx. */
export const MARKETING_EVENTS = [
  "apply_start",
  "passport_scan_start",
  "passport_scan_complete",
  "lead_submit",
  "application_handoff",
  "portal_click",
  "contact_channel_click",
  "visa_page_view",
] as const;

export type MarketingEvent = (typeof MARKETING_EVENTS)[number];

type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: EventParams[];
  }
}

export function trackEvent(event: MarketingEvent, params: EventParams = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event,
    page_path: window.location.pathname,
    page_location: window.location.href,
    ...params,
  });
}
