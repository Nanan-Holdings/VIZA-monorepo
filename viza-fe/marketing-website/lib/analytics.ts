"use client";

import { phCapture } from "./observability";

export type MarketingEvent =
  | "apply_start"
  | "passport_scan_start"
  | "passport_scan_complete"
  | "lead_submit"
  | "checkout_start"
  | "portal_click"
  | "contact_channel_click"
  | "visa_page_view";

type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: EventParams[];
  }
}

export function trackEvent(event: MarketingEvent, params: EventParams = {}) {
  if (typeof window === "undefined") return;
  const payload = {
    page_path: window.location.pathname,
    page_location: window.location.href,
    ...params,
  };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...payload });
  // Same taxonomy, second sink. No-ops until a PostHog key is configured.
  phCapture(event, payload);
}
