export type SubmissionQueueStatus =
  | "pending"
  | "processing"
  | "ds160_prefill_pending"
  | "ds160_prefill_processing"
  | "fv_prefill_pending"
  | "fv_prefill_processing"
  | "uk_prefill_pending"
  | "uk_prefill_processing"
  | "vn_prefill_pending"
  | "vn_prefill_processing"
  | "au_prefill_pending"
  | "au_prefill_processing";

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

/** Map a visa package's visa_type to the submission_queue status that
 * routes the worker to the right autofill pipeline. */
export function queueStatusForVisaType(visaType: string | null | undefined): SubmissionQueueStatus {
  const normalized = (visaType ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
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
