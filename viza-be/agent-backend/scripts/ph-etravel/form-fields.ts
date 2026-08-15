import {
  type PhEtravelOption,
  PH_ETRAVEL_AIR_TRANSIT_PORT_OPTIONS,
  PH_ETRAVEL_COUNTRY_OPTIONS,
  PH_ETRAVEL_CURRENCY_PURPOSE_OPTIONS,
  PH_ETRAVEL_CURRENCY_SOURCE_OPTIONS,
  PH_ETRAVEL_CURRENCY_TRANSPORT_METHOD_OPTIONS,
  PH_ETRAVEL_CURRENCY_TYPE_OPTIONS,
  PH_ETRAVEL_DECLARATION_CHECKLIST,
  PH_ETRAVEL_DESTINATION_TYPE_OPTIONS,
  PH_ETRAVEL_DYNAMIC_OPTION_SOURCES,
  PH_ETRAVEL_FAMILY_COMPANION_GATE_OPTIONS,
  PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS,
  PH_ETRAVEL_HEALTH_BOOLEAN_OPTIONS,
  PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS,
  PH_ETRAVEL_OCCUPATION_OPTIONS,
  PH_ETRAVEL_PASSPORT_HOLDER_OPTIONS,
  PH_ETRAVEL_PURPOSE_OPTIONS,
  PH_ETRAVEL_SEA_PORT_OPTIONS,
  PH_ETRAVEL_SEX_OPTIONS,
  PH_ETRAVEL_SICKNESS_SYMPTOM_OPTIONS,
  PH_ETRAVEL_SUFFIX_OPTIONS,
  PH_ETRAVEL_TRANSPORT_TYPES,
  PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS,
  PH_ETRAVEL_UNSUPPORTED_ARRIVAL_TRAVELLER_TYPE_OPTIONS,
  PH_ETRAVEL_YES_NO_OPTIONS,
  phEtravelOption,
} from "./official-options";

export const PH_ETRAVEL_VISA_TYPE = "PH_ETRAVEL_ARRIVAL_CARD";

export interface PhEtravelFieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: PhEtravelOption[];
  conditional_logic?: Record<string, unknown>;
}

export type PhEtravelConfirmedApplicantCoverage = {
  field_name: string;
  official_key: string;
  evidence: "E2" | "E6" | "E7" | "E8" | "E9" | "E10";
  path_specific?: boolean;
};

export type PhEtravelSeaElectronicPositiveCoverage = {
  evidence: "E10" | "E11";
  observed_path: string;
  page_order: readonly string[];
  selector_reuse_scope: string;
  confirmed_through: string;
  field_names: readonly string[];
  excluded_paths: readonly string[];
  attachment_surface_evidence: string;
  attachment_schema_status: string;
  post_signature_unverified: readonly string[];
};

// E17 is an audit of the canonical official contract, not a claim that all
// rows are v1 applicant fields. Keep its counts visible to static coverage
// tests so unsupported/runtime/result rows cannot be silently promoted.
export const PH_ETRAVEL_ARRIVAL_CONTRACT_AUDIT = {
  canonical_rows: 111,
  confirmed_live_rows: 56,
  verified_public_rows: 19,
  needs_review_rows: 36,
  unsupported_or_diverted_rows: 8,
} as const;

// E21 is a public-client wiring audit. These details deliberately describe
// client behavior without elevating upload, option, or server contracts.
export const PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21 = {
  photo_url: {
    owner: "profile_owned",
    flat_key: "photo_url",
    client_yup_required: true,
    clear_on: "widget_delete_clears_photo_url",
    trigger_modes: "auth_with_mobile:file; otherwise:camera_and_file",
    generic_widget_default_max_bytes: 5242880,
    live_file_control: "E26_normal_single_file_image_control_visible_selection_policy_blocked",
    passport_holder_condition: "none_observed",
    profile_persistence: "FOR_ME_profile_route; FOR_OTHER_registration_payload_only",
    file_contract: "needs_review_live_single_file_control_only_no_accept_mime_size_content_or_server_acceptance",
  },
  mobile_number: {
    owner: "profile_and_registration_payload",
    flat_key: "mobile_number",
    no_separate_official_mobile_country_code: true,
    client_country_initial_and_preferred: "ph",
    client_mask: "... ... ....",
    client_searchable_country_chooser: true,
    client_normalization: "remove_spaces_from_component_return",
    client_yup_required: false,
    profile_persistence: "FOR_ME_profile_route; FOR_OTHER_registration_payload_only",
    server_contract: "needs_review",
  },
  residence: {
    owner: "profile_and_registration_payload",
    country_flat_key: "country_code",
    downstream_flat_keys: ["region_code", "province_code", "municipality_code", "barangay_code", "street", "street_two"],
    client_branch: "country_code === PH",
    passport_holder_condition: "none_residence_branch_is_not_FILIPINO_or_FOREIGNER",
    country_change_clears: ["region_code", "province_code", "municipality_code", "barangay_code", "street", "street_two"],
    province_source: "/api/v1/common/provinces?order_by=name",
    municipality_source: "/api/v1/common/municipalities?province_code={selected code}",
    barangay_source: "/api/v1/common/barangays?municipality_code={selected code}",
    client_required: ["country_code", "street", "region_code@PH", "province_code@PH", "municipality_code@PH", "barangay_code@PH"],
    client_optional: ["street_two"],
    profile_persistence: "FOR_ME_profile_route; FOR_OTHER_registration_payload_only",
    server_contract: "needs_review",
  },
} as const;

// E24 records only public SEA client wiring. It must not become a port-flow,
// route-selection, or server-acceptance rule.
export const PH_ETRAVEL_SEA_FLOW_CLIENT_WIRING_E24 = {
  is_disembarking: {
    official_key: "is_disembarking",
    default_value: false,
    control_type: "checkbox",
    visible_when: "transport_type === SEA && flight_type === ARRIVAL",
    clear_when: ["transport_type === AIR", "flight_type === DEPARTURE"],
    clear_value: false,
    server_requiredness: "needs_review",
    live_false_continuation: "needs_review",
  },
  falsey_destination_subtree: {
    visible_when: "transport_type === SEA && flight_type === ARRIVAL && is_disembarking === true",
    hidden_when_falsey: [
      "stay_location_type",
      "destination_upon_arrival_in_philippines",
      "is_destination_same_as_permanent_address",
      "disembarking_port_code",
    ],
    is_disembarking_clear_callback: "none_observed",
  },
  ports: {
    voyage_destination_key: "destination_port_code",
    disembarking_key: "disembarking_port_code",
    keys_are_aliases: false,
    disembarking_source_transport_filter: "none",
    voyage_source_transport_filter: "SEA",
  },
  with_custom_declaration: {
    regular_page_gate: "registration.travel_port.with_custom_declaration",
    customs_hook_source_shape: "registration.with_custom_declaration",
    applicant_field: false,
    port_to_manual_or_electronic_mapping: "needs_review",
    route_selection: "needs_review_regular_vs_declaration_shortcut",
  },
} as const;

export type PhEtravelE18ScenarioReadiness = {
  scenario: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";
  launch_ready: false;
  planned_only: true;
  canonical_needs_review_keys: readonly string[];
  schema_fields_present: readonly string[];
  non_schema_or_unsupported_keys: readonly string[];
  branch_boundary: string;
  requiredness_boundary: string;
  option_source_boundary: string;
  minimum_schema_delta_after_official_evidence: string;
  confirmed_live_keys?: readonly string[];
};

// E18 is a synthetic, stop-before-submit observation plan. These rows make its
// scenario ownership machine-checkable without creating test values, fields, or
// a claim that any unresolved branch is launch-ready. S5 is intentionally
// path-only and therefore has no share of E17's 41 canonical needs-review rows.
export const PH_ETRAVEL_E18_SYNTHETIC_SCENARIO_READINESS: readonly PhEtravelE18ScenarioReadiness[] = [
  {
    scenario: "S0",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: ["account.email", "account.otp", "account.password"],
    schema_fields_present: [],
    non_schema_or_unsupported_keys: ["account.email", "account.otp", "account.password"],
    branch_boundary: "runtime_account_boundary_only_no_login_or_secret",
    requiredness_boundary: "passenger_form_requiredness_not_applicable",
    option_source_boundary: "not_an_option_source",
    minimum_schema_delta_after_official_evidence: "none_keep_account_runtime_excluded_from_visa_form_fields",
  },
  {
    scenario: "S1",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: [
      "registration.application_for", "traveller.passenger_type", "profile.photo_url",
      "traveller.mobile_number",
      "residence.country_code", "residence.region_code", "residence.province_code", "residence.municipality_code", "residence.barangay_code",
      "residence.address_line1", "residence.address_line2",
    ],
    schema_fields_present: ["registration_for", "transport_type", "flight_type", "registration_data_privacy_affidavit_consent", "traveller_type", "first_name", "middle_name", "last_name", "suffix", "sex", "mobile_number", "country_of_residence", "residence_province_code", "residence_municipality_code", "residence_barangay_code", "residence_address_line1", "residence_address_line2"],
    non_schema_or_unsupported_keys: ["profile.photo_url", "residence.region_code"],
    branch_boundary: "ordinary_profile_and_foreign_or_philippine_residence_branch",
    requiredness_boundary: "profile_photo_and_residence_requiredness_not_closed",
    option_source_boundary: "countries_and_PH_residence_cascade_use_verified_official_dynamic_code_identity",
    minimum_schema_delta_after_official_evidence: "photo_contract_only; PH_residence_cascade_is_now_schema_owned",
    confirmed_live_keys: ["traveller.first_name", "traveller.middle_name", "traveller.last_name", "traveller.suffix", "traveller.sex"],
  },
  {
    scenario: "S2",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: [
      "air.airline_code", "air.flight_number", "air.is_special_flight", "air.special_flight_number",
      "destination.same_as_residence", "destination.transit_port_code", "destination.transit_destination_country_code",
    ],
    schema_fields_present: ["airline_name", "flight_number", "flight_number_special", "destination_same_as_residence", "destination_transit_airport", "destination_country"],
    non_schema_or_unsupported_keys: ["air.is_special_flight"],
    branch_boundary: "AIR_only_with_residence_or_TRANSIT_destination_children",
    requiredness_boundary: "airline_flight_and_destination_child_requiredness_not_closed",
    option_source_boundary: "airline_and_flight_runtime_dynamic_transit_country_code_dynamic",
    minimum_schema_delta_after_official_evidence: "close_only_live_rendered_requiredness_option_values_and_server_acceptance_for_existing_special_flight_branch",
  },
  {
    scenario: "S3",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: [
      "health.with_negative_antigen", "health.has_recent_travel_history_30d", "health.visited_countries_30d",
      "health.exposed_to_bats_or_sick_animals", "health.sickness_symptoms",
    ],
    schema_fields_present: ["with_negative_antigen", "has_recent_travel_history_30d", "visited_country_30d", "has_exposure_to_sick_person_30d", "has_been_sick_30d", "sickness_symptom"],
    non_schema_or_unsupported_keys: ["health.exposed_to_bats_or_sick_animals"],
    branch_boundary: "health_inherited_vaccination_age_antigen_predicate_and_yes_children_only_no_factual_health_data",
    requiredness_boundary: "health_screenshot_confirms_base_radios_and_positive_group_minimums_but_server_acceptance_remains_review",
    option_source_boundary: "sickness_options_and_country_children_remain_dynamic_or_needs_review",
    minimum_schema_delta_after_official_evidence: "close_only_live_rendered_requiredness_option_interaction_and_server_acceptance_for_existing_health_controls",
  },
  {
    scenario: "S4",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: ["sea.is_disembarking"],
    schema_fields_present: ["is_disembarking", "sea_manual_customs_forms_notice"],
    non_schema_or_unsupported_keys: [],
    branch_boundary: "SEA_ARRIVAL_checkbox_default_false_falsey_stay_subtree_hidden_manual_path_not_electronic",
    requiredness_boundary: "disembarking_false_continuation_and_server_requiredness_not_closed",
    option_source_boundary: "destination_and_disembarking_ports_distinct_with_custom_declaration_runtime_page_gate_not_port_flow",
    minimum_schema_delta_after_official_evidence: "close_only_live_false_continuation_manual_notice_route_selection_and_server_acceptance_without_port_flow_inference",
  },
  {
    scenario: "S5",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: [],
    schema_fields_present: ["customs_signature", "family_member_gate_confirmation"],
    non_schema_or_unsupported_keys: ["summary.review", "summary.final_submit"],
    branch_boundary: "SEA_electronic_Yes_post_signature_only_not_manual_or_electronic_No",
    requiredness_boundary: "signature_page_requiredness_does_not_close_positive_post_signature_continuation",
    option_source_boundary: "not_an_option_source",
    minimum_schema_delta_after_official_evidence: "update_path_metadata_only_for_Family_Summary_sequence_never_add_signature_pixels_or_runtime_submit_data",
  },
  {
    scenario: "S6",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: [
      "currency.needs_currency_declaration", "currency.owner_not_applicable", "currency.bsp_authorization_date", "attachments.travel_document",
    ],
    schema_fields_present: ["has_baggage_or_currency_to_declare", "currency_owner_not_applicable", "bsp_authorization_date"],
    non_schema_or_unsupported_keys: ["attachments.travel_document"],
    branch_boundary: "AIR_positive_or_SEA_electronic_Yes_pre_signature_only",
    requiredness_boundary: "threshold_owner_NA_BSP_and_attachment_requiredness_not_closed",
    option_source_boundary: "currency_dynamic_id_source_owner_NA_selector_unstable_attachment_no_file_contract",
    minimum_schema_delta_after_official_evidence: "add_attachment_field_only_after_stable_input_mime_size_count_and_requiredness_evidence",
  },
  {
    scenario: "S7",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: [
      "customs.information_acknowledgement", "declaration.customs_signature_declaration", "declaration.certify_true_correct",
    ],
    schema_fields_present: ["customs_information_acknowledgement", "customs_signature_declaration"],
    non_schema_or_unsupported_keys: ["declaration.certify_true_correct"],
    branch_boundary: "electronic_customs_or_signature_acknowledgement_surface_only",
    requiredness_boundary: "acknowledgement_control_vs_static_copy_and_requiredness_not_closed",
    option_source_boundary: "not_an_option_source",
    minimum_schema_delta_after_official_evidence: "promote_or_add_only_an_observed_control_never_synthesize_a_checkbox_from_copy",
  },
  {
    scenario: "S8",
    launch_ready: false,
    planned_only: true,
    canonical_needs_review_keys: ["result.official_reference", "result.reference_qr_render"],
    schema_fields_present: [],
    non_schema_or_unsupported_keys: ["result.official_reference", "result.reference_qr_render", "result.qr_artifact"],
    branch_boundary: "separately_authorized_final_result_and_recovery_only",
    requiredness_boundary: "not_an_applicant_requiredness_or_visa_form_field",
    option_source_boundary: "reference_derived_QR_render_not_an_option_source_or_artifact_upload",
    minimum_schema_delta_after_official_evidence: "none_keep_reference_and_QR_render_as_result_metadata_with_qr_artifact_legacy_alias_only",
  },
] as const;

