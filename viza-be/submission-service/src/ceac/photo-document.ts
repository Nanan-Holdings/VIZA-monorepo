import type { ApplicationDocument } from "../types";

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

const PHOTO_DOCUMENT_TYPES = new Set<string>(DS160_PHOTO_DOCUMENT_TYPES);

const PHOTO_DOCUMENT_PRIORITY = [
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
];

const USABLE_DOCUMENT_STATUSES = new Set([
  "approved",
  "validated",
  "processed",
  "uploaded",
  "ready",
  "pending",
]);

/** Universal-profile statuses that are explicitly reusable for CEAC photos. */
export const DS160_REUSABLE_PROFILE_PHOTO_STATUSES = [
  "uploaded",
  "validated",
  "accepted",
  "approved",
] as const;

const REUSABLE_PROFILE_PHOTO_STATUSES = new Set<string>(DS160_REUSABLE_PROFILE_PHOTO_STATUSES);

export interface Ds160ProfilePhotoDocument {
  id: string;
  applicant_id: string;
  document_type: string;
  storage_path: string | null;
  status: string | null;
  file_name?: string | null;
  filename?: string | null;
  updated_at?: string | null;
}

export interface ResolveDs160PhotoDocumentInput {
  applicationId: string;
  applicantId: string;
  applicationDocuments: readonly ApplicationDocument[];
  /**
   * The caller must scope this lookup to the same application owner. The
   * resolver also checks each returned row's applicant_id before using it.
   */
  loadReusableProfileDocuments: (input: {
    applicationId: string;
    applicantId: string;
  }) => Promise<readonly Ds160ProfilePhotoDocument[]>;
}

export function isDs160PhotoDocument(doc: ApplicationDocument): boolean {
  if (!doc.storage_path?.trim()) return false;
  if (!PHOTO_DOCUMENT_TYPES.has(normalizeDocumentType(doc.document_type))) return false;
  const status = doc.status.trim().toLowerCase();
  return status.length === 0 || USABLE_DOCUMENT_STATUSES.has(status);
}

/**
 * Identifies an application-scoped photo row regardless of status or storage.
 * A rejected/failed row is still authoritative and must prevent a profile
 * photo from silently replacing the applicant's explicit upload attempt.
 */
export function hasDs160PhotoUpload(
  documents: readonly Pick<ApplicationDocument, "document_type">[],
): boolean {
  return documents.some((document) => PHOTO_DOCUMENT_TYPES.has(normalizeDocumentType(document.document_type)));
}

export function selectDs160PhotoDocument(
  documents: readonly ApplicationDocument[],
): ApplicationDocument | null {
  const candidates = documents.filter(isDs160PhotoDocument);
  candidates.sort((a, b) => {
    const aRank = PHOTO_DOCUMENT_PRIORITY.indexOf(a.document_type);
    const bRank = PHOTO_DOCUMENT_PRIORITY.indexOf(b.document_type);
    return normalizeRank(aRank) - normalizeRank(bRank);
  });
  return candidates[0] ?? null;
}

/**
 * Selects the newest usable profile photo for one applicant. This is metadata
 * selection only; callers decide whether and when the selected object is
 * downloaded. Rows for another applicant are discarded as an ownership fence.
 */
export function selectReusableDs160ProfilePhotoDocument(
  documents: readonly Ds160ProfilePhotoDocument[],
  applicantId: string,
): Ds160ProfilePhotoDocument | null {
  const normalizedApplicantId = applicantId.trim();
  const candidates = documents.filter((document) => {
    const documentType = normalizeDocumentType(document.document_type);
    const status = document.status?.trim().toLowerCase() ?? "";
    return document.applicant_id === normalizedApplicantId &&
      PHOTO_DOCUMENT_TYPES.has(documentType) &&
      Boolean(document.storage_path?.trim()) &&
      REUSABLE_PROFILE_PHOTO_STATUSES.has(status);
  });

  candidates.sort((a, b) => {
    const aTimestamp = timestampRank(a.updated_at);
    const bTimestamp = timestampRank(b.updated_at);
    if (aTimestamp !== bTimestamp) return bTimestamp - aTimestamp;

    const aRank = PHOTO_DOCUMENT_PRIORITY.indexOf(normalizeDocumentType(a.document_type));
    const bRank = PHOTO_DOCUMENT_PRIORITY.indexOf(normalizeDocumentType(b.document_type));
    if (normalizeRank(aRank) !== normalizeRank(bRank)) {
      return normalizeRank(aRank) - normalizeRank(bRank);
    }
    return a.id.localeCompare(b.id);
  });

  return candidates[0] ?? null;
}

/**
 * Resolve a CEAC photo while preserving application-scoped authority. The
 * profile loader is called only when the current application has no photo row
 * at all, so a rejected or unavailable app upload cannot be overwritten by a
 * reusable profile document.
 */
export async function resolveDs160PhotoDocument(
  input: ResolveDs160PhotoDocumentInput,
): Promise<ApplicationDocument | null> {
  const applicationId = input.applicationId.trim();
  const applicantId = input.applicantId.trim();
  if (!applicationId || !applicantId) return null;

  if (hasDs160PhotoUpload(input.applicationDocuments)) {
    return selectDs160PhotoDocument(input.applicationDocuments);
  }

  const profileDocuments = await input.loadReusableProfileDocuments({ applicationId, applicantId });
  const selected = selectReusableDs160ProfilePhotoDocument(profileDocuments, applicantId);
  if (!selected) return null;

  return {
    id: selected.id,
    application_id: applicationId,
    document_type: selected.document_type,
    storage_path: selected.storage_path,
    status: selected.status?.trim() ?? "",
    file_name: selected.file_name ?? selected.filename ?? null,
  };
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

function normalizeDocumentType(documentType: string): string {
  return documentType.trim().toLowerCase();
}

function timestampRank(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}
