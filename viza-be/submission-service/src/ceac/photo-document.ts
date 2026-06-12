import type { ApplicationDocument } from "../types";

const PHOTO_DOCUMENT_TYPES = new Set([
  "applicant_photo_cropped",
  "ds160_photo",
  "visa_photo",
  "passport_photo",
  "applicant_photo",
  "photo",
]);

const PHOTO_DOCUMENT_PRIORITY = [
  "applicant_photo_cropped",
  "ds160_photo",
  "visa_photo",
  "passport_photo",
  "applicant_photo",
  "photo",
];

const USABLE_DOCUMENT_STATUSES = new Set([
  "approved",
  "validated",
  "processed",
  "uploaded",
  "ready",
  "pending",
]);

export function isDs160PhotoDocument(doc: ApplicationDocument): boolean {
  if (!doc.storage_path) return false;
  if (!PHOTO_DOCUMENT_TYPES.has(doc.document_type)) return false;
  const status = doc.status.trim().toLowerCase();
  return status.length === 0 || USABLE_DOCUMENT_STATUSES.has(status);
}

export function selectDs160PhotoDocument(
  documents: ApplicationDocument[],
): ApplicationDocument | null {
  const candidates = documents.filter(isDs160PhotoDocument);
  candidates.sort((a, b) => {
    const aRank = PHOTO_DOCUMENT_PRIORITY.indexOf(a.document_type);
    const bRank = PHOTO_DOCUMENT_PRIORITY.indexOf(b.document_type);
    return normalizeRank(aRank) - normalizeRank(bRank);
  });
  return candidates[0] ?? null;
}

export function buildPhotoFileFromDownloadedDocument(
  photoDocument: ApplicationDocument | null,
  downloadedPaths: Map<string, string>,
): { kind: "path"; path: string } | undefined {
  if (!photoDocument) return undefined;
  const localPath = downloadedPaths.get(photoDocument.document_type);
  return localPath ? { kind: "path", path: localPath } : undefined;
}

function normalizeRank(rank: number): number {
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}
