"use client";

/**
 * Client-portal route timing instrument.
 *
 * Answers one question with numbers instead of stopwatch feel: "how long does a
 * tab switch inside /client take, and where did the time go?".
 *
 * Timeline recorded per navigation:
 *
 *   intent  — capture-phase pointerdown/click on the nav control (t0; what the
 *             user experiences as "I clicked")
 *   commit  — React has rendered the new route's first frame
 *   paint   — the browser has painted that frame (rAF after commit)
 *   ready   — the destination page says its primary content is on screen
 *             (pages report this through `useRouteReady`); this is the number
 *             the navigation budget is set against
 *   settled — no in-flight fetch and no DOM mutations for QUIET_MS, i.e. every
 *             background enrichment has landed too
 *
 * Alongside that it records every fetch the navigation caused, split into RSC
 * payload requests, server actions, and plain API calls, so a slow tab switch
 * points at the request that owns the time.
 *
 * Recording is always on (a few counters, no measurable overhead). The on-screen
 * overlay is opt-in via `?perf=1`, and `window.__vizaRoutePerf` is the
 * programmatic surface used by scripts/measure-portal-nav.mjs.
 */

import { useEffect } from "react";

export type NavPhase = "pending" | "committed" | "settled";

export type NavRequest = {
  kind: "rsc" | "action" | "api";
  label: string;
  startedAt: number;
  ms: number;
  status: number | null;
};

export type NavSample = {
  id: number;
  from: string;
  to: string;
  /** Milliseconds from the click to each milestone. */
  toCommit: number | null;
  toPaint: number | null;
  toReady: number | null;
  toSettled: number | null;
  phase: NavPhase;
  /** True when t0 came from a real click rather than a programmatic push. */
  fromClick: boolean;
  requests: NavRequest[];
  startedAt: number;
};

type Listener = (samples: NavSample[]) => void;

const QUIET_MS = 200;
const INTENT_MAX_AGE_MS = 2_000;
const MAX_SAMPLES = 60;

type PerfState = {
  samples: NavSample[];
  current: NavSample | null;
  intentAt: number | null;
  nextId: number;
  inFlight: number;
  lastActivityAt: number;
  listeners: Set<Listener>;
  settleTimer: number | null;
  installed: boolean;
  observer: MutationObserver | null;
};

const STATE_KEY = "__vizaRoutePerfState";

function getState(): PerfState {
  const holder = window as unknown as Record<string, PerfState | undefined>;
  let state = holder[STATE_KEY];
  if (!state) {
    state = {
      samples: [],
      current: null,
      intentAt: null,
      nextId: 1,
      inFlight: 0,
      lastActivityAt: 0,
      listeners: new Set(),
      settleTimer: null,
      installed: false,
      observer: null,
    };
    holder[STATE_KEY] = state;
  }
  return state;
}

function now() {
  return performance.now();
}

function emit(state: PerfState) {
  const snapshot = [...state.samples];
  state.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // A broken subscriber must never break navigation.
    }
  });
}

function classify(url: string, init?: RequestInit): NavRequest["kind"] {
  if (url.includes("_rsc=")) return "rsc";
  const headers = init?.headers;
  if (headers) {
    const has = (name: string) => {
      if (headers instanceof Headers) return headers.has(name);
      if (Array.isArray(headers)) {
        return headers.some(([key]) => key.toLowerCase() === name);
      }
      return Object.keys(headers).some((key) => key.toLowerCase() === name);
    };
    if (has("next-action")) return "action";
  }
  return "api";
}

function shortLabel(url: string, kind: NavRequest["kind"]) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (kind === "rsc") return `rsc ${parsed.pathname}`;
    if (kind === "action") return `action ${parsed.pathname}`;
    return parsed.pathname;
  } catch {
    return url.slice(0, 80);
  }
}

function touchActivity(state: PerfState) {
  state.lastActivityAt = now();
  scheduleSettleCheck(state);
}

function scheduleSettleCheck(state: PerfState) {
  if (!state.current || state.current.toCommit === null) return;
  if (state.settleTimer !== null) {
    window.clearTimeout(state.settleTimer);
  }
  state.settleTimer = window.setTimeout(() => {
    state.settleTimer = null;
    const sample = state.current;
    if (!sample || sample.toCommit === null) return;
    if (state.inFlight > 0) {
      scheduleSettleCheck(state);
      return;
    }
    if (now() - state.lastActivityAt < QUIET_MS) {
      scheduleSettleCheck(state);
      return;
    }
    sample.toSettled = state.lastActivityAt - sample.startedAt;
    sample.phase = "settled";
    state.current = null;
    emit(state);
  }, QUIET_MS);
}

/** Patch fetch once so request cost can be attributed to a navigation. */
function installFetchProbe(state: PerfState) {
  const original = window.fetch;
  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const kind = classify(url, init ?? (input instanceof Request ? { headers: input.headers } : undefined));
    const startedAt = now();
    state.inFlight += 1;
    touchActivity(state);

    const record = (status: number | null) => {
      state.inFlight = Math.max(0, state.inFlight - 1);
      const sample = state.current ?? state.samples[0];
      if (sample && startedAt >= sample.startedAt - 50) {
        sample.requests.push({
          kind,
          label: shortLabel(url, kind),
          startedAt: startedAt - sample.startedAt,
          ms: now() - startedAt,
          status,
        });
      }
      touchActivity(state);
      emit(state);
    };

    return original
      .call(window, input as RequestInfo, init)
      .then((response) => {
        record(response.status);
        return response;
      })
      .catch((error: unknown) => {
        record(null);
        throw error;
      });
  };
}

