import type { USAppointmentProvider } from "./USAppointmentProvider.js";
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

export const DRY_RUN_SLOTS = [
  {
    appointmentDate: "2026-09-10",
    appointmentTime: "09:30",
    appointmentLocation: "U.S. Embassy Singapore",
    appointmentType: "interview",
    source: "dry_run",
  },
  {
    appointmentDate: "2026-09-12",
    appointmentTime: "14:00",
    appointmentLocation: "U.S. Embassy Singapore",
    appointmentType: "interview",
    source: "dry_run",
  },
];

export class DryRunUSAppointmentProvider implements USAppointmentProvider {
  providerName = "dry_run_us_appointment";
  supportedApplyingCountries = ["*"];
  supportsDryRun = true;
  supportsAssistedLive = false;
  supportsAccountCreation = true;
  supportsStatusCheck = true;

  async detectPortal(application: USAppointmentApplication): Promise<PortalDetectionResult> {
    return {
      providerName: this.providerName,
      schedulingProvider: "dry_run",
      portal: "dry_run_us_appointment_portal",
      applyingCountryCode: application.countryCode,
      applyingPostCity: null,
      confidence: "high",
      riskNotes: [
        "Dry-run provider only. No real appointment portal was opened.",
      ],
    };
  }

  async validatePreconditions(application: USAppointmentApplication): Promise<ValidationResult> {
    const errors: ValidationResult["errors"] = [];
    const visaType = application.visaType?.toUpperCase() ?? "";
    if (application.countryCode !== "US" && application.country.toLowerCase() !== "united_states") {
      errors.push({
        code: "not_us_application",
        message: "Appointment assistance is currently scoped to U.S. B1/B2 applications.",
      });
    }
    if (visaType && !["B1/B2", "B1_B2", "DS160", "DS-160"].includes(visaType)) {
      errors.push({
        code: "unsupported_visa_type",
        message: "Only U.S. B1/B2 DS-160 appointment assistance is supported.",
      });
    }
    return { valid: errors.length === 0, errors };
  }

  async createOrLoadAccount(): Promise<AccountResult> {
    return {
      status: "completed",
      jobStatus: "appointment_account_creation_started",
      message: "Dry-run appointment account loaded.",
      rawResultRedacted: { dry_run_only: true },
    };
  }

  async runAccountCreation(): Promise<AppointmentRunResult> {
    return {
      status: "manual_required",
      jobStatus: "appointment_email_verification_required",
      manualActionType: "account_email_verification",
      instruction: "Enter the dry-run email verification code shown by VIZA to continue.",
      rawResultRedacted: { dry_run_only: true, simulated_email_verification: true },
    };
  }

  async runLogin(): Promise<AppointmentRunResult> {
    return {
      status: "completed",
      jobStatus: "appointment_login_required",
      rawResultRedacted: { dry_run_only: true, login_simulated: true },
    };
  }

  async fillProfile(): Promise<AppointmentRunResult> {
    return {
      status: "completed",
      jobStatus: "appointment_profile_filled",
      rawResultRedacted: { dry_run_only: true, profile_autofill_simulated: true },
    };
  }

  async linkDS160(): Promise<AppointmentRunResult> {
    return {
      status: "completed",
      jobStatus: "appointment_ds160_linked",
      rawResultRedacted: { dry_run_only: true, ds160_link_simulated: true },
    };
  }

  async handleFeeStep(): Promise<AppointmentRunResult> {
    return {
      status: "payment_required",
      jobStatus: "appointment_payment_required",
      manualActionType: "payment",
      instruction: "Dry-run checkpoint: acknowledge that no real MRV/payment is made in development.",
      rawResultRedacted: { dry_run_only: true, payment_checkpoint_simulated: true },
    };
  }

  async openCalendar(): Promise<AppointmentRunResult> {
    return {
      status: "completed",
      jobStatus: "appointment_calendar_opened",
      rawResultRedacted: { dry_run_only: true, calendar_opened: true },
    };
  }

  async readVisibleSlots(job: AppointmentAssistanceJob): Promise<SlotReadResult> {
    const scenario = typeof job.userPreferencesJson.slotScenario === "string"
      ? job.userPreferencesJson.slotScenario
      : "slots";
    if (scenario === "no_slots") {
      return {
        status: "no_slots_available",
        jobStatus: "appointment_no_slots_available",
        slots: [],
        message: "Dry-run no-slots scenario. No repeated polling was started.",
        rawResultRedacted: { dry_run_only: true, scenario },
      };
    }
    return {
      status: "slots_observed",
      jobStatus: "appointment_slots_observed",
      slots: DRY_RUN_SLOTS,
      rawResultRedacted: { dry_run_only: true, observed_slot_count: DRY_RUN_SLOTS.length },
    };
  }

  async selectSlot(_job: AppointmentAssistanceJob, _slotId: string): Promise<AppointmentRunResult> {
    return {
      status: "final_confirmation_required",
      jobStatus: "appointment_final_confirmation_required",
      manualActionType: "final_confirmation",
      instruction: "Review the selected dry-run slot and approve before booking.",
      rawResultRedacted: { dry_run_only: true },
    };
  }

  async finalConfirm(): Promise<AppointmentRunResult> {
    return {
      status: "completed",
      jobStatus: "appointment_booked",
      rawResultRedacted: { dry_run_only: true, final_confirmation_approved: true },
    };
  }

  async captureConfirmation(job: AppointmentAssistanceJob): Promise<AppointmentConfirmation> {
    return {
      id: "dry-run-provider-confirmation",
      jobId: job.id,
      applicationId: job.applicationId,
      userId: job.userId,
      countryCode: "US",
      visaType: "B1/B2",
      appointmentDate: "2026-09-10",
      appointmentTime: "09:30",
      appointmentLocation: "U.S. Embassy Singapore",
      appointmentType: "interview",
      confirmationNumber: `DRYRUN-US-B1B2-${job.applicationId.slice(0, 8).toUpperCase()}`,
      confirmationPdfUrl: null,
      confirmationScreenshotUrl: null,
      rawConfirmationRedactedJson: {
        dry_run_only: true,
        status: "appointment_booked",
        mode: "dry_run",
      },
      createdAt: new Date().toISOString(),
    };
  }

  async checkAppointmentStatus(job: AppointmentAssistanceJob): Promise<AppointmentStatusResult> {
    return {
      status: "status_checked",
      jobStatus: "appointment_status_checked",
      statusCheck: "appointment_exists",
      resultRedactedJson: {
        dry_run_only: true,
        appointment_exists: true,
        confirmation_present: true,
      },
    };
  }
}
