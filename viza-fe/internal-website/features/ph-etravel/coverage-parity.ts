export type PhEtravelCoverageCategory =
  | "applicant_input"
  | "profile_owned"
  | "runtime"
  | "action_only"
  | "official_only"
  | "result_only"
  | "unsupported_diverted";

export type PhEtravelCoverageEvidenceTier =
  "confirmed_live" | "verified_public_bundle" | "needs_review";

export type PhEtravelCoveragePath =
  "ordinary_air" | "sea_manual" | "sea_electronic_no" | "sea_electronic_yes";

export type PhEtravelCoverageUiDisposition =
  | "input_when_shared_ready"
  | "profile_or_eligibility_gate"
  | "review_gate"
  | "not_an_applicant_input";

export type PhEtravelCoverageRecord = {
  semanticKey: string;
  category: PhEtravelCoverageCategory;
  evidenceTier: PhEtravelCoverageEvidenceTier;
  paths: PhEtravelCoveragePath[];
  uiDisposition: PhEtravelCoverageUiDisposition;
  owners: string[];
  clientContractEvidence?: "verified_public_bundle";
  legacyAliases?: string[];
};

export type PhEtravelCoverageAuditIssue =
  | "duplicate_semantic_key"
  | "missing_coverage_owner"
  | "runtime_leaks_to_ui"
  | "result_leaks_to_ui"
  | "wrong_path_scope"
  | "needs_review_enabled_input";

const ALL_PATHS: PhEtravelCoveragePath[] = [
  "ordinary_air",
  "sea_manual",
  "sea_electronic_no",
  "sea_electronic_yes",
];

const NEEDS_REVIEW_KEYS = new Set([
  "account.email",
  "account.otp",
  "account.password",
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
  "air.airline_code",
  "air.flight_number",
  "air.is_special_flight",
  "air.special_flight_number",
  "sea.is_disembarking",
  "destination.same_as_residence",
  "destination.transit_port_code",
  "destination.transit_destination_country_code",
  "health.with_negative_antigen",
  "health.has_recent_travel_history_30d",
  "health.visited_countries_30d",
  "health.exposed_to_bats_or_sick_animals",
  "health.sickness_symptoms",
  "customs.information_acknowledgement",
  "currency.needs_currency_declaration",
  "currency.owner_not_applicable",
  "currency.bsp_authorization_date",
  "attachments.travel_document",
  "declaration.customs_signature_declaration",
  "declaration.certify_true_correct",
  "result.official_reference",
  "result.reference_qr_render",
]);

const PUBLIC_BUNDLE_KEYS = new Set([
  "registration.flight_type",
  "registration.transport_type",
  "traveller.passport_holder_type",
  "traveller.passport_number",
  "traveller.birth_date",
  "traveller.nationality_country_code",
  "traveller.country_of_birth_code",
  "traveller.passport_issuing_country_code",
  "traveller.passport_issue_date",
  "traveller.occupation_code",
  "travel.purpose_code",
  "travel.arrival_date",
  "travel.origin_country_code",
  "travel.origin_port",
  "travel.origin_departure_date",
  "travel.with_transit",
  "travel.return_date",
  "health.notice_no_covid_requirement",
  "summary.final_submit",
]);
const E22_CLIENT_BUNDLE_KEYS = new Set([
  "air.airline_code",
  "air.flight_number",
  "air.is_special_flight",
  "air.special_flight_number",
  "destination.stay_location_type",
  "destination.same_as_residence",
  "destination.address_text",
  "destination.hotel_name_or_address",
  "destination.transit_port_code",
  "destination.transit_destination_country_code",
]);
const E23_CLIENT_BUNDLE_KEYS = new Set([
  "health.with_negative_antigen",
  "health.has_recent_travel_history_30d",
  "health.visited_countries_30d",
  "health.has_exposure_to_sick_person_30d",
  "health.has_been_sick_30d",
  "health.sickness_symptoms",
]);
const E24_CLIENT_BUNDLE_KEYS = new Set([
  "sea.is_disembarking",
  "destination.stay_location_type",
  "destination.disembarking_port_code",
  "sea.destination_port_code",
]);

