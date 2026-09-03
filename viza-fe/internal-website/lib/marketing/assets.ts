export const MARKETING_ASSET_BUCKET = "marketing-public-assets";

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const DOCUMENT_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-powerpoint", "ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
]);

export type MarketingAssetKind = "image" | "document";

export function validateMarketingAsset(input: { kind: string; mimeType: string; size: number }) {
  if (input.kind !== "image" && input.kind !== "document") throw new Error("Unsupported asset kind");
  const types = input.kind === "image" ? IMAGE_TYPES : DOCUMENT_TYPES;
  const extension = types.get(input.mimeType);
  if (!extension) throw new Error(`Unsupported ${input.kind} type`);
  const limit = input.kind === "image" ? 8 * 1024 * 1024 : 20 * 1024 * 1024;
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > limit) {
    throw new Error(`${input.kind === "image" ? "Image" : "Document"} must be ${limit / 1024 / 1024}MB or smaller`);
  }
  return { kind: input.kind as MarketingAssetKind, extension, limit };
}
