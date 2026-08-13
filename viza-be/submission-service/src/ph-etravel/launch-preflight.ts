import type { SubmissionPayload } from "../country-submissions/types";
import {
  PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS,
  PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS,
} from "./profile-owned-preflight";
import { buildPhEtravelAirDestinationActionPlan } from "./air-destination-preflight";
import {
  buildPhEtravelHealthActionPlan,
  phEtravelHealthPositiveBranchPresent,
} from "./health-preflight";
import {
  buildPhEtravelSeaFlowActionPlan,
  PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS,
} from "./sea-flow-preflight";

export type PhEtravelLaunchPreflightCode =
  | "ph_etravel_arrival_diverted_unsupported"
  | "ph_etravel_arrival_for_other_action_required"
  | "ph_etravel_launch_profile_persona_review_required"
  | "ph_etravel_launch_residence_review_required"
  | "ph_etravel_launch_air_travel_review_required"
  | "ph_etravel_launch_air_special_flight_review_required"
  | "ph_etravel_launch_health_positive_review_required"
  | "ph_etravel_launch_sea_disembarking_review_required"
  | "ph_etravel_launch_sea_customs_flow_review_required"
  | "ph_etravel_launch_sea_electronic_positive_review_required"
  | "ph_etravel_launch_currency_positive_review_required"
  | "ph_etravel_launch_attachment_review_required"
  | "ph_etravel_launch_final_result_recovery_required";

export interface PhEtravelLaunchPreflightBlocker {
  code: PhEtravelLaunchPreflightCode;
  canonicalKeys: string[];
}

export type PhEtravelArrivalLaunchPreflight =
  | {
      status: "allowed";
      blockingCodes: [];
      missingKeys: [];
      officialResubmitAllowed: false;
    }
  | {
      status: "action_required" | "diverted";
      code: PhEtravelLaunchPreflightCode;
      blockingCodes: PhEtravelLaunchPreflightCode[];
      missingKeys: string[];
      officialResubmitAllowed: false;
    };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown): string {
  return text(value).replace(/[\s-]+/g, "_").toUpperCase();
}

function isTrue(value: unknown): boolean {
  return ["YES", "Y", "TRUE", "1", "ON", "CHECKED"].includes(normalized(value));
}

function hasAnyTrue(answers: Record<string, string>, keys: string[]): boolean {
  return keys.some((key) => isTrue(answers[key]));
}

function hasUnsupportedOrdinaryArrivalPersona(answers: Record<string, string>): boolean {
  const combined = [
    answers.traveller_type,
    answers.passenger_type,
    answers.registration_type,
    answers.travel_registration_type,
    answers.registration_route,
    answers.declaration_route,
    answers.eligibility_category,
    answers.eligibility_status,
    answers.eligibility_traveller_type,
    answers.eligibility_passport_type,
    answers.eligibility_visa_type,
    answers.arrival_registration_type,
    answers.arrival_eligibility,
    answers.passport_type,
    answers.travel_document_type,
    answers.visa_type,
    answers.visa_category,
    answers.official_status,
    answers.exemption_status,
    answers.special_identity,
  ].join(" ");
  return /(?:flight|aircraft|vessel|cruise)[\s_-]*crew|cruise[\s_-]*(?:passenger|travel)|special[\s_-]*(?:travel[\s_-]*)?(?:registration|declaration)|\b9[\s_-]*\(?e\)?\b|diplomat|diplomatic|dependent|dignitar|delegation|official[\s_-]*passport|service[\s_-]*passport/i.test(combined) ||
    hasAnyTrue(answers, [
      "is_crew",
      "is_crew_member",
      "crew",
      "is_cruise_passenger",
      "cruise_passenger",
      "is_cruise_travel",
      "cruise_travel",
      "is_cruise_registration",
      "is_special_registration",
      "is_special_travel_declaration",
      "special_registration",
      "special_travel_declaration",
      "is_foreign_diplomat",
      "foreign_diplomat",
      "is_foreign_diplomat_or_dependent",
      "foreign_diplomat_dependent",
      "is_foreign_diplomat_dependent",
      "foreign_diplomat_or_dependent",
      "is_foreign_dignitary",
      "foreign_dignitary",
      "is_foreign_dignitary_or_delegation",
      "foreign_dignitary_delegation",
      "is_foreign_dignitary_delegation",
      "foreign_delegation",
      "is_9e_visa_holder",
      "visa_9e",
      "has_9e_visa",
      "diplomatic_passport_holder",
      "has_diplomatic_passport",
      "is_official_passport_holder",
      "official_passport_holder",
      "service_passport_holder",
      "has_official_or_service_passport",
    ]);
}

function hasPositiveChecklist(answers: Record<string, string>, itemNumbers: number[]): boolean {
  return itemNumbers.some((itemNumber) => isTrue(answers[`customs_checklist_${itemNumber}`]));
}

function addBlocker(
  blockers: PhEtravelLaunchPreflightBlocker[],
  code: PhEtravelLaunchPreflightCode,
  canonicalKeys: string[],
): void {
  const existing = blockers.find((blocker) => blocker.code === code);
  if (existing) {
    existing.canonicalKeys = Array.from(new Set([...existing.canonicalKeys, ...canonicalKeys])).sort();
    return;
  }
  blockers.push({ code, canonicalKeys: Array.from(new Set(canonicalKeys)).sort() });
}

