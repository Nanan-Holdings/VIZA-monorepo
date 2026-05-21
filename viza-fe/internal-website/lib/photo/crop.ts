/**
 * Photo auto-crop to consulate spec (DOCUP-003).
 *
 * Server-side helper that takes a JPEG/PNG buffer + a `PhotoSpec` and
 * returns a Buffer cropped to the spec's aspect ratio. The implementation
 * is deliberately framework-agnostic so we can call it from a Next.js
 * server action AND from the submission-service worker.
 *
 * The actual face-detection lives client-side (browser-detector hook
 * passes the box bounds in via `cropRegion`); when no region is
 * supplied we fall back to a centered crop sized to match the target
 * aspect ratio. We do not depend on `sharp` at type-check time — it's
 * a heavy native dep loaded lazily so this file can be imported from
 * any context (RSC, edge, scripts).
 */

export interface PhotoSpec {
  country: string;
  visaType: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  eyelineFromTop?: number | null;
  headHeightPct?: number | null;
  backgroundHex?: string | null;
}

export interface CropRegion {
  /** Left offset within the source image, in pixels. */
  x: number;
  /** Top offset within the source image, in pixels. */
  y: number;
  /** Width of the crop in source pixels. */
  width: number;
  /** Height of the crop in source pixels. */
  height: number;
}

export interface CropResult {
  buffer: Buffer;
  /** Final pixel dimensions after the crop+resize step. */
  width: number;
  height: number;
  /** Crop region actually used, in source-image coordinates. */
  region: CropRegion;
  /** Target dimensions derived from the spec (mm × dpi). */
  targetWidthPx: number;
  targetHeightPx: number;
}

interface SharpModuleShape {
  default: (input: Buffer) => SharpInstanceShape;
}

interface SharpInstanceShape {
  metadata(): Promise<{ width?: number; height?: number }>;
  extract(region: { left: number; top: number; width: number; height: number }): SharpInstanceShape;
  resize(width: number, height: number, opts?: { fit?: string }): SharpInstanceShape;
  jpeg(opts: { quality: number }): SharpInstanceShape;
  toBuffer(): Promise<Buffer>;
}

let cachedSharp: SharpModuleShape | null = null;

async function loadSharp(): Promise<SharpModuleShape> {
  if (cachedSharp) return cachedSharp;
  const mod = (await import("sharp")) as unknown as SharpModuleShape;
  cachedSharp = mod;
  return mod;
}

export function specToPixels(spec: PhotoSpec): { width: number; height: number } {
  const factor = spec.dpi / 25.4;
  return {
    width: Math.round(spec.widthMm * factor),
    height: Math.round(spec.heightMm * factor),
  };
}

export function centeredCropForAspect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CropRegion {
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceAspect > targetAspect) {
    cropWidth = Math.round(sourceHeight * targetAspect);
  } else {
    cropHeight = Math.round(sourceWidth / targetAspect);
  }
  return {
    x: Math.round((sourceWidth - cropWidth) / 2),
    y: Math.round((sourceHeight - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

export async function cropToSpec(
  source: Buffer,
  spec: PhotoSpec,
  cropRegion?: CropRegion,
): Promise<CropResult> {
  const sharpModule = await loadSharp();
  const sharp = sharpModule.default;
  const meta = await sharp(source).metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  if (sourceWidth === 0 || sourceHeight === 0) {
    throw new Error("Source image dimensions could not be read");
  }

  const target = specToPixels(spec);
  const region = cropRegion ?? centeredCropForAspect(sourceWidth, sourceHeight, target.width, target.height);
  const safeRegion = {
    left: Math.max(0, Math.min(region.x, sourceWidth - 1)),
    top: Math.max(0, Math.min(region.y, sourceHeight - 1)),
    width: Math.max(1, Math.min(region.width, sourceWidth - region.x)),
    height: Math.max(1, Math.min(region.height, sourceHeight - region.y)),
  };

  const buffer = await sharp(source)
    .extract(safeRegion)
    .resize(target.width, target.height, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    buffer,
    width: target.width,
    height: target.height,
    region: { x: safeRegion.left, y: safeRegion.top, width: safeRegion.width, height: safeRegion.height },
    targetWidthPx: target.width,
    targetHeightPx: target.height,
  };
}
