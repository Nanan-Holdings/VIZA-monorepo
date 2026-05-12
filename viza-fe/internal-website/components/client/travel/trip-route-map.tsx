"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TripMapPoint = {
  id: string;
  kind: "city" | "hotel" | "hotspot";
  label: string;
  subtitle: string;
  localName?: string;
  intro?: string;
  countryLabel?: string;
  recommendedDays?: string;
  imageSrc: string;
  lat: number;
  lng: number;
  city?: string;
};

type TripRouteMapProps = {
  points: TripMapPoint[];
  routeCoordinates: Array<[number, number]>;
  activePointId?: string | null;
  onPointSelect?: (id: string) => void;
  onAddDestination?: (point: TripMapPoint) => void;
  className?: string;
};

type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleMarkerListener = {
  remove: () => void;
};

type GoogleMapMarkerIcon = {
  url: string;
  scaledSize?: unknown;
  anchor?: unknown;
  labelOrigin?: unknown;
};

type GoogleMarkerLabel = {
  text: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
};

type GoogleMarkerInstance = {
  addListener: (eventName: string, handler: () => void) => GoogleMarkerListener;
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number) => void;
  setCenter: (center: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  addListener: (eventName: string, handler: () => void) => GoogleMarkerListener;
};

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setPath: (path: GoogleLatLngLiteral[]) => void;
};

type GoogleInfoWindowInstance = {
  setContent: (content: string) => void;
  open: (options: {
    map: GoogleMapInstance;
    anchor?: GoogleMarkerInstance;
    shouldFocus?: boolean;
  }) => void;
  close: () => void;
};

type GoogleLatLngBoundsInstance = {
  extend: (point: GoogleLatLngLiteral) => void;
};

type GoogleMapsNamespace = {
  Map: new (
    container: HTMLElement,
    options: {
      center: GoogleLatLngLiteral;
      zoom: number;
      minZoom?: number;
      maxZoom?: number;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
      zoomControl?: boolean;
      gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
      restriction?: {
        latLngBounds: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
        strictBounds: boolean;
      };
    }
  ) => GoogleMapInstance;
  Marker: new (options: {
    position: GoogleLatLngLiteral;
    map?: GoogleMapInstance | null;
    title?: string;
    icon?: GoogleMapMarkerIcon;
    label?: GoogleMarkerLabel;
    optimized?: boolean;
    zIndex?: number;
  }) => GoogleMarkerInstance;
  Polyline: new (options: {
    path: GoogleLatLngLiteral[];
    geodesic?: boolean;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    map?: GoogleMapInstance | null;
  }) => GooglePolylineInstance;
  InfoWindow: new (options?: { content?: string; disableAutoPan?: boolean }) => GoogleInfoWindowInstance;
  LatLngBounds: new () => GoogleLatLngBoundsInstance;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  event: {
    clearInstanceListeners: (instance: unknown) => void;
    trigger: (instance: unknown, eventName: string) => void;
    addListener: (
      instance: unknown,
      eventName: string,
      handler: () => void
    ) => GoogleMarkerListener;
    addListenerOnce: (
      instance: unknown,
      eventName: string,
      handler: () => void
    ) => GoogleMarkerListener;
  };
};

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsNamespace;
    };
  }
}

const DEFAULT_CENTER: GoogleLatLngLiteral = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 2;
const MIN_ZOOM = 2;
const SCRIPT_ID = "viza-travel-google-maps-script";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let mapsLoaderPromise: Promise<GoogleMapsNamespace> | null = null;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveMarkerImageUrl(imageSrc: string): string {
  if (!imageSrc) return "";
  if (/^https?:\/\//i.test(imageSrc) || imageSrc.startsWith("data:")) {
    return imageSrc;
  }
  if (imageSrc.startsWith("/")) {
    return `${window.location.origin}${imageSrc}`;
  }
  return imageSrc;
}

