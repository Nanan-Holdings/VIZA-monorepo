import { Buffer } from "node:buffer";
import { specFor, type PhotoSpec } from "./specs";

/**
 * Server-side photo validation (DOC-001).
 *
 * Checks the deterministic rules:
 *   - file format magic
 *   - file size
 *   - pixel dimensions (parsed from JPEG SOF / PNG IHDR — no deps)
 *
 * Visual checks (background colour, head height, expression) require
 * ML and are deferred to a follow-on enrichment pass.
 *
 * Returns a structured failure object with a human-readable reason
 * the client can render directly.
 */

export type PhotoFormat = "jpeg" | "png" | "unknown";

export interface PhotoDimensions {
  width: number;
  height: number;
  format: PhotoFormat;
}

export interface PhotoValidationOk {
  ok: true;
  format: "jpeg" | "png";
  width: number;
  height: number;
  bytes: number;
}

export interface PhotoValidationFail {
  ok: false;
  reason: string;
  /** Stable code so the client can localise / branch UI. */
  code:
    | "spec_missing"
    | "format_unsupported"
    | "format_corrupt"
    | "file_too_large"
    | "dimensions_off"
    | "image_too_small";
}

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function detectFormat(buf: Buffer): PhotoFormat {
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_MAGIC)) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return "png";
  return "unknown";
}

/** Parse dimensions out of a JPEG by walking the segment table to a SOF marker. */
function jpegDims(buf: Buffer): { w: number; h: number } | null {
  let i = 2; // skip SOI
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    // skip fill bytes
    let m = buf[i + 1];
    while (m === 0xff && i + 2 < buf.length) {
      i += 1;
      m = buf[i + 1];
    }
    i += 2;
    // Standalone markers (no segment length): 0xD0..0xD9, 0x01.
    if ((m >= 0xd0 && m <= 0xd9) || m === 0x01) continue;
    if (i + 1 >= buf.length) return null;
    const segLen = buf.readUInt16BE(i);
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const sof =
      (m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (sof) {
      // structure: len(2), precision(1), height(2), width(2), ...
      const h = buf.readUInt16BE(i + 3);
      const w = buf.readUInt16BE(i + 5);
      return { w, h };
    }
    i += segLen;
  }
  return null;
}

/** Parse dimensions from the PNG IHDR chunk (always at offset 8). */
function pngDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  // bytes 8..11 = IHDR length (always 13), 12..15 = "IHDR" type
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h };
}

export function readImageDimensions(buf: Buffer): PhotoDimensions {
  const fmt = detectFormat(buf);
  if (fmt === "jpeg") {
    const d = jpegDims(buf);
    if (!d) return { width: 0, height: 0, format: "jpeg" };
    return { width: d.w, height: d.h, format: "jpeg" };
  }
  if (fmt === "png") {
    const d = pngDims(buf);
    if (!d) return { width: 0, height: 0, format: "png" };
    return { width: d.w, height: d.h, format: "png" };
  }
  return { width: 0, height: 0, format: "unknown" };
}

export function validatePhoto(
  bytes: Buffer | Uint8Array,
  country: string,
  visaType: string,
): PhotoValidationOk | PhotoValidationFail {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const spec = specFor(country, visaType);
  if (!spec) {
    return {
      ok: false,
      code: "spec_missing",
      reason: `No photo spec configured for ${country}/${visaType}.`,
    };
  }
  if (buf.length > spec.maxBytes) {
    return {
      ok: false,
      code: "file_too_large",
      reason: `File is ${(buf.length / 1024).toFixed(0)} KB; max for ${country}/${visaType} is ${(spec.maxBytes / 1024).toFixed(0)} KB.`,
    };
  }
  const dims = readImageDimensions(buf);
  if (dims.format === "unknown") {
    return {
      ok: false,
      code: "format_unsupported",
      reason:
        "Could not detect image format. Supported formats: " +
        spec.formats.join(", ").toUpperCase() +
        ".",
    };
  }
  if (!spec.formats.includes(dims.format)) {
    return {
      ok: false,
      code: "format_unsupported",
      reason: `Image is ${dims.format.toUpperCase()}; ${country}/${visaType} requires ${spec.formats.join("/").toUpperCase()}.`,
    };
  }
  if (dims.width === 0 || dims.height === 0) {
    return {
      ok: false,
      code: "format_corrupt",
      reason: "Image header is malformed; dimensions could not be read.",
    };
  }
  const tol = spec.dimensionTolerance ?? 0.05;
  const okDims =
    Math.abs(dims.width - spec.widthPx) / spec.widthPx <= tol &&
    Math.abs(dims.height - spec.heightPx) / spec.heightPx <= tol;
  if (!okDims) {
    return {
      ok: false,
      code: dims.width < spec.widthPx * 0.5 ? "image_too_small" : "dimensions_off",
      reason: `Image is ${dims.width}×${dims.height}px; ${country}/${visaType} requires ${spec.widthPx}×${spec.heightPx}px (±${(tol * 100).toFixed(0)}%).`,
    };
  }
  return {
    ok: true,
    format: dims.format,
    width: dims.width,
    height: dims.height,
    bytes: buf.length,
  };
}

/** Re-export for convenience. */
export type { PhotoSpec };
