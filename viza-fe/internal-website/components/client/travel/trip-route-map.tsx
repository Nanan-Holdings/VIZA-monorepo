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
const GALLERY_IMAGE_POOL = [
  "/globe/tokyo.jpg",
  "/globe/singapore.jpg",
  "/globe/sydney.jpg",
  "/globe/nyc.jpg",
  "/globe/beijing.jpg",
  "/globe/london.jpg",
  "/globe/paris.jpg",
  "/globe/sf.jpg",
  "/globe/pisa.jpg",
  "/globe/egypt.jpg",
] as const;
const GALLERY_MAX_IMAGES = 6;
const GALLERY_IMAGES_BY_KEY: Record<string, string[]> = {
  tokyo: ["/globe/tokyo.jpg", "/globe/beijing.jpg", "/globe/singapore.jpg"],
  singapore: ["/globe/singapore.jpg", "/globe/tokyo.jpg", "/globe/sydney.jpg"],
  sydney: ["/globe/sydney.jpg", "/globe/singapore.jpg", "/globe/sf.jpg"],
  london: ["/globe/london.jpg", "/globe/paris.jpg", "/globe/pisa.jpg"],
  paris: ["/globe/paris.jpg", "/globe/london.jpg", "/globe/pisa.jpg"],
  newyork: ["/globe/nyc.jpg", "/globe/sf.jpg", "/globe/london.jpg"],
  nyc: ["/globe/nyc.jpg", "/globe/sf.jpg", "/globe/london.jpg"],
  beijing: ["/globe/beijing.jpg", "/globe/tokyo.jpg", "/globe/singapore.jpg"],
  pisa: ["/globe/pisa.jpg", "/globe/paris.jpg", "/globe/london.jpg"],
  rome: ["/globe/pisa.jpg", "/globe/paris.jpg", "/globe/london.jpg"],
  dubai: ["/globe/sf.jpg", "/globe/singapore.jpg", "/globe/egypt.jpg"],
  bali: ["/globe/sf.jpg", "/globe/singapore.jpg", "/globe/sydney.jpg"],
  egypt: ["/globe/egypt.jpg", "/globe/pisa.jpg", "/globe/sf.jpg"],
  marinabaysands: ["/globe/singapore.jpg", "/globe/tokyo.jpg", "/globe/sydney.jpg"],
  eiffeltower: ["/globe/paris.jpg", "/globe/london.jpg", "/globe/pisa.jpg"],
  bigben: ["/globe/london.jpg", "/globe/paris.jpg", "/globe/pisa.jpg"],
};
const LOCAL_NAME_BY_KEY: Record<string, string> = {
  tokyo: "东京",
  singapore: "新加坡",
  sydney: "悉尼",
  london: "伦敦",
  paris: "巴黎",
  newyork: "纽约",
  nyc: "纽约",
  beijing: "北京",
  pisa: "比萨",
  rome: "罗马",
  dubai: "迪拜",
  bali: "巴厘岛",
  egypt: "埃及",
  marinabaysands: "滨海湾金沙",
  eiffeltower: "埃菲尔铁塔",
  bigben: "大本钟",
  shibuyacrossing: "涩谷十字路口",
  sensojitemple: "浅草寺",
  operahouse: "悉尼歌剧院",
  sydneyoperahouse: "悉尼歌剧院",
  colosseum: "罗马斗兽场",
};
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

