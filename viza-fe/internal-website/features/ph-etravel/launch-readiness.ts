import {
  PH_ETRAVEL_CANONICAL_COVERAGE,
  type PhEtravelCoverageEvidenceTier,
} from "./coverage-parity";

export type PhEtravelLaunchScenarioId =
  "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";

export type PhEtravelLaunchState = "eligible" | "review" | "diverted";
export type PhEtravelLaunchPriority = "P0" | "P1";

export type PhEtravelLaunchScenario = {
  id: PhEtravelLaunchScenarioId;
  priority: PhEtravelLaunchPriority;
  evidenceTiers: PhEtravelCoverageEvidenceTier[];
  canonicalKeys: string[];
  currentState: PhEtravelLaunchState;
  authorization: "stop_before_submit";
  noResubmit: boolean;
  userCopy: {
    en: string;
    zh: string;
    actionEn: string;
    actionZh: string;
  };
};

export type PhEtravelLaunchReadiness = PhEtravelLaunchScenario & {
  state: PhEtravelLaunchState;
};

export type PhEtravelLaunchScenarioAuditIssue =
  | "duplicate_scenario"
  | "duplicate_gap_assignment"
  | "missing_needs_review_gap"
  | "scenario_key_not_needs_review"
  | "unsafe_authorization"
  | "result_or_runtime_as_input";

const reviewCopy = {
  en: "This part of the Philippines eTravel process needs review before you can continue.",
  zh: "菲律宾 eTravel 的这一部分需要复核后才能继续。",
  actionEn: "Review required",
  actionZh: "需要复核",
};

const scenarios: PhEtravelLaunchScenario[] = [
  {
    id: "S0",
    priority: "P1",
    evidenceTiers: ["needs_review"],
    canonicalKeys: ["account.email", "account.otp", "account.password"],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S1",
    priority: "P0",
    evidenceTiers: ["needs_review"],
    canonicalKeys: [
      "registration.application_for",
      "traveller.passenger_type",
      "profile.photo_url",
      "traveller.mobile_number",
      "residence.country_code",
      "residence.region_code",
      "residence.province_code",
      "residence.municipality_code",
      "residence.barangay_code",
      "residence.address_line1",
      "residence.address_line2",
    ],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S2",
    priority: "P0",
    evidenceTiers: ["needs_review"],
    canonicalKeys: [
      "air.airline_code",
      "air.flight_number",
      "air.is_special_flight",
      "air.special_flight_number",
      "destination.same_as_residence",
      "destination.transit_port_code",
      "destination.transit_destination_country_code",
    ],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S3",
    priority: "P0",
    evidenceTiers: ["needs_review"],
    canonicalKeys: [
      "health.with_negative_antigen",
      "health.has_recent_travel_history_30d",
      "health.visited_countries_30d",
      "health.exposed_to_bats_or_sick_animals",
      "health.sickness_symptoms",
    ],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S4",
    priority: "P0",
    evidenceTiers: ["confirmed_live", "needs_review"],
    canonicalKeys: ["sea.is_disembarking"],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S5",
    priority: "P0",
    evidenceTiers: ["confirmed_live", "verified_public_bundle", "needs_review"],
    canonicalKeys: [],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S6",
    priority: "P0",
    evidenceTiers: ["confirmed_live", "verified_public_bundle", "needs_review"],
    canonicalKeys: [
      "currency.needs_currency_declaration",
      "currency.owner_not_applicable",
      "currency.bsp_authorization_date",
      "attachments.travel_document",
    ],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S7",
    priority: "P1",
    evidenceTiers: ["needs_review"],
    canonicalKeys: [
      "customs.information_acknowledgement",
      "declaration.customs_signature_declaration",
      "declaration.certify_true_correct",
    ],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
  {
    id: "S8",
    priority: "P0",
    evidenceTiers: ["needs_review"],
    canonicalKeys: ["result.official_reference", "result.reference_qr_render"],
    currentState: "review",
    authorization: "stop_before_submit",
    noResubmit: true,
    userCopy: reviewCopy,
  },
];

export const PH_ETRAVEL_LAUNCH_SCENARIOS = scenarios;

export function getPhEtravelLaunchReadiness(input: {
  scenarioId: PhEtravelLaunchScenarioId;
  isUnsupportedIdentity?: boolean;
}): PhEtravelLaunchReadiness {
  const scenario = PH_ETRAVEL_LAUNCH_SCENARIOS.find(
    (candidate) => candidate.id === input.scenarioId
  );
  if (!scenario) throw new Error("Unknown Philippines eTravel launch scenario");
  return {
    ...scenario,
    state: input.isUnsupportedIdentity ? "diverted" : scenario.currentState,
  };
}

export function getPhEtravelLaunchGapCount(): number {
  return PH_ETRAVEL_LAUNCH_SCENARIOS.reduce(
    (count, scenario) => count + scenario.canonicalKeys.length,
    0
  );
}

export function auditPhEtravelLaunchScenarios(
  input: readonly PhEtravelLaunchScenario[] = PH_ETRAVEL_LAUNCH_SCENARIOS
): PhEtravelLaunchScenarioAuditIssue[] {
  const issues: PhEtravelLaunchScenarioAuditIssue[] = [];
  const scenarioIds = new Set<string>();
  const assignedKeys = new Set<string>();
  const canonicalByKey = new Map(
    PH_ETRAVEL_CANONICAL_COVERAGE.map((record) => [record.semanticKey, record])
  );

  for (const scenario of input) {
    if (scenarioIds.has(scenario.id)) issues.push("duplicate_scenario");
    scenarioIds.add(scenario.id);
    if (
      scenario.authorization !== "stop_before_submit" ||
      !scenario.noResubmit
    ) {
      issues.push("unsafe_authorization");
    }
    for (const semanticKey of scenario.canonicalKeys) {
      if (assignedKeys.has(semanticKey))
        issues.push("duplicate_gap_assignment");
      assignedKeys.add(semanticKey);
      const record = canonicalByKey.get(semanticKey);
      if (!record || record.evidenceTier !== "needs_review") {
        issues.push("scenario_key_not_needs_review");
      }
      if (
        record?.category === "runtime" ||
        record?.category === "result_only"
      ) {
        if (scenario.currentState !== "review")
          issues.push("result_or_runtime_as_input");
      }
    }
  }

  for (const record of PH_ETRAVEL_CANONICAL_COVERAGE) {
    if (
      record.evidenceTier === "needs_review" &&
      !assignedKeys.has(record.semanticKey)
    ) {
      issues.push("missing_needs_review_gap");
    }
  }
  return [...new Set(issues)];
}
