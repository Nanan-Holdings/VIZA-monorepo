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
  | "vn_payment_pending"
  | "vn_payment_processing"
  | "vn_payment_paid"
  | "vn_payment_failed"
  | "vn_blocked"
  | "sgac_dry_run_pending"
  | "sgac_dry_run_processing"
  | "sgac_dry_run_failed"
  | "sgac_live_assisted_pending"
  | "sgac_live_assisted_scheduled"
  | "sgac_live_assisted_cancelled"
  | "sgac_live_assisted_processing"
  | "sgac_live_assisted_failed"
  | "sgac_blocked"
  | "mdac_dry_run_pending"
  | "mdac_dry_run_processing"
  | "mdac_dry_run_failed"
  | "mdac_live_assisted_pending"
  | "mdac_live_assisted_scheduled"
  | "mdac_live_assisted_processing"
  | "mdac_live_assisted_failed"
  | "mdac_live_assisted_cancelled"
  | "mdac_blocked"
  | "tdac_dry_run_pending"
  | "tdac_dry_run_processing"
  | "tdac_dry_run_failed"
  | "tdac_live_assisted_pending"
  | "tdac_live_assisted_scheduled"
  | "tdac_live_assisted_processing"
  | "tdac_live_assisted_failed"
  | "tdac_live_assisted_cancelled"
  | "tdac_blocked"
  | "id_c1_live_assisted_pending"
  | "id_c1_live_assisted_processing"
  | "id_c1_live_assisted_failed"
  | "id_c1_blocked"
  | "id_b1_evoa_live_assisted_pending"
  | "id_b1_evoa_live_assisted_processing"
  | "id_b1_evoa_live_assisted_failed"
  | "id_b1_evoa_blocked"
  | "phetravel_dry_run_pending"
  | "phetravel_dry_run_processing"
  | "phetravel_dry_run_failed"
  | "phetravel_live_assisted_pending"
  | "phetravel_live_assisted_scheduled"
  | "phetravel_live_assisted_processing"
  | "phetravel_live_assisted_failed"
  | "phetravel_live_assisted_cancelled"
  | "phetravel_blocked"
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

const MALAYSIA_COUNTRY_ALIASES = new Set([
  "MY",
  "MALAYSIA",
]);

const MALAYSIA_MDAC_TYPES = new Set([
  "MY_MDAC_ARRIVAL_CARD",
]);

const THAILAND_COUNTRY_ALIASES = new Set([
  "TH",
  "THAILAND",
]);

const THAILAND_TDAC_TYPES = new Set([
  "TH_TDAC_ARRIVAL_CARD",
]);

const PHILIPPINES_COUNTRY_ALIASES = new Set([
  "PH",
  "PHILIPPINES",
]);

const PHILIPPINES_ETRAVEL_TYPES = new Set([
  "PH_ETRAVEL_ARRIVAL_CARD",
]);

const INDONESIA_COUNTRY_ALIASES = new Set([
  "ID",
  "INDONESIA",
]);

const INDONESIA_C1_TYPES = new Set([
  "ID_C1_TOURIST",
  "C1_TOURIST",
  "B211A",
]);

const INDONESIA_B1_EVOA_TYPES = new Set([
  "ID_B1_EVOA",
  "B1_EVOA",
  "EVOA",
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
  "mdac_dry_run_pending",
  "mdac_dry_run_processing",
  "mdac_live_assisted_pending",
  "mdac_live_assisted_scheduled",
  "mdac_live_assisted_processing",
  "tdac_dry_run_pending",
  "tdac_dry_run_processing",
  "tdac_live_assisted_pending",
  "tdac_live_assisted_scheduled",
  "tdac_live_assisted_processing",
  "id_c1_live_assisted_pending",
  "id_c1_live_assisted_processing",
  "id_b1_evoa_live_assisted_pending",
  "id_b1_evoa_live_assisted_processing",
  "phetravel_dry_run_pending",
  "phetravel_dry_run_processing",
  "phetravel_live_assisted_pending",
  "phetravel_live_assisted_scheduled",
  "phetravel_live_assisted_processing",
  "vn_prefill_pending",
  "vn_prefill_processing",
  "vn_payment_pending",
  "vn_payment_processing",
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
  "sgac_live_assisted_cancelled",
  "sgac_blocked",
  "mdac_dry_run_failed",
  "mdac_live_assisted_failed",
  "mdac_live_assisted_cancelled",
  "mdac_blocked",
  "tdac_dry_run_failed",
  "tdac_live_assisted_failed",
  "tdac_live_assisted_cancelled",
  "tdac_blocked",
  "id_c1_live_assisted_failed",
  "id_c1_blocked",
  "id_b1_evoa_live_assisted_failed",
  "id_b1_evoa_blocked",
  "phetravel_dry_run_failed",
  "phetravel_live_assisted_failed",
  "phetravel_live_assisted_cancelled",
  "phetravel_blocked",
  "vn_prefill_failed",
  "vn_payment_failed",
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

export function isMalaysiaMdacApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  return (
    MALAYSIA_COUNTRY_ALIASES.has(normalizeCountry(country)) &&
    MALAYSIA_MDAC_TYPES.has(normalizeVisaType(visaType))
  );
}

export function isThailandTdacApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  return (
    THAILAND_COUNTRY_ALIASES.has(normalizeCountry(country)) &&
    THAILAND_TDAC_TYPES.has(normalizeVisaType(visaType))
  );
}