export type PhEtravelApplicantQuestionOwner =
  | "schema"
  | "viza_audit"
  | "profile_owned"
  | "runtime"
  | "result"
  | "static_action"
  | "unsupported";

export type PhEtravelApplicantQuestionManifestEntry = {
  semantic_key: string;
  owner: PhEtravelApplicantQuestionOwner;
  applicant_answer: boolean;
  schema_field?: string;
  persona: string;
  transport: string;
  page: string;
  condition: string;
  evidence_level: string;
  legacy_aliases?: readonly string[];
  requiredness_evidence?: string;
  file_contract_evidence?: string;
  persistence_boundary?: string;
};

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({ label_zh: labelZh, ...extra });
const showIf = (expression: string) => ({ showIf: expression });
const option = (value: string, labelZh: string, labelEn: string) => phEtravelOption(value, labelZh, labelEn);

const FOR_WHOM_OPTIONS = [
  option("FOR_ME", "本人（当前用户）", "For me (Current User)"),
  option("FOR_OTHER", "他人（家人）", "For other (Family Member)"),
];

const ARRIVAL_ONLY_OPTIONS = [
  option("ARRIVAL", "入境菲律宾", "Arrival (Entering the Philippines)"),
];

const IS_AIR = "transport_type === AIR";
const IS_SEA = "transport_type === SEA";
const IS_PH_RESIDENCE = "country_of_residence === PH";
const HAS_TRANSIT = "with_transit === true";
const HAS_AIR_TRANSIT = `${IS_AIR} && ${HAS_TRANSIT}`;
const HAS_SEA_TRANSIT = `${IS_SEA} && ${HAS_TRANSIT}`;
const ARRIVAL_FLIGHT_TYPE = "flight_type === ARRIVAL";
const SEA_ARRIVAL_DISEMBARKING = `${IS_SEA} && ${ARRIVAL_FLIGHT_TYPE} && is_disembarking === true`;
const DESTINATION_SECTION_ACTIVE = `${ARRIVAL_FLIGHT_TYPE} && (${IS_AIR} || ${SEA_ARRIVAL_DISEMBARKING})`;
const DESTINATION_RESIDENCE = `${DESTINATION_SECTION_ACTIVE} && destination_type === RESIDENCE`;
const DESTINATION_HOTEL = `${DESTINATION_SECTION_ACTIVE} && destination_type === HOTEL`;
const DESTINATION_AIR_TRANSIT = `${IS_AIR} && ${ARRIVAL_FLIGHT_TYPE} && destination_type === TRANSIT`;
const DESTINATION_SEA_TRAVEL_PORT = `${SEA_ARRIVAL_DISEMBARKING} && destination_type === TRAVEL_PORT`;
const SEA_MANUAL_CUSTOMS_FORMS = `${IS_SEA} && selected_port_customs_flow === MANUAL_FORMS`;
const ELECTRONIC_CUSTOMS_FLOW = `(${IS_AIR} || selected_port_customs_flow === ELECTRONIC_CUSTOMS)`;
const HAS_RECENT_TRAVEL = "has_recent_travel_history_30d === true";
const HAS_BEEN_SICK = "has_been_sick_30d === true";
const HAS_CUSTOMS_DECLARATION = `${ELECTRONIC_CUSTOMS_FLOW} && has_baggage_or_currency_to_declare === yes`;
const HAS_PHP_CURRENCY_DECLARATION = "customs_checklist_1 === yes";
const HAS_FOREIGN_CURRENCY_DECLARATION = "customs_checklist_2 === yes";
export const PH_ETRAVEL_HEALTH_DECLARATION_WARNING = "Any false declaration made in this context may subject the traveler to legal penalties under applicable Philippine laws including public health, quarantine and communicable diseases regulations.";
const HAS_CURRENCY_DECLARATION = `(${HAS_PHP_CURRENCY_DECLARATION} || ${HAS_FOREIGN_CURRENCY_DECLARATION})`;
const HAS_GOODS_DECLARATION = `(${PH_ETRAVEL_DECLARATION_CHECKLIST
  .filter((item) => item.type !== "CURRENCY")
  .map((item) => `customs_checklist_${item.id} === yes`)
  .join(" || ")})`;
const HAS_CURRENCY_OWNER_DETAILS = `${HAS_CURRENCY_DECLARATION} && currency_owner_not_applicable !== true`;
const HAS_COURIER_TRANSFER = `${HAS_CURRENCY_DECLARATION} && currency_transport_method === is_shipped_thru_courier_service`;
const HAS_PHYSICAL_TRANSFER = `${HAS_CURRENCY_DECLARATION} && currency_transport_method === is_physically_transferred_by_person`;
const HAS_OTHER_CURRENCY_SOURCE = `${HAS_CURRENCY_DECLARATION} && currency_source includes OTHER`;
const HAS_OTHER_CURRENCY_PURPOSE = `${HAS_CURRENCY_DECLARATION} && currency_transport_purpose includes OTHER`;
const NO_FAMILY_MEMBERS_SELECTED = "selected_family_members_count === 0";

const CANONICAL_COUNTRY_RULES = {
  canonical_source: "official_country_code",
  accepts_profile_aliases: false,
  dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.countries,
};
const CANONICAL_DATE_RULES = { canonical_format: "YYYY-MM-DD", accepts_profile_aliases: false };
const CANONICAL_OPTION_RULES = { canonical_source: "official_option_value", accepts_profile_aliases: false };

export const PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE = {
  official_evidence_required: [
    "attachment_requiredness_file_input",
    "currency_owner_not_applicable_stable_selector",
    "currency_owner_recipient_full_requiredness",
    "customs_other_goods_no_row_page_blocking",
    "sea_non_disembarking_path",
    "sea_disembarking_question_applicability",
    "sea_port_customs_variants",
    "sea_electronic_customs_signature_variants",
    "sea_electronic_positive_post_signature_path",
    "final_submit_reference_qr_result_recovery",
  ],
  option_snapshot_required: [
    "currency_options_complete_current_snapshot",
    "monetary_instrument_options_complete_current_snapshot",
    "sea_ports_with_customs_flow_snapshot",
  ],
  frontend_shared_required: [
    "dynamic_form_attachment_file_condition_ui",
    "dynamic_form_structured_customs_currency_ui",
    "dynamic_form_sea_non_disembarking_and_port_customs_conditions",
    "shared_result_status_reference_qr_gate",
  ],
  runner_required: [
    "air_positive_customs_currency_phased_enablement",
    "owner_not_applicable_selector_strategy",
    "physical_branch_validation_strategy",
    "sea_port_customs_flow_runtime_detection",
    "final_result_recovery_without_resubmit",
  ],
} as const;

// Canonical v0.2 questions with a currently confirmed official control/value key.
// This is deliberately not a list of every seed row: Review-only, runtime, and
// result surfaces must not be promoted to applicant questions by implication.
export const PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE: readonly PhEtravelConfirmedApplicantCoverage[] = [
  { field_name: "transport_type", official_key: "transportation_type", evidence: "E2" },
  { field_name: "passport_holder_type", official_key: "nationality", evidence: "E2" },
  { field_name: "passport_number", official_key: "passport_number", evidence: "E2" },
  { field_name: "date_of_birth", official_key: "birth_date", evidence: "E2" },
  { field_name: "passport_issue_date", official_key: "passport_issued_date", evidence: "E2" },
  { field_name: "purpose_of_travel", official_key: "purpose_of_visit_code", evidence: "E2" },
  { field_name: "traveller_type", official_key: "passenger_type", evidence: "E8" },
  { field_name: "vessel_name", official_key: "vessel_name", evidence: "E8", path_specific: true },
  { field_name: "voyage_number", official_key: "flight_number", evidence: "E8", path_specific: true },
  { field_name: "origin_country", official_key: "origin_country_code", evidence: "E2" },
  { field_name: "airport_of_origin", official_key: "origin_port", evidence: "E2", path_specific: true },
  { field_name: "seaport_of_origin", official_key: "origin_port", evidence: "E8", path_specific: true },
  { field_name: "flight_departure_date", official_key: "departure_date", evidence: "E2", path_specific: true },
  { field_name: "voyage_departure_date", official_key: "departure_date", evidence: "E8", path_specific: true },
  { field_name: "flight_arrival_date", official_key: "arrival_date", evidence: "E2", path_specific: true },
  { field_name: "voyage_arrival_date", official_key: "arrival_date", evidence: "E8", path_specific: true },
  { field_name: "return_date", official_key: "return_date", evidence: "E8", path_specific: true },
  { field_name: "sea_port_of_entry", official_key: "destination_port_code", evidence: "E8", path_specific: true },
  { field_name: "is_disembarking", official_key: "is_disembarking", evidence: "E6", path_specific: true },
  { field_name: "transit_country", official_key: "transit_country_code", evidence: "E8", path_specific: true },
  { field_name: "transit_airport", official_key: "transit_port", evidence: "E2", path_specific: true },
  { field_name: "transit_seaport", official_key: "transit_port", evidence: "E8", path_specific: true },
  { field_name: "transit_date", official_key: "transit_date", evidence: "E8", path_specific: true },
  { field_name: "destination_type", official_key: "stay_location_type", evidence: "E6", path_specific: true },
  { field_name: "destination_residence_address", official_key: "destination_upon_arrival_in_philippines", evidence: "E2", path_specific: true },
  { field_name: "destination_hotel_name", official_key: "destination_upon_arrival_in_philippines", evidence: "E2", path_specific: true },
  { field_name: "disembarking_port_code", official_key: "disembarking_port_code", evidence: "E6", path_specific: true },
  { field_name: "has_exposure_to_sick_person_30d", official_key: "is_with_history_exposure", evidence: "E2" },
  { field_name: "has_been_sick_30d", official_key: "is_sicked_within_thirty_days", evidence: "E2" },
  { field_name: "accompanied_under_18_count", official_key: "accompanied_family_members.below_eighteen", evidence: "E2" },
  { field_name: "accompanied_18_plus_count", official_key: "accompanied_family_members.above_or_equal_eighteen", evidence: "E2" },
  { field_name: "checked_baggage_count", official_key: "no_of_checked_in_baggages", evidence: "E8", path_specific: true },
  { field_name: "handcarry_baggage_count", official_key: "no_of_hand_carried_baggages", evidence: "E8", path_specific: true },
  { field_name: "first_time_visiting_philippines", official_key: "first_time_visit", evidence: "E8", path_specific: true },
  { field_name: "has_baggage_or_currency_to_declare", official_key: "with_something_to_declare_arrival", evidence: "E7", path_specific: true },
];

