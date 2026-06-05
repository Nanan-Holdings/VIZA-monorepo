import type {
  AccountResult,
  AppointmentAssistanceJob,
  AppointmentConfirmation,
  AppointmentRunResult,
  AppointmentStatusResult,
  PortalDetectionResult,
  SlotReadResult,
  USAppointmentApplication,
  ValidationResult,
} from "./types.js";

export interface USAppointmentProvider {
  providerName: string;
  supportedApplyingCountries: string[];
  supportedPosts?: string[];
  supportsDryRun: boolean;
  supportsAssistedLive: boolean;
  supportsAccountCreation: boolean;
  supportsStatusCheck: boolean;

  detectPortal(application: USAppointmentApplication): Promise<PortalDetectionResult>;
  validatePreconditions(application: USAppointmentApplication): Promise<ValidationResult>;

  createOrLoadAccount(job: AppointmentAssistanceJob): Promise<AccountResult>;
  runAccountCreation(job: AppointmentAssistanceJob): Promise<AppointmentRunResult>;
  runLogin(job: AppointmentAssistanceJob): Promise<AppointmentRunResult>;
  fillProfile(job: AppointmentAssistanceJob): Promise<AppointmentRunResult>;
  linkDS160(job: AppointmentAssistanceJob): Promise<AppointmentRunResult>;
  handleFeeStep(job: AppointmentAssistanceJob): Promise<AppointmentRunResult>;
  openCalendar(job: AppointmentAssistanceJob): Promise<AppointmentRunResult>;
  readVisibleSlots(job: AppointmentAssistanceJob): Promise<SlotReadResult>;
  selectSlot(job: AppointmentAssistanceJob, slotId: string): Promise<AppointmentRunResult>;
  finalConfirm(job: AppointmentAssistanceJob): Promise<AppointmentRunResult>;
  captureConfirmation(job: AppointmentAssistanceJob): Promise<AppointmentConfirmation>;
  checkAppointmentStatus(job: AppointmentAssistanceJob): Promise<AppointmentStatusResult>;
}