const RUNTIME_KEYS = new Set([
  "account.email",
  "account.otp",
  "account.password",
]);
const PROFILE_OWNED_KEYS = new Set([
  "traveller.passport_holder_type",
  "traveller.passenger_type",
  "profile.photo_url",
  "traveller.passport_number",
  "traveller.first_name",
  "traveller.middle_name",
  "traveller.last_name",
  "traveller.suffix",
  "traveller.sex",
  "traveller.birth_date",
  "traveller.nationality_country_code",
  "traveller.mobile_number",
  "traveller.country_of_birth_code",
  "traveller.passport_issuing_country_code",
  "traveller.passport_issue_date",
  "traveller.occupation_code",
  "residence.country_code",
  "residence.region_code",
  "residence.province_code",
  "residence.municipality_code",
  "residence.barangay_code",
  "residence.address_line1",
  "residence.address_line2",
  "family.relationship",
]);
const ACTION_ONLY_KEYS = new Set([
  "health.notice_no_covid_requirement",
  "family.selected_members",
  "signature.applicant_signature",
  "summary.review",
  "summary.final_submit",
]);
const OFFICIAL_ONLY_KEYS = new Set([
  "registration.application_for",
  "customs.information_acknowledgement",
  "attachments.travel_document",
  "declaration.customs_signature_declaration",
  "declaration.certify_true_correct",
]);
const RESULT_ONLY_KEYS = new Set([
  "result.official_reference",
  "result.reference_qr_render",
]);

const CANONICAL_KEYS = [
  "account.email",
  "account.otp",
  "account.password",
  "registration.application_for",
  "registration.flight_type",
  "registration.transport_type",
  "traveller.passport_holder_type",
  "traveller.passenger_type",
  "profile.photo_url",
  "traveller.passport_number",
  "traveller.first_name",
  "traveller.middle_name",
  "traveller.last_name",
  "traveller.suffix",
  "traveller.sex",
  "traveller.birth_date",
  "traveller.nationality_country_code",
  "traveller.mobile_number",
  "traveller.country_of_birth_code",
  "traveller.passport_issuing_country_code",
  "traveller.passport_issue_date",
  "traveller.occupation_code",
  "residence.country_code",
  "residence.region_code",
  "residence.province_code",
  "residence.municipality_code",
  "residence.barangay_code",
  "residence.address_line1",
  "residence.address_line2",
  "travel.purpose_code",
  "travel.arrival_date",
  "travel.origin_country_code",
  "travel.origin_port",
  "travel.origin_departure_date",
  "travel.with_transit",
  "travel.transit_country_code",
  "travel.transit_port",
  "travel.transit_date",
  "travel.return_date",
  "air.airline_code",
  "air.flight_number",
  "air.is_special_flight",
  "air.special_flight_number",
  "sea.vessel_name",
  "sea.voyage_number",
  "sea.is_disembarking",
  "destination.stay_location_type",
  "destination.same_as_residence",
  "destination.address_text",
  "destination.hotel_name_or_address",
  "destination.transit_port_code",
  "destination.transit_destination_country_code",
  "destination.disembarking_port_code",
  "sea.destination_port_code",
  "health.notice_no_covid_requirement",
  "health.with_negative_antigen",
  "health.has_recent_travel_history_30d",
  "health.visited_countries_30d",
  "health.has_exposure_to_sick_person_30d",
  "health.exposed_to_bats_or_sick_animals",
  "health.has_been_sick_30d",
  "health.sickness_symptoms",
  "family.selected_members",
  "family.accompanied_under_18_count",
  "family.accompanied_18_plus_count",
  "family.relationship",
  "customs.information_acknowledgement",
  "customs.has_baggage_or_currency_to_declare",
  "baggage.checked_count",
  "baggage.hand_carried_count",
  "baggage.first_time_visit",
  "baggage.goods_amount_currency",
  "baggage.goods_amount",
  "baggage.items",
  "customs.checklist",
  "customs.checklist.ph_currency_over_50000",
  "customs.checklist.foreign_currency_over_10000_usd",
  "customs.checklist.gambling_paraphernalia",
  "customs.checklist.personal_use_excess_products",
  "customs.checklist.dangerous_drugs",
  "customs.checklist.firearms_explosives",
  "customs.checklist.commercial_alcohol_tobacco",
  "customs.checklist.food_animals_plants",
  "customs.checklist.excess_gadgets_radio",
  "customs.checklist.cremains_organs_tissues",
  "customs.checklist.jewelry_gold_precious_metals_gems",
  "customs.checklist.other_goods",
  "currency.needs_currency_declaration",
  "currency.owner_not_applicable",
  "currency.owner",
  "currency.recipient",
  "currency.items",
  "currency.bsp_authorization_date",
  "currency.sources",
  "currency.source_other",
  "currency.transport_purposes",
  "currency.transport_purpose_other",
  "currency.transfer_method",
  "currency.no_of_days_in_philippines",
  "currency.last_travel_to_philippines",
  "currency.courier_name",
  "currency.airway_bill_no",
  "currency.airway_bill_date",
  "attachments.travel_document",
  "signature.applicant_signature",
  "declaration.customs_signature_declaration",
  "declaration.certify_true_correct",
  "summary.review",
  "summary.final_submit",
  "result.official_reference",
  "result.reference_qr_render",
] as const;

