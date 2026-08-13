import {
  getPhEtravelLaunchReadiness,
  type PhEtravelLaunchScenarioId,
} from "./launch-readiness";

/**
 * Versioned, PII-free envelope requested from PH-C before a shared UI consumes
 * its launch-preflight decision. An unversioned runner result is deliberately
 * not display-integrated as an allowed state.
 */
export const PH_ETRAVEL_PREFLIGHT_CONTRACT_VERSION =
  "ph_etravel_launch_preflight_v1" as const;

export type PhEtravelSafePreflightStatus =
  "allowed" | "action_required" | "diverted";

export type PhEtravelSafePreflightCode =
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

type PhEtravelPreflightDiagnosticIssue =
  | "invalid_payload"
  | "payload_pii_rejected"
  | "version_mismatch"
  | "unknown_status"
  | "unknown_safe_code"
  | "missing_safe_code"
  | "unexpected_code_for_status"
  | "duplicate_canonical_key"
  | "duplicate_safe_code"
  | "unstable_order"
  | "canonical_key_outside_scenario"
  | "canonical_keys_missing"
  | "resubmit_not_disabled";

type PhEtravelPreflightDiagnostic = {
  accepted: boolean;
  issues: PhEtravelPreflightDiagnosticIssue[];
  scenarioIds: PhEtravelLaunchScenarioId[];
  status: PhEtravelSafePreflightStatus | null;
};

export type PhEtravelPreflightUserPresentation = {
  state: "action_required" | "diverted";
  authorization: "stop_before_submit";
  submitted: false;
  noQueue: true;
  noBrowser: true;
  noResubmit: true;
  userCopy: {
    en: string;
    zh: string;
    actionEn: string;
    actionZh: string;
  };
};

type SafeCodeDefinition = {
  scenarioId: PhEtravelLaunchScenarioId;
  permittedCanonicalKeys: readonly string[];
};

const SAFE_CODE_DEFINITIONS: Record<
  PhEtravelSafePreflightCode,
  SafeCodeDefinition
> = {
  ph_etravel_arrival_diverted_unsupported: {
    scenarioId: "S1",
    permittedCanonicalKeys: ["eligibility.ordinary_arrival"],
  },
  ph_etravel_arrival_for_other_action_required: {
    scenarioId: "S1",
    permittedCanonicalKeys: ["registration.application_for"],
  },
  ph_etravel_launch_profile_persona_review_required: {
    scenarioId: "S1",
    permittedCanonicalKeys: [
      "profile.photo_url",
      "traveller.first_name",
      "traveller.last_name",
      "traveller.middle_name",
      "traveller.mobile_number",
      "traveller.passenger_type",
      "traveller.sex",
      "traveller.suffix",
    ],
  },
  ph_etravel_launch_residence_review_required: {
    scenarioId: "S1",
    permittedCanonicalKeys: [
      "residence.address_line1",
      "residence.address_line2",
      "residence.barangay_code",
      "residence.country_code",
      "residence.municipality_code",
      "residence.province_code",
      "residence.region_code",
    ],
  },
  ph_etravel_launch_air_travel_review_required: {
    scenarioId: "S2",
    permittedCanonicalKeys: ["air.airline_code", "air.flight_number"],
  },
  ph_etravel_launch_air_special_flight_review_required: {
    scenarioId: "S2",
    permittedCanonicalKeys: [
      "air.is_special_flight",
      "air.special_flight_number",
    ],
  },
  ph_etravel_launch_health_positive_review_required: {
    scenarioId: "S3",
    permittedCanonicalKeys: [
      "health.exposed_to_bats_or_sick_animals",
      "health.has_recent_travel_history_30d",
      "health.sickness_symptoms",
      "health.visited_countries_30d",
      "health.with_negative_antigen",
    ],
  },
  ph_etravel_launch_sea_disembarking_review_required: {
    scenarioId: "S4",
    permittedCanonicalKeys: ["sea.is_disembarking"],
  },
  ph_etravel_launch_sea_customs_flow_review_required: {
    scenarioId: "S4",
    permittedCanonicalKeys: ["destination.destination_port_code"],
  },
  ph_etravel_launch_sea_electronic_positive_review_required: {
    scenarioId: "S5",
    permittedCanonicalKeys: [
      "attachments.travel_document",
      "currency.needs_currency_declaration",
    ],
  },
  ph_etravel_launch_currency_positive_review_required: {
    scenarioId: "S6",
    permittedCanonicalKeys: [
      "currency.bsp_authorization_date",
      "currency.needs_currency_declaration",
      "currency.owner_not_applicable",
    ],
  },
  ph_etravel_launch_attachment_review_required: {
    scenarioId: "S6",
    permittedCanonicalKeys: ["attachments.travel_document"],
  },
  ph_etravel_launch_final_result_recovery_required: {
    scenarioId: "S8",
    permittedCanonicalKeys: [
      "result.official_reference",
      "result.reference_qr_render",
    ],
  },
};

