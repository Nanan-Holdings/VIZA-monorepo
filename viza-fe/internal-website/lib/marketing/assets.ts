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

/* Shorts from viza-fe/social-video are H.264 MP4. TikTok, Reels and Shorts
   all take MP4, so nothing else is accepted. */
const VIDEO_TYPES = new Map([
  ["video/mp4", "mp4"],
]);

export type MarketingAssetKind = "image" | "document" | "video";

const KINDS: Record<MarketingAssetKind, { types: Map<string, string>; limit: number; label: string }> = {
  image: { types: IMAGE_TYPES, limit: 8 * 1024 * 1024, label: "Image" },
  document: { types: DOCUMENT_TYPES, limit: 20 * 1024 * 1024, label: "Document" },
  // Matches the bucket's file_size_limit (migration 20261016090000).
  video: { types: VIDEO_TYPES, limit: 50 * 1024 * 1024, label: "Video" },
};

export function validateMarketingAsset(input: { kind: string; mimeType: string; size: number }) {
  if (input.kind !== "image" && input.kind !== "document" && input.kind !== "video") throw new Error("Unsupported asset kind");
  const kind = input.kind as MarketingAssetKind;
  const { types, limit, label } = KINDS[kind];
  const extension = types.get(input.mimeType);
  if (!extension) throw new Error(`Unsupported ${kind} type`);
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > limit) {
    throw new Error(`${label} must be ${limit / 1024 / 1024}MB or smaller`);
  }
  return { kind, extension, limit };
}

export function marketingAssetPath(kind: MarketingAssetKind, actorId: string, id: string, extension: string, now = new Date()): string {
  return `${kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${actorId}/${id}.${extension}`;
}