function pathsFor(semanticKey: string): PhEtravelCoveragePath[] {
  if (semanticKey.startsWith("air.")) return ["ordinary_air"];
  if (semanticKey.startsWith("sea."))
    return ["sea_manual", "sea_electronic_no", "sea_electronic_yes"];
  if (semanticKey === "destination.disembarking_port_code")
    return ["sea_manual"];
  if (
    semanticKey === "destination.transit_port_code" ||
    semanticKey === "destination.transit_destination_country_code"
  ) {
    return ["ordinary_air"];
  }
  if (semanticKey.startsWith("baggage."))
    return ["ordinary_air", "sea_electronic_no"];
  if (
    semanticKey.startsWith("customs.checklist") ||
    semanticKey.startsWith("currency.")
  ) {
    return ["ordinary_air", "sea_electronic_yes"];
  }
  if (semanticKey === "signature.applicant_signature")
    return ["ordinary_air", "sea_electronic_no", "sea_electronic_yes"];
  return ALL_PATHS;
}

function categoryFor(semanticKey: string): PhEtravelCoverageCategory {
  if (RUNTIME_KEYS.has(semanticKey)) return "runtime";
  if (RESULT_ONLY_KEYS.has(semanticKey)) return "result_only";
  if (ACTION_ONLY_KEYS.has(semanticKey)) return "action_only";
  if (OFFICIAL_ONLY_KEYS.has(semanticKey)) return "official_only";
  if (PROFILE_OWNED_KEYS.has(semanticKey)) return "profile_owned";
  return "applicant_input";
}

function ownersFor(
  category: PhEtravelCoverageCategory,
  semanticKey: string
): string[] {
  if (category === "runtime") return ["account_boundary"];
  if (category === "result_only") return ["result-recovery"];
  if (category === "profile_owned") return ["eligibility", "presentation"];
  if (category === "action_only") return ["wizard-contract", "status"];
  if (category === "official_only") return ["presentation"];
  if (semanticKey.startsWith("currency."))
    return ["presentation", "owner-na", "attachment-contract"];
  if (
    semanticKey.startsWith("sea.") ||
    semanticKey.startsWith("destination.")
  ) {
    return ["presentation", "port-flow", "page-contract"];
  }
  if (semanticKey.startsWith("travel.") || semanticKey.startsWith("air.")) {
    return ["presentation", "official-options"];
  }
  return ["presentation", "page-contract"];
}

function evidenceTierFor(semanticKey: string): PhEtravelCoverageEvidenceTier {
  if (NEEDS_REVIEW_KEYS.has(semanticKey)) return "needs_review";
  return PUBLIC_BUNDLE_KEYS.has(semanticKey)
    ? "verified_public_bundle"
    : "confirmed_live";
}

function uiDispositionFor(
  category: PhEtravelCoverageCategory,
  evidenceTier: PhEtravelCoverageEvidenceTier,
  semanticKey: string
): PhEtravelCoverageUiDisposition {
  if (
    ["runtime", "action_only", "official_only", "result_only"].includes(
      category
    )
  ) {
    return "not_an_applicant_input";
  }
  if (category === "profile_owned") return "profile_or_eligibility_gate";
  if (
    evidenceTier === "needs_review" ||
    semanticKey.startsWith("air.") ||
    semanticKey.startsWith("health.")
  ) {
    return "review_gate";
  }
  return "input_when_shared_ready";
}

