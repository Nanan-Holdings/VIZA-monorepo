export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export type USAppointmentMode = "dry_run" | "assisted_live" | "manual";

export const usAppointmentStatuses = [
  "appointment_not_started",
  "appointment_consent_required",
  "appointment_consent_received",
  "appointment_missing_ds160_confirmation",
  "appointment_missing_applying_post",
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
  "appointment_booked",
  "appointment_confirmation_captured",
  "appointment_status_check_in_progress",
  "appointment_status_checked",
  "appointment_manual_required",
  "appointment_blocked_by_site_policy",
  "appointment_failed",
  "appointment_cancelled",
] as const;
export type USAppointmentStatus = (typeof usAppointmentStatuses)[number];

export type AppointmentManualActionType =
  | "consent"
  | "account_email_verification"
  | "login"
  | "captcha"
  | "payment"
  | "slot_selection"
  | "final_confirmation"
  | "site_policy_review";

export type AppointmentManualActionStatus =
  | "pending"
  | "completed"
  | "expired"
  | "failed"
  | "cancelled";

export interface AppointmentAssistanceJob {
  id: string;
  applicationId: string;
  userId: string;
  appointmentAccountId: string | null;
  countryCode: string;
  visaType: string;
  ds160ConfirmationCode: string | null;
  applyingCountryCode: string | null;
  applyingPostCity: string | null;
  schedulingProvider: string | null;
  status: USAppointmentStatus;
  mode: USAppointmentMode;
  userPreferencesJson: JsonObject;
  requiresUserAction: boolean;
  currentManualAction: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  idempotencyKey: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AppointmentManualAction {
  id: string;
  jobId: string | null;
  applicationId: string;
  userId: string;
  actionType: AppointmentManualActionType;
  status: AppointmentManualActionStatus;
  instruction: string | null;
  userInputSchemaJson: JsonObject | null;
  userInputRedactedJson: JsonObject | null;
  screenshotUrl: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  metadataRedactedJson: JsonObject | null;
  createdAt: string | null;
}

export interface AppointmentSlot {
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

export interface AppointmentConfirmation {
  id: string;
  jobId: string | null;
  applicationId: string;
  userId: string;
  countryCode: string;
  visaType: string;
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

export interface AppointmentStatusCheck {
  id: string;
  jobId: string | null;
  applicationId: string;
  userId: string;
  status: string;
  checkedAt: string | null;
  resultRedactedJson: JsonObject | null;
  screenshotUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface AppointmentStatusSnapshot {
  job: AppointmentAssistanceJob | null;
  account: JsonObject | null;
  pendingManualAction: AppointmentManualAction | null;
  manualActions: AppointmentManualAction[];
  slots: AppointmentSlot[];
  confirmation: AppointmentConfirmation | null;
  latestStatusCheck: AppointmentStatusCheck | null;
  dryRunNotice: string | null;
}

export interface AppointmentApiResponse<T> {
  error: boolean;
  data?: T;
  code?: string;
  message?: string;
}
