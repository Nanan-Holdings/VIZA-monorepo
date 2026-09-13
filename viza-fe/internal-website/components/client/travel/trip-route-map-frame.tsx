"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { TripMapPoint, TripRouteMapProps } from "./trip-route-map";

export type MapFrameSnapshot = Omit<TripRouteMapProps, "onPointSelect" | "onAddDestination" | "className"> & {
  canSelect: boolean;
  canAdd: boolean;
};

export const MAP_FRAME_CHANNEL = "viza:travel-map:v1";

/** Maps fixes its language at SDK load. Reload its document, keeping trip drafts mounted. */
export function TripRouteMapFrame({ onPointSelect, onAddDestination, className, ...options }: TripRouteMapProps) {
  const locale = normalizeInterfaceLocale(useLocale());
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadedLocale, setLoadedLocale] = useState<string | null>(null);
  const latestRef = useRef({ options, onPointSelect, onAddDestination });
  useEffect(() => {
    latestRef.current = { options, onPointSelect, onAddDestination };
  }, [options, onPointSelect, onAddDestination]);

  const sendSnapshot = useCallback(() => {
    const latest = latestRef.current;
    iframeRef.current?.contentWindow?.postMessage({
      channel: MAP_FRAME_CHANNEL,
      type: "snapshot",
      payload: { ...latest.options, canSelect: Boolean(latest.onPointSelect), canAdd: Boolean(latest.onAddDestination) },
    }, window.location.origin);
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as { channel?: unknown; type?: unknown; locale?: unknown; id?: unknown; point?: unknown };
      if (data.channel !== MAP_FRAME_CHANNEL) return;
      if (data.type === "ready" && data.locale === locale) {
        setLoadedLocale(locale);
        sendSnapshot();
      } else if (data.type === "select" && typeof data.id === "string") {
        latestRef.current.onPointSelect?.(data.id);
      } else if (data.type === "add" && isTripMapPoint(data.point)) {
        latestRef.current.onAddDestination?.(data.point);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [locale, sendSnapshot]);

  useEffect(() => {
    if (loadedLocale === locale) sendSnapshot();
  }, [loadedLocale, locale, options, onPointSelect, onAddDestination, sendSnapshot]);

  return <iframe
    key={locale}
    ref={iframeRef}
    src={`/travel-map?locale=${locale}`}
    title={locale === "zh" ? "旅行地图" : "Travel map"}
    className={cn("block h-full w-full border-0", className)}
    allow="fullscreen"
    data-testid="trip-route-map"
  />;
}

export function isTripMapPoint(value: unknown): value is TripMapPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<TripMapPoint>;
  return typeof point.id === "string" && typeof point.label === "string"
    && typeof point.subtitle === "string" && typeof point.imageSrc === "string"
    && (point.kind === "city" || point.kind === "hotel" || point.kind === "hotspot")
    && typeof point.lat === "number" && Number.isFinite(point.lat)
    && typeof point.lng === "number" && Number.isFinite(point.lng);
}
