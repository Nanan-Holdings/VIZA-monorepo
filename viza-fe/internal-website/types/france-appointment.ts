export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export type FranceAppointmentMode = "dry_run" | "assisted_live" | "manual";

export const franceAppointmentStatuses = [
  "appointment_not_started",
  "appointment_consent_required",
  "appointment_consent_received",
  "appointment_account_required",
  "appointment_account_creation_started",
  "appointment_email_verification_required",
  "appointment_login_required",
  "appointment_captcha_required",
  "appointment_profile_fill_in_progress",
  "appointment_profile_filled",
  "appointment_ds160_linked",
  "appointment_payment_required",
  "appointment_payment_in_progress",
  "appointment_payment_completed",
  "appointment_calendar_opened",
  "appointment_slots_observed",
  "appointment_no_slots_available",
  "appointment_slot_selection_required",
  "appointment_slot_selected",
  "appointment_final_confirmation_required",
  "appointment_final_confirmation_approved",
  "appointment_booked",
  "appointment_confirmation_captured",
  "appointment_status_check_in_progress",
  "appointment_status_checked",
  "appointment_manual_required",
  "appointment_blocked_by_site_policy",
  "appointment_failed",
  "appointment_cancelled",
] as const;

export type FranceAppointmentStatus =
  (typeof franceAppointmentStatuses)[number];

export type FranceAppointmentManualActionType =
  | "consent"
  | "account_email_verification"
  | "login"
  | "captcha"
  | "payment"
  | "slot_selection"
  | "final_confirmation"
  | "site_policy_review"
  | "waf"
  | "selector_drift"
  | "account_preparation_failed"
  | "account_preparation_disabled"
  | "account_preparation_not_configured"
  | "account_preparation_incomplete"
  | "applicant_profile_review_required"
  | "worker_readiness_timeout"
  | "worker_not_configured"
  | "captcha_grid"
  | "captcha_token"
  | "official_field_mapping_required";

export type FranceAppointmentManualActionStatus =
  | "pending"
  | "completed"
  | "expired"
  | "failed"
  | "cancelled";

export interface FranceAppointmentJob {
  id: string;
  applicationId: string;
  userId: string;
  appointmentAccountId: string | null;
  countryCode: "FR";
  visaType: "EU_SCHENGEN_C_SHORT_STAY";
  ds160ConfirmationCode: string | null;
  applyingCountryCode: "CN";
  applyingPostCity: string | null;
  schedulingProvider: "tlscontact_cn_fr";
  status: FranceAppointmentStatus;
  mode: FranceAppointmentMode;
  userPreferencesJson: JsonObject;
  requiresUserAction: boolean;
  currentManualAction: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  idempotencyKey: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FranceAppointmentManualAction {
  id: string;
  jobId: string | null;
  applicationId: string;
  userId: string;
  actionType: FranceAppointmentManualActionType;
  status: FranceAppointmentManualActionStatus;
  instruction: string | null;
  userInputSchemaJson: JsonObject | null;
  userInputRedactedJson: JsonObject | null;
  screenshotUrl: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  metadataRedactedJson: JsonObject | null;
  createdAt: string | null;
}

export interface FranceAppointmentSlot {
  id: string;
  jobId: string | null;
  applicationId: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentLocation: string | null;
  appointmentType: string | null;
  source: string | null;
  status: string;
  observedAt: string | null;
  expiresAt: string | null;
  metadataRedactedJson: JsonObject | null;
}

/**
 * Server-owned applicant review data for the appointment assistant.
 *
 * The values are captured with the status snapshot so the client never needs
 * to compose a second, potentially stale review from a profile action.
 */
export interface FranceAppointmentReview {
  fullName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  franceVisasReferenceMasked: string | null;
  centerCode: string | null;
  centerName: string | null;
  missingFields: string[];
  complete: boolean;
}

export interface FranceAppointmentConfirmation {
  id: string;
  jobId: string | null;
  applicationId: string;
  userId: string;
  countryCode: "FR";
  visaType: "EU_SCHENGEN_C_SHORT_STAY";
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentLocation: string | null;
  appointmentType: string | null;
  confirmationNumber: string | null;
  confirmationPdfUrl: string | null;
  confirmationScreenshotUrl: string | null;
  rawConfirmationRedactedJson: JsonObject | null;
  createdAt: string | null;
}

export interface FranceAppointmentAccount {
  id: string;
  applicationId: string | null;
  accountEmail: string | null;
  accountStatus: string;
  emailVerified: boolean;
  referenceReady?: boolean;
  metadataRedactedJson?: JsonObject;
  lastLoginAt: string | null;
  updatedAt: string | null;
}

export interface FranceAppointmentStatusSnapshot {
  job: FranceAppointmentJob | null;
  account: FranceAppointmentAccount | null;
  review: FranceAppointmentReview | null;
  pendingManualAction: FranceAppointmentManualAction | null;
  manualActions: FranceAppointmentManualAction[];
  slots: FranceAppointmentSlot[];
  confirmation: FranceAppointmentConfirmation | null;
  latestStatusCheck: null;
  dryRunNotice: string | null;
}

export type FranceAppointmentStage = "review" | "account" | "slots" | "confirm" | "result";

const TERMINAL_APPOINTMENT_STATUSES = new Set<FranceAppointmentStatus>([
  "appointment_failed",
  "appointment_cancelled",
  "appointment_blocked_by_site_policy",
]);

/**
 * Derive the current screen solely from persisted server state.
 *
 * This function intentionally has no local consent/review override. A refresh
 * must render the same stage as the last persisted snapshot, and terminal
 * failures/cancellations expose the review/restart entry point.
 */
export function getFranceAppointmentStage(
  snapshot: FranceAppointmentStatusSnapshot | null,
): FranceAppointmentStage {
  if (!snapshot?.job) return "review";
  if (snapshot.confirmation) return "result";
  if (TERMINAL_APPOINTMENT_STATUSES.has(snapshot.job.status)) return "review";

  const hasSelectedSlot = snapshot.slots.some((slot) =>
    ["selected", "user_selected"].includes(slot.status),
  );
  if (
    hasSelectedSlot ||
    snapshot.pendingManualAction?.actionType === "final_confirmation" ||
    [
      "appointment_slot_selected",
      "appointment_final_confirmation_required",
      "appointment_final_confirmation_approved",
      "appointment_booked",
    ].includes(snapshot.job.status)
  ) {
    return "confirm";
  }

  const hasSlotObservation = snapshot.slots.length > 0;
  if (
    hasSlotObservation ||
    [
      "appointment_calendar_opened",
      "appointment_slots_observed",
      "appointment_slot_selection_required",
      "appointment_no_slots_available",
    ].includes(snapshot.job.status)
  ) {
    return "slots";
  }

  return "account";
}

export interface FranceAppointmentApiResponse<T> {
  error: boolean;
  data?: T;
  code?: string;
  message?: string;
}
