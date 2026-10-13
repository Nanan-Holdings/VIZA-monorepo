"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { PostHogInterface } from "posthog-js";

/*
 * PostHog: product analytics, session replay and exception capture.
 *
 * Privacy model, in order of strength:
 *
 * 1. Session replay is OFF at init (`disable_session_recording: true`) and is
 *    only switched on by `applyRoutePolicy` once the current path is known to
 *    be safe. A hard load straight onto /apply therefore never starts the
 *    recorder at all.
 * 2. `applyRoutePolicy` runs again on every client-side navigation
 *    (usePathname). A recorder started on the home page keeps running across
 *    soft navigations, so entering an excluded route calls
 *    `stopSessionRecording()`, and leaving it calls `startSessionRecording()`.
 * 3. React commits the new page before effects run, so the first frame of an
 *    excluded page could reach the recorder before the stop lands. Every
 *    excluded page is therefore also wrapped in an element carrying
 *    REPLAY_BLOCK_ATTRIBUTE, which is the recorder's `blockSelector`: rrweb
 *    serialises that subtree as an empty placeholder (no text, no images, no
 *    passport scans) and ignores mutations inside it.
 * 4. On excluded routes autocapture keeps recording clicks, but with
 *    `mask_all_text` on, so a click on a rendered passport field does not ship
 *    its text as `$el_text`.
 * 5. Replay never records network request or response headers or bodies, on
 *    any route: `recordHeaders: false` and `recordBody: false` are set
 *    explicitly, and posthog-js lets an explicit client `false` override the
 *    project's remote "capture network payloads" setting. Input values stay
 *    masked (`maskAllInputs: true`).
 */

/** Attribute that makes the replay recorder skip a subtree entirely. */
export const REPLAY_BLOCK_ATTRIBUTE = "data-ph-block";

/* Hosts that are allowed to send data. Preview deployments, localhost and the
   portal never initialise PostHog. */
const PRODUCTION_HOSTS = new Set(["viza.it.com", "www.viza.it.com"]);

/* Route prefixes (after the optional locale segment) that must never be
   recorded. /apply shows passport scans and the identity details read from
   them; /contact collects name, email, phone and passport nationality. */
const REPLAY_EXCLUDED_PREFIXES = ["/apply", "/contact"];
const LOCALE_PREFIX = /^\/(?:en|zh-CN)(?=\/|$)/;

export function isReplayExcludedPath(pathname: string): boolean {
  const path = pathname.replace(LOCALE_PREFIX, "") || "/";
  return REPLAY_EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

let client: PostHogInterface | null = null;
let loading = false;
let lastExcluded: boolean | null = null;

function applyRoutePolicy(pathname: string) {
  if (!client) return;
  const excluded = isReplayExcludedPath(pathname);
  if (excluded === lastExcluded) return;
  lastExcluded = excluded;
  client.set_config({ mask_all_text: excluded });
  if (excluded) {
    client.stopSessionRecording();
  } else {
    client.startSessionRecording();
  }
}

export function PostHogAnalytics({ token }: { token: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (client) {
      applyRoutePolicy(pathname);
      return;
    }
    if (loading || !token || !PRODUCTION_HOSTS.has(window.location.hostname)) return;
    loading = true;
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(token, {
        api_host: "https://us.i.posthog.com",
        ui_host: "https://us.posthog.com",
        defaults: "2026-08-30",
        person_profiles: "identified_only",
        capture_exceptions: true,
        disable_session_recording: true,
        session_recording: {
          maskAllInputs: true,
          blockSelector: `[${REPLAY_BLOCK_ATTRIBUTE}]`,
          recordHeaders: false,
          recordBody: false,
        },
        loaded: (instance) => {
          client = instance;
          applyRoutePolicy(window.location.pathname);
        },
      });
    });
  }, [token, pathname]);

  return null;
}