function buildMarkerIcon(
  maps: GoogleMapsNamespace,
  point: TripMapPoint,
  isActive: boolean
): GoogleMapMarkerIcon {
  const size = isActive ? 60 : 52;
  const imageUrl = resolveMarkerImageUrl(point.imageSrc);

  return {
    url: imageUrl,
    scaledSize: new maps.Size(size, size),
    anchor: new maps.Point(Math.round(size / 2), Math.round(size / 2)),
    labelOrigin: new maps.Point(Math.round(size / 2), size + 14),
  };
}

function buildMarkerLabel(point: TripMapPoint): GoogleMarkerLabel {
  return {
    text: point.localName ?? point.label,
    color: "#12254c",
    fontSize: "12px",
    fontWeight: "700",
  };
}

function buildHoverCardHtml(
  point: TripMapPoint,
  addButtonId: string | null,
  buttonLabel: string
): string {
  const cityOrCountry = point.countryLabel ?? point.subtitle;
  const intro =
    point.intro ??
    `${point.subtitle}。推荐先锁定核心景点，再按地理位置安排同一天路线，减少来回折返。`;
  const duration = point.recommendedDays ?? "2-4 days";
  const imageUrl = resolveMarkerImageUrl(point.imageSrc);

  return `
<div style="width:300px;max-width:300px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <div style="border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.16);background:#fff;">
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(point.label)}" style="display:block;width:100%;height:170px;object-fit:cover;" />
    <div style="padding:12px 14px 14px;">
      <div style="font-size:20px;font-weight:700;line-height:1.15;">${escapeHtml(point.label)}</div>
      <div style="margin-top:4px;font-size:13px;color:#475569;">${escapeHtml(point.localName ?? point.subtitle)}</div>
      <div style="margin-top:10px;border-radius:10px;background:#eff6ff;padding:8px 10px;font-size:13px;line-height:1.4;color:#1e3a8a;">
        ${escapeHtml(intro)}
      </div>
      <div style="margin-top:10px;font-size:13px;color:#334155;">
        <span style="font-weight:600;">${escapeHtml(cityOrCountry)}</span> · ${escapeHtml(duration)}
      </div>
      ${
        addButtonId
          ? `<div style="margin-top:12px;">
        <button id="${addButtonId}" type="button" style="width:100%;border:0;border-radius:10px;padding:10px 12px;background:#2563eb;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">
          ${escapeHtml(buttonLabel)}
        </button>
      </div>`
          : ""
      }
    </div>
  </div>
</div>`;
}

