export type JsonObject = Record<string, unknown>;

export interface JapanAppointmentJob {
  id: string;
  applicationId: string;
  userId: string;
  status: string;
  mode: "assisted_live";
  requiresUserAction: boolean;
  currentManualAction: string | null;
  userPreferencesJson: JsonObject;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface JapanAppointmentAccount {
  id: string;
  accountEmail: string | null;
  accountStatus: string;
  emailVerified: boolean;
}

export interface JapanAppointmentManualAction {
  id: string;
  actionType: string;
  status: string;
  instruction: string | null;
  metadataRedactedJson: JsonObject;
  createdAt: string | null;
}

export interface JapanAppointmentSlot {
  id: string;
  jobId: string;
  applicationId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  source: string;
  status: string;
  observedAt: string | null;
  metadataRedactedJson: JsonObject;
}

export interface JapanAppointmentConfirmation {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  confirmationNumber: string | null;
  confirmationPdfUrl: string | null;
  confirmationScreenshotUrl: string | null;
  createdAt: string | null;
}

export interface JapanAppointmentSnapshot {
  job: JapanAppointmentJob | null;
  account: JapanAppointmentAccount | null;
  slots: JapanAppointmentSlot[];
  pendingManualAction: JapanAppointmentManualAction | null;
  evidence: JsonObject | null;
  confirmation: JapanAppointmentConfirmation | null;
  preflight: {
    consentRecorded: boolean;
    missingApplicationFields: string[];
    documentTypes: string[];
    passportUploaded: boolean;
    photoUploaded: boolean;
    review: {
      englishName: string;
      dateOfBirth: string;
      nationality: string;
      passportNumber: string;
      passportExpiryDate: string;
      phone: string;
      email: string;
      residentialAddress: string;
      appointmentCenter: string;
    };
  };
}

export interface JapanAppointmentApiResponse<T> {
  error: boolean;
  data?: T;
  code?: string;
  message?: string;
}

export type JapanAppointmentStage = "review" | "account" | "slots" | "confirm" | "result";

export function getJapanAppointmentStage(snapshot: JapanAppointmentSnapshot | null): JapanAppointmentStage {
  if (!snapshot?.job || snapshot.job.status === "appointment_cancelled") return "review";
  if (snapshot.confirmation) return "result";
  const selectedSlot = snapshot.slots.some((slot) => ["user_selected", "selected"].includes(slot.status));
  if (
    selectedSlot
    || snapshot.job.currentManualAction === "payment"
    || ["appointment_payment_required", "appointment_payment_ready", "appointment_final_confirmation_approved"].includes(snapshot.job.status)
  ) return "confirm";
  if (
    snapshot.slots.some((slot) => ["observed", "user_selected", "selected"].includes(slot.status))
    || ["appointment_no_slots_available", "appointment_slot_selection_required"].includes(snapshot.job.status)
  ) return "slots";
  return "account";
}
