import {
  normalizeStatusToken,
  type InternalLifecycleStatus,
} from "./status.js";

export const EXTERNAL_SUBMISSION_STATUSES = [
  "queued",
  "handoff_received",
  "in_progress",
  "submitted",
  "under_review",
  "needs_attention",
  "approved",
  "rejected",
] as const;

export type ExternalSubmissionStatus =
  (typeof EXTERNAL_SUBMISSION_STATUSES)[number];

export const APPLICATION_RESULT_STATUSES = ["approved", "rejected"] as const;

export type ApplicationResultStatus =
  (typeof APPLICATION_RESULT_STATUSES)[number];

export interface ExternalStatusUpdateInput {
  status: string;
  resultStatus?: string | null;
  reference?: string | null;
  resultStoragePath?: string | null;
  resultNotes?: string | null;
  source?: string | null;
  updatedAt?: Date | string | null;
}

export interface NormalizedExternalStatusUpdate {
  externalStatus: ExternalSubmissionStatus;
  lifecycleStatus: InternalLifecycleStatus;
  resultStatus: ApplicationResultStatus | null;
  externalReference: string | null;
  resultStoragePath: string | null;
  resultNotes: string | null;
  source: string | null;
  externalStatusUpdatedAt: string | null;
}

const EXTERNAL_STATUS_SET = new Set<string>(EXTERNAL_SUBMISSION_STATUSES);
const RESULT_STATUS_SET = new Set<string>(APPLICATION_RESULT_STATUSES);

const EXTERNAL_STATUS_ALIASES: Record<string, ExternalSubmissionStatus> = {
  pending: "queued",
  waiting: "queued",
  received: "handoff_received",
  handoff: "handoff_received",
  handoff_accepted: "handoff_received",
  accepted: "handoff_received",
  processing: "in_progress",
  started: "in_progress",
  external_submission_in_progress: "in_progress",
  submitting: "in_progress",
  lodged: "submitted",
  filed: "submitted",
  sent: "submitted",
  review: "under_review",
  reviewing: "under_review",
  action_required: "needs_attention",
  additional_info_requested: "needs_attention",
  documents_requested: "needs_attention",
  document_requested: "needs_attention",
  missing_documents: "needs_attention",
  granted: "approved",
  issued: "approved",
  denied: "rejected",
  refused: "rejected",
};

const RESULT_STATUS_ALIASES: Record<string, ApplicationResultStatus> = {
  granted: "approved",
  issued: "approved",
  success: "approved",
  denied: "rejected",
  refused: "rejected",
  unsuccessful: "rejected",
};

export function isExternalSubmissionStatus(
  value: string | null | undefined
): value is ExternalSubmissionStatus {
  return Boolean(value && EXTERNAL_STATUS_SET.has(value));
}

export function normalizeExternalStatus(
  value: string | null | undefined
): ExternalSubmissionStatus | null {
  if (!value) return null;

  const normalized = normalizeStatusToken(value);
  if (isExternalSubmissionStatus(normalized)) return normalized;
  return EXTERNAL_STATUS_ALIASES[normalized] ?? null;
}

export function isApplicationResultStatus(
  value: string | null | undefined
): value is ApplicationResultStatus {
  return Boolean(value && RESULT_STATUS_SET.has(value));
}

export function normalizeResultStatus(
  value: string | null | undefined
): ApplicationResultStatus | null {
  if (!value) return null;

  const normalized = normalizeStatusToken(value);
  if (isApplicationResultStatus(normalized)) return normalized;
  return RESULT_STATUS_ALIASES[normalized] ?? null;
}

export function mapExternalStatusToLifecycleStatus(
  status: ExternalSubmissionStatus,
  resultStatus: ApplicationResultStatus | null = null
): InternalLifecycleStatus {
  if (resultStatus) return resultStatus;
  if (status === "approved" || status === "rejected") return status;
  if (status === "submitted" || status === "under_review") return "submitted";
  if (status === "needs_attention") return "awaiting_documents";
  return "external_submission_in_progress";
}

export function normalizeExternalStatusUpdate(
  input: ExternalStatusUpdateInput
): NormalizedExternalStatusUpdate | null {
  const externalStatus = normalizeExternalStatus(input.status);
  if (!externalStatus) return null;

  const resultStatus = normalizeResultStatus(input.resultStatus);
  const lifecycleStatus = mapExternalStatusToLifecycleStatus(
    externalStatus,
    resultStatus
  );

  return {
    externalStatus,
    lifecycleStatus,
    resultStatus,
    externalReference: sanitizeExternalText(input.reference, 160),
    resultStoragePath: sanitizeStorageReference(input.resultStoragePath),
    resultNotes: sanitizeExternalText(input.resultNotes, 1000),
    source: sanitizeExternalText(input.source, 80),
    externalStatusUpdatedAt: toIsoString(input.updatedAt),
  };
}

function sanitizeExternalText(
  value: string | null | undefined,
  maxLength: number
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeStorageReference(value: string | null | undefined): string | null {
  const trimmed = sanitizeExternalText(value, 500);
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed;
  }
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