/**
 * E17 is a launch gate, not a source of defaults. It consumes only VIZA keys
 * and returns canonical keys/codes; no answer values, portal text, or runtime
 * credentials can enter its result.
 */
export function evaluatePhEtravelArrivalLaunchPreflight(input: {
  payload: SubmissionPayload;
  finalSubmitEnabled: boolean;
  existingResultRequiresRecovery?: boolean;
}): PhEtravelArrivalLaunchPreflight {
  if (input.payload.countryCode !== "PH" || input.payload.visaType !== "PH_ETRAVEL_ARRIVAL_CARD") {
    return { status: "allowed", blockingCodes: [], missingKeys: [], officialResubmitAllowed: false };
  }

  const answers = input.payload.countrySpecific;
  const blockers: PhEtravelLaunchPreflightBlocker[] = [];
  if (hasUnsupportedOrdinaryArrivalPersona(answers)) {
    addBlocker(blockers, "ph_etravel_arrival_diverted_unsupported", ["eligibility.ordinary_arrival"]);
  }
  if (normalized(answers.registration_for) === "FOR_OTHER") {
    addBlocker(blockers, "ph_etravel_arrival_for_other_action_required", ["registration.application_for"]);
  }

  // E17 classifies these ordinary-arrival controls as P0 until controlled
  // profile/residence observations close their requiredness and branch rules.
  // E19 closes five personal-field rows; E21 is client-only evidence for the
  // remaining profile-owned photo/mobile/residence controls, so they stay P0.
  addBlocker(blockers, "ph_etravel_launch_profile_persona_review_required", [
    ...PH_ETRAVEL_PROFILE_OWNED_NEEDS_REVIEW_KEYS,
  ]);
  addBlocker(blockers, "ph_etravel_launch_residence_review_required", [
    ...PH_ETRAVEL_RESIDENCE_NEEDS_REVIEW_KEYS,
  ]);

  const transport = normalized(answers.transport_type);
  if (transport === "AIR") {
    const airDestinationPlan = buildPhEtravelAirDestinationActionPlan(answers);
    addBlocker(blockers, "ph_etravel_launch_air_travel_review_required", airDestinationPlan.canonicalKeys);
    if (airDestinationPlan.specialFlight.selected) {
      addBlocker(blockers, "ph_etravel_launch_air_special_flight_review_required", [
        "air.is_special_flight",
        "air.special_flight_number",
      ]);
    }
  }

  if (phEtravelHealthPositiveBranchPresent(answers)) {
    const healthPlan = buildPhEtravelHealthActionPlan(answers);
    addBlocker(blockers, "ph_etravel_launch_health_positive_review_required", healthPlan.canonicalKeys);
  }

  const positiveCurrency = hasAnyTrue(answers, ["has_currency_to_declare", "has_currency_over_threshold"]) ||
    hasPositiveChecklist(answers, [1, 2]);
  const positiveGoods = hasAnyTrue(answers, ["has_baggage_or_currency_to_declare", "has_dutiable_goods", "has_goods_to_declare"]) ||
    hasPositiveChecklist(answers, Array.from({ length: 10 }, (_, index) => index + 3));
  if (positiveCurrency) {
    addBlocker(blockers, "ph_etravel_launch_currency_positive_review_required", [
      "currency.bsp_authorization_date",
      "currency.needs_currency_declaration",
      "currency.owner_not_applicable",
    ]);
  }
  if (positiveCurrency || positiveGoods || Boolean(text(answers.customs_signature_file))) {
    addBlocker(blockers, "ph_etravel_launch_attachment_review_required", ["attachments.travel_document"]);
  }

  if (transport === "SEA") {
    const seaFlowPlan = buildPhEtravelSeaFlowActionPlan({ transportType: transport, answers });
    if (seaFlowPlan.status === "action_required" && seaFlowPlan.disembarking.state !== "true") {
      addBlocker(blockers, "ph_etravel_launch_sea_disembarking_review_required", ["sea.is_disembarking"]);
    }
    addBlocker(blockers, "ph_etravel_launch_sea_customs_flow_review_required", [
      ...PH_ETRAVEL_SEA_FLOW_NEEDS_REVIEW_KEYS,
    ]);
    if (positiveCurrency || positiveGoods) {
      addBlocker(blockers, "ph_etravel_launch_sea_electronic_positive_review_required", [
        "attachments.travel_document",
        "currency.needs_currency_declaration",
      ]);
    }
  }

  if (input.finalSubmitEnabled || input.existingResultRequiresRecovery) {
    addBlocker(blockers, "ph_etravel_launch_final_result_recovery_required", [
      "result.official_reference",
      "result.reference_qr_render",
    ]);
  }

  if (blockers.length === 0) {
    return { status: "allowed", blockingCodes: [], missingKeys: [], officialResubmitAllowed: false };
  }
  const diverted = blockers.some((blocker) => blocker.code === "ph_etravel_arrival_diverted_unsupported");
  const ordered = blockers.sort((left, right) => left.code.localeCompare(right.code));
  return {
    status: diverted ? "diverted" : "action_required",
    code: diverted ? "ph_etravel_arrival_diverted_unsupported" : ordered[0].code,
    blockingCodes: ordered.map((blocker) => blocker.code),
    missingKeys: Array.from(new Set(ordered.flatMap((blocker) => blocker.canonicalKeys))).sort(),
    officialResubmitAllowed: false,
  };
}
