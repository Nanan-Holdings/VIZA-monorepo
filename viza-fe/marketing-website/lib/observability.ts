"use client";

/**
 * PostHog + Microsoft Clarity bootstrap for the marketing site.
 *
 * Sits underneath `lib/analytics.ts`: that module owns the marketing event
 * taxonomy and the GTM/GA4 sink, and calls in here so the same events also
 * reach PostHog. Nothing here throws — an ad blocker, a missing key or blocked
 * storage must never break a page render or the apply flow.
 *
 * Configuration (all optional; unset => that tool simply never loads):
 *   NEXT_PUBLIC_POSTHOG_KEY   — PostHog project API key (phc_...)
 *   NEXT_PUBLIC_POSTHOG_HOST  — defaults to PostHog US cloud
 *   NEXT_PUBLIC_CLARITY_ID    — Microsoft Clarity project id
 *
 * Why both: PostHog gives funnels, retention and replays keyed to a user;
 * Clarity gives unlimited free replay and heatmaps with no event budget.
 */

import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

let posthog: PostHog | null = null;
let posthogReady = false;
let clarityReady = false;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

function initPosthog(): void {
  if (posthogReady || !KEY || typeof window === "undefined") return;
  try {
    // Required lazily so a blocked/missing bundle cannot break hydration.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ph = require("posthog-js").default as PostHog;
    ph.init(KEY, {
      api_host: HOST,
      defaults: "2025-05-24",
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_exceptions: true,
      persistence: "localStorage+cookie",
      // Replay is the point: it shows where visa applicants abandon the flow.
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
      },
    });
    posthog = ph;
    posthogReady = true;
  } catch {
    posthog = null;
  }
}

function initClarity(): void {
  if (clarityReady || !CLARITY_ID || typeof window === "undefined") return;
  try {
    /* eslint-disable */
    (function (c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
    /* eslint-enable */
    clarityReady = true;
  } catch {
    clarityReady = false;
  }
}

/** Boot both tools. Idempotent; no-ops entirely when no keys are configured. */
export function initObservability(): void {
  try {
    initPosthog();
    initClarity();
  } catch {
    /* never break startup */
  }
}

/** Mirror one taxonomy event into PostHog. Called by lib/analytics.ts. */
export function phCapture(event: string, properties?: Record<string, unknown>): void {
  try {
    if (posthogReady && posthog) posthog.capture(event, properties);
  } catch {
    /* swallow */
  }
}

/** Associate the session with a known lead/user once one is identified. */
export function identifyUser(id: string, properties?: Record<string, unknown>): void {
  if (!id) return;
  try {
    if (posthogReady && posthog) posthog.identify(id, properties);
  } catch {
    /* swallow */
  }
  try {
    if (clarityReady && window.clarity) window.clarity("identify", id);
  } catch {
    /* swallow */
  }
}

/** Debug helper: what actually initialised. */
export function observabilityStatus() {
  return { posthog: posthogReady, clarity: clarityReady };
}
