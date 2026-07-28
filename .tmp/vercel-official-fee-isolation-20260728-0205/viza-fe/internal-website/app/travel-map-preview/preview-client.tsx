"use client";

import { useMemo, useState } from "react";
import { TripRouteMap, type TripMapPoint } from "@/components/client/travel/trip-route-map";

const PREVIEW_POINTS: TripMapPoint[] = [
  {
    id: "tokyo",
    kind: "city",
    label: "Tokyo",
    localName: "东京",
    subtitle: "Hotspot in Tokyo",
    imageSrc: "/globe/tokyo.jpg",
    lat: 35.6762,
    lng: 139.6503,
    city: "Tokyo",
  },
  {
    id: "singapore",
    kind: "city",
    label: "Singapore",
    localName: "新加坡",
    subtitle: "Hotspot in Singapore",
    imageSrc: "/globe/singapore.jpg",
    lat: 1.3521,
    lng: 103.8198,
    city: "Singapore",
  },
  {
    id: "sydney",
    kind: "city",
    label: "Sydney",
    localName: "悉尼",
    subtitle: "Hotspot in Sydney",
    imageSrc: "/globe/sydney.jpg",
    lat: -33.8688,
    lng: 151.2093,
    city: "Sydney",
  },
  {
    id: "beijing",
    kind: "city",
    label: "Beijing",
    localName: "北京",
    subtitle: "Hotspot in Beijing",
    imageSrc: "/globe/beijing.jpg",
    lat: 39.9042,
    lng: 116.4074,
    city: "Beijing",
  },
  {
    id: "bali",
    kind: "city",
    label: "Bali",
    localName: "巴厘岛",
    subtitle: "Hotspot in Bali",
    imageSrc: "/globe/sf.jpg",
    lat: -8.4095,
    lng: 115.1889,
    city: "Bali",
  },
];

const PREVIEW_ROUTE: Array<[number, number]> = [
  [39.9042, 116.4074],
  [35.6762, 139.6503],
  [1.3521, 103.8198],
  [-33.8688, 151.2093],
];

export default function TravelMapPreviewClient() {
  const [activePointId, setActivePointId] = useState<string | null>("tokyo");

  const points = useMemo(() => PREVIEW_POINTS, []);
  const routeCoordinates = useMemo(() => PREVIEW_ROUTE, []);

  return (
    <main className="mx-auto flex h-screen max-w-[1600px] flex-col p-4">
      <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
        Travel Map Preview (for Playwright self-test)
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-slate-50">
        <TripRouteMap
          activePointId={activePointId}
          className="h-full w-full"
          onPointSelect={setActivePointId}
          points={points}
          routeCoordinates={routeCoordinates}
        />
      </div>
    </main>
  );
}

