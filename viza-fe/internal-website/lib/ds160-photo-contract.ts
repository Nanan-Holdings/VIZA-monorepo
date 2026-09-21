/**
 * Pure client/server contract for a U.S. DS-160 applicant photo.
 *
 * This checks the parts of the Department of State upload contract that can
 * be established from file bytes.  Composition, lighting, and whether the
 * image contains the applicant are intentionally outside this helper.
 */

export const DS160_PHOTO_MAX_BYTES = 240 * 1024;
export const DS160_PHOTO_ACCEPT = ".jpg,.jpeg,image/jpeg";

export const DS160_PHOTO_DOCUMENT_TYPES = [
  "applicant_photo_cropped",
  "ds160_photo",
  "visa_photo",
  "passport_photo",
  "applicant_photo",
  "photo",
  "personal_photo",
  "profile_photo",
  "formal_photo",
  "formal_photo_upload",
  "portrait_photo",
] as const;

export type Ds160PhotoError =
  | "file_too_large"
  | "wrong_format"
  | "corrupt_image"
  | "dimensions_too_small"
  | "dimensions_too_large"
  | "not_square"
  | "invalid_color";

const PHOTO_DOCUMENT_TYPES = new Set<string>(DS160_PHOTO_DOCUMENT_TYPES);
const US_DS160_VISA_TYPES = new Set([
  "DS160",
  "DS_160",
  "B1_B2",
  "B_1_B_2",
  "US_B1_B2",
  "US_DS160",
]);
const US_COUNTRY_ALIASES = new Set(["UNITED_STATES", "UNITEDSTATES", "US", "USA"]);

export function isDs160PhotoRequirement(input: {
  country?: string | null;
  visaType?: string | null;
  documentType: string;
  requirementKey?: string | null;
}): boolean {
  const country = normalizeCode(input.country);
  const visaType = normalizeCode(input.visaType);
  if (!US_COUNTRY_ALIASES.has(country) || !US_DS160_VISA_TYPES.has(visaType)) return false;

  return PHOTO_DOCUMENT_TYPES.has(normalizeDocumentType(input.documentType)) ||
    PHOTO_DOCUMENT_TYPES.has(normalizeDocumentType(input.requirementKey));
}

/**
 * Validate a JPEG using only its bytes.  The SOF marker supplies dimensions,
 * sample precision, and component count without decoding image pixels.
 */
export function validateDs160PhotoBytes(bytes: Uint8Array): Ds160PhotoError | null {
  if (bytes.byteLength > DS160_PHOTO_MAX_BYTES) return "file_too_large";
  if (!hasJpegSignature(bytes)) return "wrong_format";

  const frame = findJpegFrame(bytes);
  if (!frame) return "corrupt_image";
  if (frame.precision !== 8 || frame.components !== 3) return "invalid_color";
  if (frame.width < 600 || frame.height < 600) return "dimensions_too_small";
  if (frame.width > 1200 || frame.height > 1200) return "dimensions_too_large";
  if (frame.width !== frame.height) return "not_square";

  return null;
}

export function getDs160PhotoErrorMessage(error: Ds160PhotoError, isZh: boolean): string {
  const messages: Record<Ds160PhotoError, { zh: string; en: string }> = {
    file_too_large: {
      zh: "照片文件不能超过 240 KB。",
      en: "The photo file must be 240 KB or smaller.",
    },
    wrong_format: {
      zh: "请上传 JPEG（JPG）照片。",
      en: "Upload a JPEG (JPG) photo.",
    },
    corrupt_image: {
      zh: "无法读取照片，请重新选择有效的 JPEG 文件。",
      en: "The JPEG image is invalid or unreadable. Please choose another file.",
    },
    dimensions_too_small: {
      zh: "照片尺寸必须至少为 600×600 像素。",
      en: "The photo must be at least 600×600 pixels.",
    },
    dimensions_too_large: {
      zh: "照片尺寸不能超过 1200×1200 像素。",
      en: "The photo cannot exceed 1200×1200 pixels.",
    },
    not_square: {
      zh: "照片必须是正方形（宽高相等）。",
      en: "The photo must be square with equal width and height.",
    },
    invalid_color: {
      zh: "照片必须是 8 位、3 通道彩色 JPEG。",
      en: "The photo must be an 8-bit, three-channel color JPEG.",
    },
  };

  return isZh ? messages[error].zh : messages[error].en;
}

interface JpegFrame {
  width: number;
  height: number;
  precision: number;
  components: number;
}

function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function normalizeDocumentType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
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

    // EOI before a scan, and a stuffed zero outside entropy data, are both
    // malformed headers.  Check EOI before the restart-marker range because
    // D9 is numerically inside that range.
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
      // SOF payload is precision, height, width, component count, then one
      // three-byte descriptor per component.
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
      // FF 00 is a literal FF byte in entropy-coded data.
      offset = markerOffset + 1;
      continue;
    }
    if (marker === 0xd9) return true;

    // Restart markers can occur inside the scan.  Other marker bytes are
    // skipped conservatively until an unstuffed EOI is found.
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
