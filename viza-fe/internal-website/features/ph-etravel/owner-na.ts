import type {
  PhEtravelPresentationTransport,
  PhEtravelSeaFlow,
} from "./presentation";

export const PH_ETRAVEL_OWNER_FIELD_KEYS = [
  "owner_business_name",
  "owner_first_name",
  "owner_middle_name",
  "owner_last_name",
  "owner_suffix_name",
  "owner_occupation",
  "owner_country_code",
  "owner_region_code",
  "owner_province_code",
  "owner_municipality_code",
  "owner_barangay_code",
  "owner_street",
  "owner_postal_code",
] as const;

export const PH_ETRAVEL_RECIPIENT_FIELD_KEYS = [
  "recipient_business_name",
  "recipient_first_name",
  "recipient_middle_name",
  "recipient_last_name",
  "recipient_suffix_name",
  "recipient_occupation",
  "recipient_country_code",
  "recipient_region_code",
  "recipient_province_code",
  "recipient_municipality_code",
  "recipient_barangay_code",
  "recipient_street",
  "recipient_postal_code",
] as const;

export const PH_ETRAVEL_OWNER_NA_CLEARED_FIELD_KEYS = [
  ...PH_ETRAVEL_OWNER_FIELD_KEYS,
  ...PH_ETRAVEL_RECIPIENT_FIELD_KEYS,
] as const;

export type PhEtravelOwnerNaContext = {
  transportType: PhEtravelPresentationTransport;
  seaFlow?: PhEtravelSeaFlow;
  customsDeclaration?: "yes" | "no" | null;
  currencyDeclaration?: "yes" | "no" | null;
  currencyTransportMethod?: "physical" | "courier" | null;
};

export type PhEtravelOwnerNaPresentation = {
  visible: boolean;
  officialStateKey: "owner_details_not_applicable";
  requiredness: "unknown";
  controlsDisabled: boolean;
  clearedFieldKeys: readonly string[];
  reason: string;
};

function isElectronicCurrencyContext(
  context: PhEtravelOwnerNaContext
): boolean {
  return (
    context.customsDeclaration === "yes" &&
    context.currencyDeclaration === "yes" &&
    (context.transportType === "AIR" ||
      context.seaFlow === "electronic_customs")
  );
}

export function createPhEtravelOwnerNaPresentation(
  context: PhEtravelOwnerNaContext,
  ownerNotApplicable: boolean | null | undefined
): PhEtravelOwnerNaPresentation {
  if (!isElectronicCurrencyContext(context)) {
    return {
      visible: false,
      officialStateKey: "owner_details_not_applicable",
      requiredness: "unknown",
      controlsDisabled: false,
      clearedFieldKeys: [],
      reason:
        "Owner N/A belongs only to the conditional electronic Currency Declaration page; do not show it on manual, Customs No, or non-currency paths.",
    };
  }

  if (ownerNotApplicable === true) {
    return {
      visible: true,
      officialStateKey: "owner_details_not_applicable",
      requiredness: "unknown",
      controlsDisabled: true,
      clearedFieldKeys: PH_ETRAVEL_OWNER_NA_CLEARED_FIELD_KEYS,
      reason:
        "Official public state wiring clears and disables direct owner and recipient fields. It does not prove live requiredness when unchecked.",
    };
  }

  return {
    visible: true,
    officialStateKey: "owner_details_not_applicable",
    requiredness: "unknown",
    controlsDisabled: false,
    clearedFieldKeys: [],
    reason:
      "When Owner N/A is false, owner and recipient requiredness remains unknown; do not infer required fields from public state wiring.",
  };
}

export function applyPhEtravelOwnerNaNormalization(input: {
  context: PhEtravelOwnerNaContext;
  ownerNotApplicable: boolean | null | undefined;
  values: Readonly<Record<string, unknown>>;
}): {
  presentation: PhEtravelOwnerNaPresentation;
  values: Record<string, unknown>;
} {
  const presentation = createPhEtravelOwnerNaPresentation(
    input.context,
    input.ownerNotApplicable
  );
  if (!presentation.controlsDisabled) {
    return { presentation, values: { ...input.values } };
  }

  const values = { ...input.values };
  for (const key of presentation.clearedFieldKeys) {
    delete values[key];
  }
  return { presentation, values };
}
