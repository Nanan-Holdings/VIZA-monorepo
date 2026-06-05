import { DryRunUSAppointmentProvider } from "./DryRunUSAppointmentProvider.js";
import type {
  AppointmentAssistanceJob,
  AppointmentRunResult,
  PortalDetectionResult,
  USAppointmentApplication,
} from "./types.js";

export class ManualUSAppointmentProvider extends DryRunUSAppointmentProvider {
  override providerName = "manual_us_appointment";
  override supportsDryRun = true;
  override supportsAssistedLive = false;
  override supportsAccountCreation = false;
  override supportsStatusCheck = true;

  override async detectPortal(application: USAppointmentApplication): Promise<PortalDetectionResult> {
    return {
      providerName: this.providerName,
      schedulingProvider: "manual_provider",
      portal: "manual_provider",
      applyingCountryCode: application.countryCode,
      applyingPostCity: null,
      confidence: "needs_research",
      riskNotes: [
        "Provider could not be determined safely. User/admin must choose the official scheduling portal manually.",
      ],
    };
  }

  override async runAccountCreation(_job: AppointmentAssistanceJob): Promise<AppointmentRunResult> {
    return {
      status: "manual_required",
      jobStatus: "appointment_manual_required",
      manualActionType: "site_policy_review",
      instruction: "Manual provider selected. Review the post-specific official appointment instructions before continuing.",
      rawResultRedacted: { manual_required: true },
    };
  }
}