export const PH_ETRAVEL_CANONICAL_COVERAGE: PhEtravelCoverageRecord[] =
  CANONICAL_KEYS.map((semanticKey) => {
    const category = categoryFor(semanticKey);
    const evidenceTier = evidenceTierFor(semanticKey);
    return {
      semanticKey,
      category,
      evidenceTier,
      paths: pathsFor(semanticKey),
      uiDisposition: uiDispositionFor(category, evidenceTier, semanticKey),
      owners: ownersFor(category, semanticKey),
      ...(E22_CLIENT_BUNDLE_KEYS.has(semanticKey) ||
      E23_CLIENT_BUNDLE_KEYS.has(semanticKey) ||
      E24_CLIENT_BUNDLE_KEYS.has(semanticKey)
        ? { clientContractEvidence: "verified_public_bundle" as const }
        : {}),
      ...(semanticKey === "result.reference_qr_render"
        ? { legacyAliases: ["result.qr_artifact"] }
        : {}),
    };
  });

export const PH_ETRAVEL_DIVERTED_COVERAGE: PhEtravelCoverageRecord[] = [
  "eligibility.is_crew_member",
  "eligibility.is_cruise_registration",
  "eligibility.is_special_registration",
  "eligibility.is_foreign_diplomat_or_dependent",
  "eligibility.is_foreign_dignitary_or_delegation",
  "eligibility.has_9e_visa",
  "eligibility.has_diplomatic_passport",
  "eligibility.has_official_or_service_passport",
].map((semanticKey) => ({
  semanticKey,
  category: "unsupported_diverted",
  evidenceTier: "verified_public_bundle",
  paths: ALL_PATHS,
  uiDisposition: "not_an_applicant_input",
  owners: ["eligibility"],
}));

export function getPhEtravelCoverageCounts(
  records = PH_ETRAVEL_CANONICAL_COVERAGE
) {
  return records.reduce(
    (counts, record) => {
      counts[record.evidenceTier] += 1;
      return counts;
    },
    { confirmed_live: 0, verified_public_bundle: 0, needs_review: 0 }
  );
}

export function getPhEtravelEnabledApplicantCoverage(
  path: PhEtravelCoveragePath
) {
  return PH_ETRAVEL_CANONICAL_COVERAGE.filter(
    (record) =>
      record.category === "applicant_input" &&
      record.uiDisposition === "input_when_shared_ready" &&
      record.paths.includes(path)
  );
}

export function auditPhEtravelCoverage(
  records: readonly PhEtravelCoverageRecord[] = PH_ETRAVEL_CANONICAL_COVERAGE
): PhEtravelCoverageAuditIssue[] {
  const issues: PhEtravelCoverageAuditIssue[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.semanticKey)) issues.push("duplicate_semantic_key");
    seen.add(record.semanticKey);
    if (record.owners.length === 0) issues.push("missing_coverage_owner");
    if (
      (record.category === "runtime" || record.category === "result_only") &&
      record.uiDisposition !== "not_an_applicant_input"
    ) {
      issues.push(
        record.category === "runtime"
          ? "runtime_leaks_to_ui"
          : "result_leaks_to_ui"
      );
    }
    if (
      record.evidenceTier === "needs_review" &&
      record.uiDisposition === "input_when_shared_ready"
    ) {
      issues.push("needs_review_enabled_input");
    }
    if (
      (record.semanticKey.startsWith("air.") &&
        record.paths.some((path) => path !== "ordinary_air")) ||
      (record.semanticKey.startsWith("sea.") &&
        record.paths.includes("ordinary_air")) ||
      (record.semanticKey.startsWith("baggage.") &&
        record.paths.includes("sea_manual")) ||
      (record.semanticKey.startsWith("customs.checklist") &&
        record.paths.includes("sea_manual"))
    ) {
      issues.push("wrong_path_scope");
    }
  }
  return [...new Set(issues)];
}