const PRECHECK_PROPERTIES = new Set([
  "contractVersion",
  "status",
  "code",
  "blockingCodes",
  "canonicalKeys",
  "officialResubmitAllowed",
]);

const PII_SHAPED_VALUE = /(?:\b[A-Z]\d{6,}\b|\b\d{6,}[A-Z]\b|@|passport)/i;

const reviewCopy = {
  en: "This Philippines eTravel step needs review before you can continue.",
  zh: "菲律宾 eTravel 的这一步需要复核后才能继续。",
  actionEn: "Review required",
  actionZh: "需要复核",
};

const divertedCopy = {
  en: "This traveller needs the official Philippines eTravel route for their travel type.",
  zh: "此旅客需要使用菲律宾 eTravel 针对其旅行类型的官方入口。",
  actionEn: "Use official route",
  actionZh: "使用官方入口",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeCode(value: unknown): value is PhEtravelSafePreflightCode {
  return typeof value === "string" && value in SAFE_CODE_DEFINITIONS;
}

function isSafeStatus(value: unknown): value is PhEtravelSafePreflightStatus {
  return (
    value === "allowed" || value === "action_required" || value === "diverted"
  );
}

function includesPiiLikeValue(value: unknown): boolean {
  if (typeof value === "string") return PII_SHAPED_VALUE.test(value);
  if (Array.isArray(value)) return value.some(includesPiiLikeValue);
  if (isRecord(value)) return Object.values(value).some(includesPiiLikeValue);
  return false;
}

function asUniqueStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    return null;
  return value;
}

function isStableLexicalOrder(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || values[index - 1] <= value
  );
}

function orderedScenarioIds(
  codes: readonly PhEtravelSafePreflightCode[]
): PhEtravelLaunchScenarioId[] {
  const ids = new Set(
    codes.map((code) => SAFE_CODE_DEFINITIONS[code].scenarioId)
  );
  const allScenarioIds: readonly PhEtravelLaunchScenarioId[] = [
    "S0",
    "S1",
    "S2",
    "S3",
    "S4",
    "S5",
    "S6",
    "S7",
    "S8",
  ];
  return allScenarioIds.filter((scenarioId) => ids.has(scenarioId));
}

/**
 * Testing/integration diagnostic only. It contains generic validation classes
 * and scenario ids, never raw server payload values, keys, or safe codes.
 */
