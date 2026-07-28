/**
 * Client-side DS-160 photo validation.
 *
 * Requirements mirror the Department of State digital image specs:
 *   - JPEG format
 *   - <= 240 KB
 *   - >= 600x600 px
 *   - Square (1:1) aspect ratio
 *   - Reasonable illumination
 */

export type PhotoFailureReason =
  | "file_too_large"
  | "wrong_format"
  | "dimensions_too_small"
  | "not_square"
  | "poor_illumination";

export interface PhotoValidationResult {
  passed: boolean;
  /** Blocking failures (everything except poor_illumination) */
  failures: PhotoFailureReason[];
  /** Soft warnings (poor_illumination) — informational only */
  warnings: PhotoFailureReason[];
}

const MAX_SIZE_BYTES = 240 * 1024; // 240 KB
const MIN_DIMENSION = 600;
const ASPECT_TOLERANCE = 0.1; // allow 10% deviation from 1:1
const BRIGHTNESS_STDDEV_THRESHOLD = 10;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Sample brightness from an image and return the standard deviation.
 * Uses a down-sampled canvas for performance.
 */
function computeBrightnessStdDev(img: HTMLImageElement): number {
  const sampleSize = 100;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 255; // can't measure — assume ok

  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
  const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

  // Compute brightness per pixel (simple average of RGB)
  const values: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Validate a photo file or blob against DS-160 requirements.
 * All checks are client-side — no network calls.
 */
export async function validatePhoto(
  fileOrBlob: File | Blob,
): Promise<PhotoValidationResult> {
  const failures: PhotoFailureReason[] = [];
  const warnings: PhotoFailureReason[] = [];

  // 1. Format check
  if (
    fileOrBlob.type !== "image/jpeg" &&
    fileOrBlob.type !== "image/jpg"
  ) {
    failures.push("wrong_format");
  }

  // 2. Size check
  if (fileOrBlob.size > MAX_SIZE_BYTES) {
    failures.push("file_too_large");
  }

  // 3-5. Dimension, aspect, and illumination checks (need to load image)
  try {
    const url = URL.createObjectURL(fileOrBlob);
    try {
      const img = await loadImage(url);

      if (img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) {
        failures.push("dimensions_too_small");
      }

      const ratio = img.naturalWidth / img.naturalHeight;
      if (Math.abs(ratio - 1) > ASPECT_TOLERANCE) {
        failures.push("not_square");
      }

      // Illumination is a soft check — only warn
      const stddev = computeBrightnessStdDev(img);
      if (stddev < BRIGHTNESS_STDDEV_THRESHOLD) {
        warnings.push("poor_illumination");
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    // If we can't load the image at all, it's a format issue
    if (!failures.includes("wrong_format")) {
      failures.push("wrong_format");
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}
