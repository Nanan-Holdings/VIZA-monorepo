export type SubmissionQueueStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "stalled"
  | "action_required"
  | "ds160_prefill_pending"
  | "ds160_prefill_processing"
  | "ds160_prefilled"
  | "ds160_prefill_failed"
  | "ds160_live_assisted_pending"
  | "ds160_live_assisted_processing"
  | "ds160_live_assisted_failed"
  | "ds160_proof_pending"
  | "ds160_proof_processing"
  | "ds160_proof_failed"
  | "ds160_blocked"
  | "fv_prefill_pending"
  | "fv_prefill_processing"
  | "fv_prefilled"
  | "fv_prefill_failed"
  | "fv_blocked"
  | "france_live_assisted_pending"
  | "france_live_processing"
  | "france_live_official_portal_opened"
  | "needs_manual_verification"
  | "uk_prefill_pending"
  | "uk_prefill_processing"
  | "uk_prefilled"
  | "uk_prefill_failed"
  | "uk_blocked"
  | "vn_dry_run_pending"
  | "vn_dry_run_processing"
  | "vn_dry_run_failed"
  | "vn_live_assisted_pending"
  | "vn_live_assisted_processing"
  | "vn_live_assisted_failed"
  | "vn_prefill_pending"
  | "vn_prefill_processing"
  | "vn_prefilled"
  | "vn_prefill_failed"
  | "vn_blocked"
  | "sgac_dry_run_pending"
  | "sgac_dry_run_processing"
  | "sgac_dry_run_failed"
  | "sgac_live_assisted_pending"
  | "sgac_live_assisted_scheduled"
  | "sgac_live_assisted_processing"
  | "sgac_live_assisted_failed"
  | "sgac_blocked"
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

const VIETNAM_COUNTRY_ALIASES = new Set([
  "VN",
  "VIETNAM",
  "VIET_NAM",
]);

const VIETNAM_EVISA_TYPES = new Set([
  "VN_E_VISA",
  "VIETNAM_E_VISA",
  "E_VISA_TOURISM",
  "EVISA_TOURISM",
  "TOURIST_E_VISA",
  "TOURIST_EVISA",
]);

const SINGAPORE_COUNTRY_ALIASES = new Set([
  "SG",
  "SINGAPORE",
]);

const SG_ARRIVAL_CARD_TYPES = new Set([
  "SG_ARRIVAL_CARD",
]);

export const ACTIVE_SUBMISSION_QUEUE_STATUSES: SubmissionQueueStatus[] = [
  "pending",
  "processing",
  "ds160_prefill_pending",
  "ds160_prefill_processing",
  "ds160_live_assisted_pending",
  "ds160_live_assisted_processing",
  "ds160_proof_pending",
  "ds160_proof_processing",
  "fv_prefill_pending",
  "fv_prefill_processing",
  "france_live_assisted_pending",
  "france_live_processing",
  "france_live_official_portal_opened",
  "uk_prefill_pending",
  "uk_prefill_processing",
  "vn_dry_run_pending",
  "vn_dry_run_processing",
  "vn_live_assisted_pending",
  "vn_live_assisted_processing",
  "sgac_dry_run_pending",
  "sgac_dry_run_processing",
  "sgac_live_assisted_scheduled",
  "sgac_live_assisted_pending",
  "sgac_live_assisted_processing",
  "vn_prefill_pending",
  "vn_prefill_processing",
  "au_prefill_pending",
  "au_prefill_processing",
];

export const RETRY_SUPERSEDABLE_SUBMISSION_QUEUE_STATUSES: SubmissionQueueStatus[] = [
  ...ACTIVE_SUBMISSION_QUEUE_STATUSES,
  "stalled",
  "action_required",
  "needs_manual_verification",
  "failed",
  "ds160_prefill_failed",
  "ds160_live_assisted_failed",
  "ds160_proof_failed",
  "ds160_blocked",
  "fv_prefill_failed",
  "fv_blocked",
  "uk_prefill_failed",
  "uk_blocked",
  "vn_dry_run_failed",
  "vn_live_assisted_failed",
  "sgac_dry_run_failed",
  "sgac_live_assisted_failed",
  "sgac_blocked",
  "vn_prefill_failed",
  "vn_blocked",
  "au_prefill_failed",
  "au_blocked",
];

