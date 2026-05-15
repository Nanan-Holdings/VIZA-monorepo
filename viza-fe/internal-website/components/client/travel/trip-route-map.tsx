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
  setIcon: (icon?: GoogleMapMarkerIcon) => void;
  setLabel: (label?: GoogleMarkerLabel) => void;
  setZIndex: (zIndex: number) => void;
};

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number) => void;
  setCenter: (center: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  getCenter: () => { lat: () => number; lng: () => number } | null;
  getZoom: () => number | undefined;
  addListener: (eventName: string, handler: () => void) => GoogleMarkerListener;
};

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setPath: (path: GoogleLatLngLiteral[]) => void;
};

type GoogleInfoWindowInstance = {
  setContent: (content: string) => void;
  setOptions: (options: {
    disableAutoPan?: boolean;
    maxWidth?: number;
    pixelOffset?: unknown;
  }) => void;
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
const markerIconCache = new Map<string, Promise<string>>();

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

function toScreenPixel(
  lat: number,
  lng: number,
  center: GoogleLatLngLiteral,
  zoom: number,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } {
  const centerWorld = toWorldPixel(center.lat, center.lng, zoom);
  const world = toWorldPixel(lat, lng, zoom);
  return {
    x: mapWidth / 2 + (world.x - centerWorld.x),
    y: mapHeight / 2 + (world.y - centerWorld.y),
  };
}

function getAdaptiveIconSize(
  pointCount: number,
  mapWidth: number,
  mapHeight: number
): number {
  const minDim = Math.max(320, Math.min(mapWidth, mapHeight));
  const base = minDim / 11;
  const densityFactor = clamp(1 - Math.max(0, pointCount - 4) * 0.07, 0.52, 1);
  return clamp(Math.round(base * densityFactor), ICON_MIN_SIZE, ICON_MAX_SIZE);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function createBubbleMarkerDimensions(iconSize: number, isActive: boolean) {
  const bodySize = isActive ? Math.round(iconSize * 1.08) : iconSize;
  const tailHeight = Math.round(bodySize * 0.26);
  const width = bodySize + 10;
  const height = bodySize + tailHeight + 10;
  const strokeColor = isActive ? "#1d4ed8" : "#dbeafe";
  const strokeWidth = isActive ? 3 : 2;
  const borderRadius = Math.round(bodySize * 0.24);
  const tailHalf = Math.max(6, Math.round(bodySize * 0.11));
  const bubbleBottom = bodySize + 6;

  return {
    bodySize,
    tailHeight,
    width,
    height,
    strokeColor,
    strokeWidth,
    borderRadius,
    tailHalf,
    bubbleBottom,
  };
}

function createBubblePath(
  ctx: CanvasRenderingContext2D,
  dims: ReturnType<typeof createBubbleMarkerDimensions>
): void {
  drawRoundedRectPath(ctx, 3, 3, dims.bodySize + 4, dims.bodySize + 4, dims.borderRadius + 3);
  ctx.moveTo(Math.round(dims.width / 2) - dims.tailHalf, dims.bubbleBottom);
  ctx.lineTo(Math.round(dims.width / 2) + dims.tailHalf, dims.bubbleBottom);
  ctx.lineTo(Math.round(dims.width / 2), dims.bubbleBottom + dims.tailHeight);
  ctx.closePath();
}

function createSolidBubbleMarkerDataUrl(
  point: TripMapPoint,
  iconSize: number,
  isActive: boolean
): string {
  if (typeof document === "undefined") {
    return resolveMarkerImageUrl(point.imageSrc);
  }

  const dims = createBubbleMarkerDimensions(iconSize, isActive);
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(dims.width * dpr);
  canvas.height = Math.ceil(dims.height * dpr);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return resolveMarkerImageUrl(point.imageSrc);
  }

  ctx.scale(dpr, dpr);
  ctx.fillStyle = isActive ? "#3b82f6" : "#60a5fa";
  createBubblePath(ctx, dims);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 14px 'Segoe UI', 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fallbackText = (point.localName ?? point.label ?? "?").trim().slice(0, 1) || "?";
  ctx.fillText(fallbackText, Math.round(dims.width / 2), Math.round((dims.bodySize + 8) / 2));

  return canvas.toDataURL("image/png");
}

function loadImageForCanvas(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`marker image load failed: ${imageUrl}`));
    image.src = imageUrl;
  });
}

