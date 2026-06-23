export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export const usAppointmentModes = ["dry_run", "assisted_live", "manual"] as const;
export type USAppointmentMode = (typeof usAppointmentModes)[number];

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

export const appointmentManualActionTypes = [
  "consent",
  "account_email_verification",
  "login",
  "captcha",
  "payment",
  "slot_selection",
  "final_confirmation",
  "site_policy_review",
] as const;
export type AppointmentManualActionType = (typeof appointmentManualActionTypes)[number];

export const appointmentManualActionStatuses = [
  "pending",
  "completed",
  "expired",
  "failed",
  "cancelled",
] as const;
export type AppointmentManualActionStatus =
  (typeof appointmentManualActionStatuses)[number];

export const appointmentProviderResultStatuses = [
  "completed",
  "manual_required",
  "blocked_by_policy",
  "failed",
  "no_slots_available",
  "slots_observed",
  "payment_required",
  "final_confirmation_required",
  "confirmation_captured",
  "status_checked",
] as const;
export type AppointmentProviderResultStatus =
  (typeof appointmentProviderResultStatuses)[number];

export interface USAppointmentApplication {
  id: string;
  applicantId: string;
  userId: string;
  country: string;
  countryCode: string;
  visaType: string | null;
  status: string;
  paymentStatus: string | null;
  packetStatus: string | null;
  automationStatus: string | null;
  confirmationNumber: string | null;
  ds160ApplicationId: string | null;
  ds160RetrievalUrl: string | null;
  ds160AppointmentPostCity: string | null;
  appointmentAssistanceStatus: string | null;
}

export interface PortalDetectionResult {
  providerName: string;
  schedulingProvider: string;
  portal: string;
  applyingCountryCode: string | null;
  applyingPostCity: string | null;
  confidence: "high" | "medium" | "low" | "needs_research";
  riskNotes: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string }>;
}

export interface AppointmentAccount {
  id: string;
  userId: string;
  applicationId: string | null;
  countryCode: string;
  portal: string;
  accountEmail: string | null;
  encryptedAccountPassword: string | null;
  passwordVaultRef: string | null;
  accountStatus: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  metadataRedactedJson: JsonObject;
  createdAt: string | null;
  updatedAt: string | null;
}

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

export interface AppointmentAssistanceAttempt {
  id: string;
  jobId: string | null;
  applicationId: string;
  attemptNumber: number;
  status: string;
  provider: string | null;
  mode: USAppointmentMode;
  startedAt: string | null;
  finishedAt: string | null;
  requestSnapshotRedactedJson: JsonObject | null;
  resultSnapshotRedactedJson: JsonObject | null;
  errorCode: string | null;
  errorMessage: string | null;
  screenshotUrl: string | null;
  traceUrl: string | null;
  videoUrl: string | null;
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

export interface AppointmentRunResult {
  status: AppointmentProviderResultStatus;
  jobStatus?: USAppointmentStatus;
  manualActionType?: AppointmentManualActionType;
  instruction?: string;
  message?: string;
  rawResultRedacted?: JsonObject;
  errorCode?: string;
  errorMessage?: string;
}

export interface AccountResult extends AppointmentRunResult {
  account?: AppointmentAccount;
}

export interface SlotReadResult extends AppointmentRunResult {
  slots: Array<{
    appointmentDate: string;
    appointmentTime: string;
    appointmentLocation: string;
    appointmentType: string;
    source?: string;
    metadataRedactedJson?: JsonObject;
  }>;
}

export interface AppointmentStatusResult extends AppointmentRunResult {
  statusCheck: string;
  resultRedactedJson: JsonObject;
}

export interface CreateAppointmentJobInput {
  applicationId: string;
  userId: string;
  mode?: USAppointmentMode;
  ds160ConfirmationCode?: string | null;
  applyingCountryCode: string;
  applyingPostCity?: string | null;
  schedulingProvider?: string | null;
  userPreferencesJson?: JsonObject;
  idempotencyKey?: string;
}

export interface InsertAppointmentManualActionInput {
  jobId: string | null;
  applicationId: string;
  userId: string;
  actionType: AppointmentManualActionType;
  status?: AppointmentManualActionStatus;
  instruction?: string | null;
  userInputSchemaJson?: JsonObject | null;
  userInputRedactedJson?: JsonObject | null;
  screenshotUrl?: string | null;
  expiresAt?: string | null;
  metadataRedactedJson?: JsonObject | null;
}

export interface InsertAppointmentAuditEventInput {
  jobId?: string | null;
  applicationId?: string | null;
  userId?: string | null;
  eventType: string;
  eventMessage?: string | null;
  metadataRedactedJson?: JsonObject | null;
}

export interface AppointmentStatusSnapshot {
  job: AppointmentAssistanceJob | null;
  account: SafeAppointmentAccount | null;
  pendingManualAction: AppointmentManualAction | null;
  manualActions: AppointmentManualAction[];
  slots: AppointmentSlot[];
  confirmation: AppointmentConfirmation | null;
  latestStatusCheck: AppointmentStatusCheck | null;
  dryRunNotice: string | null;
}

export type SafeAppointmentAccount = Omit<
  AppointmentAccount,
  "encryptedAccountPassword" | "passwordVaultRef"
> & {
  encryptedAccountPassword: null;
  passwordVaultRef: null;
};