function sanitizeDomId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  }

  const existingMaps = window.google?.maps;
  if (existingMaps) return existingMaps;
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const resolveMaps = () => {
      const maps = window.google?.maps;
      if (maps) {
        resolve(maps);
        return;
      }
      reject(new Error("Google Maps API loaded, but window.google.maps is unavailable"));
    };

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", resolveMaps, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps script")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=zh-CN&region=CN&v=weekly`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolveMaps, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load Google Maps script")),
      { once: true }
    );
    document.head.appendChild(script);
  })
    .catch((error) => {
      mapsLoaderPromise = null;
      throw error;
    });

  return mapsLoaderPromise;
}

export function TripRouteMap({
  points,
  routeCoordinates,
  activePointId,
  onPointSelect,
  onAddDestination,
  className,
}: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const routeRef = useRef<GooglePolylineInstance | null>(null);
  const hoverInfoRef = useRef<GoogleInfoWindowInstance | null>(null);
  const markersRef = useRef<
    Array<{
      marker: GoogleMarkerInstance;
      listeners: GoogleMarkerListener[];
      id: string;
    }>
  >([]);
  const fittedOnceRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pointKey = useMemo(
    () => points.map((point) => `${point.id}:${point.lat}:${point.lng}`).join("|"),
    [points]
  );

  const routeKey = useMemo(
    () => routeCoordinates.map(([lat, lng]) => `${lat},${lng}`).join("|"),
    [routeCoordinates]
  );

  useEffect(() => {
    let disposed = false;

    void (async () => {
      if (!containerRef.current || mapRef.current) return;
      try {
        const maps = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        if (disposed || !containerRef.current) return;

        mapsRef.current = maps;
        const map = new maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: "greedy",
          restriction: {
            latLngBounds: {
              north: 85,
              south: -85,
              west: -179.9,
              east: 179.9,
            },
            strictBounds: true,
          },
        });

        routeRef.current = new maps.Polyline({
          path: [],
          geodesic: true,
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map,
        });
        hoverInfoRef.current = new maps.InfoWindow({
          disableAutoPan: true,
        });

        mapRef.current = map;
        map.addListener("click", () => {
          hoverInfoRef.current?.close();
        });
        window.setTimeout(() => {
          maps.event.trigger(map, "resize");
        }, 0);
        setLoadError(null);
        setIsReady(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialize Google Maps";
        setLoadError(message);
      }
    })();

    return () => {
      disposed = true;
      setIsReady(false);

      markersRef.current.forEach(({ marker, listeners }) => {
        listeners.forEach((listener) => listener.remove());
        marker.setMap(null);
      });
      markersRef.current = [];

      if (routeRef.current) {
        routeRef.current.setMap(null);
        routeRef.current = null;
      }

      if (hoverInfoRef.current) {
        hoverInfoRef.current.close();
        hoverInfoRef.current = null;
      }

      mapRef.current = null;
      mapsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const map = mapRef.current;
    const maps = mapsRef.current;
    const route = routeRef.current;
    const hoverInfo = hoverInfoRef.current;
    if (!map || !maps || !route || !hoverInfo) return;

    markersRef.current.forEach(({ marker, listeners }) => {
      listeners.forEach((listener) => listener.remove());
      marker.setMap(null);
    });
    markersRef.current = [];

    points.forEach((point) => {
      const isActive = point.id === activePointId;
      const marker = new maps.Marker({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: `${point.label} · ${point.subtitle}`,
        icon: buildMarkerIcon(maps, point, isActive),
        label: buildMarkerLabel(point),
        optimized: false,
        zIndex: isActive ? 1000 : 100,
      });

      const openPreview = () => {
        const buttonId = `trip-map-add-${sanitizeDomId(point.id)}`;
        const cityForPlan = point.localName ?? point.label;
        hoverInfo.setContent(
          buildHoverCardHtml(
            point,
            onAddDestination ? buttonId : null,
            `加入我的计划：${cityForPlan}`
          )
        );
        hoverInfo.open({
          map,
          anchor: marker,
          shouldFocus: false,
        });

        if (onAddDestination) {
          maps.event.addListenerOnce(hoverInfo as unknown, "domready", () => {
            const button = document.getElementById(buttonId);
            if (!button) return;
            button.addEventListener(
              "click",
              (event) => {
                event.preventDefault();
                event.stopPropagation();
                onAddDestination(point);
                hoverInfo.close();
              },
              { once: true }
            );
          });
        }
      };

      const listeners = [
        marker.addListener("click", () => {
          onPointSelect?.(point.id);
          openPreview();
        }),
        marker.addListener("mouseover", openPreview),
      ];

      markersRef.current.push({ marker, listeners, id: point.id });
    });

    const routePath = routeCoordinates.map(([lat, lng]) => ({ lat, lng }));
    if (routePath.length >= 2) {
      route.setPath(routePath);
      route.setMap(map);
    } else {
      route.setPath([]);
      route.setMap(null);
    }

    const bounds = new maps.LatLngBounds();
    let coordinateCount = 0;

    routePath.forEach((point) => {
      bounds.extend(point);
      coordinateCount += 1;
    });
    points.forEach((point) => {
      bounds.extend({ lat: point.lat, lng: point.lng });
      coordinateCount += 1;
    });

    if (coordinateCount >= 2) {
      map.fitBounds(bounds, 72);
      fittedOnceRef.current = true;
    } else if (coordinateCount === 1 && points.length > 0) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(6);
      fittedOnceRef.current = true;
    } else if (!fittedOnceRef.current) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }, [activePointId, isReady, onPointSelect, pointKey, points, routeCoordinates, routeKey]);

  return (
    <div className={`relative ${className ?? ""}`} data-testid="trip-route-map">
      <div className="h-full w-full" ref={containerRef} />
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 p-4 text-center text-sm text-slate-700">
          地图加载失败：{loadError}
        </div>
      ) : null}
    </div>
  );
}
