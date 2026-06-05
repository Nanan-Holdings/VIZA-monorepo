import { AISUSVisaInfoProvider } from "./AISUSVisaInfoProvider.js";
import { DryRunUSAppointmentProvider } from "./DryRunUSAppointmentProvider.js";
import { EmbassySpecificNIVProvider } from "./EmbassySpecificNIVProvider.js";
import { ManualUSAppointmentProvider } from "./ManualUSAppointmentProvider.js";
import { USTravelDocsProvider } from "./USTravelDocsProvider.js";
import { USVisaSchedulingProvider } from "./USVisaSchedulingProvider.js";
import type { USAppointmentProvider } from "./USAppointmentProvider.js";

function normalizeProviderName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export class USAppointmentProviderRegistry {
  private readonly dryRunProvider = new DryRunUSAppointmentProvider();
  private readonly manualProvider = new ManualUSAppointmentProvider();
  private readonly providers: USAppointmentProvider[] = [
    this.dryRunProvider,
    this.manualProvider,
    new USVisaSchedulingProvider(),
    new USTravelDocsProvider(),
    new AISUSVisaInfoProvider(),
    new EmbassySpecificNIVProvider(),
  ];

  getProvider(providerName: string | null | undefined, mode = "dry_run"): USAppointmentProvider {
    if (mode === "dry_run") return this.dryRunProvider;
    const normalized = normalizeProviderName(providerName);
    return (
      this.providers.find((provider) => {
        const supportedNames = [
          provider.providerName,
          provider.providerName.replace(/^us_/, "us"),
        ].map(normalizeProviderName);
        return supportedNames.includes(normalized);
      }) ?? this.manualProvider
    );
  }

  detectProviderForPost(input: {
    schedulingProvider?: string | null;
    applyingCountryCode?: string | null;
  }): string {
    const explicit = normalizeProviderName(input.schedulingProvider);
    if (explicit) return explicit;

    const country = (input.applyingCountryCode ?? "").trim().toUpperCase();
    if (!country) return "manual_provider";
    if (["CA", "MX", "AR", "BR", "CL", "CO", "GB"].includes(country)) {
      return "ais_usvisa_info";
    }
    if (["BD", "CN", "HK", "IN", "ID", "JP", "MY", "NP", "PH", "SG", "KR", "LK", "TW", "TH", "VN"].includes(country)) {
      return "usvisascheduling";
    }
    return "ustraveldocs";
  }
}