// E10/E11 prove selector reuse through the signature page only for this SEA
// electronic Yes path. It must not be read as a universal SEA contract.
export const PH_ETRAVEL_SEA_ELECTRONIC_POSITIVE_COVERAGE: PhEtravelSeaElectronicPositiveCoverage = {
  evidence: "E11",
  observed_path: "SEA + ARRIVAL + VESSEL PASSENGER + Manila South Harbor + electronic customs Yes",
  page_order: [
    "Customs Declaration Confirmation:Yes",
    "Other Travel Details",
    "Customs General Declaration",
    "Customs Currency Declaration",
    "For Customs - Declaration Attachments and Signature",
  ],
  selector_reuse_scope: "AIR_E7_and_SEA_E10_E11_electronic_positive_through_signature_page_only",
  confirmed_through: "For Customs - Declaration Attachments and Signature",
  field_names: [
    "accompanied_under_18_count",
    "accompanied_18_plus_count",
    "checked_baggage_count",
    "handcarry_baggage_count",
    "first_time_visiting_philippines",
    ...PH_ETRAVEL_DECLARATION_CHECKLIST.map((item) => `customs_checklist_${item.id}`),
    "goods_total_currency",
    "goods_total_amount",
    "goods_item_description",
    "goods_item_quantity",
    "goods_item_value",
    "currency_owner_not_applicable",
    "currency_owner_first_name",
    "currency_owner_middle_name",
    "currency_owner_last_name",
    "currency_owner_business_name",
    "currency_owner_suffix",
    "currency_owner_occupation",
    "currency_owner_country",
    "currency_owner_address",
    "currency_owner_postal_code",
    "currency_recipient_first_name",
    "currency_recipient_middle_name",
    "currency_recipient_last_name",
    "currency_recipient_business_name",
    "currency_recipient_suffix",
    "currency_recipient_occupation",
    "currency_recipient_country",
    "currency_recipient_address",
    "currency_recipient_postal_code",
    "currency_item_currency",
    "currency_monetary_instrument",
    "currency_amount",
    "bsp_authorization_date",
    "currency_source",
    "currency_source_other",
    "currency_transport_purpose",
    "currency_transport_purpose_other",
    "currency_transport_method",
    "no_of_days_in_philippines",
    "last_travel_to_philippines",
    "courier_name",
    "airway_bill_no",
    "airway_bill_date",
    "customs_signature",
  ],
  excluded_paths: [
    "SEA_MANUAL_FORMS",
    "SEA_ELECTRONIC_NO_DECLARATION",
    "SEA_NON_DISEMBARKING_OR_UNOBSERVED_PORT",
  ],
  attachment_surface_evidence: "upload_copy_visible_without_stable_file_input_mime_size_or_requiredness",
  attachment_schema_status: "not_an_applicant_file_field_pending_official_file_contract",
  post_signature_unverified: [
    "family_member_gate",
    "no_companion_confirmation",
    "summary",
    "final_submit",
    "official_reference",
    "result.reference_qr_render",
    "result_recovery",
  ],
};

const CUSTOMS_CHECKLIST_FIELDS: PhEtravelFieldDef[] = PH_ETRAVEL_DECLARATION_CHECKLIST.map((item, index) => ({
  field_name: `customs_checklist_${item.id}`,
  label: item.description,
  field_type: "radio",
  required: false,
  step_number: 7,
  step_name: "Customs Declaration",
  display_order: 10 + index,
  options: PH_ETRAVEL_YES_NO_OPTIONS,
  conditional_logic: showIf(HAS_CUSTOMS_DECLARATION),
  validation_rules: rules(`海关申报项目 ${item.id}`, {
    official: true,
    official_id: item.id,
    official_type: item.type,
    official_notes: item.notes ?? null,
    official_key: `check_lists.${index}.response`,
    official_control_type: "radio_pair",
    selector_evidence_level: "confirmed_live_visible_air_positive",
    requiredness_evidence: "no_visible_html_required_attr_observed; validation remains needs_review",
    answer_contract: "itemized yes/no response; do not replace with an aggregate customs boolean",
    evidence_level: "needs_review_requiredness",
  }),
}));

