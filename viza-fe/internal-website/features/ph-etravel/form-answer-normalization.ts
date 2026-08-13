import {
  applyPhEtravelOwnerNaNormalization,
  type PhEtravelOwnerNaContext,
} from "./owner-na";

export type PhEtravelArrivalFormAnswers = Record<string, string>;

export type PhEtravelArrivalFormNormalization = {
  values: PhEtravelArrivalFormAnswers;
  clearedFieldNames: string[];
};

const SEA_STAY_FIELD_NAMES = [
  "stay_location_type",
  "destination_address",
  "address_in_philippines",
  "hotel_name_or_address",
  "disembarking_port_code",
] as const;

const HEALTH_CLEAR_RULES: Array<{ when: string; clear: readonly string[] }> = [
  { when: "has_recent_travel_history_30d", clear: ["visited_countries_30d", "visited_countries"] },
  { when: "has_been_sick_30d", clear: ["sickness_symptoms", "symptoms"] },
];

function isTrue(value: string | undefined): boolean {
  return ["true", "yes", "1"].includes(value?.trim().toLowerCase() ?? "");
}

function isFalseyAnswer(value: string | undefined): boolean {
  return ["false", "no", "0"].includes(value?.trim().toLowerCase() ?? "");
}

function clearValues(values: PhEtravelArrivalFormAnswers, keys: readonly string[]): string[] {
  const cleared: string[] = [];
  for (const key of keys) {
    if (!values[key]) continue;
    values[key] = "";
    cleared.push(key);
  }
  return cleared;
}

/** Applies observed PH-only conditional clearing; it never infers requiredness. */
export function normalizePhEtravelArrivalFormAnswers(
  input: Readonly<PhEtravelArrivalFormAnswers>,
): PhEtravelArrivalFormNormalization {
  const values = { ...input };
  const clearedFieldNames: string[] = [];
  const transportType = values.transport_type?.trim().toUpperCase();

  if (transportType === "SEA" && isFalseyAnswer(values.is_disembarking)) {
    clearedFieldNames.push(...clearValues(values, SEA_STAY_FIELD_NAMES));
  }
  for (const rule of HEALTH_CLEAR_RULES) {
    if (isFalseyAnswer(values[rule.when])) {
      clearedFieldNames.push(...clearValues(values, rule.clear));
    }
  }

  const ownerContext: PhEtravelOwnerNaContext = {
    transportType: transportType === "SEA" ? "SEA" : "AIR",
    seaFlow:
      values.sea_flow?.trim() === "electronic_customs"
        ? "electronic_customs"
        : values.sea_flow?.trim() === "manual_forms"
          ? "manual_forms"
          : undefined,
    customsDeclaration: isTrue(values.customs_declaration) ? "yes" : "no",
    currencyDeclaration: isTrue(values.currency_declaration) ? "yes" : "no",
    currencyTransportMethod:
      values.currency_transport_method?.trim() === "courier"
        ? "courier"
        : values.currency_transport_method?.trim() === "physical"
          ? "physical"
          : null,
  };
  const owner = applyPhEtravelOwnerNaNormalization({
    context: ownerContext,
    ownerNotApplicable: isTrue(values.owner_details_not_applicable),
    values,
  });
  for (const key of owner.presentation.clearedFieldKeys) {
    if (input[key]) clearedFieldNames.push(key);
  }

  return {
    values: Object.fromEntries(
      Object.entries(owner.values).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
    ),
    clearedFieldNames: [...new Set(clearedFieldNames)],
  };
}
