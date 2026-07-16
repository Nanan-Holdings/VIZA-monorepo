export type JsonObject = Record<string, unknown>;

export interface JapanAppointmentJob {
  id: string;
  applicationId: string;
  userId: string;
  status: string;
  mode: "assisted_live";
  requiresUserAction: boolean;
  currentManualAction: string | null;
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
  };
}

export interface JapanAppointmentApiResponse<T> {
  error: boolean;
  data?: T;
  code?: string;
  message?: string;
}