function installDomProbe(state: PerfState) {
  const observer = new MutationObserver(() => {
    if (state.current && state.current.toCommit !== null) {
      touchActivity(state);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  state.observer = observer;
}

function installIntentProbe(state: PerfState) {
  const onIntent = () => {
    state.intentAt = now();
  };
  window.addEventListener("pointerdown", onIntent, { capture: true });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") onIntent();
  }, { capture: true });
}

/** Idempotent: safe to call from every mount. */
export function installRoutePerf() {
  if (typeof window === "undefined") return;
  const state = getState();
  if (state.installed) return;
  state.installed = true;
  installFetchProbe(state);
  installDomProbe(state);
  installIntentProbe(state);
  exposeApi(state);
}

/** Called when the route key (pathname + search) changes. */
export function beginNavigation(from: string, to: string) {
  if (typeof window === "undefined") return;
  const state = getState();
  const intentAt = state.intentAt;
  const fromClick = intentAt !== null && now() - intentAt < INTENT_MAX_AGE_MS;
  const startedAt = fromClick && intentAt !== null ? intentAt : now();
  state.intentAt = null;

  const sample: NavSample = {
    id: state.nextId++,
    from,
    to,
    toCommit: null,
    toPaint: null,
    toReady: null,
    toSettled: null,
    phase: "pending",
    fromClick,
    requests: [],
    startedAt,
  };
  state.current = sample;
  state.samples.unshift(sample);
  if (state.samples.length > MAX_SAMPLES) state.samples.length = MAX_SAMPLES;
  emit(state);
}

/** Called from a layout effect once the new route has rendered. */
export function markCommit() {
  if (typeof window === "undefined") return;
  const state = getState();
  const sample = state.current;
  if (!sample || sample.toCommit !== null) return;
  sample.toCommit = now() - sample.startedAt;
  sample.phase = "committed";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (sample.toPaint === null) {
        sample.toPaint = now() - sample.startedAt;
        emit(state);
      }
    });
  });
  touchActivity(state);
  emit(state);
}

/**
 * Marks the current navigation's primary content as on screen.
 *
 * Called by pages through `useRouteReady` once they have real content rather
 * than skeletons. Only the first call per navigation counts.
 */
export function markReady() {
  if (typeof window === "undefined") return;
  const state = getState();
  const sample = state.current ?? state.samples[0];
  if (!sample || sample.toReady !== null) return;
  sample.toReady = now() - sample.startedAt;
  emit(state);
}

export function subscribeRoutePerf(listener: Listener) {
  const state = getState();
  state.listeners.add(listener);
  listener([...state.samples]);
  return () => {
    state.listeners.delete(listener);
  };
}

export function getSamples(): NavSample[] {
  if (typeof window === "undefined") return [];
  return [...getState().samples];
}

function summarize(samples: NavSample[]) {
  const settled = samples.filter((sample) => sample.toSettled !== null);
  const values = settled
    .map((sample) => sample.toReady ?? (sample.toSettled as number))
    .sort((a, b) => a - b);
  const percentile = (p: number) =>
    values.length === 0 ? null : Math.round(values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]);
  return {
    count: settled.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    worst: values.length ? Math.round(values[values.length - 1]) : null,
    rows: settled.map((sample) => ({
      to: sample.to,
      commit: sample.toCommit === null ? null : Math.round(sample.toCommit),
      paint: sample.toPaint === null ? null : Math.round(sample.toPaint),
      ready: sample.toReady === null ? null : Math.round(sample.toReady),
      settled: Math.round(sample.toSettled as number),
      requests: sample.requests.map((request) => ({
        kind: request.kind,
        label: request.label,
        at: Math.round(request.startedAt),
        ms: Math.round(request.ms),
      })),
    })),
  };
}

function exposeApi(state: PerfState) {
  (window as unknown as Record<string, unknown>).__vizaRoutePerf = {
    get samples() {
      return [...state.samples];
    },
    summary: () => summarize([...state.samples]),
    clear: () => {
      state.samples.length = 0;
      state.current = null;
      emit(state);
    },
    /** Resolves once every recorded navigation has settled (or after timeout). */
    waitForIdle: (timeoutMs = 15_000) =>
      new Promise<void>((resolve) => {
        const startedAt = now();
        const tick = () => {
          const pending = state.samples.some((sample) => sample.phase !== "settled");
          if (!pending || now() - startedAt > timeoutMs) {
            resolve();
            return;
          }
          window.setTimeout(tick, 50);
        };
        tick();
      }),
  };
}

/**
 * Reports when a portal page's primary content is on screen.
 *
 * Pages call this with the same condition that decides whether they render
 * content or skeletons, so the recorded "ready" time is the moment the
 * applicant can actually read the page — not the moment every background
 * enrichment has finished.
 */
export function useRouteReady(ready: boolean) {
  useEffect(() => {
    if (ready) markReady();
  }, [ready]);
}
