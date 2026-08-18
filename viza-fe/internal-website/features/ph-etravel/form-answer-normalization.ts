import {
  applyPhEtravelOwnerNaNormalization,
  type PhEtravelOwnerNaContext,
} from "./owner-na";
import { getPhEtravelArrivalPurposeCode } from "./official-options";

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
  {
    when: "has_recent_travel_history_30d",
    clear: [
      "visited_country_30d",
      "visited_countries_30d",
      "visited_countries",
    ],
  },
  {
    when: "has_been_sick_30d",
    clear: ["sickness_symptom", "sickness_symptoms", "symptoms"],
  },
];

const ELECTRONIC_CUSTOMS_FIELD_NAMES = [
  "customs_information_acknowledgement",
  "has_baggage_or_currency_to_declare",
  "with_something_to_declare_arrival",
  "customs_declaration",
  "goods_amount_currency",
  "goods_amount",
  "general_declaration_checklist",
  "baggage_items",
  "currency_declaration",
  "currency_items",
  "owner_details_not_applicable",
  "currency_sources",
  "currency_source_other",
  "transport_purposes",
  "transport_purpose_other",
  "currency_transport_method",
  "no_of_days_in_philippines",
  "last_travel_to_philippines",
  "courier_name",
  "airway_bill_no",
  "airway_bill_date",
] as const;

const POSITIVE_ELECTRONIC_CUSTOMS_FIELD_NAMES = [
  "goods_amount_currency",
  "goods_amount",
  "general_declaration_checklist",
  "baggage_items",
  "currency_declaration",
  "currency_items",
  "owner_details_not_applicable",
  "currency_sources",
  "currency_source_other",
  "transport_purposes",
  "transport_purpose_other",
  "currency_transport_method",
  "no_of_days_in_philippines",
  "last_travel_to_philippines",
  "courier_name",
  "airway_bill_no",
  "airway_bill_date",
] as const;

function isTrue(value: string | undefined): boolean {
  return ["true", "yes", "1"].includes(value?.trim().toLowerCase() ?? "");
}

function isFalseyAnswer(value: string | undefined): boolean {
  return ["false", "no", "0"].includes(value?.trim().toLowerCase() ?? "");
}

function clearValues(
  values: PhEtravelArrivalFormAnswers,
  keys: readonly string[]
): string[] {
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
  input: Readonly<PhEtravelArrivalFormAnswers>
): PhEtravelArrivalFormNormalization {
  const values = { ...input };
  const clearedFieldNames: string[] = [];
  const transportType = values.transport_type?.trim().toUpperCase();
  const purposeSource =
    values.purpose_of_visit_code || values.purpose_of_travel;
  const purposeCode = getPhEtravelArrivalPurposeCode(purposeSource);

  if (purposeSource) {
    if (purposeCode) {
      values.purpose_of_visit_code = purposeCode;
      values.purpose_of_travel = purposeCode;
    } else {
      clearedFieldNames.push(
        ...clearValues(values, ["purpose_of_visit_code", "purpose_of_travel"])
      );
    }
  }

  if (transportType === "SEA" && isFalseyAnswer(values.is_disembarking)) {
    clearedFieldNames.push(...clearValues(values, SEA_STAY_FIELD_NAMES));
  }
  if (transportType === "SEA" && values.sea_flow?.trim() === "manual_forms") {
    clearedFieldNames.push(
      ...clearValues(values, ELECTRONIC_CUSTOMS_FIELD_NAMES)
    );
  }
  if (
    transportType === "SEA" &&
    values.sea_flow?.trim() === "electronic_customs" &&
    isFalseyAnswer(values.customs_declaration)
  ) {
    clearedFieldNames.push(
      ...clearValues(values, POSITIVE_ELECTRONIC_CUSTOMS_FIELD_NAMES)
    );
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
      Object.entries(owner.values).map(([key, value]) => [
        key,
        typeof value === "string" ? value : "",
      ])
    ),
    clearedFieldNames: [...new Set(clearedFieldNames)],
  };
}