async function createBubbleMarkerDataUrl(
  point: TripMapPoint,
  iconSize: number,
  isActive: boolean
): Promise<string> {
  if (typeof document === "undefined") {
    return resolveMarkerImageUrl(point.imageSrc);
  }

  const imageUrl = resolveMarkerImageUrl(point.imageSrc);
  if (!imageUrl) {
    return createSolidBubbleMarkerDataUrl(point, iconSize, isActive);
  }

  try {
    const image = await loadImageForCanvas(imageUrl);
    const dims = createBubbleMarkerDimensions(iconSize, isActive);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(dims.width * dpr);
    canvas.height = Math.ceil(dims.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return imageUrl;
    }

    ctx.scale(dpr, dpr);

    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,0.26)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    createBubblePath(ctx, dims);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    drawRoundedRectPath(ctx, 3, 3, dims.bodySize + 4, dims.bodySize + 4, dims.borderRadius + 3);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = dims.strokeWidth;
    ctx.strokeStyle = dims.strokeColor;
    ctx.stroke();

    const imageInset = 5;
    const imageSize = dims.bodySize;
    ctx.save();
    drawRoundedRectPath(ctx, imageInset, imageInset, imageSize, imageSize, dims.borderRadius);
    ctx.clip();
    ctx.drawImage(image, imageInset, imageInset, imageSize, imageSize);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(Math.round(dims.width / 2) - dims.tailHalf, dims.bubbleBottom);
    ctx.lineTo(Math.round(dims.width / 2) + dims.tailHalf, dims.bubbleBottom);
    ctx.lineTo(Math.round(dims.width / 2), dims.bubbleBottom + dims.tailHeight);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = dims.strokeWidth;
    ctx.strokeStyle = dims.strokeColor;
    ctx.stroke();

    return canvas.toDataURL("image/png");
  } catch {
    return createSolidBubbleMarkerDataUrl(point, iconSize, isActive);
  }
}

function getBubbleMarkerDataUrl(
  point: TripMapPoint,
  iconSize: number,
  isActive: boolean
): Promise<string> {
  const cacheKey = `${resolveMarkerImageUrl(point.imageSrc)}::${iconSize}::${isActive ? "1" : "0"}`;
  const cached = markerIconCache.get(cacheKey);
  if (cached) return cached;

  const promise = createBubbleMarkerDataUrl(point, iconSize, isActive);
  markerIconCache.set(cacheKey, promise);
  return promise;
}

