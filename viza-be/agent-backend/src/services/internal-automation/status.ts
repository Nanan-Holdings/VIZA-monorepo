export const INTERNAL_LIFECYCLE_STATUSES = [
  "draft",
  "awaiting_payment",
  "awaiting_consent",
  "awaiting_documents",
  "ready_for_packet",
  "packet_ready",
  "external_submission_in_progress",
  "submitted",
  "approved",
  "rejected",
] as const;

export type InternalLifecycleStatus =
  (typeof INTERNAL_LIFECYCLE_STATUSES)[number];

export const LIFECYCLE_STATUS_ORDER: Record<InternalLifecycleStatus, number> = {
  draft: 0,
  awaiting_payment: 10,
  awaiting_consent: 20,
  awaiting_documents: 30,
  ready_for_packet: 40,
  packet_ready: 50,
  external_submission_in_progress: 60,
  submitted: 70,
  approved: 80,
  rejected: 80,
};

const INTERNAL_STATUS_SET = new Set<string>(INTERNAL_LIFECYCLE_STATUSES);

const LIFECYCLE_STATUS_ALIASES: Record<string, InternalLifecycleStatus> = {
  new: "draft",
  not_started: "draft",
  not_submitted: "draft",
  in_progress: "draft",
  incomplete: "draft",
  unpaid: "awaiting_payment",
  pending_payment: "awaiting_payment",
  payment_pending: "awaiting_payment",
  payment_required: "awaiting_payment",
  needs_payment: "awaiting_payment",
  paid: "awaiting_consent",
  consent_pending: "awaiting_consent",
  consent_required: "awaiting_consent",
  needs_consent: "awaiting_consent",
  documents_pending: "awaiting_documents",
  document_pending: "awaiting_documents",
  needs_documents: "awaiting_documents",
  missing_documents: "awaiting_documents",
  needs_review: "awaiting_documents",
  ready: "ready_for_packet",
  ready_for_handoff: "packet_ready",
  generated: "packet_ready",
  packet_generated: "packet_ready",
  submitting: "external_submission_in_progress",
  processing: "external_submission_in_progress",
  external_processing: "external_submission_in_progress",
  under_review: "submitted",
  lodged: "submitted",
  filed: "submitted",
  granted: "approved",
  issued: "approved",
  denied: "rejected",
  refused: "rejected",
};

export function normalizeStatusToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isInternalLifecycleStatus(
  value: string | null | undefined
): value is InternalLifecycleStatus {
  return Boolean(value && INTERNAL_STATUS_SET.has(value));
}

export function normalizeLifecycleStatus(
  value: string | null | undefined
): InternalLifecycleStatus | null {
  if (!value) return null;

  const normalized = normalizeStatusToken(value);
  if (isInternalLifecycleStatus(normalized)) return normalized;
  return LIFECYCLE_STATUS_ALIASES[normalized] ?? null;
}

export function isTerminalLifecycleStatus(
  status: InternalLifecycleStatus
): boolean {
  return status === "approved" || status === "rejected";
}