export function isPhilippinesEtravelApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  return (
    PHILIPPINES_COUNTRY_ALIASES.has(normalizeCountry(country)) &&
    PHILIPPINES_ETRAVEL_TYPES.has(normalizeVisaType(visaType))
  );
}

export function isIndonesiaEVisaApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  const normalizedVisaType = normalizeVisaType(visaType);
  return (
    INDONESIA_COUNTRY_ALIASES.has(normalizeCountry(country)) &&
    (INDONESIA_C1_TYPES.has(normalizedVisaType) || INDONESIA_B1_EVOA_TYPES.has(normalizedVisaType))
  );
}

export function isDigitalArrivalCardApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): boolean {
  return (
    isSgArrivalCardApplication(country, visaType) ||
    isMalaysiaMdacApplication(country, visaType) ||
    isThailandTdacApplication(country, visaType) ||
    isPhilippinesEtravelApplication(country, visaType)
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
    case "MY_MDAC_ARRIVAL_CARD":
      return "mdac_dry_run_pending";
    case "TH_TDAC_ARRIVAL_CARD":
      return "tdac_dry_run_pending";
    case "PH_ETRAVEL_ARRIVAL_CARD":
      return "phetravel_dry_run_pending";
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
  if (isMalaysiaMdacApplication(country, visaType)) {
    return mode === "live_assisted" ? "mdac_live_assisted_pending" : "mdac_dry_run_pending";
  }
  if (isThailandTdacApplication(country, visaType)) {
    return mode === "live_assisted" ? "tdac_live_assisted_pending" : "tdac_dry_run_pending";
  }
  if (isPhilippinesEtravelApplication(country, visaType)) {
    return mode === "live_assisted" ? "phetravel_live_assisted_pending" : "phetravel_dry_run_pending";
  }
  if (isIndonesiaEVisaApplication(country, visaType) && mode === "live_assisted") {
    return INDONESIA_B1_EVOA_TYPES.has(normalizeVisaType(visaType))
      ? "id_b1_evoa_live_assisted_pending"
      : "id_c1_live_assisted_pending";
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
  if (MALAYSIA_MDAC_TYPES.has(normalizeVisaType(visaType))) {
    return mode === "live_assisted" ? "malaysia_mdac_live" : "malaysia_mdac_dry_run";
  }
  if (THAILAND_TDAC_TYPES.has(normalizeVisaType(visaType))) {
    return mode === "live_assisted" ? "thailand_tdac_live" : "thailand_tdac_dry_run";
  }
  if (PHILIPPINES_ETRAVEL_TYPES.has(normalizeVisaType(visaType))) {
    return mode === "live_assisted" ? "philippines_etravel_live" : "philippines_etravel_dry_run";
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
  if (isMalaysiaMdacApplication(country, visaType)) {
    return mode === "live_assisted" ? "malaysia_mdac_live" : "malaysia_mdac_dry_run";
  }
  if (isThailandTdacApplication(country, visaType)) {
    return mode === "live_assisted" ? "thailand_tdac_live" : "thailand_tdac_dry_run";
  }
  if (isPhilippinesEtravelApplication(country, visaType)) {
    return mode === "live_assisted" ? "philippines_etravel_live" : "philippines_etravel_dry_run";
  }
  if (isIndonesiaEVisaApplication(country, visaType) && mode === "live_assisted") {
    return INDONESIA_B1_EVOA_TYPES.has(normalizeVisaType(visaType))
      ? "indonesia_b1_evoa_live"
      : "indonesia_c1_live";
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
    isDigitalArrivalCardApplication(country, visaType) ||
    isIndonesiaEVisaApplication(country, visaType)
  );
}

function isMissingSubmissionModeColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("submission_queue.mode") ||
    message.includes("submission_queue.provider") ||
    message.includes("column submission_queue.mode does not exist") ||
    message.includes("column submission_queue.provider does not exist") ||
    message.includes("could not find the 'mode' column") ||
    message.includes("could not find the 'provider' column")
  );
}

export function retryQueueInsertCanUseLegacyPayload(
  error: { message?: string; code?: string },
  input: {
    mode: SubmissionMode;
    queueStatus: SubmissionQueueStatus;
  },
): boolean {
  if (!isMissingSubmissionModeColumnError(error)) return false;
  if (input.mode === "dry_run") return true;
  return (
    input.queueStatus === "ds160_live_assisted_pending" ||
    input.queueStatus === "vn_live_assisted_pending" ||
    input.queueStatus === "france_live_assisted_pending" ||
    input.queueStatus === "sgac_live_assisted_pending" ||
    input.queueStatus === "sgac_live_assisted_scheduled" ||
    input.queueStatus === "mdac_live_assisted_pending" ||
    input.queueStatus === "mdac_live_assisted_scheduled" ||
    input.queueStatus === "tdac_live_assisted_pending" ||
    input.queueStatus === "tdac_live_assisted_scheduled" ||
    input.queueStatus === "id_c1_live_assisted_pending" ||
    input.queueStatus === "id_b1_evoa_live_assisted_pending" ||
    input.queueStatus === "phetravel_live_assisted_pending" ||
    input.queueStatus === "phetravel_live_assisted_scheduled"
  );
}

export function submitModeForPrimaryApplicationAction(
  country: string | null | undefined,
  visaType: string | null | undefined,
): SubmissionMode {
  if (
    isVietnamEVisaApplication(country, visaType) ||
    isDigitalArrivalCardApplication(country, visaType) ||
    isIndonesiaEVisaApplication(country, visaType)
  ) {
    return "live_assisted";
  }
  return "dry_run";
}
