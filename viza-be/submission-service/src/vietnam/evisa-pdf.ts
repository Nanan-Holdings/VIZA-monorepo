import { createHash } from "node:crypto";

const PDF_MAGIC = Buffer.from("%PDF-");
const MINIMUM_VISA_PDF_BYTES = 1_024;

export function validateVietnamEvisaPdf(pdfBytes: Buffer): string {
  if (
    pdfBytes.byteLength < MINIMUM_VISA_PDF_BYTES ||
    !pdfBytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
  ) {
    throw new Error("Vietnam portal did not return a valid official PDF.");
  }
  return createHash("sha256").update(pdfBytes).digest("hex");
}

export function shouldPersistVietnamEvisaVersion(
  sha256: string,
  lastHash: string | null,
  lastStoragePath: string | null,
): boolean {
  return sha256 !== lastHash || !lastStoragePath;
}
