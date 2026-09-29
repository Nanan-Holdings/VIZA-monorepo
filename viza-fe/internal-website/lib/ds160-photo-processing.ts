import {
  DS160_PHOTO_MAX_BYTES,
  validateDs160PhotoBytes,
  type Ds160PhotoError,
} from "./ds160-photo-contract";

export const DS160_PHOTO_OUTPUT_SIZE = 600;
export const DS160_JPEG_INITIAL_QUALITY = 0.92;
export const DS160_JPEG_MIN_QUALITY = 0.1;
const QUALITY_SEARCH_ITERATIONS = 9;

export interface Ds160PhotoCropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Ds160PhotoProcessingResult {
  blob: Blob;
  width: typeof DS160_PHOTO_OUTPUT_SIZE;
  height: typeof DS160_PHOTO_OUTPUT_SIZE;
  quality: number;
}

export type Ds160PhotoProcessingErrorCode =
  | "image_load_failed"
  | "invalid_crop_region"
  | "canvas_unavailable"
  | "jpeg_encode_failed"
  | "jpeg_size_limit_unreachable"
  | "invalid_output";

export class Ds160PhotoProcessingError extends Error {
  constructor(
    public readonly code: Ds160PhotoProcessingErrorCode,
    message: string,
    public readonly photoReason?: Ds160PhotoError,
  ) {
    super(message);
    this.name = "Ds160PhotoProcessingError";
  }
}

interface EncodeOptions {
  maxBytes?: number;
  maxQuality?: number;
  minQuality?: number;
  searchIterations?: number;
}

export interface EncodedJpeg {
  blob: Blob;
  quality: number;
}

/**
 * Find the highest JPEG quality that stays within the byte limit.
 *
 * The encoder is injected so the adaptive search can be tested without a
 * browser canvas. A null result is a real encoder failure and is never
 * treated as an uploadable fallback.
 */
export async function encodeJpegWithinLimit(
  encode: (quality: number) => Promise<Blob | null>,
  options: EncodeOptions = {},
): Promise<EncodedJpeg> {
  const maxBytes = options.maxBytes ?? DS160_PHOTO_MAX_BYTES;
  const maxQuality = options.maxQuality ?? DS160_JPEG_INITIAL_QUALITY;
  const minQuality = options.minQuality ?? DS160_JPEG_MIN_QUALITY;
  const searchIterations = options.searchIterations ?? QUALITY_SEARCH_ITERATIONS;

  if (
    !Number.isFinite(maxBytes) ||
    maxBytes <= 0 ||
    !Number.isFinite(minQuality) ||
    !Number.isFinite(maxQuality) ||
    minQuality <= 0 ||
    maxQuality > 1 ||
    minQuality > maxQuality ||
    !Number.isInteger(searchIterations) ||
    searchIterations < 0
  ) {
    throw new Ds160PhotoProcessingError(
      "jpeg_encode_failed",
      "Invalid JPEG compression options",
    );
  }

  const initial = await encode(maxQuality);
  if (!initial) {
    throw new Ds160PhotoProcessingError(
      "jpeg_encode_failed",
      "JPEG encoding returned no data",
    );
  }
  if (initial.size <= maxBytes) return { blob: initial, quality: maxQuality };

  const floor = await encode(minQuality);
  if (!floor) {
    throw new Ds160PhotoProcessingError(
      "jpeg_encode_failed",
      "JPEG encoding returned no data",
    );
  }
  if (floor.size > maxBytes) {
    throw new Ds160PhotoProcessingError(
      "jpeg_size_limit_unreachable",
      "The cropped photo cannot be compressed below the 240 KB limit",
    );
  }

  let lowerQuality = minQuality;
  let upperQuality = maxQuality;
  let best = { blob: floor, quality: minQuality };

  for (let index = 0; index < searchIterations; index += 1) {
    const quality = (lowerQuality + upperQuality) / 2;
    const candidate = await encode(quality);
    if (!candidate) {
      throw new Ds160PhotoProcessingError(
        "jpeg_encode_failed",
        "JPEG encoding returned no data",
      );
    }

    if (candidate.size <= maxBytes) {
      best = { blob: candidate, quality };
      lowerQuality = quality;
    } else {
      upperQuality = quality;
    }
  }

  return best;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Ds160PhotoProcessingError("image_load_failed", "Photo dimensions could not be read"));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      reject(new Ds160PhotoProcessingError("image_load_failed", "The selected photo could not be decoded"));
    };
    image.src = source;
  });
}

