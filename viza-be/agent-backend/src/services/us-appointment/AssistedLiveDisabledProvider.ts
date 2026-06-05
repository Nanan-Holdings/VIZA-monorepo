import { ManualUSAppointmentProvider } from "./ManualUSAppointmentProvider.js";
import type {
  AppointmentAssistanceJob,
  AppointmentRunResult,
  PortalDetectionResult,
  USAppointmentApplication,
} from "./types.js";

export interface AssistedLiveDisabledProviderOptions {
  providerName: string;
  schedulingProvider: string;
  portal: string;
  supportedApplyingCountries?: string[];
  supportedPosts?: string[];
}

export class AssistedLiveDisabledProvider extends ManualUSAppointmentProvider {
  override readonly providerName: string;
  override readonly supportedApplyingCountries: string[];
  override readonly supportedPosts?: string[];
  override readonly supportsDryRun = false;
  override readonly supportsAssistedLive = false;
  override readonly supportsAccountCreation = false;
  override readonly supportsStatusCheck = false;

  private readonly schedulingProvider: string;
  private readonly portal: string;

  constructor(options: AssistedLiveDisabledProviderOptions) {
    super();
    this.providerName = options.providerName;
    this.schedulingProvider = options.schedulingProvider;
    this.portal = options.portal;
    this.supportedApplyingCountries = options.supportedApplyingCountries ?? [];
    this.supportedPosts = options.supportedPosts;
  }

  override async detectPortal(application: USAppointmentApplication): Promise<PortalDetectionResult> {
    return {
      providerName: this.providerName,
      schedulingProvider: this.schedulingProvider,
      portal: this.portal,
      applyingCountryCode: application.countryCode,
      applyingPostCity: null,
      confidence: "medium",
      riskNotes: [
        "Assisted-live automation is scaffolded but disabled by default.",
        "This provider must pause for login, CAPTCHA, email verification, payment, slot selection, and final confirmation if enabled later.",
      ],
    };
  }

  override async runAccountCreation(_job: AppointmentAssistanceJob): Promise<AppointmentRunResult> {
    if (process.env.US_APPOINTMENT_ASSISTED_LIVE_ENABLED !== "true") {
      return {
        status: "manual_required",
        jobStatus: "appointment_manual_required",
        manualActionType: "site_policy_review",
        instruction:
          "Assisted live mode is disabled. Use dry-run or complete the official appointment website manually.",
        rawResultRedacted: {
          assisted_live_enabled: false,
          provider: this.providerName,
        },
        errorCode: "assisted_live_disabled",
      };
    }

    return {
      status: "manual_required",
      jobStatus: "appointment_manual_required",
      manualActionType: "site_policy_review",
      instruction:
        "Assisted live mode requires a separate compliance-approved browser runner before this provider can continue.",
      rawResultRedacted: {
        assisted_live_enabled: true,
        runner_implemented: false,
        provider: this.providerName,
      },
      errorCode: "assisted_live_runner_not_implemented",
    };
  }
}