export function auditPhEtravelSafePreflightOutcome(
  input: unknown
): PhEtravelPreflightDiagnostic {
  const issues: PhEtravelPreflightDiagnosticIssue[] = [];
  if (!isRecord(input)) {
    return {
      accepted: false,
      issues: ["invalid_payload"],
      scenarioIds: [],
      status: null,
    };
  }
  if (includesPiiLikeValue(input)) {
    return {
      accepted: false,
      issues: ["payload_pii_rejected"],
      scenarioIds: [],
      status: null,
    };
  }
  if (Object.keys(input).some((key) => !PRECHECK_PROPERTIES.has(key))) {
    return {
      accepted: false,
      issues: ["invalid_payload"],
      scenarioIds: [],
      status: null,
    };
  }
  if (input.contractVersion !== PH_ETRAVEL_PREFLIGHT_CONTRACT_VERSION)
    issues.push("version_mismatch");
  if (!isSafeStatus(input.status)) issues.push("unknown_status");

  const blockingCodes = asUniqueStringArray(input.blockingCodes);
  const canonicalKeys = asUniqueStringArray(input.canonicalKeys);
  if (!blockingCodes || !canonicalKeys) issues.push("invalid_payload");
  if (input.officialResubmitAllowed !== false)
    issues.push("resubmit_not_disabled");
  if (!isSafeStatus(input.status) || !blockingCodes || !canonicalKeys) {
    return {
      accepted: false,
      issues: [...new Set(issues)],
      scenarioIds: [],
      status: null,
    };
  }

  const unknownCode = blockingCodes.some((code) => !isSafeCode(code));
  if (unknownCode) issues.push("unknown_safe_code");
  if (new Set(blockingCodes).size !== blockingCodes.length)
    issues.push("duplicate_safe_code");
  if (new Set(canonicalKeys).size !== canonicalKeys.length)
    issues.push("duplicate_canonical_key");
  if (
    !isStableLexicalOrder(blockingCodes) ||
    !isStableLexicalOrder(canonicalKeys)
  ) {
    issues.push("unstable_order");
  }
  if (input.status === "allowed") {
    if (
      input.code !== undefined ||
      blockingCodes.length > 0 ||
      canonicalKeys.length > 0
    )
      issues.push("unexpected_code_for_status");
  } else {
    if (!isSafeCode(input.code)) issues.push("missing_safe_code");
    if (canonicalKeys.length === 0) issues.push("canonical_keys_missing");
    if (isSafeCode(input.code) && !blockingCodes.includes(input.code))
      issues.push("unexpected_code_for_status");
    if (
      input.status === "diverted" &&
      input.code !== "ph_etravel_arrival_diverted_unsupported"
    )
      issues.push("unexpected_code_for_status");
  }

  const safeCodes = blockingCodes.filter(isSafeCode);
  const permittedKeys = new Set(
    safeCodes.flatMap(
      (code) => SAFE_CODE_DEFINITIONS[code].permittedCanonicalKeys
    )
  );
  if (canonicalKeys.some((key) => !permittedKeys.has(key)))
    issues.push("canonical_key_outside_scenario");

  return {
    accepted: issues.length === 0,
    issues: [...new Set(issues)],
    scenarioIds: issues.length === 0 ? orderedScenarioIds(safeCodes) : [],
    status: issues.length === 0 ? input.status : null,
  };
}

/**
 * The user-facing layer never exposes a runner code, canonical key, selector,
 * or applicant value. All outcomes remain stop-before-submit in this release.
 */
export function createPhEtravelPreflightUserPresentation(
  input: unknown
): PhEtravelPreflightUserPresentation {
  const audit = auditPhEtravelSafePreflightOutcome(input);
  const diverted = audit.accepted && audit.status === "diverted";

  return {
    state: diverted ? "diverted" : "action_required",
    authorization: "stop_before_submit",
    submitted: false,
    noQueue: true,
    noBrowser: true,
    noResubmit: true,
    userCopy: diverted ? divertedCopy : reviewCopy,
  };
}

/**
 * Shared integration may use this only for safe scenario-level routing. It
 * never returns raw preflight data and "allowed" still proves no submission.
 */
export function getPhEtravelPreflightReadiness(input: unknown) {
  const audit = auditPhEtravelSafePreflightOutcome(input);
  return audit.scenarioIds.map((scenarioId) =>
    getPhEtravelLaunchReadiness({
      scenarioId,
      isUnsupportedIdentity: audit.status === "diverted",
    })
  );
}