function normalizeLookupKey(input: string | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getImageLookupKey(imageSrc: string | undefined): string {
  if (!imageSrc) return "";
  return normalizeLookupKey(imageSrc.split("/").pop()?.replace(/\.[^.]+$/, ""));
}

function getPointLookupKeys(point: TripMapPoint): string[] {
  return Array.from(
    new Set(
      [point.label, point.city, point.localName, point.subtitle, getImageLookupKey(point.imageSrc)]
        .map(normalizeLookupKey)
        .filter(Boolean)
    )
  );
}

function getLocalNameFromValue(value: string | undefined): string | null {
  const key = normalizeLookupKey(value);
  return key ? LOCAL_NAME_BY_KEY[key] ?? null : null;
}

function getPointDisplayName(point: TripMapPoint): string {
  const labelLocalName = getLocalNameFromValue(point.label);
  if (labelLocalName) return labelLocalName;
  if (point.kind === "city" && point.localName) return point.localName;
  if (point.kind !== "city" && point.localName && point.localName !== point.city) {
    return point.localName;
  }
  return point.label;
}

function formatChineseDuration(duration: string | undefined): string {
  const normalized = (duration ?? "2-4 days")
    .replace(/\brecommended\b/gi, "")
    .replace(/\bdays?\b/gi, "天")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "2-4 天";
}

function getPointGalleryImages(point: TripMapPoint): string[] {
  const orderedImages: string[] = [point.imageSrc];
  getPointLookupKeys(point).forEach((key) => {
    orderedImages.push(...(GALLERY_IMAGES_BY_KEY[key] ?? []));
  });
  orderedImages.push(...GALLERY_IMAGE_POOL);

  return Array.from(new Set(orderedImages.filter(Boolean))).slice(0, GALLERY_MAX_IMAGES);
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

function getPointDisplayLocation(point: TripMapPoint): string {
  if (point.countryLabel) return point.countryLabel.replace(/\s*\([^)]*\)/g, "").trim();
  if (point.subtitle.includes(" in ")) {
    const subtitleLocation = point.subtitle.split(" in ").at(-1)?.trim() || point.subtitle;
    return getLocalNameFromValue(subtitleLocation) ?? subtitleLocation;
  }
  return (
    getLocalNameFromValue(point.city) ??
    getLocalNameFromValue(point.subtitle) ??
    point.localName ??
    point.city ??
    point.subtitle
  );
}

function getPointAttractions(point: TripMapPoint): string {
  const name = getPointDisplayName(point);
  const city = getLocalNameFromValue(point.city) ?? point.localName ?? name;
  const base =
    point.kind === "city"
      ? [`${name}经典地标`, `${name}热门街区`, "观景点", "夜市"]
      : [name, `${city}步行路线`, "当地美食", "观景点", "夜景"];
  return Array.from(new Set(base)).join("、");
}

function getPointIntro(point: TripMapPoint): string {
  return (
    point.intro ??
    `${getPointDisplayName(point)}适合安排紧凑半日到一日游，动线清晰，拍照点集中，也方便串联周边美食与夜景。`
  );
}

function buildHoverCardHtml(
  point: TripMapPoint,
  addButtonId: string | null,
  buttonLabel: string,
  options?: {
    cardWidth?: number;
    imageHeight?: number;
    compact?: boolean;
    closeButtonId?: string;
    photoButtonId?: string;
    summaryButtonId?: string;
    imageElementId?: string;
    dotIdPrefix?: string;
    galleryImages?: string[];
  }
): string {
  const title = getPointDisplayName(point);
  const cityOrCountry = getPointDisplayLocation(point);
  const attractions = getPointAttractions(point);
  const duration = formatChineseDuration(point.recommendedDays);
  const galleryImages =
    options?.galleryImages && options.galleryImages.length > 0
      ? options.galleryImages
      : [resolveMarkerImageUrl(point.imageSrc)];
  const imageUrl = galleryImages[0] ?? "";
  const cardWidth = options?.cardWidth ?? 420;
  const imageHeight = options?.imageHeight ?? 260;
  const compact = options?.compact ?? false;
  const titleSize = compact ? 22 : 26;
  const bodySize = compact ? 15 : 17;
  const padding = compact ? 18 : 24;
  const closeButtonId = options?.closeButtonId;
  const photoButtonId = options?.photoButtonId;
  const summaryButtonId = options?.summaryButtonId;
  const imageElementId = options?.imageElementId;
  const dotIdPrefix = options?.dotIdPrefix;
  const introLineHeight = compact ? 24 : 28;
  const introHeight = introLineHeight * 2;

  return `
<div data-viza-trip-hover-card="true" style="box-sizing:border-box;width:${cardWidth}px;max-width:${cardWidth}px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;pointer-events:none;">
  <div style="box-sizing:border-box;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 14px 34px rgba(15,23,42,.2);background:#fff;pointer-events:none;">
    <div style="position:relative;height:${imageHeight}px;background:#e2e8f0;">
      <img ${imageElementId ? `id="${imageElementId}"` : ""} src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="display:block;width:100%;height:100%;object-fit:cover;" />
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(15,23,42,.03),rgba(15,23,42,.18));"></div>
      ${
        closeButtonId
          ? `<button id="${closeButtonId}" type="button" aria-label="关闭预览" style="pointer-events:auto;position:absolute;right:14px;top:14px;height:36px;width:36px;border:0;border-radius:999px;background:rgba(255,255,255,.92);color:#0f172a;font-size:24px;line-height:28px;cursor:pointer;padding:0;box-shadow:0 8px 20px rgba(15,23,42,.16);">×</button>`
          : ""
      }
      ${
        photoButtonId
          ? `<button id="${photoButtonId}" type="button" aria-label="切换照片" style="pointer-events:auto;position:absolute;right:18px;top:50%;height:44px;width:44px;transform:translateY(-50%);border:0;border-radius:999px;background:#fff;color:#0f172a;font-size:36px;line-height:32px;cursor:pointer;padding:0;box-shadow:0 10px 24px rgba(15,23,42,.2);">›</button>`
          : ""
      }
      <div style="position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;gap:7px;">
        ${galleryImages
          .map(
            (_, index) =>
              `<span ${dotIdPrefix ? `id="${dotIdPrefix}-${index}"` : ""} style="height:7px;width:7px;border-radius:999px;background:rgba(255,255,255,${index === 0 ? ".96" : ".62"});"></span>`
          )
          .join("")}
      </div>
    </div>
    <div style="box-sizing:border-box;margin-top:-18px;position:relative;border-radius:16px 16px 0 0;background:#fff;padding:${padding}px ${padding}px ${padding + 2}px;">
      <div style="display:flex;align-items:center;gap:8px;font-size:${titleSize}px;font-weight:800;line-height:1.1;color:#020617;">
        <span>${escapeHtml(title)}</span>
        <span style="border-radius:7px;background:#fff1f2;color:#fb4d61;font-size:${compact ? 17 : 20}px;font-weight:800;padding:2px 6px;">🔥 10</span>
      </div>
      <button id="${summaryButtonId ?? ""}" type="button" style="pointer-events:auto;box-sizing:border-box;margin-top:14px;width:100%;border:0;border-radius:8px;background:#f1f0ff;padding:8px 10px;text-align:left;color:#0f3bae;cursor:pointer;font-size:${bodySize}px;line-height:${introLineHeight}px;min-height:${introHeight + 16}px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
        <span style="color:#0f3bae;">热门景点：</span> <span style="color:#020617;">${escapeHtml(attractions)}</span>
      </button>
      <div style="margin-top:14px;display:flex;align-items:center;gap:10px;font-size:${bodySize}px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <span style="font-size:${compact ? 18 : 21}px;color:#475569;">⌖</span>
        <span>${escapeHtml(cityOrCountry)}</span>
        <span style="height:18px;width:1px;background:#cbd5e1;"></span>
        <span>${escapeHtml(duration)} 推荐</span>
      </div>
      ${
        addButtonId
          ? `<div style="margin-top:22px;">
        <button id="${addButtonId}" type="button" style="pointer-events:auto;width:100%;border:0;border-radius:8px;padding:${compact ? 13 : 16}px 12px;background:#3464f4;color:#fff;font-size:${compact ? 18 : 21}px;font-weight:500;cursor:pointer;">
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
  const onAddDestinationRef = useRef(onAddDestination);
  const onPointSelectRef = useRef(onPointSelect);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailPointId, setDetailPointId] = useState<string | null>(null);

  const pointKey = useMemo(
    () => points.map((point) => `${point.id}:${point.lat}:${point.lng}`).join("|"),
    [points]
  );

  const routeKey = useMemo(
    () => routeCoordinates.map(([lat, lng]) => `${lat},${lng}`).join("|"),
    [routeCoordinates]
  );

  const detailPoint = useMemo(
    () => points.find((point) => point.id === detailPointId) ?? null,
    [detailPointId, points]
  );
  const detailGalleryImages = useMemo(
    () => (detailPoint ? getPointGalleryImages(detailPoint) : []),
    [detailPoint]
  );

  useEffect(() => {
    onAddDestinationRef.current = onAddDestination;
  }, [onAddDestination]);

  useEffect(() => {
    onPointSelectRef.current = onPointSelect;
  }, [onPointSelect]);

  useEffect(() => {
    if (!detailPointId) return;
    if (!points.some((point) => point.id === detailPointId)) {
      setDetailPointId(null);
    }
  }, [detailPointId, points]);

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
        const safePointId = sanitizeDomId(point.id);
        const buttonId = `trip-map-add-${safePointId}`;
        const closeButtonId = `trip-map-close-${safePointId}`;
        const photoButtonId = `trip-map-photo-${safePointId}`;
        const summaryButtonId = `trip-map-summary-${safePointId}`;
        const imageElementId = `trip-map-image-${safePointId}`;
        const dotIdPrefix = `trip-map-dot-${safePointId}`;
        const galleryImages = getPointGalleryImages(point).map(resolveMarkerImageUrl);
        const cityForPlan = getPointDisplayName(point);
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
        const cardWidth = clamp(
          compact ? 340 : 420,
          320,
          Math.max(320, currentWidth - 56)
        );
        const previewWidth = cardWidth;
        const imageHeight = compact ? 240 : 310;
        const estimatedCardHeight = imageHeight + (compact ? 260 : 300);

        let offsetX = 0;
        if (pixelPoint.x < currentWidth * 0.45) {
          offsetX = Math.round(cardWidth * 0.2);
        } else if (pixelPoint.x > currentWidth * 0.55) {
          offsetX = -Math.round(cardWidth * 0.2);
        }

        let offsetY =
          pixelPoint.y < estimatedCardHeight + 28
            ? Math.round(estimatedCardHeight * 0.72)
            : -12;

        const safeMargin = 12;
        const predictedLeft = pixelPoint.x - previewWidth / 2 + offsetX;
        const predictedRight = predictedLeft + previewWidth;
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
          disableAutoPan: true,
          maxWidth: previewWidth,
          pixelOffset: new maps.Size(offsetX, offsetY),
        });
        hoverInfo.setContent(
          buildHoverCardHtml(
            point,
            onAddDestinationRef.current ? buttonId : null,
            `加入我的计划：${cityForPlan}`,
            {
              cardWidth,
              imageHeight,
              compact,
              closeButtonId,
              photoButtonId,
              summaryButtonId,
              imageElementId,
              dotIdPrefix,
              galleryImages,
            }
          )
        );
        hoverInfo.open({
          map,
          anchor: marker,
          shouldFocus: false,
        });

        maps.event.addListenerOnce(hoverInfo as unknown, "domready", () => {
          const polishPreviewChrome = () => {
            const mapElement = containerRef.current;
            const infoElement = mapElement?.querySelector<HTMLElement>(
              ".gm-style-iw.gm-style-iw-c"
            );
            if (!infoElement) return;

            infoElement.style.background = "transparent";
            infoElement.style.boxShadow = "none";
            infoElement.style.borderRadius = "12px";
            infoElement.style.overflow = "visible";
            infoElement.style.padding = "0";
            infoElement.style.maxWidth = `${previewWidth}px`;
            infoElement.style.pointerEvents = "none";
            let chromeParent = infoElement.parentElement;
            for (let level = 0; chromeParent && level < 3; level += 1) {
              chromeParent.style.pointerEvents = "none";
              chromeParent = chromeParent.parentElement;
            }

            const contentElement =
              infoElement.querySelector<HTMLElement>(".gm-style-iw-d");
            if (contentElement) {
              contentElement.style.overflow = "visible";
              contentElement.style.maxHeight = "none";
              contentElement.style.width = `${cardWidth}px`;
              contentElement.style.pointerEvents = "none";
            }

            const defaultCloseButton =
              infoElement.querySelector<HTMLElement>(".gm-ui-hover-effect");
            if (defaultCloseButton) {
              defaultCloseButton.style.display = "none";
            }
          };

          const keepPreviewInsideMap = () => {
            polishPreviewChrome();

            const mapElement = containerRef.current;
            const infoElement = mapElement?.querySelector<HTMLElement>(
              ".gm-style-iw.gm-style-iw-c"
            );
            if (!mapElement || !infoElement) return;

            const mapRect = mapElement.getBoundingClientRect();
            const infoRect = infoElement.getBoundingClientRect();
            const margin = 8;
            let nextOffsetX = offsetX;
            let nextOffsetY = offsetY;

            if (infoRect.left < mapRect.left + margin) {
              nextOffsetX += Math.round(mapRect.left + margin - infoRect.left);
            } else if (infoRect.right > mapRect.right - margin) {
              nextOffsetX -= Math.round(infoRect.right - (mapRect.right - margin));
            }

            if (infoRect.top < mapRect.top + margin) {
              nextOffsetY += Math.round(mapRect.top + margin - infoRect.top);
            } else if (infoRect.bottom > mapRect.bottom - margin) {
              nextOffsetY -= Math.round(infoRect.bottom - (mapRect.bottom - margin));
            }

            if (nextOffsetX !== offsetX || nextOffsetY !== offsetY) {
              offsetX = nextOffsetX;
              offsetY = nextOffsetY;
              hoverInfo.setOptions({
                disableAutoPan: true,
                maxWidth: previewWidth,
                pixelOffset: new maps.Size(offsetX, offsetY),
              });
              window.requestAnimationFrame(polishPreviewChrome);
            }
          };

          window.requestAnimationFrame(() => {
            keepPreviewInsideMap();
            window.requestAnimationFrame(keepPreviewInsideMap);
          });

          const closeButton = document.getElementById(closeButtonId);
          closeButton?.addEventListener(
            "click",
            (event) => {
              event.preventDefault();
              event.stopPropagation();
              hoverInfo.close();
            },
            { once: true }
          );

          const openDetail = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setDetailPointId(point.id);
            hoverInfo.close();
          };
          let imageIndex = 0;
          const updatePreviewImage = () => {
            const imageElement = document.getElementById(
              imageElementId
            ) as HTMLImageElement | null;
            if (imageElement) {
              imageElement.src = galleryImages[imageIndex] ?? galleryImages[0] ?? "";
            }
            galleryImages.forEach((_, index) => {
              const dotElement = document.getElementById(`${dotIdPrefix}-${index}`);
              if (dotElement) {
                dotElement.style.background = `rgba(255,255,255,${
                  index === imageIndex ? ".96" : ".62"
                })`;
              }
            });
          };
          document
            .getElementById(photoButtonId)
            ?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              imageIndex = (imageIndex + 1) % Math.max(galleryImages.length, 1);
              updatePreviewImage();
            });
          document
            .getElementById(summaryButtonId)
            ?.addEventListener("click", openDetail, { once: true });

          const addDestination = onAddDestinationRef.current;
          if (addDestination) {
            const button = document.getElementById(buttonId);
            if (!button) return;
            button.addEventListener(
              "click",
              (event) => {
                event.preventDefault();
                event.stopPropagation();
                addDestination(point);
                hoverInfo.close();
              },
              { once: true }
            );
          }
        });
      };

      const listeners = [
        marker.addListener("click", () => {
          onPointSelectRef.current?.(point.id);
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
    pointKey,
    points,
    routeCoordinates,
    routeKey,
  ]);

  const detailSections = useMemo(() => {
    if (!detailPoint) return [];
    const city = getLocalNameFromValue(detailPoint.city) ?? getPointDisplayName(detailPoint);
    const location = getPointDisplayLocation(detailPoint);

    return [
      {
        id: "attractions",
        title: "热门景点",
        icon: "⌁",
        body: getPointAttractions(detailPoint),
      },
      {
        id: "food",
        title: "必吃美食",
        icon: "♨",
        body: `${city}当地小吃、招牌餐厅、咖啡甜品、夜市`,
      },
      {
        id: "stay",
        title: "热门住宿区域",
        icon: "▥",
        body: `靠近${location}核心区、地标街区、交通便利区域`,
      },
      {
        id: "nightlife",
        title: "夜生活",
        icon: "⌁",
        body: `${city}夜景、河岸散步、屋顶酒吧、夜市`,
      },
    ];
  }, [detailPoint]);

  return (
    <div className={`relative ${className ?? ""}`} data-testid="trip-route-map">
      <div className="h-full w-full" ref={containerRef} />
      {detailPoint ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-30 flex w-full justify-end bg-transparent"
          data-testid="trip-map-detail-panel"
        >
          <div className="pointer-events-auto flex h-full w-[40%] min-w-[420px] max-w-[640px] flex-col border-l border-slate-200 bg-white shadow-[-20px_0_45px_rgba(15,23,42,0.12)] max-md:w-full max-md:min-w-0">
            <div className="flex items-center justify-end px-5 py-5">
              <button
                aria-label="关闭目的地详情"
                className="flex h-11 w-11 items-center justify-center rounded-full text-4xl leading-none text-slate-900 transition-colors hover:bg-slate-100"
                onClick={() => setDetailPointId(null)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-28">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-3xl font-bold text-slate-950">
                    <span>{getPointDisplayName(detailPoint)}</span>
                    <span className="text-slate-300">›</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-rose-50 px-2 py-1 text-base font-semibold text-[#fb4d61]">
                    <span>🔥 10</span>
                    <span className="h-4 w-px bg-rose-200" />
                    <span>第 1 名 · {getPointDisplayLocation(detailPoint)}热门城市</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xl text-slate-600">
                  <span className="text-2xl">⌖</span>
                  <span>{getPointDisplayLocation(detailPoint)}</span>
                  <span className="h-5 w-px bg-slate-300" />
                  <span>{formatChineseDuration(detailPoint.recommendedDays)} 推荐</span>
                </div>

                <p className="text-lg leading-relaxed text-slate-600">
                  {getPointIntro(detailPoint)}
                </p>

                <div className="flex gap-3 overflow-x-auto py-2">
                  {detailGalleryImages.map((imageSrc, index) => (
                    <div
                      aria-label={`${getPointDisplayName(detailPoint)}照片 ${index + 1}`}
                      className="h-32 min-w-[150px] flex-1 rounded-md bg-cover bg-center"
                      key={`${detailPoint.id}-preview-${index}`}
                      role="img"
                      style={{ backgroundImage: `url(${imageSrc})` }}
                    />
                  ))}
                  <button
                    aria-label="下一张目的地照片"
                    className="mr-1 flex h-14 w-14 shrink-0 self-center rounded-full bg-white text-4xl text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.16)]"
                    type="button"
                  >
                    <span className="m-auto">›</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {detailSections.map((section) => (
                    <button
                      className="flex w-full items-center gap-4 rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/80 px-4 py-4 text-left transition-colors hover:from-blue-50 hover:to-blue-100/70"
                      key={section.id}
                      type="button"
                    >
                      <span className="text-2xl text-slate-600">{section.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xl font-bold text-slate-950">
                          {section.title} ›
                        </span>
                        <span className="mt-3 line-clamp-2 block text-base leading-relaxed text-slate-900">
                          {section.body}
                        </span>
                      </span>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl text-blue-600">
                        ●
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {onAddDestination ? (
              <div className="border-t border-slate-100 bg-white/95 px-8 py-6">
                <button
                  className="ml-auto block w-full max-w-xs rounded-lg bg-[#3464f4] px-6 py-4 text-xl font-medium text-white transition-colors hover:bg-[#2554e8]"
                  onClick={() => {
                    onAddDestination(detailPoint);
                    setDetailPointId(null);
                  }}
                  type="button"
                >
                  加入我的计划
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 p-4 text-center text-sm text-slate-700">
          地图加载失败：{loadError}
        </div>
      ) : null}
    </div>
  );
}
