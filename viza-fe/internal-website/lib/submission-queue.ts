export type SubmissionQueueStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "ds160_prefill_pending"
  | "ds160_prefill_processing"
  | "ds160_prefilled"
  | "ds160_prefill_failed"
  | "ds160_blocked"
  | "fv_prefill_pending"
  | "fv_prefill_processing"
  | "fv_prefilled"
  | "fv_prefill_failed"
  | "fv_blocked"
  | "uk_prefill_pending"
  | "uk_prefill_processing"
  | "uk_prefilled"
  | "uk_prefill_failed"
  | "uk_blocked"
  | "vn_prefill_pending"
  | "vn_prefill_processing"
  | "vn_prefilled"
  | "vn_prefill_failed"
  | "vn_blocked"
  | "au_prefill_pending"
  | "au_prefill_processing"
  | "au_prefilled"
  | "au_prefill_failed"
  | "au_blocked"
  | "retry_superseded";

export type SubmissionMode = "dry_run" | "live_assisted";

const DS160_VISA_TYPES = new Set([
  "DS160",
  "DS_160",
  "B1_B2",
  "B_1_B_2",
  "US_B1_B2",
  "US_DS160",
]);

export const ACTIVE_SUBMISSION_QUEUE_STATUSES: SubmissionQueueStatus[] = [
  "pending",
  "processing",
  "ds160_prefill_pending",
  "ds160_prefill_processing",
  "fv_prefill_pending",
  "fv_prefill_processing",
  "uk_prefill_pending",
  "uk_prefill_processing",
  "vn_prefill_pending",
  "vn_prefill_processing",
  "au_prefill_pending",
  "au_prefill_processing",
];

export const RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES: SubmissionQueueStatus[] = [
  ...ACTIVE_SUBMISSION_QUEUE_STATUSES,
  "failed",
  "ds160_prefill_failed",
  "ds160_blocked",
  "fv_prefill_failed",
  "fv_blocked",
  "uk_prefill_failed",
  "uk_blocked",
  "vn_prefill_failed",
  "vn_blocked",
  "au_prefill_failed",
  "au_blocked",
];

function normalizeVisaType(visaType: string | null | undefined): string {
  return (visaType ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

export function isDs160VisaType(visaType: string | null | undefined): boolean {
  return DS160_VISA_TYPES.has(normalizeVisaType(visaType));
}

export function isFranceVisasVisaType(visaType: string | null | undefined): boolean {
  return queueStatusForVisaType(visaType) === "fv_prefill_pending";
}

/** Map a visa package's visa_type to the submission_queue status that
 * routes the worker to the right autofill pipeline. */
export function queueStatusForVisaType(visaType: string | null | undefined): SubmissionQueueStatus {
  const normalized = normalizeVisaType(visaType);
  switch (normalized) {
    case "DS160":
    case "DS_160":
    case "B1_B2":
    case "B_1_B_2":
    case "US_B1_B2":
    case "US_DS160":
      return "ds160_prefill_pending";
    case "SCHENGEN_C":
    case "EU_SCHENGEN_C_SHORT_STAY":
      return "fv_prefill_pending";
    case "UK_STANDARD_VISITOR":
      return "uk_prefill_pending";
    case "VN_E_VISA":
      return "vn_prefill_pending";
    case "AU_VISITOR_600":
      return "au_prefill_pending";
    default:
      return "pending";
  }
}

export function queueProviderForVisaType(
  visaType: string | null | undefined,
  mode: SubmissionMode,
): string | null {
  if (isDs160VisaType(visaType)) {
    return mode === "live_assisted" ? "ceac_live" : "ceac_dry_run";
  }
  if (isFranceVisasVisaType(visaType)) {
    return mode === "live_assisted" ? "france_visas_live" : "france_visas_dry_run";
  }
  return null;
}
