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
  getZoom: () => number | undefined;
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
const ICON_MIN_SIZE = 44;
const ICON_MAX_SIZE = 84;
const LABEL_MIN_ZOOM = 3;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toWorldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const safeLat = clamp(lat, -85, 85);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function fromWorldPixel(x: number, y: number, zoom: number): GoogleLatLngLiteral {
  const scale = 256 * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale)));
  const lat = (latRad * 180) / Math.PI;
  return { lat: clamp(lat, -85, 85), lng: clamp(lng, -180, 180) };
}

type MarkerLayoutRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function hasRectOverlap(a: MarkerLayoutRect, b: MarkerLayoutRect, gap: number): boolean {
  return !(
    a.right + gap < b.left ||
    b.right + gap < a.left ||
    a.bottom + gap < b.top ||
    b.bottom + gap < a.top
  );
}

function buildOffsetCandidates(stepX: number, stepY: number): Array<{ dx: number; dy: number }> {
  const candidates: Array<{ dx: number; dy: number }> = [{ dx: 0, dy: 0 }];
  const maxRing = 4;

  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (let x = -ring; x <= ring; x += 1) {
      for (let y = -ring; y <= ring; y += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== ring) continue;
        candidates.push({
          dx: Math.round(x * stepX),
          dy: Math.round(y * stepY),
        });
      }
    }
  }

  return candidates;
}

function getAdaptiveIconSize(
  pointCount: number,
  mapWidth: number,
  mapHeight: number,
  zoom: number
): number {
  const minDim = Math.max(320, Math.min(mapWidth, mapHeight));
  const base = minDim / 11;
  const densityFactor = clamp(1 - Math.max(0, pointCount - 4) * 0.06, 0.56, 1);
  const zoomFactor = zoom >= 8 ? 1.18 : zoom >= 6 ? 1.08 : zoom >= 4 ? 0.98 : 0.88;
  return clamp(Math.round(base * densityFactor * zoomFactor), ICON_MIN_SIZE, ICON_MAX_SIZE);
}

type MarkerLayoutPoint = {
  point: TripMapPoint;
  lat: number;
  lng: number;
};

function layoutPointsWithoutOverlap(
  points: TripMapPoint[],
  zoom: number,
  mapWidth: number,
  mapHeight: number,
  iconSize: number,
  showLabel: boolean
): MarkerLayoutPoint[] {
  if (points.length === 0) return [];

  const usedRects: MarkerLayoutRect[] = [];
  const layout: MarkerLayoutPoint[] = [];
  const tailHeight = Math.round(iconSize * 0.26);
  const iconWidth = iconSize + 10;
  const iconHeight = iconSize + tailHeight + 10;
  const labelHeight = showLabel ? 18 : 0;
  const stepX = Math.max(24, Math.round(iconWidth * 0.74));
  const stepY = Math.max(20, Math.round(iconHeight * 0.62));
  const candidates = buildOffsetCandidates(stepX, stepY);
  const edgePadding = 8;
  const overlapGap = 6;

  for (const point of points) {
    const world = toWorldPixel(point.lat, point.lng, zoom);

    let best: {
      x: number;
      y: number;
      score: number;
      rect: MarkerLayoutRect;
    } | null = null;

    for (const candidate of candidates) {
      const px = world.x + candidate.dx;
      const py = world.y + candidate.dy;
      const rect: MarkerLayoutRect = {
        left: px - iconWidth / 2,
        right: px + iconWidth / 2,
        top: py - iconHeight,
        bottom: py + labelHeight,
      };

      const overlapCount = usedRects.reduce(
        (sum, other) => (hasRectOverlap(rect, other, overlapGap) ? sum + 1 : sum),
        0
      );

      const overflowX =
        Math.max(0, edgePadding - rect.left) + Math.max(0, rect.right - (mapWidth - edgePadding));
      const overflowY =
        Math.max(0, edgePadding - rect.top) + Math.max(0, rect.bottom - (mapHeight - edgePadding));
      const overflowPenalty = overflowX + overflowY;
      const movementPenalty = Math.abs(candidate.dx) * 0.06 + Math.abs(candidate.dy) * 0.08;
      const score = overlapCount * 1000 + overflowPenalty * 100 + movementPenalty;

      if (!best || score < best.score) {
        best = { x: px, y: py, score, rect };
      }
      if (score === 0) break;
    }

    if (!best) {
      best = {
        x: world.x,
        y: world.y,
        score: 0,
        rect: {
          left: world.x - iconWidth / 2,
          right: world.x + iconWidth / 2,
          top: world.y - iconHeight,
          bottom: world.y + labelHeight,
        },
      };
    }

    usedRects.push(best.rect);
    const latLng = fromWorldPixel(best.x, best.y, zoom);
    layout.push({
      point,
      lat: latLng.lat,
      lng: latLng.lng,
    });
  }

  return layout;
}

