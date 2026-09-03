"use client";

/**
 * Mounts the route timing instrument for the client portal and, when the URL
 * carries `?perf=1`, shows a small overlay with the last few tab switches.
 *
 * The overlay is a debugging surface, not product UI: it stays out of the
 * layout (fixed, pointer-events limited to itself) and renders nothing at all
 * unless perf mode is on.
 */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  beginNavigation,
  installRoutePerf,
  markCommit,
  subscribeRoutePerf,
  type NavSample,
} from "@/lib/client/route-perf";

const PERF_FLAG_KEY = "viza_route_perf";
/** Anything over this is a tab switch the applicant notices. */
const BUDGET_MS = 500;

function usePerfEnabled(searchParams: URLSearchParams | null) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const param = searchParams?.get("perf");
    if (param === "1") {
      window.localStorage.setItem(PERF_FLAG_KEY, "1");
      setEnabled(true);
      return;
    }
    if (param === "0") {
      window.localStorage.removeItem(PERF_FLAG_KEY);
      setEnabled(false);
      return;
    }
    setEnabled(window.localStorage.getItem(PERF_FLAG_KEY) === "1");
  }, [searchParams]);

  return enabled;
}

export function RoutePerfMonitor() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
  const enabled = usePerfEnabled(searchParams);
  const [samples, setSamples] = useState<NavSample[]>([]);

  // Install before anything else so the first navigation is already covered.
  useEffect(() => {
    installRoutePerf();
  }, []);

  // One begin per route key change, one commit once the new route rendered.
  useEffect(() => {
    installRoutePerf();
    beginNavigation(previousRouteKey ?? "(initial)", routeKey);
    previousRouteKey = routeKey;
    markCommit();
  }, [routeKey]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeRoutePerf(setSamples);
  }, [enabled]);

  if (!enabled) return null;

  const recent = samples.slice(0, 6);

  return (
    <div
      className="pointer-events-auto fixed bottom-3 left-3 z-[9999] max-h-[45vh] w-[min(420px,calc(100vw-24px))] overflow-auto rounded-xl border border-black/10 bg-white/95 p-3 font-mono text-[11px] leading-tight shadow-lg backdrop-blur"
      data-testid="route-perf-overlay"
    >
      <div className="mb-2 flex items-center justify-between font-sans text-[11px] font-semibold text-gray-700">
        <span>Route timing — content ready (budget {BUDGET_MS}ms)</span>
        <a className="text-gray-400 underline" href={`${pathname}?perf=0`}>
          hide
        </a>
      </div>
      {recent.length === 0 ? (
        <div className="text-gray-400">Switch tabs to record a sample…</div>
      ) : (
        <ul className="space-y-2">
          {recent.map((sample) => {
            // The budget is about when the page is readable, so that is the
            // headline; the settled time sits underneath as context.
            const ready = sample.toReady ?? sample.toSettled;
            const over = ready !== null && ready > BUDGET_MS;
            return (
              <li key={sample.id} className="border-t border-black/5 pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-gray-600">{sample.to.replace(/\?$/, "")}</span>
                  <span className={over ? "font-bold text-red-600" : "font-bold text-emerald-600"}>
                    {ready === null ? "…" : `${Math.round(ready)}ms`}
                  </span>
                </div>
                <div className="text-gray-400">
                  commit {sample.toCommit === null ? "…" : Math.round(sample.toCommit)}ms · paint{" "}
                  {sample.toPaint === null ? "…" : Math.round(sample.toPaint)}ms · settled{" "}
                  {sample.toSettled === null ? "…" : Math.round(sample.toSettled)}ms
                  {sample.fromClick ? "" : " · programmatic"}
                </div>
                {sample.requests.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-gray-500">
                    {sample.requests
                      .slice()
                      .sort((a, b) => b.ms - a.ms)
                      .slice(0, 4)
                      .map((request, index) => (
                        <li key={`${sample.id}-${index}`} className="flex justify-between gap-2">
                          <span className="truncate">
                            [{request.kind}] {request.label}
                          </span>
                          <span>{Math.round(request.ms)}ms</span>
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

let previousRouteKey: string | null = null;