function normalizeVisaType(visaType: string | null | undefined): string {
  return (visaType ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function normalizeCountry(country: string | null | undefined): string {
  return (country ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

export function isDs160VisaType(visaType: string | null | undefined): boolean {
  return DS160_VISA_TYPES.has(normalizeVisaType(visaType));
}

export function isFranceVisasVisaType(visaType: string | null | undefined): boolean {
  return queueStatusForVisaType(visaType) === "fv_prefill_pending";
}

export function isVietnamEVisaApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  return (
    VIETNAM_COUNTRY_ALIASES.has(normalizeCountry(country)) &&
    VIETNAM_EVISA_TYPES.has(normalizeVisaType(visaType))
  );
}

export function isSgArrivalCardApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  return (
    SINGAPORE_COUNTRY_ALIASES.has(normalizeCountry(country)) &&
    SG_ARRIVAL_CARD_TYPES.has(normalizeVisaType(visaType))
  );
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
    case "VIETNAM_E_VISA":
      return "vn_dry_run_pending";
    case "SG_ARRIVAL_CARD":
      return "sgac_dry_run_pending";
    case "AU_VISITOR_600":
      return "au_prefill_pending";
    default:
      return "pending";
  }
}

export function queueStatusForSubmissionMode(
  visaType: string | null | undefined,
  mode: SubmissionMode,
): SubmissionQueueStatus {
  if (isDs160VisaType(visaType) && mode === "live_assisted") {
    return "ds160_live_assisted_pending";
  }
  if (isFranceVisasVisaType(visaType) && mode === "live_assisted") {
    return "france_live_assisted_pending";
  }
  return queueStatusForVisaType(visaType);
}

export function queueStatusForApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
  mode: SubmissionMode = "dry_run",
): SubmissionQueueStatus {
  if (isVietnamEVisaApplication(country, visaType)) {
    return mode === "live_assisted" ? "vn_live_assisted_pending" : "vn_dry_run_pending";
  }
  if (isSgArrivalCardApplication(country, visaType)) {
    return mode === "live_assisted" ? "sgac_live_assisted_pending" : "sgac_dry_run_pending";
  }

  return queueStatusForSubmissionMode(visaType, mode);
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
  if (SG_ARRIVAL_CARD_TYPES.has(normalizeVisaType(visaType))) {
    return mode === "live_assisted" ? "sg_arrival_card_live" : "sg_arrival_card_dry_run";
  }
  return null;
}

export function queueProviderForApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
  mode: SubmissionMode,
): string | null {
  if (isVietnamEVisaApplication(country, visaType)) {
    return mode === "live_assisted" ? "vietnam_evisa_live" : "vietnam_evisa_dry_run";
  }
  if (isSgArrivalCardApplication(country, visaType)) {
    return mode === "live_assisted" ? "sg_arrival_card_live" : "sg_arrival_card_dry_run";
  }
  return queueProviderForVisaType(visaType, mode);
}

export function submissionQueueRequiresServerEnqueue(
  country: string | null | undefined,
  visaType: string | null | undefined,
  mode: SubmissionMode,
): boolean {
  return (
    mode === "live_assisted" ||
    isVietnamEVisaApplication(country, visaType) ||
    isSgArrivalCardApplication(country, visaType)
  );
}

export function submitModeForPrimaryApplicationAction(
  country: string | null | undefined,
  visaType: string | null | undefined,
): SubmissionMode {
  if (isVietnamEVisaApplication(country, visaType) || isSgArrivalCardApplication(country, visaType)) {
    return "live_assisted";
  }
  return "dry_run";
}
