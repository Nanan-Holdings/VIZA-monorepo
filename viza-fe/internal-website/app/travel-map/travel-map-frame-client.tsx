"use client";

import { useEffect, useState } from "react";
import { TripRouteMapSurface, type TripMapPoint } from "@/components/client/travel/trip-route-map";
import { MAP_FRAME_CHANNEL, isTripMapPoint, type MapFrameSnapshot } from "@/components/client/travel/trip-route-map-frame";
import type { InterfaceLocale } from "@/lib/i18n/locale";

/** This public shell has no applicant data; only its same-origin parent supplies map points. */
export function TravelMapFrameClient({ locale }: { locale: InterfaceLocale }) {
  const [snapshot, setSnapshot] = useState<MapFrameSnapshot | null>(null);
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as { channel?: unknown; type?: unknown; payload?: MapFrameSnapshot };
      if (data.channel !== MAP_FRAME_CHANNEL || data.type !== "snapshot") return;
      const payload = data.payload;
      if (!payload || !Array.isArray(payload.points) || !payload.points.every(isTripMapPoint)
        || !Array.isArray(payload.routeCoordinates)
        || !payload.routeCoordinates.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite))) return;
      setSnapshot(payload);
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ channel: MAP_FRAME_CHANNEL, type: "ready", locale }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, [locale]);

  const select = (id: string) => window.parent.postMessage({ channel: MAP_FRAME_CHANNEL, type: "select", id }, window.location.origin);
  const add = (point: TripMapPoint) => window.parent.postMessage({ channel: MAP_FRAME_CHANNEL, type: "add", point }, window.location.origin);
  return <main className="h-dvh w-full overflow-hidden">
    {snapshot ? <TripRouteMapSurface
      {...snapshot}
      interfaceLocale={locale}
      onPointSelect={snapshot.canSelect ? select : undefined}
      onAddDestination={snapshot.canAdd ? add : undefined}
      className="h-full w-full"
    /> : <div role="status" className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-600">
      {locale === "zh" ? "正在加载地图…" : "Loading map…"}
    </div>}
  </main>;
}