function assertCropRegion(
  crop: Ds160PhotoCropRegion,
  sourceWidth: number,
  sourceHeight: number,
): Ds160PhotoCropRegion {
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.width < DS160_PHOTO_OUTPUT_SIZE ||
    crop.height < DS160_PHOTO_OUTPUT_SIZE ||
    crop.x + crop.width > sourceWidth ||
    crop.y + crop.height > sourceHeight
  ) {
    throw new Ds160PhotoProcessingError(
      "invalid_crop_region",
      "The selected crop area must contain at least 600×600 source pixels and stay inside the photo",
    );
  }

  if (Math.abs(crop.width - crop.height) > 1) {
    throw new Ds160PhotoProcessingError(
      "invalid_crop_region",
      "The selected crop area must be square",
    );
  }

  // react-easy-crop can round the two sides independently by one pixel. Use
  // the smaller centered square so the final 600×600 output is never
  // stretched, while retaining the user's selected center.
  const size = Math.min(crop.width, crop.height);
  const normalized = {
    x: crop.x + (crop.width - size) / 2,
    y: crop.y + (crop.height - size) / 2,
    width: size,
    height: size,
  };
  if (
    normalized.x < 0 ||
    normalized.y < 0 ||
    normalized.x + normalized.width > sourceWidth ||
    normalized.y + normalized.height > sourceHeight
  ) {
    throw new Ds160PhotoProcessingError(
      "invalid_crop_region",
      "The selected crop area is outside the photo",
    );
  }
  return normalized;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(resolve, "image/jpeg", quality);
    } catch {
      reject(
        new Ds160PhotoProcessingError(
          "jpeg_encode_failed",
          "The browser could not encode the cropped photo",
        ),
      );
    }
  });
}

/**
 * Crop an image and encode the selected pixels as a valid DS-160 JPEG.
 * No filters, face retouching, colour changes, or original-file fallback are
 * applied. The output is always 600×600 and is rejected if the byte contract
 * cannot be satisfied.
 */
export async function processDs160Photo(
  source: string | Blob,
  crop: Ds160PhotoCropRegion,
): Promise<Ds160PhotoProcessingResult> {
  let ownedObjectUrl: string | null = null;
  const sourceUrl =
    typeof source === "string"
      ? source
      : ((ownedObjectUrl = URL.createObjectURL(source)), ownedObjectUrl);

  try {
    const image = await loadImage(sourceUrl);
    const normalizedCrop = assertCropRegion(
      crop,
      image.naturalWidth,
      image.naturalHeight,
    );

    const canvas = document.createElement("canvas");
    canvas.width = DS160_PHOTO_OUTPUT_SIZE;
    canvas.height = DS160_PHOTO_OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Ds160PhotoProcessingError(
        "canvas_unavailable",
        "The browser could not prepare the cropped photo",
      );
    }

    // Canvas performs only the requested crop and resize. Do not apply image
    // filters or a face/beauty transform to applicant pixels.
    context.drawImage(
      image,
      normalizedCrop.x,
      normalizedCrop.y,
      normalizedCrop.width,
      normalizedCrop.height,
      0,
      0,
      DS160_PHOTO_OUTPUT_SIZE,
      DS160_PHOTO_OUTPUT_SIZE,
    );

    const encoded = await encodeJpegWithinLimit((quality) => canvasToJpeg(canvas, quality));
    const photoReason = validateDs160PhotoBytes(
      new Uint8Array(await encoded.blob.arrayBuffer()),
    );
    if (photoReason) {
      throw new Ds160PhotoProcessingError(
        "invalid_output",
        "The browser produced a photo outside the DS-160 image contract",
        photoReason,
      );
    }

    return {
      blob: encoded.blob,
      width: DS160_PHOTO_OUTPUT_SIZE,
      height: DS160_PHOTO_OUTPUT_SIZE,
      quality: encoded.quality,
    };
  } finally {
    if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
  }
}
