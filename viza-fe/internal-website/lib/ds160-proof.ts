export const DS160_PROOF_QUEUE_STATUS = "ds160_proof_pending" as const;

export type Ds160ProofKind = "confirmation" | "application" | "email-confirmation";

export type Ds160ProofAction =
  | { status: "ready"; downloadUrl: string; storagePath: string }
  | { status: "queued"; queueStatus: typeof DS160_PROOF_QUEUE_STATUS }
  | { status: "unsupported"; reason: string };

type UsResultLike = {
  country?: unknown;
  status?: unknown;
  applicationId?: unknown;
  confirmationNumber?: unknown;
  confirmationPdfStoragePath?: unknown;
  applicationPdfStoragePath?: unknown;
  emailConfirmationPdfStoragePath?: unknown;
};

export function buildDs160ProofDownloadUrl(
  applicationId: string,
  artifactPath: string,
  fileName: string,
): string {
  return `/api/applications/${encodeURIComponent(applicationId)}/submission-artifact?path=${encodeURIComponent(artifactPath)}&download=${encodeURIComponent(fileName)}`;
}

export function resolveDs160ProofAction(
  applicationId: string,
  kind: Ds160ProofKind,
  result: unknown,
): Ds160ProofAction {
  if (!isSubmittedUsResult(result)) {
    return {
      status: "unsupported",
      reason: "DS-160 proof recovery requires a submitted US DS-160 result.",
    };
  }

  const storagePath = storagePathForKind(result, kind);
  if (!storagePath) {
    return { status: "queued", queueStatus: DS160_PROOF_QUEUE_STATUS };
  }

  return {
    status: "ready",
    storagePath,
    downloadUrl: buildDs160ProofDownloadUrl(
      applicationId,
      storagePath,
      fileNameForKind(kind, confirmationLabel(result)),
    ),
  };
}

export function fileNameForKind(kind: Ds160ProofKind, confirmationLabel: string): string {
  switch (kind) {
    case "confirmation":
      return `ds160-confirmation-${confirmationLabel}.pdf`;
    case "application":
      return `ds160-application-${confirmationLabel}.pdf`;
    case "email-confirmation":
      return `ds160-email-confirmation-${confirmationLabel}.pdf`;
  }
}

function isSubmittedUsResult(value: unknown): value is UsResultLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as UsResultLike;
  return result.country === "US" && result.status === "submitted" && typeof result.applicationId === "string";
}

function storagePathForKind(result: UsResultLike, kind: Ds160ProofKind): string | null {
  switch (kind) {
    case "confirmation":
      return stringOrNull(result.confirmationPdfStoragePath);
    case "application":
      return stringOrNull(result.applicationPdfStoragePath);
    case "email-confirmation":
      return stringOrNull(result.emailConfirmationPdfStoragePath) ?? stringOrNull(result.confirmationPdfStoragePath);
  }
}

function confirmationLabel(result: UsResultLike): string {
  return stringOrNull(result.confirmationNumber) ?? stringOrNull(result.applicationId) ?? "application";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