function buildMarkerIcon(
  maps: GoogleMapsNamespace,
  point: TripMapPoint,
  isActive: boolean,
  iconSize: number
): GoogleMapMarkerIcon {
  const imageUrl = resolveMarkerImageUrl(point.imageSrc);
  const bodySize = isActive ? Math.round(iconSize * 1.08) : iconSize;
  const tailHeight = Math.round(bodySize * 0.26);
  const svgWidth = bodySize + 10;
  const svgHeight = bodySize + tailHeight + 10;
  const strokeColor = isActive ? "#1d4ed8" : "#dbeafe";
  const strokeWidth = isActive ? 3 : 2;
  const radius = Math.round(bodySize * 0.24);
  const clipId = `clip_${sanitizeDomId(point.id)}_${isActive ? "a" : "n"}`;
  const bubbleBottom = bodySize + 6;
  const tailHalf = Math.max(6, Math.round(bodySize * 0.11));

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <clipPath id="${clipId}">
      <rect x="5" y="5" width="${bodySize}" height="${bodySize}" rx="${radius}" ry="${radius}" />
    </clipPath>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.26" />
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="3" y="3" width="${bodySize + 4}" height="${bodySize + 4}" rx="${radius + 3}" fill="#ffffff" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <image href="${escapeHtml(imageUrl)}" x="5" y="5" width="${bodySize}" height="${bodySize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
    <path d="M ${Math.round(svgWidth / 2) - tailHalf} ${bubbleBottom} L ${Math.round(svgWidth / 2) + tailHalf} ${bubbleBottom} L ${Math.round(svgWidth / 2)} ${bubbleBottom + tailHeight}" fill="#ffffff" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
  </g>
</svg>`;

  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

  return {
    url,
    scaledSize: new maps.Size(svgWidth, svgHeight),
    anchor: new maps.Point(Math.round(svgWidth / 2), svgHeight - 2),
    labelOrigin: new maps.Point(Math.round(svgWidth / 2), svgHeight + 11),
  };
}

function buildMarkerLabel(point: TripMapPoint, iconSize: number): GoogleMarkerLabel {
  return {
    text: point.localName ?? point.label,
    color: "#0f2a56",
    fontSize: `${clamp(Math.round(iconSize * 0.22), 10, 14)}px`,
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
  const layoutRerenderListenersRef = useRef<GoogleMarkerListener[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const fittedOnceRef = useRef(false);
  const fitKeyRef = useRef<string>("");
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

        const requestLayoutRefresh = () => {
          setLayoutVersion((value) => value + 1);
        };

        layoutRerenderListenersRef.current = [
          map.addListener("zoom_changed", requestLayoutRefresh),
        ];

        if (containerRef.current && typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(() => {
            requestLayoutRefresh();
          });
          observer.observe(containerRef.current);
          resizeObserverRef.current = observer;
        }

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
      layoutRerenderListenersRef.current.forEach((listener) => listener.remove());
      layoutRerenderListenersRef.current = [];
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

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

    const zoom = map.getZoom() ?? DEFAULT_ZOOM;
    const mapWidth = containerRef.current?.clientWidth ?? 1200;
    const mapHeight = containerRef.current?.clientHeight ?? 800;
    const iconSize = getAdaptiveIconSize(points.length, mapWidth, mapHeight, zoom);
    const showLabel = zoom >= LABEL_MIN_ZOOM;
    const laidOutPoints = layoutPointsWithoutOverlap(
      points,
      zoom,
      mapWidth,
      mapHeight,
      iconSize,
      showLabel
    );

    laidOutPoints.forEach(({ point, lat, lng }) => {
      const isActive = point.id === activePointId;
      const marker = new maps.Marker({
        map,
        position: { lat, lng },
        title: `${point.label} · ${point.subtitle}`,
        icon: buildMarkerIcon(maps, point, isActive, iconSize),
        label: showLabel ? buildMarkerLabel(point, iconSize) : undefined,
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

    const fitKey = `${pointKey}__${routeKey}`;
    const shouldFit = fitKey !== fitKeyRef.current;

    if (coordinateCount >= 2 && shouldFit) {
      map.fitBounds(bounds, 72);
      fittedOnceRef.current = true;
      fitKeyRef.current = fitKey;
    } else if (coordinateCount === 1 && points.length > 0 && shouldFit) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(6);
      fittedOnceRef.current = true;
      fitKeyRef.current = fitKey;
    } else if (!fittedOnceRef.current) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }, [
    activePointId,
    isReady,
    layoutVersion,
    onPointSelect,
    pointKey,
    points,
    routeCoordinates,
    routeKey,
  ]);

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
