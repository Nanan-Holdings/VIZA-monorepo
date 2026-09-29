import { readFile } from "node:fs/promises";

/** Keep this contract aligned with the frontend DS-160 photo validator. */
export const DS160_PHOTO_MAX_BYTES = 240 * 1024;
export const DS160_PHOTO_MIN_DIMENSION = 600;
export const DS160_PHOTO_MAX_DIMENSION = 1200;

export type Ds160PhotoValidationReason =
  | "file_too_large"
  | "wrong_format"
  | "corrupt_image"
  | "dimensions_too_small"
  | "dimensions_too_large"
  | "not_square"
  | "invalid_color";

/**
 * A local photo-contract failure is applicant data that must be corrected.
 * Keep the serialized prefix stable for the client and never include a path,
 * filename, or image metadata in the message.
 */
export class Ds160PhotoPreflightError extends Error {
  readonly code = "DS160_PHOTO_INVALID" as const;
  readonly reason: Ds160PhotoValidationReason;

  constructor(reason: Ds160PhotoValidationReason) {
    super(`DS160_PHOTO_INVALID:${reason}`);
    this.name = "Ds160PhotoPreflightError";
    this.reason = reason;
  }
}

/** Return the first deterministic DS-160 byte-contract violation, if any. */
export function validateDs160PhotoBytes(bytes: Uint8Array): Ds160PhotoValidationReason | null {
  if (bytes.byteLength > DS160_PHOTO_MAX_BYTES) return "file_too_large";
  if (!hasJpegSignature(bytes)) return "wrong_format";

  const frame = findJpegFrame(bytes);
  if (!frame) return "corrupt_image";
  if (frame.precision !== 8 || frame.components !== 3) return "invalid_color";
  if (frame.width < DS160_PHOTO_MIN_DIMENSION || frame.height < DS160_PHOTO_MIN_DIMENSION) {
    return "dimensions_too_small";
  }
  if (frame.width > DS160_PHOTO_MAX_DIMENSION || frame.height > DS160_PHOTO_MAX_DIMENSION) {
    return "dimensions_too_large";
  }
  if (frame.width !== frame.height) return "not_square";

  return null;
}

/** Read and validate the exact file selected by the CEAC photo resolver. */
export async function assertDs160PhotoFile(photoPath: string): Promise<void> {
  let bytes: Buffer;
  try {
    bytes = await readFile(photoPath);
  } catch {
    // Do not expose a local path or turn a missing/invalid upload into a
    // transient browser failure. The user must provide a readable photo.
    throw new Ds160PhotoPreflightError("corrupt_image");
  }

  const reason = validateDs160PhotoBytes(bytes);
  if (reason) throw new Ds160PhotoPreflightError(reason);
}

interface JpegFrame {
  width: number;
  height: number;
  precision: number;
  components: number;
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function findJpegFrame(bytes: Uint8Array): JpegFrame | null {
  let offset = 2;
  let frame: JpegFrame | null = null;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;

    // EOI before a scan, and a stuffed zero outside entropy data, are malformed.
    if (marker === 0xd9 || marker === 0x00) return null;

    // Restart markers and TEM have no length or payload.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    if (marker === 0xda) {
      if (!frame || segmentLength < 6) return null;
      const scanComponents = bytes[offset + 2];
      if (
        scanComponents === 0 ||
        scanComponents > frame.components ||
        segmentLength !== 6 + scanComponents * 2 ||
        !hasJpegEndOfImage(bytes, offset + segmentLength)
      ) return null;
      return frame;
    }

    if (isStartOfFrame(marker)) {
      // SOF payload: precision, height, width, components and descriptors.
      if (segmentLength < 8) return null;
      const payload = offset + 2;
      const components = bytes[payload + 5];
      if (components === 0 || segmentLength !== 8 + components * 3) return null;
      frame = {
        precision: bytes[payload],
        height: (bytes[payload + 1] << 8) | bytes[payload + 2],
        width: (bytes[payload + 3] << 8) | bytes[payload + 4],
        components,
      };
    }

    offset += segmentLength;
  }

  return null;
}

function hasJpegEndOfImage(bytes: Uint8Array, offset: number): boolean {
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerOffset = offset + 1;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= bytes.length) return false;

    const marker = bytes[markerOffset];
    if (marker === 0x00) {
      offset = markerOffset + 1;
      continue;
    }
    if (marker === 0xd9) return true;
    offset = markerOffset + 1;
  }

  return false;
}

function isStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}