const GOODS_DETAIL_FIELDS: PhEtravelFieldDef[] = [
  { field_name: "goods_total_currency", label: "Currency of Total Value of Goods", field_type: "select", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 30, options: PH_ETRAVEL_CURRENCY_TYPE_OPTIONS, conditional_logic: showIf(HAS_GOODS_DECLARATION), validation_rules: rules("申报物品总价值币种", { official: true, official_key: "amount_of_goods_acquired.currency", official_control_type: "radio", customs_contract: "goods_positive_detail", structured_contract: "amount_of_goods_acquired", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", ...CANONICAL_OPTION_RULES }) },
  { field_name: "goods_total_amount", label: "Total Value of Goods", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 31, conditional_logic: showIf(HAS_GOODS_DECLARATION), validation_rules: rules("申报物品总价值", { official: true, official_key: "amount_of_goods_acquired.amount", official_control_type: "text", customs_contract: "goods_positive_detail", structured_contract: "amount_of_goods_acquired", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", pattern: "^[0-9]+(\\.[0-9]{1,2})?$" }) },
  { field_name: "goods_item_description", label: "Description", field_type: "textarea", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 32, conditional_logic: showIf(HAS_GOODS_DECLARATION), validation_rules: rules("申报物品明细描述", { official: true, official_group_key: "items[]", official_selector: "description", official_row_label: "Description", official_control_type: "textarea", customs_contract: "goods_item_detail", modal_behavior: "Add Item repeat row", empty_validation_observed: "Description Required", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "customs_goods_items", repeat_contract: "items[]", official_table: "Add Item", page_level_no_row_blocking: "needs_review_not_reproduced_after_delete", runner_aliases: ["description", "customs_goods_item_description"], maxLength: 240 }) },
  { field_name: "goods_item_quantity", label: "Quantity", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 33, conditional_logic: showIf(HAS_GOODS_DECLARATION), validation_rules: rules("申报物品数量", { official: true, official_group_key: "items[]", official_selector: "quantity", official_row_label: "Quantity", official_control_type: "text", customs_contract: "goods_item_detail", modal_behavior: "Add Item repeat row", empty_validation_observed: "Quantity Required", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "customs_goods_items", repeat_contract: "items[]", official_table: "Add Item", page_level_no_row_blocking: "needs_review_not_reproduced_after_delete", runner_aliases: ["quantity", "customs_goods_item_quantity"], pattern: "^[0-9]+$" }) },
  { field_name: "goods_item_value", label: "Amount in USD", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 34, conditional_logic: showIf(HAS_GOODS_DECLARATION), validation_rules: rules("申报物品美元金额", { official: true, official_group_key: "items[]", official_selector: "amount", official_row_label: "Amount in USD", official_control_type: "text", customs_contract: "goods_item_detail", modal_behavior: "Add Item repeat row", empty_validation_observed: "Amount in USD Required", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "customs_goods_items", repeat_contract: "items[]", official_table: "Add Item", page_level_no_row_blocking: "needs_review_not_reproduced_after_delete", runner_aliases: ["amount_usd", "amountInUsd", "amount", "value", "goods_item_amount_usd", "goods_item_amount"], pattern: "^[0-9]+(\\.[0-9]{1,2})?$" }) },
];

const CURRENCY_DETAIL_FIELDS: PhEtravelFieldDef[] = [
  { field_name: "currency_owner_not_applicable", label: "Owner information not applicable", field_type: "checkbox", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 40, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币所有人信息不适用", { official: true, official_key_candidate: "owner_details_not_applicable", official_control_type: "checkbox", customs_contract: "currency_positive_detail", stable_selector_evidence_level: "needs_review", evidence_level: "needs_review_requiredness" }) },
  { field_name: "currency_owner_first_name", label: "Owner First Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 41, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人名", { official: true, official_key: "owner_first_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 60, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true", runner_aliases: ["currency_owner_given_name"] }) },
  { field_name: "currency_owner_middle_name", label: "Owner Middle Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 42, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人中间名", { official: true, official_key: "owner_middle_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 60, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true" }) },
  { field_name: "currency_owner_last_name", label: "Owner Last Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 43, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人姓", { official: true, official_key: "owner_last_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 60, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true", runner_aliases: ["currency_owner_family_name", "currency_owner_surname"] }) },
  { field_name: "currency_owner_business_name", label: "Owner Business Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 44, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人企业名称", { official: true, official_key: "owner_business_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 160, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true", runner_aliases: ["currency_owner_business"] }) },
  { field_name: "currency_owner_suffix", label: "Owner Suffix", field_type: "select", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 45, options: PH_ETRAVEL_SUFFIX_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人后缀", { official: true, official_key: "owner_suffix_name", official_control_type: "combobox", customs_contract: "currency_positive_detail", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true" }) },
  { field_name: "currency_recipient_first_name", label: "Recipient First Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 46, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人名", { official: true, official_key: "recipient_first_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 60, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_recipient_given_name"] }) },
  { field_name: "currency_recipient_middle_name", label: "Recipient Middle Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 47, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人中间名", { official: true, official_key: "recipient_middle_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 60, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness" }) },
  { field_name: "currency_recipient_last_name", label: "Recipient Last Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 48, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人姓", { official: true, official_key: "recipient_last_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 60, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_recipient_family_name", "currency_recipient_surname"] }) },
  { field_name: "currency_recipient_business_name", label: "Recipient Business Name", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 49, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人企业名称", { official: true, official_key: "recipient_business_name", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 160, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_recipient_business"] }) },
  { field_name: "currency_recipient_suffix", label: "Recipient Suffix", field_type: "select", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 50, options: PH_ETRAVEL_SUFFIX_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人后缀", { official: true, official_key: "recipient_suffix_name", official_control_type: "combobox", customs_contract: "currency_positive_detail", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness" }) },
  { field_name: "currency_owner_occupation", label: "Owner Occupation or Principal Business Activity", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 51, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人职业或主要业务活动", { official: true, official_key: "owner_occupation", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 160, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true", runner_aliases: ["currency_owner_business_activity", "currency_owner_occupation_or_business_activity"] }) },
  { field_name: "currency_owner_country", label: "Owner Country", field_type: "select", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 52, options: PH_ETRAVEL_COUNTRY_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人国家 / 地区", { official: true, official_key: "owner_country_code", official_control_type: "combobox", customs_contract: "currency_positive_detail", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true", runner_aliases: ["currency_owner_country_code"], ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "currency_owner_address", label: "Owner No./Bldg./City/State/Province", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 53, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人地址", { official: true, official_key: "owner_street", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 160, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true", runner_aliases: ["currency_owner_street_address"] }) },
  { field_name: "currency_owner_postal_code", label: "Owner Postal Code", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 54, conditional_logic: showIf(HAS_CURRENCY_OWNER_DETAILS), validation_rules: rules("货币所有人邮编", { official: true, official_key: "owner_postal_code", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 20, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", required_unless: "currency_owner_not_applicable === true", runner_aliases: ["currency_owner_zip_code"] }) },
  { field_name: "currency_recipient_occupation", label: "Recipient Occupation or Principal Business Activity", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 55, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人职业或主要业务活动", { official: true, official_key: "recipient_occupation", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 160, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_recipient_business_activity", "currency_recipient_occupation_or_business_activity"] }) },
  { field_name: "currency_recipient_country", label: "Recipient Country", field_type: "select", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 56, options: PH_ETRAVEL_COUNTRY_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人国家 / 地区", { official: true, official_key: "recipient_country_code", official_control_type: "combobox", customs_contract: "currency_positive_detail", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_recipient_country_code"], ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "currency_recipient_address", label: "Recipient No./Bldg./City/State/Province", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 57, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人地址", { official: true, official_key: "recipient_street", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 160, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_recipient_street_address"] }) },
  { field_name: "currency_recipient_postal_code", label: "Recipient Postal Code", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 58, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币收件人邮编", { official: true, official_key: "recipient_postal_code", official_control_type: "text", customs_contract: "currency_positive_detail", maxLength: 20, selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_recipient_zip_code"] }) },
  { field_name: "currency_item_currency", label: "Currency", field_type: "select", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 59, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("申报货币币种", { official: true, official_key: "currency_id", official_control_type: "combobox", customs_contract: "currency_item_detail", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.currencies, option_identity: "id", label_identity: "name_not_unique", official_options_source: "E13 /api/v1/common/currencies dynamic response", complete_option_list_evidence_level: "verified_public_dynamic_source", modal_behavior: "Add Item repeat row", empty_validation_observed: "Currency Required", page_validation_observed: "At least have 1 item", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "currency_items", repeat_contract: "items[]", runner_aliases: ["currency", "currency_name", "currency_type"] }) },
  { field_name: "currency_monetary_instrument", label: "Monetary Instrument", field_type: "select", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 60, options: PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("金融票据类型", { official: true, official_key: "monetary_instrument_id", official_control_type: "combobox", customs_contract: "currency_item_detail", official_options_source: "E13 /api/v1/common/monetary_instruments", official_value_type: "numeric_id", complete_option_list_evidence_level: "verified_public", modal_behavior: "Add Item repeat row", empty_validation_observed: "Monetary Instrument Required", page_validation_observed: "At least have 1 item", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "currency_items", repeat_contract: "items[]", runner_aliases: ["monetary_instrument", "instrument", "currency_item_monetary_instrument"], ...CANONICAL_OPTION_RULES }) },
  { field_name: "currency_amount", label: "Amount", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 61, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币金额", { official: true, official_key: "amount", official_control_type: "text", customs_contract: "currency_item_detail", modal_behavior: "Add Item repeat row", empty_validation_observed: "Amount Required", page_validation_observed: "At least have 1 item", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "currency_items", repeat_contract: "items[]", runner_aliases: ["amount", "currency_item_amount"], pattern: "^[0-9]+(\\.[0-9]{1,2})?$" }) },
  { field_name: "bsp_authorization_date", label: "Date of BSP authorization if transferring Philippine Pesos in excess of PHP50,000", field_type: "date", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 62, conditional_logic: showIf(HAS_PHP_CURRENCY_DECLARATION), validation_rules: rules("菲律宾央行授权日期", { official: true, official_key: "bsp_authorization_date", official_control_type: "date_picker", customs_contract: "php_currency_positive_detail", selector_evidence_level: "confirmed_live_visible_air_positive", ...CANONICAL_DATE_RULES, evidence_level: "needs_review_requiredness" }) },
  { field_name: "currency_source", label: "Sources of currencies or monetary instruments", field_type: "checkbox", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 63, options: PH_ETRAVEL_CURRENCY_SOURCE_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币来源", { official: true, official_key: "currency_sources", official_control_type: "checkbox_list", customs_contract: "currency_source_array", base_requiredness_evidence: "supported_by_page_validation_text_not_promoted_to_field_required", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "currency_sources", runner_aliases: ["currency_sources", "source_of_currency"], official_values_evidence: "PH-A live logged-in UI DOM values", ...CANONICAL_OPTION_RULES }) },
  { field_name: "currency_source_other", label: "Other Source of Currency", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 64, conditional_logic: showIf(HAS_OTHER_CURRENCY_SOURCE), validation_rules: rules("其他货币来源", { official: true, official_key: "currency_source_other", official_control_type: "text", customs_contract: "currency_source_array_other", empty_validation_observed: "Required", validated_required_when: "currency_source includes OTHER", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", maxLength: 160 }) },
  { field_name: "currency_transport_purpose", label: "Purpose's of the Transport of Foreign Currencies or Other Foreign Currency-Denominated Bearer Monetary Instruments", field_type: "checkbox", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 65, options: PH_ETRAVEL_CURRENCY_PURPOSE_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("携带 / 运输货币目的", { official: true, official_key: "transport_purposes", official_control_type: "checkbox_list", customs_contract: "currency_purpose_array", base_requiredness_evidence: "supported_by_page_validation_text_not_promoted_to_field_required", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", repeatable: true, repeat_group: "transport_purposes", runner_aliases: ["currency_transport_purposes", "purpose_of_currency_transport"], official_values_evidence: "PH-A live logged-in UI DOM values", ...CANONICAL_OPTION_RULES }) },
  { field_name: "currency_transport_purpose_other", label: "Other Purpose", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 66, conditional_logic: showIf(HAS_OTHER_CURRENCY_PURPOSE), validation_rules: rules("其他携带 / 运输目的", { official: true, official_key: "transport_purpose_other", official_control_type: "text", customs_contract: "currency_purpose_array_other", empty_validation_observed: "Required", validated_required_when: "currency_transport_purpose includes OTHER", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", maxLength: 160 }) },
  { field_name: "currency_transport_method", label: "Currency Transport Method", field_type: "radio", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 67, options: PH_ETRAVEL_CURRENCY_TRANSPORT_METHOD_OPTIONS, conditional_logic: showIf(HAS_CURRENCY_DECLARATION), validation_rules: rules("货币运输方式", { official: true, official_key: "physical_or_shipped", official_control_type: "radio", customs_contract: "currency_transfer_method", base_requiredness_evidence: "courier_child_validation_observed; base method otherwise needs_review", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["currency_transfer_method", "currency_physical_or_courier"], ...CANONICAL_OPTION_RULES }) },
  { field_name: "courier_name", label: "Name of Courrier/ Courrier Company", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 68, conditional_logic: showIf(HAS_COURIER_TRANSFER), validation_rules: rules("快递 / 货运公司名称", { official: true, official_key: "courier_name", official_control_type: "text", customs_contract: "courier_currency_detail", empty_validation_observed: "Required", validated_required_when: "currency_transport_method === is_shipped_thru_courier_service", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", maxLength: 160 }) },
  { field_name: "airway_bill_no", label: "Bill of landing/Airway Bill No.", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 69, conditional_logic: showIf(HAS_COURIER_TRANSFER), validation_rules: rules("提单 / 空运单号", { official: true, official_key: "airway_bill_no", official_control_type: "text", customs_contract: "courier_currency_detail", empty_validation_observed: "Required", validated_required_when: "currency_transport_method === is_shipped_thru_courier_service", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", runner_aliases: ["airway_bill_number"], runner_plan_key: "airway_bill_number", maxLength: 80 }) },
  { field_name: "airway_bill_date", label: "Bill of landing/Airway Bill Date", field_type: "date", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 70, conditional_logic: showIf(HAS_COURIER_TRANSFER), validation_rules: rules("提单 / 空运单日期", { official: true, official_key: "airway_bill_date", official_control_type: "date_picker", customs_contract: "courier_currency_detail", empty_validation_observed: "Required", validated_required_when: "currency_transport_method === is_shipped_thru_courier_service", selector_evidence_level: "confirmed_live_visible_air_positive", evidence_level: "needs_review_requiredness", ...CANONICAL_DATE_RULES }) },
  { field_name: "no_of_days_in_philippines", label: "No. of days in the Philippines", field_type: "text", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 71, conditional_logic: showIf(HAS_PHYSICAL_TRANSFER), validation_rules: rules("在菲律宾停留天数", { official: true, official_key: "no_of_days_in_philippines", official_control_type: "text", customs_contract: "physical_currency_detail", selector_evidence_level: "confirmed_live_visible_air_positive_and_sea_electronic_positive", physical_branch_empty_validation: "Required", validated_required_when: "currency_transport_method === is_physically_transferred_by_person", requiredness_evidence: "verified_live_sea_electronic_positive_physical_branch_only", pattern: "^[0-9]+$", evidence_level: "needs_review_requiredness" }) },
  { field_name: "last_travel_to_philippines", label: "Last travel to the Philippines", field_type: "date", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 72, conditional_logic: showIf(HAS_PHYSICAL_TRANSFER), validation_rules: rules("上次来菲律宾日期", { official: true, official_key: "last_travel_to_philippines", official_control_type: "date_picker", customs_contract: "physical_currency_detail", selector_evidence_level: "confirmed_live_visible_air_positive_and_sea_electronic_positive", physical_branch_empty_validation: "Required", validated_required_when: "currency_transport_method === is_physically_transferred_by_person", requiredness_evidence: "verified_live_sea_electronic_positive_physical_branch_only", ...CANONICAL_DATE_RULES, evidence_level: "needs_review_requiredness" }) },
];

export const PH_ETRAVEL_FORM_FIELDS: PhEtravelFieldDef[] = [
  { field_name: "registration_for", label: "Travel Registration", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 1, options: FOR_WHOM_OPTIONS, validation_rules: rules("登记对象", { official: true, e19_live_labels: ["FOR ME (Current User)", "FOR OTHER (Family Member)"], e19_for_other_observed: true, requiredness_evidence: "generic_Required_not_attributable_to_registration_for", launch_gate: "needs_review_not_a_runner_authorization" }) },
  { field_name: "transport_type", label: "Mode of Travel", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 2, options: PH_ETRAVEL_TRANSPORT_TYPES, validation_rules: rules("交通方式", { official: true, official_key: "transportation_type", supported_v1: ["AIR", "SEA"], unsupported_v1: ["LAND"] }) },
  { field_name: "flight_type", label: "Direction of Travel", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 3, options: ARRIVAL_ONLY_OPTIONS, validation_rules: rules("旅行方向", { official: true, official_key: "flight_type", official_control_type: "radio", fixed_value: "ARRIVAL", ui_locked: true, locked_for_product: PH_ETRAVEL_VISA_TYPE, official_visible_values: ["ARRIVAL", "DEPARTURE"], excluded_value: "DEPARTURE", departure_product: "PH_ETRAVEL_DEPARTURE_CARD", official_payload_status: "needs_review_fixed_arrival_registration_context", requiredness_evidence: "confirmed_live_2026_08_15_Travel_Registration", ...CANONICAL_OPTION_RULES }) },
  { field_name: "registration_data_privacy_affidavit_consent", label: "Data Privacy and Affidavit Consent", field_type: "checkbox", required: true, step_number: 1, step_name: "Travel Registration", display_order: 4, validation_rules: rules("数据隐私与宣誓同意", { official: false, viza_audit: true, exclude_from_official_payload: true, enqueue_required_value: true, covers: ["data_privacy", "affidavit"], evidence: "confirmed_live_2026_08_15_Continue_copy", clear_on_change: "none" }) },

  { field_name: "first_name", label: "First Name", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 1, validation_rules: rules("名", { maxLength: 60, official: true, official_key: "first_name", official_control_type: "text", block_group: "passport_name", selector_evidence_level: "confirmed_live_E19", requiredness_evidence: "E19_empty_Foreigner_validation_First_Name_Required", evidence_level: "verified_live_E19" }) },
  { field_name: "middle_name", label: "Middle Name", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 2, validation_rules: rules("中间名", { maxLength: 60, official: true, official_key: "middle_name", official_control_type: "text", block_group: "passport_name", selector_evidence_level: "confirmed_live_E19", requiredness_evidence: "E19_live_label_optional", evidence_level: "verified_live_E19" }) },
  { field_name: "last_name", label: "Last Name", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 3, validation_rules: rules("姓", { maxLength: 60, official: true, official_key: "last_name", official_control_type: "text", block_group: "passport_name", selector_evidence_level: "confirmed_live_E19", requiredness_evidence: "E19_live_label_optional", evidence_level: "verified_live_E19" }) },
  { field_name: "suffix", label: "Suffix", field_type: "select", required: false, step_number: 2, step_name: "Traveller Information", display_order: 4, options: PH_ETRAVEL_SUFFIX_OPTIONS, validation_rules: rules("姓名后缀", { official: true, official_key_candidate: "extension_name", official_control_type: "text_or_select", block_group: "passport_name", selector_evidence_level: "confirmed_live_E19", requiredness_evidence: "E19_live_label_optional", complete_option_list_evidence_level: "needs_review", evidence_level: "verified_live_E19" }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 5, validation_rules: rules("出生日期", { official: true, official_key: "birth_date", ...CANONICAL_DATE_RULES }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 6, options: PH_ETRAVEL_SEX_OPTIONS, validation_rules: rules("性别", { official: true, official_key: "gender", official_control_type: "react_select", selector_evidence_level: "confirmed_live_E19", e26_live_values: ["FEMALE", "MALE"], requiredness_evidence: "E19_empty_Foreigner_validation_Sex_Required", evidence_level: "verified_live_E19", ...CANONICAL_OPTION_RULES, canonical_values: ["MALE", "FEMALE"] }) },
  { field_name: "passport_holder_type", label: "Nationality", field_type: "radio", required: true, step_number: 2, step_name: "Traveller Information", display_order: 7, options: PH_ETRAVEL_PASSPORT_HOLDER_OPTIONS, validation_rules: rules("护照持有人类型", { official: true, official_key: "nationality", official_control_type: "radio", e19_live_labels: ["PHILIPPINE PASSPORT Holder", "FOREIGN PASSPORT Holder"], e19_live_values: ["FILIPINO", "FOREIGNER"], e26_default_value: "FILIPINO", e21_clear_on_change: ["traveler_type", "occupation_type"], selector_evidence_level: "confirmed_live_E19", requiredness_evidence: "default_Filipino_selection_no_omitted_persona_error", supported_v1: ["FILIPINO", "FOREIGNER"], excluded_v1: ["DIPLOMAT", "DIGNITARY", "SPECIAL", "OFFICIAL_EXEMPT"], ...CANONICAL_OPTION_RULES }) },
  { field_name: "nationality", label: "Citizenship", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 8, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("公民身份", { official: true, official_control_type: "combobox", option_identity: "code", option_label_projection: "nationality", display_label_evidence: "E26_live_Citizenship_uses_nationality_or_demonym", ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "country_of_birth", label: "Country of Birth", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 9, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("出生国家 / 地区", { official: true, official_control_type: "combobox", option_identity: "code", option_label_projection: "name", display_label_evidence: "E26_live_Country_of_Birth_uses_country_name", ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "occupation", label: "Occupation", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 10, options: PH_ETRAVEL_OCCUPATION_OPTIONS, validation_rules: rules("职业", { official: true, ...CANONICAL_OPTION_RULES }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 11, validation_rules: rules("护照号码", { maxLength: 20, official: true, official_key: "passport_number" }) },
  { field_name: "passport_issuing_authority", label: "Passport Issuing Authority", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 12, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("护照签发机关 / 国家", { official: true, official_control_type: "combobox", option_identity: "code", option_label_projection: "name", display_label_evidence: "E26_live_Passport_Issuing_Authority_uses_country_name", ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "passport_issue_date", label: "Passport Issued Date", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 13, validation_rules: rules("护照签发日期", { official: true, official_key: "passport_issued_date", ...CANONICAL_DATE_RULES }) },
  { field_name: "passport_expiry_date", label: "Passport Expiry Date", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 14, validation_rules: rules("护照有效期至", { official: true, ...CANONICAL_DATE_RULES }) },
  { field_name: "mobile_country_code", label: "Mobile Country Code", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 16, placeholder: "e.g. 86", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[+0-9]{1,5}$", official: true, e21_status: "preexisting_VIZA_field_not_an_official_personal_profile_payload_key", evidence_level: "needs_review" }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 17, validation_rules: rules("手机号码", { official: true, official_key: "mobile_number", official_control_type: "phone_picker", client_wiring: PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.mobile_number, client_requiredness_evidence: "E21_personal_Yup_shape_does_not_include_mobile_number", server_requiredness_evidence: "needs_review", evidence_level: "needs_review" }) },
  { field_name: "country_of_residence", label: "Permanent Country of Residence", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 18, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("永久居住国家 / 地区", { official: true, official_key: "country_code", block_group: "residence_address", client_wiring: PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.residence, client_requiredness_evidence: "E21_profile_Yup_requires_country_code", server_requiredness_evidence: "needs_review", clear_on_change: PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.residence.country_change_clears, ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "residence_province_code", label: "State/Province", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 19, conditional_logic: showIf(IS_PH_RESIDENCE), validation_rules: rules("州 / 省", { official: true, official_key: "province_code", official_control_type: "combobox", block_group: "residence_address", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.provinces, option_identity: "code", label_identity: "name", client_requiredness_evidence: "E21_profile_Yup_requires_province_code_when_country_code_PH", server_requiredness_evidence: "needs_review", clear_on_change: ["region_code", "residence_municipality_code", "residence_barangay_code"], ...CANONICAL_OPTION_RULES }) },
  { field_name: "residence_municipality_code", label: "City/Municipality", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 20, conditional_logic: showIf(IS_PH_RESIDENCE), validation_rules: rules("城市 / 市镇", { official: true, official_key: "municipality_code", official_control_type: "combobox", block_group: "residence_address", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.municipalities, option_identity: "code", label_identity: "name", depends_on: "residence_province_code", request_parameter: "province_code", client_requiredness_evidence: "E21_profile_Yup_requires_municipality_code_when_country_code_PH", server_requiredness_evidence: "needs_review", clear_on_change: ["residence_barangay_code"], ...CANONICAL_OPTION_RULES }) },
  { field_name: "residence_barangay_code", label: "Barangay", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 21, conditional_logic: showIf(IS_PH_RESIDENCE), validation_rules: rules("Barangay", { official: true, official_key: "barangay_code", official_control_type: "combobox", block_group: "residence_address", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.barangays, option_identity: "code", label_identity: "name", depends_on: "residence_municipality_code", request_parameter: "municipality_code", client_requiredness_evidence: "E21_profile_Yup_requires_barangay_code_when_country_code_PH", server_requiredness_evidence: "needs_review", ...CANONICAL_OPTION_RULES }) },
  { field_name: "residence_address_line1", label: "No./Bldg./City/State/Province", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 22, validation_rules: rules("门牌 / 楼宇 / 街道或城市 / 州省", { maxLength: 160, official: true, official_key: "street", block_group: "residence_address", labels_by_residence_country: { PH: "House No./Bldg./Street", non_PH: "No./Bldg./City/State/Province" }, client_requiredness_evidence: "E21_profile_Yup_requires_street_in_PH_and_non_PH_branches", server_requiredness_evidence: "needs_review", clear_on_change: "country_code" }) },
  { field_name: "residence_address_line2", label: "Address Line 2", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 23, validation_rules: rules("地址第二行", { maxLength: 160, official: true, official_key: "street_two", block_group: "residence_address", client_optional_evidence: "E21_profile_Yup_street_two_optional", server_requiredness_evidence: "needs_review", clear_on_change: "country_code" }) },

  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 1, options: PH_ETRAVEL_PURPOSE_OPTIONS, validation_rules: rules("旅行目的", { official: true, official_key: "purpose_of_visit_code", ...CANONICAL_OPTION_RULES }) },
  { field_name: "traveller_type", label: "Traveller Type", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 2, options: PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS, validation_rules: rules("旅客类型", { official: true, official_key: "passenger_type", supported_v1: ["AIRCRAFT PASSENGER", "VESSEL PASSENGER"], excluded_v1: PH_ETRAVEL_UNSUPPORTED_ARRIVAL_TRAVELLER_TYPE_OPTIONS.map((item) => item.value), allowed_by_transport: { AIR: ["AIRCRAFT PASSENGER"], SEA: ["VESSEL PASSENGER"] }, sea_observed_dropdown_values: ["VESSEL CREW", "VESSEL PASSENGER"], unsupported_observed_but_not_seeded: ["VESSEL CREW"], cruise_route: "separate_dashboard_route_not_ordinary_sea_dropdown", ...CANONICAL_OPTION_RULES }) },
  { field_name: "airline_name", label: "Name of Airline", field_type: "select", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 3, conditional_logic: showIf(IS_AIR), validation_rules: rules("航空公司名称", { official: true, official_key: "travel_company_code", transport_branch: "AIR", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.air_travel_companies, option_identity: "code", label_identity: "name", client_requiredness: "public_bundle_only", server_requiredness: "needs_review", client_clear_on_change: ["flight_number", "flight_number_special", "destination_port_code"], ...CANONICAL_OPTION_RULES }) },
  { field_name: "flight_number", label: "Flight Number", field_type: "select", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 5, options: PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS, conditional_logic: showIf(IS_AIR), validation_rules: rules("航班号", { official: true, official_key: "flight_number", transport_branch: "AIR", dependsOn: "airline_name", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.air_flight_numbers, option_identity: "flight_number", label_identity: "flight_number", special_flight_sentinel: "SPECIAL FLIGHT", selected_option_metadata_sets: "destination_port_code <- travel_port_code", client_requiredness: "public_bundle_only", server_requiredness: "needs_review" }) },
  { field_name: "flight_number_special", label: "Specify Special Flight Number", field_type: "text", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 5.5, conditional_logic: showIf("transport_type === AIR && flight_number === SPECIAL FLIGHT"), validation_rules: rules("特殊航班号", { official: true, official_key: "flight_number_special", transport_branch: "AIR", derived_ui_state: "flight_number === SPECIAL FLIGHT", not_an_official_boolean: "is_special_flight", uppercase: true, minLength: 5, client_requiredness: "public_bundle_only_when_flight_number_is_SPECIAL_FLIGHT", server_requiredness: "needs_review", evidence_level: "verified_public_bundle" }) },
  { field_name: "vessel_name", label: "Vessel Name", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 6, conditional_logic: showIf(IS_SEA), validation_rules: rules("船舶名称", { official: true, official_key: "vessel_name", transport_branch: "SEA", maxLength: 160 }) },
  { field_name: "voyage_number", label: "Voyage Number", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 7, conditional_logic: showIf(IS_SEA), validation_rules: rules("航次号", { official: true, official_key: "flight_number", transport_branch: "SEA", product_alias: true, evidence_level: "verified_live", observed_path: "SEA + ARRIVAL + is_disembarking=true + VESSEL PASSENGER", uncovered_paths: ["VESSEL CREW", "CRUISE PASSENGER", "CRUISE CREW"], uncovered_paths_evidence_level: "needs_review", maxLength: 80 }) },
  { field_name: "origin_country", label: "Country of Origin", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 8, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("出发国家 / 地区", { official: true, official_key: "origin_country_code", client_excludes_country_code: "PH", client_requiredness: "public_bundle_only", server_requiredness: "needs_review", ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "airport_of_origin", label: "Airport of Origin", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 9, conditional_logic: showIf(IS_AIR), validation_rules: rules("出发机场", { maxLength: 120, official: true, official_key: "origin_port", official_label_key: "port_origin", transport_branch: "AIR" }) },
  { field_name: "seaport_of_origin", label: "Seaport of Origin", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 10, conditional_logic: showIf(IS_SEA), validation_rules: rules("出发海港", { maxLength: 160, official: true, official_key: "origin_port", official_label_key: "port_origin", transport_branch: "SEA", evidence_level: "needs_review_options" }) },
  { field_name: "flight_departure_date", label: "Date of Departure of Flight", field_type: "date", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 11, conditional_logic: showIf(IS_AIR), validation_rules: rules("入境航班起飞日期", { inline_group: "ph_etravel_air_dates", official: true, official_key: "departure_date", transport_branch: "AIR", ...CANONICAL_DATE_RULES }) },
  { field_name: "flight_arrival_date", label: "Date of Arrival of Flight", field_type: "date", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 12, conditional_logic: showIf(IS_AIR), validation_rules: rules("入境航班抵达日期", { inline_group: "ph_etravel_air_dates", official: true, official_key: "arrival_date", transport_branch: "AIR", ...CANONICAL_DATE_RULES }) },
  { field_name: "voyage_departure_date", label: "Date of Departure of Voyage", field_type: "date", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 13, conditional_logic: showIf(IS_SEA), validation_rules: rules("入境船舶离港日期", { inline_group: "ph_etravel_sea_dates", official: true, official_key: "departure_date", transport_branch: "SEA", product_alias: true, evidence_level: "verified_live", observed_path: "SEA + ARRIVAL + is_disembarking=true + VESSEL PASSENGER", uncovered_paths: ["VESSEL CREW", "CRUISE PASSENGER", "CRUISE CREW"], uncovered_paths_evidence_level: "needs_review", ...CANONICAL_DATE_RULES }) },
  { field_name: "voyage_arrival_date", label: "Date of Arrival of Voyage", field_type: "date", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 14, conditional_logic: showIf(IS_SEA), validation_rules: rules("入境船舶抵港日期", { inline_group: "ph_etravel_sea_dates", official: true, official_key: "arrival_date", transport_branch: "SEA", product_alias: true, evidence_level: "verified_live", observed_path: "SEA + ARRIVAL + is_disembarking=true + VESSEL PASSENGER", uncovered_paths: ["VESSEL CREW", "CRUISE PASSENGER", "CRUISE CREW"], uncovered_paths_evidence_level: "needs_review", ...CANONICAL_DATE_RULES }) },
  { field_name: "return_date", label: "Date of Return", field_type: "date", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 15, conditional_logic: showIf("(transport_type === AIR && passport_holder_type === FOREIGNER && (purpose_of_travel === POV001 || purpose_of_travel === POV007)) || (transport_type === SEA && purpose_of_travel === POV001)"), validation_rules: rules("返回日期", { official: true, official_key: "return_date", evidence_level: "verified_live_and_public_bundle_path_specific", observed_path: "SEA + ARRIVAL + is_disembarking=true + VESSEL PASSENGER + Holiday/Pleasure/Vacation", air_public_bundle_condition: "FOREIGNER + AIR + (POV001 || POV007)", client_minimum_divergence: "renderer_today_vs_Yup_travel_date", client_requiredness: "public_bundle_only", server_requiredness: "needs_review", not_air_only: true, uncovered_purposes_evidence_level: "needs_review", ...CANONICAL_DATE_RULES }) },
  { field_name: "port_of_entry", label: "Airport of Destination in the Philippines", field_type: "select", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 16, conditional_logic: showIf(IS_AIR), validation_rules: rules("菲律宾目的机场 / 入境机场", { official: true, official_key: "destination_port_code", transport_branch: "AIR", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.air_destination_ports, option_identity: "code", label_identity: "name", port_metadata_field: "with_custom_declaration", port_metadata_contract: "dynamic_metadata_only_not_schema_requiredness_or_air_customs_flow", client_requiredness: "public_bundle_only", server_requiredness: "needs_review", ...CANONICAL_OPTION_RULES }) },
  { field_name: "sea_port_of_entry", label: "Seaport of Destination in the Philippines", field_type: "select", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 17, options: PH_ETRAVEL_SEA_PORT_OPTIONS, conditional_logic: showIf(`${IS_SEA} && ${ARRIVAL_FLIGHT_TYPE}`), validation_rules: rules("菲律宾目的海港 / 入境海港", { official: true, official_key: "destination_port_code", transport_branch: "SEA", product_alias: true, distinct_from: "disembarking_port_code", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_destination_ports, option_identity: "code", label_identity: "name_not_unique", port_metadata_field: "with_custom_declaration", port_metadata_contract: "dynamic_page_gate_only_not_schema_requiredness_or_port_to_customs_flow", regular_page_gate: "registration.travel_port.with_custom_declaration", customs_hook_source_shape: "registration.with_custom_declaration", manual_electronic_mapping: "needs_review", route_selection: "needs_review_regular_vs_declaration_shortcut", client_requiredness: "public_bundle_only", server_requiredness: "needs_review", ...CANONICAL_OPTION_RULES, evidence_level: "verified_live_and_public_bundle_path_specific", observed_path: "SEA + ARRIVAL + VESSEL PASSENGER page 0; E6 disembarking/manual path and E8 Manila South Harbor electronic path", option_value_evidence_level: "verified_public", selected_port_customs_flow_contract: "runtime_page_content_or_live_flow_not_applicant_field" }) },
  { field_name: "is_disembarking", label: "Are you disembarking?", field_type: "checkbox", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 18, conditional_logic: showIf(`${IS_SEA} && ${ARRIVAL_FLIGHT_TYPE}`), validation_rules: rules("是否下船", { official: true, official_key: "is_disembarking", official_control_type: "checkbox_boolean", transport_branch: "SEA", path_specific: true, client_default: false, client_visible_when: `${IS_SEA} && ${ARRIVAL_FLIGHT_TYPE}`, client_clear_when: ["transport_type === AIR", "flight_type === DEPARTURE"], client_clear_value: false, falsey_destination_subtree: "hidden", is_disembarking_clear_callback: "none_observed", client_requiredness: "needs_review", server_requiredness: "needs_review", evidence_level: "verified_public_bundle", observed_path: "E6 selected SEA passenger path displayed disembarking branch", hidden_observed_path: "E8 SEA + VESSEL PASSENGER + Manila South Harbor electronic path did not display is_disembarking before Health", non_disembarking_path_evidence_level: "needs_review" }) },
  { field_name: "with_transit", label: "With Transit (Connecting Flight/Voyage)?", field_type: "checkbox", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 19, validation_rules: rules("是否有中转 / 联程航班或航程", { official: true, official_key: "with_transit", transport_branch: "AIR_SEA", boolean_contract: "checkbox_true_false", public_bundle_name_and_id: "with_transit", client_clear_on_toggle: "does_not_clear_existing_children", server_requiredness: "needs_review" }) },
  { field_name: "transit_country", label: "Country of Transit", field_type: "select", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 20, options: PH_ETRAVEL_COUNTRY_OPTIONS, conditional_logic: showIf(HAS_TRANSIT), validation_rules: rules("中转国家 / 地区", { official: true, official_key: "transit_country_code", block_group: "transit_details", transport_branch: "AIR_SEA", client_excludes_country_code: "PH", client_requiredness: "public_bundle_only_when_with_transit", server_requiredness: "needs_review", ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "transit_airport", label: "Airport of Transit", field_type: "text", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 21, conditional_logic: showIf(HAS_AIR_TRANSIT), validation_rules: rules("中转机场", { maxLength: 120, uppercase: true, official: true, official_key: "transit_port", official_label_key: "port_transit", block_group: "transit_details", transport_branch: "AIR", client_requiredness: "public_bundle_only_when_with_transit", server_requiredness: "needs_review" }) },
  { field_name: "transit_seaport", label: "Seaport of Transit", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 22, conditional_logic: showIf(HAS_SEA_TRANSIT), validation_rules: rules("中转海港", { maxLength: 160, official: true, official_key: "transit_port", official_label_key: "port_transit", block_group: "transit_details", transport_branch: "SEA", evidence_level: "needs_review_options" }) },
  { field_name: "transit_date", label: "Date of Transit", field_type: "date", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 23, conditional_logic: showIf(HAS_TRANSIT), validation_rules: rules("中转日期", { official: true, official_key: "transit_date", block_group: "transit_details", transport_branch: "AIR_SEA", client_requiredness: "public_bundle_only_when_with_transit", server_requiredness: "needs_review", ...CANONICAL_DATE_RULES }) },

  { field_name: "destination_type", label: "Destination upon arrival in the Philippines", field_type: "radio", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 1, options: PH_ETRAVEL_DESTINATION_TYPE_OPTIONS, conditional_logic: showIf(DESTINATION_SECTION_ACTIVE), validation_rules: rules("抵达菲律宾后的目的地类型", { official: true, official_key: "stay_location_type", allowed_by_transport: { AIR: ["RESIDENCE", "HOTEL", "TRANSIT"], SEA: ["RESIDENCE", "HOTEL", "TRAVEL_PORT"] }, client_clear_on_change: ["destination_upon_arrival_in_philippines", "transit_port_code", "transit_destination_country_code", "is_destination_same_as_permanent_address"], client_requiredness: "public_bundle_only", server_requiredness: "needs_review", sea_condition: "shown only when is_disembarking === yes; E8 SEA electronic page 0 omitted stay-destination UI", evidence_level: "verified_live_path_specific", observed_path: "SEA + ARRIVAL + is_disembarking=true + VESSEL PASSENGER", hidden_observed_path: "E8 SEA + VESSEL PASSENGER + Manila South Harbor electronic path did not show stay-destination UI", non_disembarking_path_evidence_level: "needs_review", ...CANONICAL_OPTION_RULES }) },
  { field_name: "destination_same_as_residence", label: "Same as Permanent Country of Residence", field_type: "checkbox", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 2, conditional_logic: showIf(DESTINATION_RESIDENCE), validation_rules: rules("与永久居住地址相同", { official: true, official_key: "is_destination_same_as_permanent_address", boolean_contract: "checkbox_true_false", client_true_value_writes: "destination_upon_arrival_in_philippines <- profile display address", client_false_value_clears: "destination_upon_arrival_in_philippines", server_requiredness: "needs_review", evidence_level: "verified_public_bundle" }) },
  { field_name: "destination_residence_address", label: "Residence Address", field_type: "textarea", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 3, conditional_logic: showIf(DESTINATION_RESIDENCE), validation_rules: rules("菲律宾居住地址", { maxLength: 240, official: true, official_key: "destination_upon_arrival_in_philippines", official_label_key: "destination_upon_arrival_in_the_philippines", client_requiredness: "public_bundle_only_when_RESIDENCE", server_requiredness: "needs_review" }) },
  { field_name: "destination_hotel_name", label: "Hotel, Resorts, AirBnB, Tourist destinations, etc.", field_type: "text", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 4, conditional_logic: showIf(DESTINATION_HOTEL), validation_rules: rules("酒店 / 度假村 / 民宿 / 旅游目的地名称", { maxLength: 160, official: true, official_key: "destination_upon_arrival_in_philippines", official_label_key: "destination_upon_arrival_in_the_philippines", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.hotels, option_identity: "no_stable_hotel_code_observed", label_identity: "name", client_selected_display: "name, region_name, city", client_requiredness: "public_bundle_only_when_HOTEL", server_requiredness: "needs_review" }) },
  { field_name: "destination_hotel_address", label: "Hotel/Resort Address", field_type: "textarea", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 5, conditional_logic: showIf(DESTINATION_HOTEL), validation_rules: rules("酒店 / 度假村地址", { maxLength: 240, official: false, schema_status: "product_alias_without_E22_official_input_key", evidence_level: "needs_review" }) },
  { field_name: "destination_transit_airport", label: "Airport", field_type: "select", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 6, conditional_logic: showIf(DESTINATION_AIR_TRANSIT), options: PH_ETRAVEL_AIR_TRANSIT_PORT_OPTIONS, validation_rules: rules("菲律宾过境机场", { official: true, official_key: "transit_port_code", transport_branch: "AIR", fixed_public_bundle_values: ["TP1000", "TP2000", "TP3000", "TP001"], client_requiredness: "public_bundle_only_when_TRANSIT", server_requiredness: "needs_review", ...CANONICAL_OPTION_RULES }) },
  { field_name: "destination_country", label: "Country of Destination", field_type: "select", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 7, options: PH_ETRAVEL_COUNTRY_OPTIONS, conditional_logic: showIf(DESTINATION_AIR_TRANSIT), validation_rules: rules("最终目的国家 / 地区", { official: true, official_key: "transit_destination_country_code", transport_branch: "AIR", client_excludes_country_code: "PH", client_requiredness: "public_bundle_only_when_TRANSIT", server_requiredness: "needs_review", ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "disembarking_port_code", label: "Port of Disembarkation", field_type: "select", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 8, conditional_logic: showIf(DESTINATION_SEA_TRAVEL_PORT), options: PH_ETRAVEL_SEA_PORT_OPTIONS, validation_rules: rules("下船港口", { official: true, official_key: "disembarking_port_code", transport_branch: "SEA", distinct_from: "destination_port_code", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_disembarking_ports, option_identity: "code", label_identity: "name_not_unique", source_transportation_filter: "none", client_requiredness: "public_bundle_only_inside_SEA_TRAVEL_PORT", server_requiredness: "needs_review", port_metadata_contract: "does_not_select_customs_flow", fixes_contract_gap: "TRAVEL_PORT_child_field", evidence_level: "verified_live_and_public_bundle_path_specific", observed_path: "SEA + ARRIVAL + is_disembarking=true + TRAVEL_PORT branch", hidden_observed_path: "E8 SEA electronic page 0 used destination_port_code and did not show TRAVEL_PORT/disembarking_port_code", ...CANONICAL_OPTION_RULES }) },

  { field_name: "with_negative_antigen", label: "Do you have a negative Antigen test taken within 24 hours prior to departure from your port of origin?", field_type: "radio", required: false, step_number: 5, step_name: "Health Declaration", display_order: 1, options: PH_ETRAVEL_HEALTH_BOOLEAN_OPTIONS, conditional_logic: showIf("is_fully_vaccinated !== true && calculated_age_from_birth_date >= 15"), validation_rules: rules("出发港离境前 24 小时内是否完成阴性抗原检测？", { official: true, official_key: "with_negative_antigen", official_control_type: "yes_no_radio_boolean", inherited_display_predicates: ["is_fully_vaccinated !== true", "calculated_age_from_birth_date >= 15"], client_requiredness: "not_in_E23_Yup_shape", client_change_sets: "is_with_history_exposure <- false", server_requiredness: "needs_review", test_document_contract: "no_E23_control_upload_or_file_rule", evidence_level: "verified_public_bundle" }) },
  { field_name: "has_recent_travel_history_30d", label: "Do you have any recent travel history in the last 30 days?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 2, options: PH_ETRAVEL_HEALTH_BOOLEAN_OPTIONS, validation_rules: rules("过去 30 天是否有近期旅行史？", { official: true, official_client_control_key: "meta.with_recent_travel_history", legacy_official_alias: "with_recent_travel_history", official_payload_key: "needs_review", official_control_type: "yes_no_radio_boolean", requiredness_evidence: "official_health_screenshot_2026-08-15", client_requiredness: "verified_screenshot_required", client_false_clears: ["visited_countries"], server_requiredness: "needs_review", evidence_level: "verified_live_screenshot" }) },
  { field_name: "visited_country_30d", label: "Country(ies) worked, visited and transited in the last 30 days", field_type: "select", required: true, step_number: 5, step_name: "Health Declaration", display_order: 3, options: PH_ETRAVEL_COUNTRY_OPTIONS, conditional_logic: showIf(HAS_RECENT_TRAVEL), validation_rules: rules("过去 30 天工作、访问或过境的国家 / 地区", { official: true, official_client_control_key: "visited_countries", official_payload_key: "needs_review", official_control_type: "repeatable_country_select_rows", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.countries, option_identity: "code", label_identity: "name", component_exclusion_filter: "none_observed_includes_PH", requiredness_evidence: "official_health_screenshot_2026-08-15", client_requiredness: "verified_screenshot_minimum_one_row_when_recent_travel_true", client_cleared_by: "has_recent_travel_history_30d === false", clear_on_condition_false: true, server_requiredness: "needs_review", repeatable: true, repeat_group: "visited_countries", repeat_actions: ["Add", "Delete"], min_items: 1, item_required: true, evidence_level: "verified_live_screenshot", ...CANONICAL_COUNTRY_RULES }) },
  { field_name: "has_exposure_to_sick_person_30d", label: "Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 4, options: PH_ETRAVEL_HEALTH_BOOLEAN_OPTIONS, validation_rules: rules("出行前 30 天是否接触过患病或已知患有传染性 / 感染性疾病的人？", { official: true, official_key: "is_with_history_exposure", official_control_type: "yes_no_radio_boolean", requiredness_evidence: "official_health_screenshot_2026-08-15", client_requiredness: "verified_screenshot_required", client_child_contract: "no_child_rendered_in_screenshot", server_requiredness: "needs_review", evidence_level: "verified_live_screenshot" }) },
  { field_name: "has_been_sick_30d", label: "Have you been sick in the past 30 days?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 5, options: PH_ETRAVEL_HEALTH_BOOLEAN_OPTIONS, validation_rules: rules("过去 30 天是否生病？", { official: true, official_key: "is_sicked_within_thirty_days", official_control_type: "yes_no_radio_boolean", requiredness_evidence: "official_health_screenshot_2026-08-15", client_requiredness: "verified_screenshot_required", client_change_clears: ["sickness_symptoms"], server_requiredness: "needs_review", evidence_level: "verified_live_screenshot" }) },
  { field_name: "sickness_symptom", label: "Symptoms", field_type: "checkbox", required: true, step_number: 5, step_name: "Health Declaration", display_order: 6, options: PH_ETRAVEL_SICKNESS_SYMPTOM_OPTIONS, conditional_logic: showIf(HAS_BEEN_SICK), validation_rules: rules("症状", { official: true, official_client_control_key: "sickness_symptoms", official_payload_key: "needs_review", official_control_type: "multi_select_checkboxes", dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sickness_symptoms, option_identity: "code", label_identity: "name", requiredness_evidence: "official_health_screenshot_2026-08-15", client_requiredness: "verified_screenshot_minimum_one_option_when_sick_true", client_cleared_by: "has_been_sick_30d === false", clear_on_condition_false: true, server_requiredness: "needs_review", repeatable: true, repeat_group: "sickness_symptoms", min_items: 1, max_items: 15, evidence_level: "verified_live_screenshot", ...CANONICAL_OPTION_RULES }) },

  { field_name: "accompanied_under_18_count", label: "Below 18 yrs. old", field_type: "text", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 2, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("18 岁以下同行家人人数", { official: true, official_key: "accompanied_family_members.below_eighteen", electronic_customs_path_only: true, pattern: "^[0-9]+$", inline_group: "family_counts" }) },
  { field_name: "accompanied_18_plus_count", label: "18 yrs. old and above", field_type: "text", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 3, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("18 岁及以上同行家人人数", { official: true, official_key: "accompanied_family_members.above_or_equal_eighteen", electronic_customs_path_only: true, pattern: "^[0-9]+$", inline_group: "family_counts" }) },
  { field_name: "checked_baggage_count", label: "Checked-in (pcs)", field_type: "text", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 7, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("托运行李件数", { official: true, official_key: "no_of_checked_in_baggages", electronic_customs_path_only: true, official_label_key: "no_of_baggage", pattern: "^[0-9]+$", inline_group: "baggage_counts" }) },
  { field_name: "handcarry_baggage_count", label: "Hand-carried (pcs)", field_type: "text", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 8, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("手提行李件数", { official: true, official_key: "no_of_hand_carried_baggages", electronic_customs_path_only: true, pattern: "^[0-9]+$", inline_group: "baggage_counts" }) },
  { field_name: "first_time_visiting_philippines", label: "First time visiting Philippines?", field_type: "radio", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 9, options: PH_ETRAVEL_YES_NO_OPTIONS, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("是否第一次访问菲律宾？", { official: true, official_key: "first_time_visit", electronic_customs_path_only: true }) },

  { field_name: "sea_manual_customs_forms_notice", label: "Kindly accomplish the manual forms for Customs Baggage Declaration and Currencies Declaration as prescribed by laws and regulations.", field_type: "static_notice", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 0, conditional_logic: showIf(SEA_MANUAL_CUSTOMS_FORMS), validation_rules: rules("SEA 手工海关 / 货币申报表提示", { official: true, evidence_level: "verified_live", observed_path: "SEA + ARRIVAL + is_disembarking=true selected port manual forms route", selected_port_customs_flow_contract: "derived_port_metadata_not_applicant_field", manual_forms_links: ["Baggage Declaration Form", "Currency Declaration Form"], not_electronic_customs_questions: true, unverified_variants: ["SEA_NON_DISEMBARKING", "SEA_OTHER_PORT_CUSTOMS_FLOW", "SEA_ELECTRONIC_POSITIVE_POST_SIGNATURE"] }) },
  { field_name: "customs_information_acknowledgement", label: "I confirm that I have read and understood the customs and currency declaration information above.", field_type: "checkbox", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 1, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("我确认已阅读并理解海关及货币申报说明", { official: true, boolean_contract: "checkbox_true_false", selected_port_customs_flow_contract: "derived_port_metadata_not_applicant_field", sea_electronic_observed_path: "E8 No and E10 Yes SEA + VESSEL PASSENGER + Manila South Harbor electronic confirmation", sea_electronic_positive_branch_evidence_level: "verified_live_through_signature_page", sea_electronic_positive_post_signature_evidence_level: "needs_review", requiredness_evidence: "needs_review", evidence_level: "verified_live_air_and_sea_electronic_confirmation" }) },
  { field_name: "has_baggage_or_currency_to_declare", label: "Do you have baggage or currency to declare?", field_type: "radio", required: false, step_number: 7, step_name: "Customs Declaration", display_order: 2, options: PH_ETRAVEL_YES_NO_OPTIONS, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("是否有行李或货币需要申报？", { official: true, official_key: "with_something_to_declare_arrival", official_control_type: "yes_no_button", customs_contract: "entry_gate_only_not_a_substitute_for_item_answers", selected_port_customs_flow_contract: "derived_port_metadata_not_applicant_field", sea_electronic_observed_path: "E8 No and E10 Yes SEA + VESSEL PASSENGER + Manila South Harbor electronic confirmation", sea_electronic_positive_branch_evidence_level: "verified_live_through_signature_page", sea_electronic_positive_post_signature_evidence_level: "needs_review", requiredness_evidence: "needs_review", evidence_level: "verified_live_air_and_sea_electronic_confirmation" }) },
  ...CUSTOMS_CHECKLIST_FIELDS,
  ...GOODS_DETAIL_FIELDS,
  ...CURRENCY_DETAIL_FIELDS,

  { field_name: "customs_signature", label: "Signature", field_type: "signature_pad", required: true, step_number: 8, step_name: "Declaration Attachments and Signature", display_order: 1, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("签名", { official: true, official_key: "signature", signature_source: "PAD", gate: "review_precondition", selected_port_customs_flow_contract: "derived_port_metadata_not_applicant_field", evidence_level: "verified_live_air_and_sea_electronic_signature_page_not_universal_sea", error_text_observed: ["Required", "Please make sure to fill out all required fields."], not_a_file_upload: true, sea_manual_forms_path: "not_shown_before_review", sea_electronic_observed_path: "E8/E9 SEA + VESSEL PASSENGER + Manila South Harbor no-declaration branch reached signature, Family gate, and Summary", sea_electronic_positive_observed_path: "E11 SEA + VESSEL PASSENGER + Manila South Harbor electronic Yes reached attachments and signature", sea_electronic_post_signature_evidence_level: "verified_live_no_declaration_path", sea_electronic_positive_branch_evidence_level: "verified_live_signature_page_required", sea_electronic_positive_post_signature_evidence_level: "needs_review", attachment_upload_copy_observed: "Take a photo or upload a file.", attachment_file_input_evidence_level: "needs_review_not_stably_observed", attachment_mime_size_requiredness: "needs_review", universal_sea_requiredness: "not_verified" }) },
  { field_name: "customs_signature_declaration", label: "By clicking Next, I certify under pain of falsification that this declaration is true and correct to the best of my knowledge.", field_type: "static_statement", required: false, step_number: 8, step_name: "Declaration Attachments and Signature", display_order: 2, conditional_logic: showIf(ELECTRONIC_CUSTOMS_FLOW), validation_rules: rules("签名前法律确认文案", { official: true, gate: "displayed_before_family_gate", evidence_level: "verified_live_air_and_sea_electronic_signature_page_not_universal_sea", not_a_checkbox: true }) },
  { field_name: "family_member_gate_confirmation", label: "You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion?", field_type: "confirmation_gate", required: true, step_number: 9, step_name: "Family Member(s)", display_order: 1, options: PH_ETRAVEL_FAMILY_COMPANION_GATE_OPTIONS, conditional_logic: showIf(NO_FAMILY_MEMBERS_SELECTED), validation_rules: rules("无同行家属确认", { official: true, official_step: "Family Member(s)", gate: "pre_review_family_member_gate", air_electronic_customs_sequence: "after_signature_before_review", sea_manual_forms_sequence: "after_manual_customs_notice_before_review", sea_electronic_no_declaration_sequence: "after_signature_before_summary", sea_electronic_no_declaration_summary_evidence_level: "verified_live", sea_electronic_positive_post_signature_evidence_level: "needs_review", no_family_member_value: "NO_COMPANION_CONFIRMED", creates_individual_declarations: true, non_submitted_gate: true, not_a_nested_applicant_field: true, evidence_level: "coordinator_live_air_and_sea_review_observed" }) },
];

export const PH_ETRAVEL_OFFICIAL_FIELD_NAMES = PH_ETRAVEL_FORM_FIELDS.map((field) => field.field_name);

const MANIFEST_STATIC_ACTION_FIELDS = new Set([
  "sea_manual_customs_forms_notice",
  // A canvas value is a review gate, not a normal applicant-question answer.
  "customs_signature",
  "customs_signature_declaration",
  "family_member_gate_confirmation",
]);

const MANIFEST_VIZA_AUDIT_FIELDS = new Set([
  "registration_data_privacy_affidavit_consent",
]);

const MANIFEST_PROFILE_OR_REGISTRATION_FIELDS = new Set([
  "mobile_number",
  "country_of_residence",
  "residence_province_code",
  "residence_municipality_code",
  "residence_barangay_code",
  "residence_address_line1",
  "residence_address_line2",
]);

const MANIFEST_AIR_FIELDS = new Set([
  "airline_name",
  "flight_number",
  "flight_number_special",
  "airport_of_origin",
  "flight_departure_date",
  "flight_arrival_date",
  "port_of_entry",
  "destination_transit_airport",
  "destination_country",
]);

const MANIFEST_SEA_FIELDS = new Set([
  "vessel_name",
  "voyage_number",
  "seaport_of_origin",
  "voyage_departure_date",
  "voyage_arrival_date",
  "sea_port_of_entry",
  "is_disembarking",
  "disembarking_port_code",
]);

const MANIFEST_ELECTRONIC_CUSTOMS_FIELDS = new Set([
  "accompanied_under_18_count",
  "accompanied_18_plus_count",
  "checked_baggage_count",
  "handcarry_baggage_count",
  "first_time_visiting_philippines",
  "customs_information_acknowledgement",
  "has_baggage_or_currency_to_declare",
  "customs_signature",
  "customs_signature_declaration",
  "bsp_authorization_date",
  "courier_name",
  "airway_bill_no",
  "airway_bill_date",
  "no_of_days_in_philippines",
  "last_travel_to_philippines",
]);

const manifestTransport = (field: PhEtravelFieldDef) => {
  const condition = field.conditional_logic?.showIf;
  if (MANIFEST_AIR_FIELDS.has(field.field_name)) return "AIR_ORDINARY_PASSENGER";
  if (MANIFEST_SEA_FIELDS.has(field.field_name)) return "SEA_ORDINARY_PASSENGER";
  if (field.field_name === "sea_manual_customs_forms_notice") return "SEA_MANUAL_FORMS";
  if (
    MANIFEST_ELECTRONIC_CUSTOMS_FIELDS.has(field.field_name)
    || field.field_name.startsWith("customs_checklist_")
    || field.field_name.startsWith("goods_")
    || field.field_name.startsWith("currency_")
  ) {
    return "AIR_ELECTRONIC_OR_SEA_ELECTRONIC";
  }
  if (typeof condition === "string" && condition.includes("selected_port_customs_flow")) {
    return "AIR_ELECTRONIC_OR_SEA_ELECTRONIC";
  }
  return "AIR_OR_SEA_ORDINARY_PASSENGER";
};

const manifestCondition = (field: PhEtravelFieldDef) => {
  const condition = field.conditional_logic?.showIf;
  return typeof condition === "string" ? condition : "always";
};

const manifestEvidenceLevel = (field: PhEtravelFieldDef) => {
  const evidence = field.validation_rules?.evidence_level;
  return typeof evidence === "string" ? evidence : "needs_review";
};

const manifestPersistenceBoundary = (field: PhEtravelFieldDef) =>
  MANIFEST_PROFILE_OR_REGISTRATION_FIELDS.has(field.field_name)
    ? "FOR_ME_profile_route; FOR_OTHER_registration_payload_only_not_account_runtime"
    : undefined;

export type PhEtravelSchemaParityManifestEntry = {
  schema_field: string;
  official_key: string | null;
  official_key_status: "identified" | "needs_review" | "not_an_applicant_control";
  field_type: string;
  label_zh: string;
  condition: string;
  clear_relations: readonly string[];
  option_contract: "static_options" | "dynamic_source" | "no_options" | "needs_review";
  requiredness: {
    seed_required: boolean;
    evidence: string;
    status: "evidence_backed" | "needs_review_fail_closed";
    cross_layer_enforcement: "seed_value_allowed" | "do_not_infer_required_or_optional";
  };
  owner: PhEtravelApplicantQuestionOwner;
};

// The official form intentionally reuses a few payload keys across mutually
// exclusive AIR/SEA or destination branches. Every other repeated key is a
// schema drift. Consumers must use this map rather than guessing from labels.
export const PH_ETRAVEL_OFFICIAL_KEY_REUSE_CONTRACT = {
  flight_number: ["flight_number", "voyage_number"],
  origin_port: ["airport_of_origin", "seaport_of_origin"],
  departure_date: ["flight_departure_date", "voyage_departure_date"],
  arrival_date: ["flight_arrival_date", "voyage_arrival_date"],
  transit_port: ["transit_airport", "transit_seaport"],
  destination_port_code: ["port_of_entry", "sea_port_of_entry"],
  destination_upon_arrival_in_philippines: ["destination_residence_address", "destination_hotel_name"],
} as const;

const stringRule = (field: PhEtravelFieldDef, key: string) => {
  const value = field.validation_rules?.[key];
  return typeof value === "string" ? value : undefined;
};

const stringListRule = (field: PhEtravelFieldDef, key: string) => {
  const value = field.validation_rules?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

const manifestClearRelations = (field: PhEtravelFieldDef) => [
  ...stringListRule(field, "clear_on_change"),
  ...stringListRule(field, "client_change_clears"),
  ...stringListRule(field, "client_false_clears"),
  ...stringListRule(field, "client_clear_when"),
  ...(stringRule(field, "client_cleared_by") ? [stringRule(field, "client_cleared_by")!] : []),
];

const manifestRequiredness = (field: PhEtravelFieldDef): PhEtravelSchemaParityManifestEntry["requiredness"] => {
  const evidence = stringRule(field, "requiredness_evidence")
    ?? stringRule(field, "server_requiredness")
    ?? stringRule(field, "client_requiredness")
    ?? "needs_review_no_explicit_requiredness_evidence";
  const status = evidence.includes("needs_review") || evidence.includes("not_attributable")
    ? "needs_review_fail_closed"
    : "evidence_backed";

  return {
    seed_required: field.required,
    evidence,
    status,
    cross_layer_enforcement: status === "needs_review_fail_closed"
      ? "do_not_infer_required_or_optional"
      : "seed_value_allowed",
  };
};

const manifestOfficialKey = (field: PhEtravelFieldDef) => {
  const officialKey = stringRule(field, "official_key") ?? stringRule(field, "official_client_control_key");
  if (officialKey) return { official_key: officialKey, official_key_status: "identified" as const };
  if (MANIFEST_STATIC_ACTION_FIELDS.has(field.field_name) || MANIFEST_VIZA_AUDIT_FIELDS.has(field.field_name)) {
    return { official_key: null, official_key_status: "not_an_applicant_control" as const };
  }
  return { official_key: null, official_key_status: "needs_review" as const };
};

const manifestOptionContract = (field: PhEtravelFieldDef): PhEtravelSchemaParityManifestEntry["option_contract"] => {
  if (stringRule(field, "dynamic_option_source")) return "dynamic_source";
  if ((field.options ?? []).length > 0) return "static_options";
  return field.field_type === "select" || field.field_type === "radio" || field.field_type === "checkbox"
    ? "needs_review"
    : "no_options";
};

// Stable cross-layer view of every current schema row. It is intentionally
// derived from PH_ETRAVEL_FORM_FIELDS so a future seed row cannot bypass key,
// label, condition, option, or requiredness audit coverage.
export const PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_MANIFEST: readonly PhEtravelSchemaParityManifestEntry[] =
  PH_ETRAVEL_FORM_FIELDS.map((field) => {
    const owner: PhEtravelApplicantQuestionOwner = MANIFEST_STATIC_ACTION_FIELDS.has(field.field_name)
      ? "static_action"
      : MANIFEST_VIZA_AUDIT_FIELDS.has(field.field_name)
        ? "viza_audit"
        : "schema";
    return {
      schema_field: field.field_name,
      ...manifestOfficialKey(field),
      field_type: field.field_type,
      label_zh: stringRule(field, "label_zh") ?? "needs_review",
      condition: manifestCondition(field),
      clear_relations: manifestClearRelations(field),
      option_contract: manifestOptionContract(field),
      requiredness: manifestRequiredness(field),
      owner,
    };
  });

// Canonical evidence rows and product schema rows are different populations:
// schema also holds VIZA audit controls and static gates that never become an
// official payload answer.
export const PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_SCOPE = {
  canonical_contract_records: PH_ETRAVEL_ARRIVAL_CONTRACT_AUDIT.canonical_rows
    + PH_ETRAVEL_ARRIVAL_CONTRACT_AUDIT.unsupported_or_diverted_rows,
  current_schema_rows: PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_MANIFEST.length,
  schema_rows_are_not_contract_total: true,
  includes_viza_audit_and_static_gates: true,
} as const;

const manifestSchemaField = (field: PhEtravelFieldDef): PhEtravelApplicantQuestionManifestEntry => {
  const owner: PhEtravelApplicantQuestionOwner = MANIFEST_STATIC_ACTION_FIELDS.has(field.field_name)
    ? "static_action"
    : MANIFEST_VIZA_AUDIT_FIELDS.has(field.field_name)
      ? "viza_audit"
      : "schema";

  return {
    semantic_key: field.field_name === "flight_type"
      ? "registration.flight_type"
      : field.field_name === "registration_data_privacy_affidavit_consent"
        ? "consent.data_privacy_and_affidavit"
        : field.field_name === "flight_number_special"
      ? "air.special_flight_number"
      : field.field_name === "with_negative_antigen"
        ? "health.with_negative_antigen"
        : `schema.${field.field_name}`,
    owner,
    applicant_answer: owner === "schema" || owner === "viza_audit",
    schema_field: field.field_name,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: manifestTransport(field),
    page: field.step_name,
    condition: manifestCondition(field),
    evidence_level: manifestEvidenceLevel(field),
    persistence_boundary: manifestPersistenceBoundary(field),
  };
};

// This manifest is the complete ownership map for the ordinary arrival schema.
// Schema entries are derived from the actual field list so a newly seeded field
// cannot silently bypass persona, branch, page, and condition coverage.
export const PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST: readonly PhEtravelApplicantQuestionManifestEntry[] = [
  ...PH_ETRAVEL_FORM_FIELDS.map(manifestSchemaField),
  {
    semantic_key: "account.email",
    owner: "runtime",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Account",
    condition: "account_login_or_registration",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "account.otp",
    owner: "runtime",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Account",
    condition: "email_verification",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "account.password",
    owner: "runtime",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Account",
    condition: "account_login_or_registration",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "runtime.turnstile_captcha",
    owner: "runtime",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "New Travel Declaration Summary",
    condition: "final_submit_runtime_gate_only",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "profile.photo_url",
    owner: "profile_owned",
    applicant_answer: true,
    persona: "FILIPINO_OR_FOREIGNER_CONDITION_NEEDS_REVIEW",
    transport: "ALL",
    page: "Profile/Onboarding",
    condition: "official_photo_branch_not_a_universal_arrival_document",
    evidence_level: "needs_review",
    requiredness_evidence: "confirmed_live_E19_blank_Filipino_and_Foreigner_Required_marker_only",
    file_contract_evidence: "E21_E26_photo_url_client_wiring_and_live_single_file_control_only_no_accept_mime_size_content_or_server_acceptance",
    persistence_boundary: "FOR_ME_profile_route; FOR_OTHER_registration_payload_only_not_account_runtime",
  },
  {
    semantic_key: "residence.region_code",
    owner: "unsupported",
    applicant_answer: true,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Permanent Residence",
    condition: "PH_residence_address_branch",
    evidence_level: "needs_review",
    persistence_boundary: "country_code === PH; FOR_ME_profile_route; FOR_OTHER_registration_payload_only_not_account_runtime",
  },
  {
    semantic_key: "air.is_special_flight",
    owner: "runtime",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "AIR_ORDINARY_PASSENGER",
    page: "Travel Details",
    condition: "flight_number === SPECIAL FLIGHT; derived_ui_state_only_not_registration_payload",
    evidence_level: "verified_public_bundle",
    persistence_boundary: "derived_ui_state_not_official_payload",
  },
  {
    semantic_key: "health.exposed_to_bats_or_sick_animals",
    owner: "static_action",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Health Declaration",
    condition: "translation_text_only_not_current_component_control",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "family.selected_members",
    owner: "profile_owned",
    applicant_answer: true,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "AIR_OR_SEA_ORDINARY_PASSENGER",
    page: "Family Member(s)",
    condition: "family_profile_selection_creates_individual_declarations",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "family.relationship",
    owner: "profile_owned",
    applicant_answer: true,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Family Profile",
    condition: "selected_family_member",
    evidence_level: "verified_public",
  },
  {
    semantic_key: "attachments.travel_document",
    owner: "unsupported",
    applicant_answer: true,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "AIR_ELECTRONIC_OR_SEA_ELECTRONIC",
    page: "Declaration Attachments and Signature",
    condition: "file_control_mime_size_and_requiredness_unverified",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "declaration.certify_true_correct",
    owner: "static_action",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "AIR_ELECTRONIC_OR_SEA_ELECTRONIC",
    page: "Declaration Attachments and Signature",
    condition: "signature_page_visible",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "privacy.copy",
    owner: "static_action",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Travel Registration",
    condition: "always",
    evidence_level: "verified_public",
  },
  {
    semantic_key: "summary.review",
    owner: "static_action",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "New Travel Declaration Summary",
    condition: "review_path_reached",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "summary.final_submit",
    owner: "static_action",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "New Travel Declaration Summary",
    condition: "review_complete",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "result.official_reference",
    owner: "result",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Submission Result",
    condition: "after_official_submit",
    evidence_level: "needs_review",
  },
  {
    semantic_key: "result.reference_qr_render",
    owner: "result",
    applicant_answer: false,
    persona: "ORDINARY_FILIPINO_OR_FOREIGNER",
    transport: "ALL",
    page: "Submission Result",
    condition: "after_official_submit",
    evidence_level: "needs_review",
    legacy_aliases: ["result.qr_artifact"],
  },
  {
    semantic_key: "unsupported.flight_crew_or_vessel_crew_or_cruise",
    owner: "unsupported",
    applicant_answer: false,
    persona: "CREW_OR_CRUISE",
    transport: "AIR_OR_SEA",
    page: "Travel Details",
    condition: "diverted_from_ordinary_arrival_v1",
    evidence_level: "needs_review",
  },
];
