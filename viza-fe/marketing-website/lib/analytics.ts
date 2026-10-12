"use client";

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
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event,
    page_path: window.location.pathname,
    page_location: window.location.href,
    ...params,
  });
}
