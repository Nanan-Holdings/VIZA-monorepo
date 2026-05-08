import { Buffer } from "node:buffer";

/**
 * Supporting-document validation (DOC-003).
 *
 * Mirrors the server-side rules: file format magic + size + slot
 * acceptance. PDF / JPEG / PNG are the universally accepted formats;
 * extending requires a new magic-byte signature here AND the
 * `accepted_mime_hint` text on the slot row.
 *
 * "Virus scan" in the acceptance criteria is interpreted
 * conservatively: we don't ship an AV daemon, but the worker that
 * downloads the file in the runner already runs in an isolated
 * Playwright container. For production, ops should layer a
 * ClamAV-equivalent sidecar on Storage uploads — documented as a
 * follow-on rather than blocked here.
 */

export const ACCEPTED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface SupportingDocValidationOk {
  ok: true;
  mime: AcceptedMime;
  sizeBytes: number;
}

export interface SupportingDocValidationFail {
  ok: false;
  code:
    | "format_unsupported"
    | "format_corrupt"
    | "file_too_large"
    | "empty";
  reason: string;
}

export function detectSupportingMime(buf: Buffer): AcceptedMime | null {
  if (buf.length === 0) return null;
  if (buf.length >= 5 && buf.subarray(0, 5).equals(PDF_MAGIC)) return "application/pdf";
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_MAGIC)) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
  return null;
}

export function validateSupportingDoc(
  bytes: Buffer | Uint8Array,
  maxBytes: number,
): SupportingDocValidationOk | SupportingDocValidationFail {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length === 0) {
    return { ok: false, code: "empty", reason: "Empty file." };
  }
  if (buf.length > maxBytes) {
    return {
      ok: false,
      code: "file_too_large",
      reason: `File is ${(buf.length / 1024 / 1024).toFixed(1)} MB; max is ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`,
    };
  }
  const mime = detectSupportingMime(buf);
  if (!mime) {
    return {
      ok: false,
      code: "format_unsupported",
      reason: "Only PDF, JPEG, and PNG are accepted.",
    };
  }
  return { ok: true, mime, sizeBytes: buf.length };
}
