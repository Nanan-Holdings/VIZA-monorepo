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
  | "site_policy_review";

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
  metadataRedactedJson: JsonObject | null;
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

export interface FranceAppointmentStatusSnapshot {
  job: FranceAppointmentJob | null;
  account: JsonObject | null;
  pendingManualAction: FranceAppointmentManualAction | null;
  manualActions: FranceAppointmentManualAction[];
  slots: FranceAppointmentSlot[];
  confirmation: FranceAppointmentConfirmation | null;
  latestStatusCheck: null;
  dryRunNotice: string | null;
}

export interface FranceAppointmentApiResponse<T> {
  error: boolean;
  data?: T;
  code?: string;
  message?: string;
}