function buildMarkerIcon(
  maps: GoogleMapsNamespace,
  point: TripMapPoint,
  isActive: boolean,
  iconSize: number,
  markerDataUrl: string
): GoogleMapMarkerIcon {
  const dims = createBubbleMarkerDimensions(iconSize, isActive);

  return {
    url: markerDataUrl,
    scaledSize: new maps.Size(dims.width, dims.height),
    anchor: new maps.Point(Math.round(dims.width / 2), dims.height - 2),
    labelOrigin: new maps.Point(Math.round(dims.width / 2), dims.height + 11),
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
  buttonLabel: string,
  options?: {
    cardWidth?: number;
    imageHeight?: number;
    compact?: boolean;
  }
): string {
  const cityOrCountry = point.countryLabel ?? point.subtitle;
  const intro =
    point.intro ??
    `${point.subtitle}。推荐先锁定核心景点，再按地理位置安排同一天路线，减少来回折返。`;
  const duration = point.recommendedDays ?? "2-4 days";
  const imageUrl = resolveMarkerImageUrl(point.imageSrc);
  const cardWidth = options?.cardWidth ?? 300;
  const imageHeight = options?.imageHeight ?? 170;
  const compact = options?.compact ?? false;
  const titleSize = compact ? 18 : 20;
  const bodySize = compact ? 12 : 13;
  const padding = compact ? 12 : 14;

  return `
<div style="width:${cardWidth}px;max-width:${cardWidth}px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <div style="border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.16);background:#fff;">
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(point.label)}" style="display:block;width:100%;height:${imageHeight}px;object-fit:cover;" />
    <div style="padding:${Math.round(padding * 0.85)}px ${padding}px ${padding}px;">
      <div style="font-size:${titleSize}px;font-weight:700;line-height:1.15;">${escapeHtml(point.label)}</div>
      <div style="margin-top:4px;font-size:${bodySize}px;color:#475569;">${escapeHtml(point.localName ?? point.subtitle)}</div>
      <div style="margin-top:10px;border-radius:10px;background:#eff6ff;padding:8px 10px;font-size:${bodySize}px;line-height:1.4;color:#1e3a8a;">
        ${escapeHtml(intro)}
      </div>
      <div style="margin-top:10px;font-size:${bodySize}px;color:#334155;">
        <span style="font-weight:600;">${escapeHtml(cityOrCountry)}</span> · ${escapeHtml(duration)}
      </div>
      ${
        addButtonId
          ? `<div style="margin-top:12px;">
        <button id="${addButtonId}" type="button" style="width:100%;border:0;border-radius:10px;padding:${compact ? 9 : 10}px 12px;background:#2563eb;color:#fff;font-size:${compact ? 13 : 14}px;font-weight:700;cursor:pointer;">
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
          hoverInfoRef.current?.close();
          setLayoutVersion((value) => value + 1);
        };

        layoutRerenderListenersRef.current = [
          map.addListener("zoom_changed", requestLayoutRefresh),
          map.addListener("dragstart", () => {
            hoverInfoRef.current?.close();
          }),
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
    const iconSize = getAdaptiveIconSize(points.length, mapWidth, mapHeight);
    const showLabel = zoom >= LABEL_MIN_ZOOM;
    let effectDisposed = false;

    points.forEach((point) => {
      const isActive = point.id === activePointId;
      const fallbackMarkerUrl = createSolidBubbleMarkerDataUrl(point, iconSize, isActive);
      const marker = new maps.Marker({
        map,
        position: { lat: point.lat, lng: point.lng },
        title: `${point.label} · ${point.subtitle}`,
        icon: buildMarkerIcon(maps, point, isActive, iconSize, fallbackMarkerUrl),
        label: showLabel ? buildMarkerLabel(point, iconSize) : undefined,
        optimized: false,
        zIndex: isActive ? 1000 : 100,
      });

      void getBubbleMarkerDataUrl(point, iconSize, isActive).then((markerDataUrl) => {
        if (effectDisposed) return;
        marker.setIcon(buildMarkerIcon(maps, point, isActive, iconSize, markerDataUrl));
      });

      const openPreview = () => {
        const buttonId = `trip-map-add-${sanitizeDomId(point.id)}`;
        const cityForPlan = point.localName ?? point.label;
        const currentWidth = containerRef.current?.clientWidth ?? mapWidth;
        const currentHeight = containerRef.current?.clientHeight ?? mapHeight;
        const currentZoom = map.getZoom() ?? zoom;
        const currentCenterValue = map.getCenter();
        const currentCenter = currentCenterValue
          ? { lat: currentCenterValue.lat(), lng: currentCenterValue.lng() }
          : DEFAULT_CENTER;
        const pixelPoint = toScreenPixel(
          point.lat,
          point.lng,
          currentCenter,
          currentZoom,
          currentWidth,
          currentHeight
        );
        const compact = currentWidth < 980 || currentHeight < 680;
        const cardWidth = clamp(compact ? 308 : 344, 260, Math.max(260, currentWidth - 56));
        const imageHeight = compact ? 164 : 188;
        const estimatedCardHeight = imageHeight + (compact ? 220 : 244);

        let offsetX = 0;
        if (pixelPoint.x < currentWidth * 0.45) {
          offsetX = Math.round(cardWidth * 0.2);
        } else if (pixelPoint.x > currentWidth * 0.55) {
          offsetX = -Math.round(cardWidth * 0.2);
        }

        let offsetY = pixelPoint.y < estimatedCardHeight + 28 ? Math.round(estimatedCardHeight * 0.54) : -12;

        const safeMargin = 12;
        const predictedLeft = pixelPoint.x - cardWidth / 2 + offsetX;
        const predictedRight = predictedLeft + cardWidth;
        const predictedTop = pixelPoint.y - estimatedCardHeight + offsetY;
        const predictedBottom = predictedTop + estimatedCardHeight;

        if (predictedLeft < safeMargin) {
          offsetX += Math.round(safeMargin - predictedLeft);
        } else if (predictedRight > currentWidth - safeMargin) {
          offsetX -= Math.round(predictedRight - (currentWidth - safeMargin));
        }

        if (predictedTop < safeMargin) {
          offsetY += Math.round(safeMargin - predictedTop);
        } else if (predictedBottom > currentHeight - safeMargin) {
          offsetY -= Math.round(predictedBottom - (currentHeight - safeMargin));
        }

        hoverInfo.setOptions({
          disableAutoPan: false,
          maxWidth: cardWidth,
          pixelOffset: new maps.Size(offsetX, offsetY),
        });
        hoverInfo.setContent(
          buildHoverCardHtml(
            point,
            onAddDestination ? buttonId : null,
            `加入我的计划：${cityForPlan}`,
            {
              cardWidth,
              imageHeight,
              compact,
            }
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

    return () => {
      effectDisposed = true;
    };
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
