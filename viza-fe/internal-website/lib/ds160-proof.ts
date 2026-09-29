export const DS160_PROOF_QUEUE_STATUS = "ds160_proof_pending" as const;
export const DS160_PROOF_EMAIL_ERROR_CODE = "ds160_proof_email_failed" as const;
export const DS160_PROOF_EMAIL_UNAVAILABLE_CODE = "ds160_proof_email_unavailable" as const;
export const DS160_PROOF_EMAIL_UNKNOWN_CODE = "ds160_proof_email_unknown" as const;
export const DS160_PROOF_EMAIL_ACCOUNT_ONLY_CODE = "ds160_proof_email_account_only" as const;
export const DS160_PROOF_EMAIL_REQUEST_INVALID_CODE = "ds160_proof_email_request_invalid" as const;
export const DS160_PROOF_EMAIL_PENDING_CODE = "ds160_proof_email_pending" as const;

export type Ds160ProofEmailStatus = "idle" | "queued" | "sending" | "sent" | "unknown" | "failed";

export type Ds160ProofEmailQueueState = {
  status?: string;
  current_stage?: string | null;
  locked_until?: string | null;
  ceac_result_payload?: unknown;
};

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function readDs160ProofEmailStatus(row: Ds160ProofEmailQueueState | null): Ds160ProofEmailStatus {
  if (!row) return "idle";
  const payload = recordOrNull(row.ceac_result_payload);
  const email = recordOrNull(payload?.email);
  const payloadStatus = email?.status;
  const sendStarted = Boolean(stringOrNull(email?.send_started_at) ?? stringOrNull(payload?.send_started_at));
  const isProcessing = row.status === "ds160_proof_processing" || row.status === "processing";
  if (isProcessing) {
    const leaseExpiry = stringOrNull(row.locked_until);
    const leaseExpiresAt = leaseExpiry ? Date.parse(leaseExpiry) : Number.NaN;
    const leaseActive = Number.isFinite(leaseExpiresAt) && leaseExpiresAt > Date.now();
    if (!leaseActive) return sendStarted ? "unknown" : "failed";
  }
  if (row.status === "failed" || row.status === "ds160_proof_failed") {
    return sendStarted ? "unknown" : "failed";
  }
  if (row.status === "done" && payloadStatus !== "sent") return "unknown";
  if (isProcessing && payloadStatus === "queued") return "sending";
  if (
    payloadStatus === "queued" || payloadStatus === "sending" || payloadStatus === "sent" ||
    payloadStatus === "unknown" || payloadStatus === "failed"
  ) {
    if (payloadStatus === "failed" && sendStarted) return "unknown";
    return payloadStatus;
  }
  if (row.current_stage === "email_confirmation_sending") return "sending";
  if (row.current_stage === "email_confirmation_unknown") return "unknown";
  if (row.current_stage === "email_confirmation_failed") return "failed";
  return "queued";
}

export function ds160ProofEmailFailureResponse(): {
  code: typeof DS160_PROOF_EMAIL_ERROR_CODE;
  error: string;
} {
  return {
    code: DS160_PROOF_EMAIL_ERROR_CODE,
    error:
      "The DS-160 proof file was saved, but the email could not be sent. You can still download the saved file or try sending it again later.",
  };
}

export function ds160ProofEmailUnavailableResponse(): {
  code: typeof DS160_PROOF_EMAIL_UNAVAILABLE_CODE;
  error: string;
} {
  return {
    code: DS160_PROOF_EMAIL_UNAVAILABLE_CODE,
    error: "The DS-160 proof email could not be sent. Please try again later.",
  };
}

export function ds160ProofEmailUnknownResponse(): {
  code: typeof DS160_PROOF_EMAIL_UNKNOWN_CODE;
  error: string;
} {
  return {
    code: DS160_PROOF_EMAIL_UNKNOWN_CODE,
    error:
      "CEAC did not return a clear email receipt. The application submission is unchanged; you can check your account email and retry manually, but a retry may send another email.",
  };
}

export function ds160ProofEmailAccountOnlyResponse(): {
  code: typeof DS160_PROOF_EMAIL_ACCOUNT_ONLY_CODE;
  error: string;
} {
  return {
    code: DS160_PROOF_EMAIL_ACCOUNT_ONLY_CODE,
    error: "Official DS-160 confirmation email can only be sent to the signed-in account email.",
  };
}

export function ds160ProofEmailRequestInvalidResponse(): {
  code: typeof DS160_PROOF_EMAIL_REQUEST_INVALID_CODE;
  error: string;
} {
  return {
    code: DS160_PROOF_EMAIL_REQUEST_INVALID_CODE,
    error: "The DS-160 confirmation email request is invalid. Please try again.",
  };
}

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
