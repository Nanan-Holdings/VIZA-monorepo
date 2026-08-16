import { describe, expect, it } from "vitest";
import {
  PH_ETRAVEL_FORM_FIELDS,
  PH_ETRAVEL_GENERAL_DECLARATION_ITEM_IDS,
  PH_ETRAVEL_GENERAL_DECLARATION_POSITIVE_AMOUNT_RULE,
  PH_ETRAVEL_ARRIVAL_CONTRACT_AUDIT,
  PH_ETRAVEL_E18_SYNTHETIC_SCENARIO_READINESS,
  PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21,
  PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_MANIFEST,
  PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_SCOPE,
  PH_ETRAVEL_OFFICIAL_KEY_REUSE_CONTRACT,
  PH_ETRAVEL_SEA_FLOW_CLIENT_WIRING_E24,
  PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE,
  PH_ETRAVEL_HEALTH_DECLARATION_WARNING,
  PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST,
  PH_ETRAVEL_OFFICIAL_FIELD_NAMES,
  PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE,
  PH_ETRAVEL_SEA_ELECTRONIC_POSITIVE_COVERAGE,
  PH_ETRAVEL_VISA_TYPE,
  type PhEtravelFieldDef,
} from "../../scripts/ph-etravel/form-fields";
import {
  PH_ETRAVEL_COUNTRY_OPTIONS,
  PH_ETRAVEL_CURRENCY_PURPOSE_OPTIONS,
  PH_ETRAVEL_CURRENCY_SOURCE_OPTIONS,
  PH_ETRAVEL_DYNAMIC_OPTION_SOURCES,
  PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS,
  PH_ETRAVEL_OCCUPATION_OPTIONS,
  PH_ETRAVEL_PURPOSE_OPTIONS,
  PH_ETRAVEL_SEA_PORT_OPTIONS,
  PH_ETRAVEL_SICKNESS_SYMPTOM_OPTIONS,
} from "../../scripts/ph-etravel/official-options";
import officialSnapshot from "../../scripts/ph-etravel/official-options.snapshot.json";

const byName = (name: string): PhEtravelFieldDef => {
  const field = PH_ETRAVEL_FORM_FIELDS.find((item) => item.field_name === name);
  expect(field, `${name} must exist`).toBeDefined();
  return field!;
};

const valuesOf = (name: string) => (byName(name).options ?? []).map((option) => option.value);
const showIf = (name: string) => byName(name).conditional_logic?.showIf;
const rulesOf = (name: string) => byName(name).validation_rules ?? {};
const officialSnapshotValues = new Set(
  (Object.values(officialSnapshot) as unknown[])
    .flatMap((items) => (Array.isArray(items) ? items : []))
    .flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const record = item as Record<string, unknown>;
      return [record.code, record.id].filter((value): value is string | number => typeof value === "string" || typeof value === "number");
    })
    .map(String),
);

describe("Philippines eTravel arrival card schema", () => {
  it("uses the dedicated arrival visa type and unique field contract", () => {
    expect(PH_ETRAVEL_VISA_TYPE).toBe("PH_ETRAVEL_ARRIVAL_CARD");
    expect(PH_ETRAVEL_VISA_TYPE).not.toBe("PH_9A_TOURIST");

    expect(PH_ETRAVEL_FORM_FIELDS).toHaveLength(PH_ETRAVEL_OFFICIAL_FIELD_NAMES.length);
    expect(new Set(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).size).toBe(PH_ETRAVEL_OFFICIAL_FIELD_NAMES.length);
  });

  it("covers every canonical confirmed applicant control without promoting runtime or result surfaces", () => {
    expect(PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE.length).toBeGreaterThan(30);
    for (const coverage of PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE) {
      expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, coverage.field_name).toContain(coverage.field_name);
      expect(rulesOf(coverage.field_name).official_key, coverage.field_name).toBe(coverage.official_key);
      if (coverage.path_specific) {
        expect(showIf(coverage.field_name), coverage.field_name).toBeDefined();
      }
    }

    for (const fieldName of [
      "data_privacy_agreement",
      "account_email",
      "account_password",
      "account_otp",
      "review_summary",
      "official_reference_number",
      "etravel_qr_code",
      "final_submit",
    ]) {
      expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, fieldName).not.toContain(fieldName);
    }
  });

  it("owns every ordinary arrival schema field in the applicant-question manifest", () => {
    const manifest = PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST;
    const schemaEntries = manifest.filter((entry) => entry.schema_field !== undefined);
    const schemaFieldNames = schemaEntries.map((entry) => entry.schema_field!);

    expect(new Set(schemaFieldNames).size).toBe(schemaFieldNames.length);
    expect([...schemaFieldNames].sort()).toEqual([...PH_ETRAVEL_OFFICIAL_FIELD_NAMES].sort());

    for (const coverage of PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE) {
      expect(schemaFieldNames, coverage.field_name).toContain(coverage.field_name);
    }
    for (const fieldName of PH_ETRAVEL_SEA_ELECTRONIC_POSITIVE_COVERAGE.field_names) {
      expect(schemaFieldNames, fieldName).toContain(fieldName);
    }

    for (const entry of manifest) {
      expect(entry.semantic_key).not.toBe("");
      expect(entry.persona).not.toBe("");
      expect(entry.transport).not.toBe("");
      expect(entry.page).not.toBe("");
      expect(entry.condition).not.toBe("");
      expect(entry.evidence_level).not.toBe("");

      if (entry.schema_field) {
        expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, entry.semantic_key).toContain(entry.schema_field);
      } else {
        expect(entry.owner, entry.semantic_key).not.toBe("schema");
      }

      if (entry.applicant_answer) {
        expect(entry.owner, entry.semantic_key).toEqual(expect.stringMatching(/^(schema|viza_audit|profile_owned|unsupported)$/));
      }
    }

    for (const fieldName of [
      "sea_manual_customs_forms_notice",
      "customs_signature",
      "customs_signature_declaration",
      "family_member_gate_confirmation",
    ]) {
      expect(schemaEntries.find((entry) => entry.schema_field === fieldName)?.owner).toBe("static_action");
    }
  });

  it("publishes a complete fail-closed schema parity manifest for cross-layer consumers", () => {
    const manifest = PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_MANIFEST;
    expect(PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_SCOPE.canonical_contract_records).toBe(119);
    expect(PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_SCOPE.current_schema_rows).toBe(PH_ETRAVEL_OFFICIAL_FIELD_NAMES.length);
    expect(PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_SCOPE.schema_rows_are_not_contract_total).toBe(true);
    expect(PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_SCOPE.includes_viza_audit_and_static_gates).toBe(true);
    expect(manifest).toHaveLength(PH_ETRAVEL_OFFICIAL_FIELD_NAMES.length);
    expect(new Set(manifest.map((entry) => entry.schema_field)).size).toBe(PH_ETRAVEL_OFFICIAL_FIELD_NAMES.length);
    expect([...manifest.map((entry) => entry.schema_field)].sort()).toEqual([...PH_ETRAVEL_OFFICIAL_FIELD_NAMES].sort());

    const keyToFields = new Map<string, string[]>();
    for (const entry of manifest) {
      expect(entry.field_type, entry.schema_field).not.toBe("");
      expect(entry.label_zh, entry.schema_field).not.toBe("needs_review");
      expect(entry.condition, entry.schema_field).not.toBe("");
      expect(entry.requiredness.evidence, entry.schema_field).not.toBe("");

      if (entry.official_key_status === "identified") {
        expect(entry.official_key, entry.schema_field).not.toBeNull();
        const fields = keyToFields.get(entry.official_key!) ?? [];
        fields.push(entry.schema_field);
        keyToFields.set(entry.official_key!, fields);
      } else {
        expect(entry.official_key, entry.schema_field).toBeNull();
      }

      if (entry.requiredness.status === "needs_review_fail_closed") {
        expect(entry.requiredness.cross_layer_enforcement, entry.schema_field).toBe(
          "do_not_infer_required_or_optional",
        );
      }
    }

    for (const [officialKey, fields] of keyToFields) {
      if (fields.length < 2) continue;
      expect(PH_ETRAVEL_OFFICIAL_KEY_REUSE_CONTRACT[officialKey as keyof typeof PH_ETRAVEL_OFFICIAL_KEY_REUSE_CONTRACT])
        .toEqual(fields);
    }

    expect(manifest.find((entry) => entry.schema_field === "customs_signature")).toMatchObject({
      official_key: "signature",
      owner: "static_action",
    });
  });

  it("keeps account, profile, document, review, and result surfaces out of applicant schema ownership", () => {
    const bySemanticKey = (semanticKey: string) =>
      PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST.find((entry) => entry.semantic_key === semanticKey)!;

    expect(bySemanticKey("account.email").owner).toBe("runtime");
    expect(bySemanticKey("account.otp").owner).toBe("runtime");
    expect(bySemanticKey("account.password").owner).toBe("runtime");
    expect(bySemanticKey("runtime.turnstile_captcha")).toMatchObject({ owner: "runtime", applicant_answer: false });
    expect(bySemanticKey("profile.photo_url").owner).toBe("profile_owned");
    expect(bySemanticKey("attachments.travel_document").owner).toBe("unsupported");
    expect(bySemanticKey("privacy.copy").owner).toBe("static_action");
    expect(bySemanticKey("summary.review").owner).toBe("static_action");
    expect(bySemanticKey("summary.final_submit").owner).toBe("static_action");
    expect(bySemanticKey("result.official_reference").owner).toBe("result");
    const qrRender = bySemanticKey("result.reference_qr_render");
    expect(qrRender.owner).toBe("result");
    expect(qrRender.legacy_aliases).toEqual(["result.qr_artifact"]);
    expect(PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST.map((entry) => entry.semantic_key))
      .not.toContain("result.qr_artifact");

    const forbiddenSchemaFields = [
      "account_email",
      "account_otp",
      "account_password",
      "data_privacy_agreement",
      "profile_photo",
      "travel_document",
      "customs_attachment_file",
      "customs_signature_file",
      "turnstile_captcha",
      "review_summary",
      "official_reference_number",
      "etravel_qr_code",
      "final_submit",
    ];
    for (const fieldName of forbiddenSchemaFields) {
      expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, fieldName).not.toContain(fieldName);
    }
  });

  it("locks this product to ARRIVAL and requires VIZA privacy/affidavit consent before enqueue", () => {
    expect(byName("flight_type")).toMatchObject({
      field_type: "radio",
      required: true,
      step_number: 1,
      options: [{ value: "ARRIVAL", label_en: "Arrival (Entering the Philippines)" }],
    });
    expect(valuesOf("flight_type")).toEqual(["ARRIVAL"]);
    expect(valuesOf("flight_type")).not.toContain("DEPARTURE");
    expect(rulesOf("flight_type")).toMatchObject({
      official_key: "flight_type",
      fixed_value: "ARRIVAL",
      ui_locked: true,
      locked_for_product: "PH_ETRAVEL_ARRIVAL_CARD",
      excluded_value: "DEPARTURE",
      departure_product: "PH_ETRAVEL_DEPARTURE_CARD",
    });

    const arrivalConditions = PH_ETRAVEL_FORM_FIELDS.filter((field) =>
      String(field.conditional_logic?.showIf ?? "").includes("flight_type === ARRIVAL"));
    expect(arrivalConditions.length).toBeGreaterThan(0);
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).toContain("flight_type");

    expect(byName("registration_data_privacy_affidavit_consent")).toMatchObject({
      field_type: "checkbox",
      required: true,
      step_number: 1,
    });
    expect(rulesOf("registration_data_privacy_affidavit_consent")).toMatchObject({
      official: false,
      viza_audit: true,
      exclude_from_official_payload: true,
      enqueue_required_value: true,
      covers: ["data_privacy", "affidavit"],
    });
    expect(PH_ETRAVEL_CONFIRMED_APPLICANT_COVERAGE.map((entry) => entry.field_name))
      .not.toContain("registration_data_privacy_affidavit_consent");

    const parityConsent = PH_ETRAVEL_ARRIVAL_SCHEMA_PARITY_MANIFEST.find(
      (entry) => entry.schema_field === "registration_data_privacy_affidavit_consent",
    );
    expect(parityConsent).toMatchObject({
      official_key: null,
      official_key_status: "not_an_applicant_control",
      owner: "viza_audit",
    });
    const manifest = PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST;
    expect(manifest.find((entry) => entry.semantic_key === "registration.flight_type")).toMatchObject({
      owner: "schema",
      applicant_answer: true,
      schema_field: "flight_type",
    });
    expect(manifest.find((entry) => entry.semantic_key === "consent.data_privacy_and_affidavit")).toMatchObject({
      owner: "viza_audit",
      applicant_answer: true,
      schema_field: "registration_data_privacy_affidavit_consent",
    });
    expect(manifest.filter((entry) => entry.semantic_key === "registration.flight_type")).toHaveLength(1);
  });

  it("maps every E17 needs-review row to one planned E18 owner without making a scenario launch-ready", () => {
    const scenarios = PH_ETRAVEL_E18_SYNTHETIC_SCENARIO_READINESS;
    expect(scenarios.map((scenario) => scenario.scenario)).toEqual(["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
    expect(scenarios.every((scenario) => scenario.launch_ready === false && scenario.planned_only)).toBe(true);

    const needsReviewKeys = scenarios.flatMap((scenario) => scenario.canonical_needs_review_keys);
    expect(needsReviewKeys).toHaveLength(PH_ETRAVEL_ARRIVAL_CONTRACT_AUDIT.needs_review_rows);
    expect(new Set(needsReviewKeys).size).toBe(needsReviewKeys.length);
    expect(scenarios.find((scenario) => scenario.scenario === "S5")?.canonical_needs_review_keys).toEqual([]);

    for (const scenario of scenarios) {
      for (const fieldName of scenario.schema_fields_present) {
        expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, `${scenario.scenario}:${fieldName}`).toContain(fieldName);
      }
      expect(scenario.minimum_schema_delta_after_official_evidence).not.toBe("");
      expect(scenario.requiredness_boundary).not.toBe("");
    }

    const scenario = (id: string) => scenarios.find((entry) => entry.scenario === id)!;
    expect(scenario("S1").non_schema_or_unsupported_keys).toEqual(["profile.photo_url", "residence.region_code"]);
    expect(scenario("S1").schema_fields_present).toEqual(expect.arrayContaining([
      "residence_province_code", "residence_municipality_code", "residence_barangay_code",
    ]));
    expect(scenario("S2").schema_fields_present).toContain("flight_number_special");
    expect(scenario("S2").non_schema_or_unsupported_keys).toEqual(["air.is_special_flight"]);
    expect(scenario("S3").schema_fields_present).toEqual(expect.arrayContaining([
      "with_negative_antigen",
      "has_recent_travel_history_30d",
      "visited_country_30d",
      "has_exposure_to_sick_person_30d",
      "has_been_sick_30d",
      "sickness_symptom",
    ]));
    expect(scenario("S3").non_schema_or_unsupported_keys).toEqual([
      "health.exposed_to_bats_or_sick_animals",
    ]);
    expect(scenario("S6").non_schema_or_unsupported_keys).toEqual(["attachments.travel_document"]);
  });

  it("keeps E18 scenario branch and result boundaries schema-only and fail-closed", () => {
    const scenario = (id: string) => PH_ETRAVEL_E18_SYNTHETIC_SCENARIO_READINESS.find((entry) => entry.scenario === id)!;
    const manifestEntry = (semanticKey: string) =>
      PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST.find((entry) => entry.semantic_key === semanticKey)!;

    expect(showIf("airline_name")).toBe("transport_type === AIR");
    expect(showIf("flight_number")).toBe("transport_type === AIR");
    expect(showIf("flight_number_special")).toBe("transport_type === AIR && flight_number === SPECIAL FLIGHT");
    expect(showIf("destination_transit_airport")).toBe("transport_type === AIR && flight_type === ARRIVAL && destination_type === TRANSIT");
    expect(showIf("destination_country")).toBe("transport_type === AIR && flight_type === ARRIVAL && destination_type === TRANSIT");
    expect(scenario("S2").option_source_boundary).toContain("runtime_dynamic");

    expect(showIf("visited_country_30d")).toBe("has_recent_travel_history_30d === true");
    expect(showIf("sickness_symptom")).toBe("has_been_sick_30d === true");
    expect(scenario("S3").requiredness_boundary).toBe(
      "health_screenshot_confirms_base_radios_and_positive_group_minimums_but_server_acceptance_remains_review",
    );

    expect(showIf("is_disembarking")).toBe("transport_type === SEA && flight_type === ARRIVAL");
    expect(showIf("sea_manual_customs_forms_notice")).toBe("transport_type === SEA && selected_port_customs_flow === MANUAL_FORMS");
    expect(scenario("S4").branch_boundary).toContain("not_electronic");
    expect(scenario("S5").branch_boundary).toContain("not_manual_or_electronic_No");
    expect(rulesOf("customs_signature").sea_electronic_positive_post_signature_evidence_level).toBe("needs_review");

    expect(showIf("currency_owner_not_applicable")).toContain("customs_checklist_1 === yes");
    expect(showIf("bsp_authorization_date")).toBe("customs_checklist_1 === yes");
    expect(rulesOf("currency_owner_not_applicable").official_key).toBe("owner_details_not_applicable");
    expect(scenario("S6").minimum_schema_delta_after_official_evidence).toContain("stable_input_mime_size_count_and_requiredness_evidence");

    expect(showIf("customs_information_acknowledgement")).toBe("(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS)");
    expect(manifestEntry("schema.customs_information_acknowledgement").owner).toBe("schema");
    expect(manifestEntry("schema.customs_signature_declaration").owner).toBe("static_action");
    expect(scenario("S7").minimum_schema_delta_after_official_evidence).toContain("never_synthesize_a_checkbox_from_copy");

    expect(scenario("S8").schema_fields_present).toEqual([]);
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toEqual(expect.arrayContaining([
      "official_reference", "reference_qr_render", "qr_artifact", "result_qr_artifact",
    ]));
    expect(manifestEntry("result.official_reference").owner).toBe("result");
    expect(manifestEntry("result.reference_qr_render").legacy_aliases).toEqual(["result.qr_artifact"]);
    expect(manifestEntry("result.reference_qr_render").applicant_answer).toBe(false);
  });

  it("keeps AIR, SEA, manual/electronic, Yes/No, and physical/courier manifest scopes isolated", () => {
    const manifestField = (fieldName: string) =>
      PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST.find((entry) => entry.schema_field === fieldName)!;

    for (const fieldName of ["airline_name", "flight_number", "flight_number_special", "airport_of_origin", "port_of_entry"]) {
      expect(manifestField(fieldName).transport, fieldName).toBe("AIR_ORDINARY_PASSENGER");
    }
    for (const fieldName of ["vessel_name", "voyage_number", "seaport_of_origin", "sea_port_of_entry"]) {
      expect(manifestField(fieldName).transport, fieldName).toBe("SEA_ORDINARY_PASSENGER");
    }

    expect(manifestField("sea_manual_customs_forms_notice").transport).toBe("SEA_MANUAL_FORMS");
    expect(manifestField("sea_manual_customs_forms_notice").condition).toBe(
      "transport_type === SEA && selected_port_customs_flow === MANUAL_FORMS",
    );
    for (const fieldName of [
      "accompanied_under_18_count",
      "accompanied_18_plus_count",
      "checked_baggage_count",
      "handcarry_baggage_count",
      "first_time_visiting_philippines",
    ]) {
      expect(manifestField(fieldName).transport, fieldName).toBe("AIR_ELECTRONIC_OR_SEA_ELECTRONIC");
      expect(manifestField(fieldName).condition, fieldName).toBe(
        "(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS)",
      );
    }

    for (const fieldName of ["customs_checklist_1", "customs_checklist_12"]) {
      expect(manifestField(fieldName).transport, fieldName).toBe("AIR_ELECTRONIC_OR_SEA_ELECTRONIC");
      expect(manifestField(fieldName).condition, fieldName).toContain("has_baggage_or_currency_to_declare === yes");
    }
    expect(manifestField("customs_checklist_3_item_description").transport).toBe("AIR_ELECTRONIC_OR_SEA_ELECTRONIC");
    expect(manifestField("currency_item_currency").transport).toBe("AIR_ELECTRONIC_OR_SEA_ELECTRONIC");
    expect(manifestField("no_of_days_in_philippines").condition).toContain(
      "currency_transport_method === is_physically_transferred_by_person",
    );
    expect(manifestField("courier_name").condition).toContain(
      "currency_transport_method === is_shipped_thru_courier_service",
    );
  });

  it("supports ordinary Filipino and Foreigner passengers only", () => {
    expect(valuesOf("passport_holder_type").sort()).toEqual(["FILIPINO", "FOREIGNER"]);
    expect(valuesOf("transport_type").sort()).toEqual(["AIR", "SEA"]);
    expect(valuesOf("traveller_type").sort()).toEqual(["AIRCRAFT PASSENGER", "VESSEL PASSENGER"]);

    expect(valuesOf("traveller_type")).not.toContain("FLIGHT CREW");
    expect(valuesOf("traveller_type")).not.toContain("CRUISE CREW");
    expect(valuesOf("traveller_type")).not.toContain("CRUISE PASSENGER");
    expect(valuesOf("traveller_type")).not.toContain("VESSEL CREW");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("is_special_flight");

    expect(rulesOf("traveller_type").allowed_by_transport).toEqual({
      AIR: ["AIRCRAFT PASSENGER"],
      SEA: ["VESSEL PASSENGER"],
    });
    expect(rulesOf("passport_holder_type").excluded_v1).toContain("OFFICIAL_EXEMPT");
  });

  it("keeps Filipino and Foreigner profile fields canonicalized to official values", () => {
    expect(byName("first_name").required).toBe(true);
    expect(byName("middle_name").required).toBe(false);
    expect(byName("last_name").required).toBe(false);
    expect(byName("suffix").required).toBe(false);

    for (const fieldName of [
      "sex",
      "passport_holder_type",
      "nationality",
      "country_of_birth",
      "occupation",
      "passport_issuing_authority",
      "country_of_residence",
    ]) {
      expect(rulesOf(fieldName).canonical_source, fieldName).toMatch(/^official_/);
      expect(rulesOf(fieldName).accepts_profile_aliases, fieldName).toBe(false);
    }

    expect(valuesOf("sex").sort()).toEqual(["FEMALE", "MALE"]);
    expect(rulesOf("sex").e26_live_values).toEqual(["FEMALE", "MALE"]);
    expect(rulesOf("passport_holder_type").e26_default_value).toBe("FILIPINO");
    expect(rulesOf("nationality")).toMatchObject({
      option_identity: "code",
      option_label_projection: "nationality",
      display_label_evidence: "E26_live_Citizenship_uses_nationality_or_demonym",
    });
    for (const fieldName of ["country_of_birth", "passport_issuing_authority"]) {
      expect(rulesOf(fieldName), fieldName).toMatchObject({
        option_identity: "code",
        option_label_projection: "name",
      });
    }
    expect(byName("occupation")).toMatchObject({ field_type: "select" });
  });

  it("consumes E19 S1 live profile evidence without creating a photo applicant file field", () => {
    expect(valuesOf("passport_holder_type")).toEqual(["FILIPINO", "FOREIGNER"]);
    expect(rulesOf("passport_holder_type").official_key).toBe("nationality");
    expect(rulesOf("passport_holder_type").official_control_type).toBe("radio");
    expect(rulesOf("passport_holder_type").e19_live_values).toEqual(["FILIPINO", "FOREIGNER"]);
    expect(rulesOf("passport_holder_type").e19_live_labels).toEqual([
      "PHILIPPINE PASSPORT Holder",
      "FOREIGN PASSPORT Holder",
    ]);
    expect(rulesOf("passport_holder_type").requiredness_evidence).toBe("default_Filipino_selection_no_omitted_persona_error");

    expect(rulesOf("first_name")).toMatchObject({
      official_key: "first_name",
      official_control_type: "text",
      selector_evidence_level: "confirmed_live_E19",
      requiredness_evidence: "E19_empty_Foreigner_validation_First_Name_Required",
      evidence_level: "verified_live_E19",
    });
    for (const fieldName of ["middle_name", "last_name", "suffix"]) {
      expect(byName(fieldName).required, fieldName).toBe(false);
      expect(rulesOf(fieldName).selector_evidence_level, fieldName).toBe("confirmed_live_E19");
      expect(rulesOf(fieldName).requiredness_evidence, fieldName).toBe("E19_live_label_optional");
    }
    expect(rulesOf("last_name").official_key).toBe("last_name");
    expect(rulesOf("suffix").official_key_candidate).toBe("extension_name");
    expect(rulesOf("suffix").complete_option_list_evidence_level).toBe("needs_review");
    expect(rulesOf("sex")).toMatchObject({
      official_key: "gender",
      official_control_type: "react_select",
      selector_evidence_level: "confirmed_live_E19",
      requiredness_evidence: "E19_empty_Foreigner_validation_Sex_Required",
      evidence_level: "verified_live_E19",
    });

    const manifest = PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST;
    const photo = manifest.find((entry) => entry.semantic_key === "profile.photo_url")!;
    expect(photo).toMatchObject({
      owner: "profile_owned",
      applicant_answer: true,
      evidence_level: "needs_review",
      requiredness_evidence: "confirmed_live_E19_blank_Filipino_and_Foreigner_Required_marker_only",
      file_contract_evidence: "E21_E26_photo_url_client_wiring_and_live_single_file_control_only_no_accept_mime_size_content_or_server_acceptance",
    });
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toEqual(expect.arrayContaining([
      "profile_photo", "photo_url", "applicant_photo", "profile_photo_file",
    ]));

    const s1 = PH_ETRAVEL_E18_SYNTHETIC_SCENARIO_READINESS.find((scenario) => scenario.scenario === "S1")!;
    expect(s1.confirmed_live_keys).toEqual([
      "traveller.first_name", "traveller.middle_name", "traveller.last_name", "traveller.suffix", "traveller.sex",
    ]);
    expect(s1.canonical_needs_review_keys).not.toEqual(expect.arrayContaining([...(s1.confirmed_live_keys ?? [])]));
    expect(s1.canonical_needs_review_keys).toEqual(expect.arrayContaining([
      "registration.application_for", "traveller.passenger_type", "profile.photo_url", "traveller.mobile_number", "residence.country_code",
    ]));
    expect(s1.launch_ready).toBe(false);
    expect(s1.planned_only).toBe(true);

    expect(rulesOf("registration_for").e19_for_other_observed).toBe(true);
    expect(rulesOf("registration_for").launch_gate).toBe("needs_review_not_a_runner_authorization");
  });

  it("maps E21 profile, mobile, and residence wiring without promoting client rules to server requirements", () => {
    expect(PH_ETRAVEL_ARRIVAL_CONTRACT_AUDIT).toEqual(expect.objectContaining({
      canonical_rows: 111,
      confirmed_live_rows: 56,
      verified_public_rows: 19,
      needs_review_rows: 36,
      unsupported_or_diverted_rows: 8,
    }));

    expect(PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.photo_url).toMatchObject({
      owner: "profile_owned",
      flat_key: "photo_url",
      client_yup_required: true,
      clear_on: "widget_delete_clears_photo_url",
      generic_widget_default_max_bytes: 5242880,
      passport_holder_condition: "none_observed",
      live_file_control: "E26_normal_single_file_image_control_visible_selection_policy_blocked",
      file_contract: "needs_review_live_single_file_control_only_no_accept_mime_size_content_or_server_acceptance",
    });
    expect(PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.mobile_number).toMatchObject({
      flat_key: "mobile_number",
      no_separate_official_mobile_country_code: true,
      client_country_initial_and_preferred: "ph",
      client_mask: "... ... ....",
      client_yup_required: false,
      server_contract: "needs_review",
    });
    expect(PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.residence).toMatchObject({
      country_flat_key: "country_code",
      client_branch: "country_code === PH",
      passport_holder_condition: "none_residence_branch_is_not_FILIPINO_or_FOREIGNER",
      province_source: "/api/v1/common/provinces?order_by=name",
      municipality_source: "/api/v1/common/municipalities?province_code={selected code}",
      barangay_source: "/api/v1/common/barangays?municipality_code={selected code}",
      server_contract: "needs_review",
    });
    expect(PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.residence.country_change_clears).toEqual([
      "region_code", "province_code", "municipality_code", "barangay_code", "street", "street_two",
    ]);

    expect(byName("mobile_number").required).toBe(false);
    expect(rulesOf("mobile_number")).toMatchObject({
      official_key: "mobile_number",
      official_control_type: "phone_picker",
      client_requiredness_evidence: "E21_personal_Yup_shape_does_not_include_mobile_number",
      server_requiredness_evidence: "needs_review",
    });
    expect(byName("mobile_country_code").required).toBe(false);
    expect(rulesOf("mobile_country_code").e21_status).toBe("preexisting_VIZA_field_not_an_official_personal_profile_payload_key");

    expect(byName("country_of_residence").required).toBe(true);
    expect(byName("residence_address_line1").required).toBe(true);
    expect(byName("residence_address_line2").required).toBe(false);
    expect(rulesOf("country_of_residence")).toMatchObject({
      official_key: "country_code",
      client_requiredness_evidence: "E21_profile_Yup_requires_country_code",
      server_requiredness_evidence: "needs_review",
      clear_on_change: ["region_code", "province_code", "municipality_code", "barangay_code", "street", "street_two"],
    });
    expect(showIf("residence_province_code")).toBe("country_of_residence === PH");
    expect(showIf("residence_municipality_code")).toBe("country_of_residence === PH");
    expect(showIf("residence_barangay_code")).toBe("country_of_residence === PH");
    expect(rulesOf("residence_province_code")).toMatchObject({
      official_key: "province_code",
      option_identity: "code",
      client_requiredness_evidence: "E21_profile_Yup_requires_province_code_when_country_code_PH",
      server_requiredness_evidence: "needs_review",
      clear_on_change: ["region_code", "residence_municipality_code", "residence_barangay_code"],
    });
    expect(rulesOf("residence_municipality_code")).toMatchObject({
      official_key: "municipality_code",
      depends_on: "residence_province_code",
      request_parameter: "province_code",
      option_identity: "code",
      client_requiredness_evidence: "E21_profile_Yup_requires_municipality_code_when_country_code_PH",
      server_requiredness_evidence: "needs_review",
      clear_on_change: ["residence_barangay_code"],
    });
    expect(rulesOf("residence_barangay_code")).toMatchObject({
      official_key: "barangay_code",
      depends_on: "residence_municipality_code",
      request_parameter: "municipality_code",
      option_identity: "code",
      client_requiredness_evidence: "E21_profile_Yup_requires_barangay_code_when_country_code_PH",
      server_requiredness_evidence: "needs_review",
    });
    for (const fieldName of ["residence_province_code", "residence_municipality_code", "residence_barangay_code"]) {
      expect(byName(fieldName).required, fieldName).toBe(true);
      expect(rulesOf(fieldName).dynamic_option_source, fieldName).toBeDefined();
      expect(byName(fieldName).options, fieldName).toBeUndefined();
    }
    expect(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.provinces).toMatchObject({
      endpoint: "/api/v1/common/provinces",
      query: ["order_by=name"],
      response_identity: "code",
      response_label: "name",
    });
    expect(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.municipalities.query).toEqual([
      "province_code={selected official province code}",
    ]);
    expect(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.barangays.query).toEqual([
      "municipality_code={selected official municipality code}",
    ]);
    expect(rulesOf("residence_address_line1")).toMatchObject({
      official_key: "street",
      labels_by_residence_country: {
        PH: "House No./Bldg./Street",
        non_PH: "No./Bldg./City/State/Province",
      },
      client_requiredness_evidence: "E21_profile_Yup_requires_street_in_PH_and_non_PH_branches",
      server_requiredness_evidence: "needs_review",
    });
    expect(rulesOf("residence_address_line2")).toMatchObject({
      official_key: "street_two",
      client_optional_evidence: "E21_profile_Yup_street_two_optional",
      server_requiredness_evidence: "needs_review",
    });

    expect(rulesOf("passport_holder_type").e21_clear_on_change).toEqual(["traveler_type", "occupation_type"]);
    expect(showIf("country_of_residence")).toBeUndefined();
    expect(showIf("residence_address_line1")).toBeUndefined();
    expect(PH_ETRAVEL_PROFILE_CLIENT_WIRING_E21.residence.passport_holder_condition).toBe(
      "none_residence_branch_is_not_FILIPINO_or_FOREIGNER",
    );

    const manifest = PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST;
    const manifestField = (fieldName: string) => manifest.find((entry) => entry.schema_field === fieldName)!;
    for (const fieldName of [
      "mobile_number", "country_of_residence", "residence_province_code", "residence_municipality_code",
      "residence_barangay_code", "residence_address_line1", "residence_address_line2",
    ]) {
      expect(manifestField(fieldName).persistence_boundary, fieldName).toBe(
        "FOR_ME_profile_route; FOR_OTHER_registration_payload_only_not_account_runtime",
      );
    }
    expect(manifest.find((entry) => entry.semantic_key === "profile.photo_url")?.persistence_boundary).toBe(
      "FOR_ME_profile_route; FOR_OTHER_registration_payload_only_not_account_runtime",
    );
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toEqual(expect.arrayContaining([
      "photo_url", "profile_photo_file", "upload_result", "mobile_number_result",
    ]));
  });

  it("models AIR and SEA as independent travel branches", () => {
    for (const fieldName of [
      "airline_name",
      "flight_number",
      "airport_of_origin",
      "flight_departure_date",
      "flight_arrival_date",
      "port_of_entry",
    ]) {
      expect(showIf(fieldName), fieldName).toBe("transport_type === AIR");
      expect(rulesOf(fieldName).transport_branch, fieldName).toBe("AIR");
    }

    for (const fieldName of [
      "vessel_name",
      "voyage_number",
      "seaport_of_origin",
      "voyage_departure_date",
      "voyage_arrival_date",
    ]) {
      expect(showIf(fieldName), fieldName).toBe("transport_type === SEA");
      expect(rulesOf(fieldName).transport_branch, fieldName).toBe("SEA");
    }
    expect(showIf("sea_port_of_entry")).toBe("transport_type === SEA && flight_type === ARRIVAL");
    expect(showIf("is_disembarking")).toBe("transport_type === SEA && flight_type === ARRIVAL");
    expect(byName("is_disembarking").required).toBe(false);
    expect(byName("is_disembarking").field_type).toBe("checkbox");
    expect(rulesOf("is_disembarking").transport_branch).toBe("SEA");
    expect(rulesOf("is_disembarking").path_specific).toBe(true);
    expect(rulesOf("is_disembarking").client_default).toBe(false);
    expect(rulesOf("is_disembarking").client_clear_when).toEqual([
      "transport_type === AIR",
      "flight_type === DEPARTURE",
    ]);
    expect(rulesOf("is_disembarking").hidden_observed_path).toContain("Manila South Harbor electronic path");

    expect(rulesOf("voyage_number").official_key).toBe("flight_number");
    expect(rulesOf("voyage_departure_date").official_key).toBe("departure_date");
    expect(rulesOf("voyage_arrival_date").official_key).toBe("arrival_date");
    expect(rulesOf("sea_port_of_entry").official_key).toBe("destination_port_code");
    for (const fieldName of ["voyage_number", "voyage_departure_date", "voyage_arrival_date"]) {
      expect(rulesOf(fieldName).product_alias, fieldName).toBe(true);
      expect(rulesOf(fieldName).evidence_level, fieldName).toBe("verified_live");
      expect(rulesOf(fieldName).observed_path, fieldName).toContain("SEA + ARRIVAL");
    }
    expect(rulesOf("sea_port_of_entry").product_alias).toBe(true);
    expect(rulesOf("sea_port_of_entry").evidence_level).toBe("verified_live_and_public_bundle_path_specific");
    expect(rulesOf("voyage_number").uncovered_paths).toEqual(["VESSEL CREW", "CRUISE PASSENGER", "CRUISE CREW"]);
    expect(rulesOf("voyage_number").uncovered_paths_evidence_level).toBe("needs_review");
    expect(rulesOf("traveller_type").sea_observed_dropdown_values).toEqual(["VESSEL CREW", "VESSEL PASSENGER"]);
    expect(rulesOf("traveller_type").unsupported_observed_but_not_seeded).toEqual(["VESSEL CREW"]);
    expect(rulesOf("traveller_type").cruise_route).toBe("separate_dashboard_route_not_ordinary_sea_dropdown");

    expect(showIf("return_date")).toBe(
      "(transport_type === AIR && passport_holder_type === FOREIGNER && (purpose_of_travel === POV001 || purpose_of_travel === POV007)) || (transport_type === SEA && purpose_of_travel === POV001)",
    );
    expect(rulesOf("return_date").official_key).toBe("return_date");
    expect(rulesOf("return_date").evidence_level).toBe("verified_live_and_public_bundle_path_specific");
    expect(rulesOf("return_date").not_air_only).toBe(true);

    expect(valuesOf("sea_port_of_entry")).toEqual([]);
    expect(valuesOf("port_of_entry")).toEqual([]);
    expect(showIf("with_transit")).toBeUndefined();
    expect(rulesOf("with_transit").transport_branch).toBe("AIR_SEA");
  });

  it("uses checkbox-safe transit conditions without mixing AIR and SEA port fields", () => {
    expect(showIf("transit_country")).toBe("with_transit === true");
    expect(showIf("transit_airport")).toBe("transport_type === AIR && with_transit === true");
    expect(showIf("transit_seaport")).toBe("transport_type === SEA && with_transit === true");
    expect(showIf("transit_date")).toBe("with_transit === true");
  });

  it("keeps destination branches transport-scoped and gives TRAVEL_PORT child fields", () => {
    expect(showIf("destination_type")).toBe(
      "flight_type === ARRIVAL && (transport_type === AIR || transport_type === SEA && flight_type === ARRIVAL && is_disembarking === true)",
    );
    expect(rulesOf("destination_type").evidence_level).toBe("verified_live_path_specific");
    expect(rulesOf("destination_type").non_disembarking_path_evidence_level).toBe("needs_review");
    expect(rulesOf("destination_type").hidden_observed_path).toContain("Manila South Harbor electronic path");
    expect(rulesOf("destination_type").allowed_by_transport).toEqual({
      AIR: ["RESIDENCE", "HOTEL", "TRANSIT"],
      SEA: ["RESIDENCE", "HOTEL", "TRAVEL_PORT"],
    });
    expect(valuesOf("destination_type").sort()).toEqual(["HOTEL", "RESIDENCE", "TRANSIT", "TRAVEL_PORT"]);

    expect(showIf("destination_residence_address")).toBe(
      "flight_type === ARRIVAL && (transport_type === AIR || transport_type === SEA && flight_type === ARRIVAL && is_disembarking === true) && destination_type === RESIDENCE",
    );
    expect(showIf("destination_hotel_name")).toBe(
      "flight_type === ARRIVAL && (transport_type === AIR || transport_type === SEA && flight_type === ARRIVAL && is_disembarking === true) && destination_type === HOTEL",
    );
    expect(showIf("destination_hotel_address")).toBe(
      "flight_type === ARRIVAL && (transport_type === AIR || transport_type === SEA && flight_type === ARRIVAL && is_disembarking === true) && destination_type === HOTEL",
    );
    expect(showIf("destination_transit_airport")).toBe("transport_type === AIR && flight_type === ARRIVAL && destination_type === TRANSIT");
    expect(showIf("destination_country")).toBe("transport_type === AIR && flight_type === ARRIVAL && destination_type === TRANSIT");
    expect(showIf("disembarking_port_code")).toBe(
      "transport_type === SEA && flight_type === ARRIVAL && is_disembarking === true && destination_type === TRAVEL_PORT",
    );
    expect(rulesOf("disembarking_port_code").official_key).toBe("disembarking_port_code");
    expect(rulesOf("disembarking_port_code").distinct_from).toBe("destination_port_code");
    expect(rulesOf("sea_port_of_entry").distinct_from).toBe("disembarking_port_code");
    expect(rulesOf("sea_port_of_entry").option_value_evidence_level).toBe("verified_public");
    expect(rulesOf("sea_port_of_entry").option_identity).toBe("code");
    expect(rulesOf("sea_port_of_entry").label_identity).toBe("name_not_unique");
    expect(rulesOf("sea_port_of_entry").port_metadata_contract).toBe(
      "dynamic_page_gate_only_not_schema_requiredness_or_port_to_customs_flow",
    );
    expect(rulesOf("sea_port_of_entry").dynamic_option_source).toEqual(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_destination_ports);
    expect(byName("disembarking_port_code").required).toBe(false);
    expect(rulesOf("disembarking_port_code").evidence_level).toBe("verified_live_and_public_bundle_path_specific");
    expect(rulesOf("disembarking_port_code").hidden_observed_path).toContain("destination_port_code");
    expect(valuesOf("disembarking_port_code")).toEqual([]);
    expect(rulesOf("disembarking_port_code").dynamic_option_source).toEqual(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_disembarking_ports);
    expect(rulesOf("disembarking_port_code").port_metadata_contract).toBe("does_not_select_customs_flow");
  });

  it("consumes E24 SEA explicit-false and manual metadata without inventing a customs-flow mapping", () => {
    expect(PH_ETRAVEL_SEA_FLOW_CLIENT_WIRING_E24.is_disembarking).toEqual({
      official_key: "is_disembarking",
      default_value: false,
      control_type: "checkbox",
      visible_when: "transport_type === SEA && flight_type === ARRIVAL",
      clear_when: ["transport_type === AIR", "flight_type === DEPARTURE"],
      clear_value: false,
      server_requiredness: "needs_review",
      live_false_continuation: "needs_review",
    });
    expect(PH_ETRAVEL_SEA_FLOW_CLIENT_WIRING_E24.falsey_destination_subtree).toMatchObject({
      visible_when: "transport_type === SEA && flight_type === ARRIVAL && is_disembarking === true",
      is_disembarking_clear_callback: "none_observed",
    });
    expect(PH_ETRAVEL_SEA_FLOW_CLIENT_WIRING_E24.falsey_destination_subtree.hidden_when_falsey).toEqual(expect.arrayContaining([
      "stay_location_type",
      "destination_upon_arrival_in_philippines",
      "is_destination_same_as_permanent_address",
      "disembarking_port_code",
    ]));

    expect(showIf("is_disembarking")).toBe("transport_type === SEA && flight_type === ARRIVAL");
    expect(showIf("destination_type")).toContain("is_disembarking === true");
    for (const fieldName of [
      "destination_residence_address",
      "destination_hotel_name",
      "destination_hotel_address",
      "disembarking_port_code",
    ]) {
      expect(showIf(fieldName), fieldName).toContain("is_disembarking === true");
      expect(showIf(fieldName), fieldName).toContain("flight_type === ARRIVAL");
    }
    for (const fieldName of ["destination_type", "destination_residence_address", "destination_hotel_name", "destination_hotel_address", "disembarking_port_code"]) {
      expect(showIf(fieldName), fieldName).not.toContain("selected_port_customs_flow");
      expect(showIf(fieldName), fieldName).not.toContain("with_custom_declaration");
    }

    expect(rulesOf("sea_port_of_entry")).toMatchObject({
      official_key: "destination_port_code",
      distinct_from: "disembarking_port_code",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_destination_ports,
      port_metadata_field: "with_custom_declaration",
      regular_page_gate: "registration.travel_port.with_custom_declaration",
      customs_hook_source_shape: "registration.with_custom_declaration",
      manual_electronic_mapping: "needs_review",
      route_selection: "needs_review_regular_vs_declaration_shortcut",
    });
    expect(rulesOf("disembarking_port_code")).toMatchObject({
      official_key: "disembarking_port_code",
      distinct_from: "destination_port_code",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_disembarking_ports,
      source_transportation_filter: "none",
      server_requiredness: "needs_review",
    });
    expect(PH_ETRAVEL_SEA_FLOW_CLIENT_WIRING_E24.ports.keys_are_aliases).toBe(false);
    expect(PH_ETRAVEL_SEA_FLOW_CLIENT_WIRING_E24.with_custom_declaration).toMatchObject({
      applicant_field: false,
      port_to_manual_or_electronic_mapping: "needs_review",
      route_selection: "needs_review_regular_vs_declaration_shortcut",
    });
    for (const fieldName of ["with_custom_declaration", "selected_port_customs_flow", "sea_manual_electronic_flag"]) {
      expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, fieldName).not.toContain(fieldName);
    }
  });

  it("consumes E23 Health client wiring without inventing server acceptance or a bats/animals question", () => {
    expect(valuesOf("with_negative_antigen")).toEqual(["true", "false"]);
    expect(showIf("with_negative_antigen")).toBe(
      "is_fully_vaccinated !== true && calculated_age_from_birth_date >= 15",
    );
    expect(byName("with_negative_antigen").required).toBe(false);
    expect(rulesOf("with_negative_antigen")).toMatchObject({
      official_key: "with_negative_antigen",
      official_control_type: "yes_no_radio_boolean",
      inherited_display_predicates: ["is_fully_vaccinated !== true", "calculated_age_from_birth_date >= 15"],
      client_requiredness: "not_in_E23_Yup_shape",
      client_change_sets: "is_with_history_exposure <- false",
      test_document_contract: "no_E23_control_upload_or_file_rule",
      server_requiredness: "needs_review",
    });

    for (const fieldName of [
      "has_recent_travel_history_30d",
      "visited_country_30d",
      "has_exposure_to_sick_person_30d",
      "has_been_sick_30d",
      "sickness_symptom",
    ]) {
      expect(byName(fieldName).required, fieldName).toBe(true);
      expect(rulesOf(fieldName).server_requiredness, fieldName).toBe("needs_review");
      expect(showIf(fieldName) ?? "always", fieldName).not.toContain("transport_type");
      expect(showIf(fieldName) ?? "always", fieldName).not.toContain("passport_holder_type");
      expect(
        PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST.find((entry) => entry.schema_field === fieldName)?.transport,
        fieldName,
      ).toBe("AIR_OR_SEA_ORDINARY_PASSENGER");
    }
    expect(valuesOf("has_recent_travel_history_30d")).toEqual(["true", "false"]);
    expect(valuesOf("has_exposure_to_sick_person_30d")).toEqual(["true", "false"]);
    expect(valuesOf("has_been_sick_30d")).toEqual(["true", "false"]);
    expect(rulesOf("has_recent_travel_history_30d")).toMatchObject({
      official_client_control_key: "meta.with_recent_travel_history",
      legacy_official_alias: "with_recent_travel_history",
      official_payload_key: "needs_review",
      client_false_clears: ["visited_countries"],
      requiredness_evidence: "official_health_screenshot_2026-08-15",
      client_requiredness: "verified_screenshot_required",
    });
    expect(showIf("visited_country_30d")).toBe("has_recent_travel_history_30d === true");
    expect(rulesOf("visited_country_30d")).toMatchObject({
      official_client_control_key: "visited_countries",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.countries,
      option_identity: "code",
      label_identity: "name",
      component_exclusion_filter: "none_observed_includes_PH",
      client_requiredness: "verified_screenshot_minimum_one_row_when_recent_travel_true",
      client_cleared_by: "has_recent_travel_history_30d === false",
      clear_on_condition_false: true,
      repeat_group: "visited_countries",
      repeat_actions: ["Add", "Delete"],
      min_items: 1,
      item_required: true,
    });
    expect(rulesOf("has_exposure_to_sick_person_30d")).toMatchObject({
      official_key: "is_with_history_exposure",
      requiredness_evidence: "official_health_screenshot_2026-08-15",
      client_requiredness: "verified_screenshot_required",
      client_child_contract: "no_child_rendered_in_screenshot",
    });
    expect(showIf("sickness_symptom")).toBe("has_been_sick_30d === true");
    expect(rulesOf("has_been_sick_30d")).toMatchObject({
      official_key: "is_sicked_within_thirty_days",
      requiredness_evidence: "official_health_screenshot_2026-08-15",
      client_requiredness: "verified_screenshot_required",
      client_change_clears: ["sickness_symptoms"],
    });
    expect(rulesOf("sickness_symptom")).toMatchObject({
      official_client_control_key: "sickness_symptoms",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sickness_symptoms,
      option_identity: "code",
      label_identity: "name",
      client_requiredness: "verified_screenshot_minimum_one_option_when_sick_true",
      client_cleared_by: "has_been_sick_30d === false",
      clear_on_condition_false: true,
      repeat_group: "sickness_symptoms",
      min_items: 1,
      max_items: 15,
    });
    expect(byName("sickness_symptom").field_type).toBe("checkbox");
    expect(PH_ETRAVEL_SICKNESS_SYMPTOM_OPTIONS.map((option) => [option.value, option.label_en])).toEqual([
      ["SS015", "Altered Mental Status"], ["SS008", "Colds"], ["SS002", "Cough"], ["SS014", "Diarrhea"], ["SS017", "Difficulty of Breathing"],
      ["SS022", "Dizziness"], ["SS001", "Fever"], ["SS005", "Headache"], ["SS023", "Loss of appetite"], ["SS016", "Loss of smell"],
      ["SS018", "Loss of taste"], ["SS006", "Muscle Pain"], ["SS011", "Nausea"], ["SS021", "Rashes, vesicles or blisters"], ["SS007", "Sore throat"],
    ]);
    expect(PH_ETRAVEL_HEALTH_DECLARATION_WARNING).toBe(
      "Any false declaration made in this context may subject the traveler to legal penalties under applicable Philippine laws including public health, quarantine and communicable diseases regulations.",
    );
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("health_declaration_warning");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("exposed_to_bats_or_sick_animals");
    const bats = PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST.find(
      (entry) => entry.semantic_key === "health.exposed_to_bats_or_sick_animals",
    );
    expect(bats).toMatchObject({
      owner: "static_action",
      applicant_answer: false,
      condition: "translation_text_only_not_current_component_control",
      evidence_level: "needs_review",
    });
  });

  it("preserves customs checklist 1-12 as itemized official yes/no answers", () => {
    const checklist = PH_ETRAVEL_FORM_FIELDS.filter((field) => /^customs_checklist_\d+$/.test(field.field_name));
    expect(checklist.map((field) => field.field_name)).toEqual(
      Array.from({ length: 12 }, (_, index) => `customs_checklist_${index + 1}`),
    );
    for (const field of checklist) {
      expect(field.options?.map((option) => option.value)).toEqual(["yes", "no"]);
      expect(field.required, field.field_name).toBe(false);
      expect(field.conditional_logic?.showIf, field.field_name).toBe(
        "(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS) && has_baggage_or_currency_to_declare === yes",
      );
      expect(field.validation_rules?.answer_contract, field.field_name).toContain("do not replace");
      expect(field.validation_rules?.evidence_level, field.field_name).toBe("needs_review_requiredness");
      const itemIndex = Number(field.field_name.replace("customs_checklist_", "")) - 1;
      expect(field.validation_rules?.official_key, field.field_name).toBe(`check_lists.${itemIndex}.response`);
      expect(field.validation_rules?.official_control_type, field.field_name).toBe("radio_pair");
      expect(field.validation_rules?.selector_evidence_level, field.field_name).toBe("confirmed_live_visible_air_positive");
    }
  });

  it("models the AIR General Declaration amount and Q3-Q12 item repeaters without inventing blockers", () => {
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("has_goods_to_declare");
    expect(showIf("goods_total_currency")).toBe(
      "(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS) && has_baggage_or_currency_to_declare === yes",
    );
    expect(showIf("goods_total_amount")).toBe(showIf("goods_total_currency"));

    for (const fieldName of ["goods_total_currency", "goods_total_amount"]) {
      expect(byName(fieldName).required, fieldName).toBe(false);
      expect(rulesOf(fieldName).evidence_level, fieldName).toBe("needs_review_requiredness");
      expect(rulesOf(fieldName).selector_evidence_level, fieldName).toBe("E42_confirmed_user_provided_behavior");
    }
    expect(rulesOf("goods_total_currency").official_key).toBe("amount_of_goods_acquired.currency");
    expect(rulesOf("goods_total_currency").official_control_type).toBe("radio");
    expect(rulesOf("goods_total_currency").currency_switch_contract).toBe(
      "Philippine_Peso_and_US_Dollar_use_the_same_amount_control",
    );
    expect(rulesOf("goods_total_amount").official_key).toBe("amount_of_goods_acquired.amount");
    expect(rulesOf("goods_total_amount").official_control_type).toBe("text");
    expect(rulesOf("goods_total_amount").initial_rendered_value).toBe("0");
    expect(rulesOf("goods_total_amount").positive_amount_rule).toEqual(PH_ETRAVEL_GENERAL_DECLARATION_POSITIVE_AMOUNT_RULE);
    expect(PH_ETRAVEL_GENERAL_DECLARATION_ITEM_IDS).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    for (const itemId of PH_ETRAVEL_GENERAL_DECLARATION_ITEM_IDS) {
      const fields = [
        `customs_checklist_${itemId}_item_description`,
        `customs_checklist_${itemId}_item_quantity`,
        `customs_checklist_${itemId}_item_amount_usd`,
      ];
      for (const fieldName of fields) {
        expect(byName(fieldName).required, fieldName).toBe(false);
        expect(showIf(fieldName), fieldName).toContain(`customs_checklist_${itemId} === yes`);
        expect(rulesOf(fieldName).customs_contract, fieldName).toBe("question_specific_goods_item_detail");
        expect(rulesOf(fieldName).repeat_group, fieldName).toBe(`customs_checklist_${itemId}_items`);
        expect(rulesOf(fieldName).repeat_contract, fieldName).toBe("baggage.items[]");
        expect(rulesOf(fieldName).official_question_key, fieldName).toBe(`check_lists.${itemId - 1}.response`);
        expect(rulesOf(fieldName).page_level_no_row_blocking, fieldName).toBe("needs_review_not_reproduced_after_delete");
      }
      expect(rulesOf(fields[0]).official_selector).toBe("description");
      expect(rulesOf(fields[1]).official_selector).toBe("quantity");
      expect(rulesOf(fields[2]).official_selector).toBe("amount");
      expect(rulesOf(fields[2]).official_row_label).toBe("Amount in USD");
    }
    for (const itemId of [1, 2]) {
      expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain(`customs_checklist_${itemId}_item_description`);
    }
  });

  it("adds structured currency-positive details without relying on aggregate/free-text substitutes", () => {
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("has_currency_to_declare");
    expect(showIf("currency_amount")).toBe("(customs_checklist_1 === yes || customs_checklist_2 === yes)");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("bsp_authorization_number");
    expect(showIf("bsp_authorization_date")).toBe("customs_checklist_1 === yes");
    expect(showIf("no_of_days_in_philippines")).toBe(
      "(customs_checklist_1 === yes || customs_checklist_2 === yes) && currency_transport_method === is_physically_transferred_by_person",
    );
    expect(showIf("courier_name")).toBe(
      "(customs_checklist_1 === yes || customs_checklist_2 === yes) && currency_transport_method === is_shipped_thru_courier_service",
    );

    for (const fieldName of [
      "currency_owner_first_name",
      "currency_owner_last_name",
      "currency_owner_country",
      "currency_owner_address",
      "currency_owner_suffix",
      "currency_recipient_first_name",
      "currency_recipient_last_name",
      "currency_recipient_country",
      "currency_recipient_address",
      "currency_recipient_suffix",
      "currency_item_currency",
      "currency_monetary_instrument",
      "currency_amount",
      "currency_source",
      "currency_transport_purpose",
      "currency_transport_method",
    ]) {
      expect(byName(fieldName).required, fieldName).toBe(false);
      expect(rulesOf(fieldName).evidence_level, fieldName).toBe("needs_review_requiredness");
      expect(rulesOf(fieldName).selector_evidence_level, fieldName).toBe("confirmed_live_visible_air_positive");
    }

    expect(rulesOf("currency_owner_not_applicable").official_key).toBe("owner_details_not_applicable");
    expect(rulesOf("currency_owner_not_applicable").selector_evidence_level).toBe("confirmed_live_E45");
    expect(rulesOf("currency_owner_not_applicable").e45_empty_state_toggle).toBe(
      "direct_owner_inputs_disabled; country_combobox_native_disabled_not_observed",
    );
    expect(rulesOf("currency_owner_first_name").official_key).toBe("owner_first_name");
    expect(rulesOf("currency_owner_suffix").official_key).toBe("owner_suffix_name");
    expect(rulesOf("currency_recipient_first_name").official_key).toBe("recipient_first_name");
    expect(rulesOf("currency_recipient_suffix").official_key).toBe("recipient_suffix_name");
    expect(rulesOf("currency_item_currency").official_key).toBe("currency_id");
    expect(rulesOf("currency_item_currency").official_value_type).toBe("numeric_id");
    expect(rulesOf("currency_monetary_instrument").official_key).toBe("monetary_instrument_id");
    expect(rulesOf("currency_monetary_instrument").official_value_type).toBe("numeric_id");
    expect(rulesOf("currency_amount").official_key).toBe("amount");
    expect(rulesOf("currency_source").official_key).toBe("currency_sources");
    expect(rulesOf("currency_source_other").official_key).toBe("currency_source_other");
    expect(rulesOf("currency_transport_purpose").official_key).toBe("transport_purposes");
    expect(rulesOf("currency_transport_purpose_other").official_key).toBe("transport_purpose_other");
    expect(rulesOf("currency_transport_method").official_key).toBe("physical_or_shipped");
    expect(rulesOf("no_of_days_in_philippines").official_key).toBe("no_of_days_in_philippines");
    expect(rulesOf("last_travel_to_philippines").official_key).toBe("last_travel_to_philippines");
    expect(rulesOf("courier_name").official_key).toBe("courier_name");
    expect(rulesOf("airway_bill_no").official_key).toBe("airway_bill_no");
    expect(rulesOf("airway_bill_date").official_key).toBe("airway_bill_date");
    for (const fieldName of ["currency_item_currency", "currency_monetary_instrument", "currency_amount"]) {
      expect(rulesOf(fieldName).modal_behavior, fieldName).toBe("Add Item repeat row");
      expect(rulesOf(fieldName).page_validation_observed, fieldName).toBe("At least have 1 item");
    }
    expect(rulesOf("currency_item_currency").empty_validation_observed).toBe("Currency Required");
    expect(rulesOf("currency_monetary_instrument").empty_validation_observed).toBe("Monetary Instrument Required");
    expect(rulesOf("currency_amount").empty_validation_observed).toBe("Amount Required");
    expect(rulesOf("currency_monetary_instrument").complete_option_list_evidence_level).toBe("verified_public");
    expect(rulesOf("currency_source").base_requiredness_evidence).toBe("supported_by_page_validation_text_not_promoted_to_field_required");
    expect(rulesOf("currency_source_other").empty_validation_observed).toBe("Required");
    expect(rulesOf("currency_source_other").validated_required_when).toBe("currency_source includes OTHER");
    expect(rulesOf("currency_source_other").e45_live_other_child_visibility).toBe(
      "not_rendered_current_build; E7_wiring_conflict_needs_review",
    );
    expect(rulesOf("currency_transport_purpose").base_requiredness_evidence).toBe(
      "supported_by_page_validation_text_not_promoted_to_field_required",
    );
    expect(rulesOf("currency_transport_purpose_other").empty_validation_observed).toBe("Required");
    expect(rulesOf("currency_transport_purpose_other").validated_required_when).toBe("currency_transport_purpose includes OTHER");
    expect(rulesOf("currency_transport_purpose_other").e45_live_other_child_visibility).toBe(
      "not_rendered_current_build; E7_wiring_conflict_needs_review",
    );
    expect(rulesOf("currency_transport_method").base_requiredness_evidence).toBe(
      "courier_child_validation_observed; base method otherwise needs_review",
    );
    for (const fieldName of ["courier_name", "airway_bill_no", "airway_bill_date"]) {
      expect(rulesOf(fieldName).empty_validation_observed, fieldName).toBe("Required");
      expect(rulesOf(fieldName).validated_required_when, fieldName).toBe(
        "currency_transport_method === is_shipped_thru_courier_service",
      );
    }
    for (const fieldName of ["no_of_days_in_philippines", "last_travel_to_philippines"]) {
      expect(byName(fieldName).required, fieldName).toBe(false);
      expect(rulesOf(fieldName).physical_branch_empty_validation, fieldName).toBe("Required");
      expect(rulesOf(fieldName).validated_required_when, fieldName).toBe(
        "currency_transport_method === is_physically_transferred_by_person",
      );
      expect(rulesOf(fieldName).requiredness_evidence, fieldName).toBe(
        "verified_live_air_and_sea_electronic_positive_physical_branch_only",
      );
    }

    expect(byName("currency_source").field_type).toBe("checkbox");
    expect(rulesOf("currency_source").repeat_group).toBe("currency_sources");
    expect(byName("currency_transport_purpose").field_type).toBe("checkbox");
    expect(rulesOf("currency_transport_purpose").repeat_group).toBe("transport_purposes");
    expect(rulesOf("currency_item_currency").repeat_group).toBe("currency_items");
    expect(rulesOf("currency_monetary_instrument").repeat_group).toBe("currency_items");
    expect(rulesOf("currency_amount").repeat_contract).toBe("items[]");
    expect(rulesOf("currency_item_currency").runner_aliases).toEqual(["currency", "currency_name", "currency_type"]);
    expect(rulesOf("currency_monetary_instrument").runner_aliases).toEqual([
      "monetary_instrument",
      "instrument",
      "currency_item_monetary_instrument",
    ]);
    expect(rulesOf("currency_amount").runner_aliases).toEqual(["amount", "currency_item_amount"]);
    expect(rulesOf("currency_source").runner_aliases).toEqual(["currency_sources", "source_of_currency"]);
    expect(rulesOf("currency_transport_purpose").runner_aliases).toEqual([
      "currency_transport_purposes",
      "purpose_of_currency_transport",
    ]);
    expect(rulesOf("currency_transport_method").runner_aliases).toEqual([
      "currency_transfer_method",
      "currency_physical_or_courier",
    ]);
    expect(rulesOf("currency_owner_first_name").runner_aliases).toEqual(["currency_owner_given_name"]);
    expect(rulesOf("currency_recipient_last_name").runner_aliases).toEqual([
      "currency_recipient_family_name",
      "currency_recipient_surname",
    ]);
    expect(rulesOf("airway_bill_no").runner_aliases).toEqual(["airway_bill_number"]);
    expect(rulesOf("airway_bill_no").runner_plan_key).toBe("airway_bill_number");
    expect(PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS).toHaveLength(16);
    expect(valuesOf("currency_monetary_instrument")).toContain("15");
  });

  it("keeps SEA manual customs and electronic positive customs as separate paths", () => {
    expect(showIf("sea_manual_customs_forms_notice")).toBe("transport_type === SEA && selected_port_customs_flow === MANUAL_FORMS");
    expect(rulesOf("sea_manual_customs_forms_notice").evidence_level).toBe("verified_live");
    expect(rulesOf("sea_manual_customs_forms_notice").not_electronic_customs_questions).toBe(true);
    expect(rulesOf("sea_manual_customs_forms_notice").selected_port_customs_flow_contract).toBe(
      "derived_port_metadata_not_applicant_field",
    );
    expect(rulesOf("sea_manual_customs_forms_notice").unverified_variants).toEqual([
      "SEA_NON_DISEMBARKING",
      "SEA_OTHER_PORT_CUSTOMS_FLOW",
      "SEA_ELECTRONIC_POSITIVE_POST_SIGNATURE",
    ]);

    expect(showIf("customs_information_acknowledgement")).toBe("(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS)");
    expect(showIf("has_baggage_or_currency_to_declare")).toBe("(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS)");
    expect(rulesOf("has_baggage_or_currency_to_declare").evidence_level).toBe("verified_live_air_and_sea_electronic_confirmation");
    expect(rulesOf("has_baggage_or_currency_to_declare").sea_electronic_observed_path).toContain("Manila South Harbor");
    expect(rulesOf("has_baggage_or_currency_to_declare").sea_electronic_positive_branch_evidence_level).toBe(
      "verified_live_through_signature_page",
    );
    expect(rulesOf("has_baggage_or_currency_to_declare").sea_electronic_positive_post_signature_evidence_level).toBe("needs_review");
    expect(byName("customs_information_acknowledgement").required).toBe(false);
    expect(byName("has_baggage_or_currency_to_declare").required).toBe(false);
    expect(rulesOf("has_baggage_or_currency_to_declare").official_key).toBe("with_something_to_declare_arrival");
    expect(rulesOf("has_baggage_or_currency_to_declare").official_control_type).toBe("yes_no_button");

    expect(showIf("customs_signature")).toBe("(transport_type === AIR || selected_port_customs_flow === ELECTRONIC_CUSTOMS)");
    expect(rulesOf("customs_signature").evidence_level).toBe("verified_live_air_and_sea_electronic_signature_page_not_universal_sea");
    expect(rulesOf("customs_signature").sea_manual_forms_path).toBe("not_shown_before_review");
    expect(rulesOf("customs_signature").sea_electronic_post_signature_evidence_level).toBe("verified_live_no_declaration_path");
    expect(rulesOf("customs_signature").sea_electronic_positive_branch_evidence_level).toBe("verified_live_signature_page_required");
    expect(rulesOf("customs_signature").sea_electronic_positive_post_signature_evidence_level).toBe("needs_review");
    expect(rulesOf("customs_signature").attachment_file_input_evidence_level).toBe("needs_review_not_stably_observed");
    expect(rulesOf("customs_signature").attachment_mime_size_requiredness).toBe("needs_review");
    expect(rulesOf("customs_signature").attachment_surface_variant).toBe(
      "AIR_Q3_to_Q12_any_yes_attachment_plus_signature; Q3_to_Q12_all_no_signature_only",
    );
    expect(rulesOf("customs_signature").attachment_requiredness).toBe(
      "verified_live_AIR_client_not_required_E45; SEA_and_server_acceptance_needs_review",
    );
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("customs_attachment_file");
    expect(rulesOf("customs_signature").universal_sea_requiredness).toBe("not_verified");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("selected_port_customs_flow");
  });

  it("covers E11 SEA electronic Yes controls through its signature page without promoting later stages", () => {
    const coverage = PH_ETRAVEL_SEA_ELECTRONIC_POSITIVE_COVERAGE;
    expect(coverage.evidence).toBe("E11");
    expect(coverage.observed_path).toContain("SEA + ARRIVAL + VESSEL PASSENGER");
    expect(coverage.page_order).toEqual([
      "Customs Declaration Confirmation:Yes",
      "Other Travel Details",
      "Customs General Declaration",
      "Customs Currency Declaration",
      "For Customs - Declaration Attachments and Signature",
    ]);
    expect(coverage.selector_reuse_scope).toBe("AIR_E7_and_SEA_E10_E11_electronic_positive_through_signature_page_only");
    expect(coverage.confirmed_through).toBe("For Customs - Declaration Attachments and Signature");

    for (const fieldName of coverage.field_names) {
      expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, fieldName).toContain(fieldName);
    }
    expect(coverage.field_names).toEqual(expect.arrayContaining([
      "customs_checklist_1",
      "customs_checklist_12",
      "goods_total_amount",
      "currency_owner_first_name",
      "currency_recipient_first_name",
      "currency_item_currency",
      "currency_source",
      "currency_transport_purpose",
      "no_of_days_in_philippines",
      "courier_name",
      "customs_signature",
    ]));

    for (const fieldName of coverage.field_names.filter((name) =>
      name !== "customs_signature" && (name.startsWith("customs_") || name.startsWith("goods_") || name.startsWith("currency_") || [
        "bsp_authorization_date",
        "no_of_days_in_philippines",
        "last_travel_to_philippines",
        "courier_name",
        "airway_bill_no",
        "airway_bill_date",
      ].includes(name)),
    )) {
      expect(byName(fieldName).required, fieldName).toBe(false);
    }

    expect(coverage.excluded_paths).toEqual([
      "SEA_MANUAL_FORMS",
      "SEA_ELECTRONIC_NO_DECLARATION",
      "SEA_NON_DISEMBARKING_OR_UNOBSERVED_PORT",
    ]);
    expect(coverage.field_names).not.toEqual(expect.arrayContaining([
      "data_privacy_agreement",
      "customs_attachment_file",
      "customs_signature_file",
      "family_member_gate_confirmation",
      "review_summary",
      "official_reference_number",
      "etravel_qr_code",
      "final_submit",
    ]));
    expect(coverage.attachment_surface_evidence).toBe("upload_copy_visible_without_stable_file_input_mime_size_or_requiredness");
    expect(coverage.attachment_schema_status).toBe("not_an_applicant_file_field_pending_official_file_contract");
    expect(coverage.post_signature_unverified).toEqual(expect.arrayContaining([
      "family_member_gate",
      "summary",
      "final_submit",
      "official_reference",
      "result.reference_qr_render",
      "result_recovery",
    ]));
  });

  it("lets currency owner N/A bypass owner detail fields before Review requiredness is proven", () => {
    expect(byName("currency_owner_not_applicable").required).toBe(false);

    for (const fieldName of [
      "currency_owner_first_name",
      "currency_owner_middle_name",
      "currency_owner_last_name",
      "currency_owner_business_name",
      "currency_owner_suffix",
      "currency_owner_occupation",
      "currency_owner_country",
      "currency_owner_address",
      "currency_owner_postal_code",
    ]) {
      expect(byName(fieldName).required, fieldName).toBe(false);
      expect(showIf(fieldName), fieldName).toBe(
        "(customs_checklist_1 === yes || customs_checklist_2 === yes) && currency_owner_not_applicable !== true",
      );
      expect(rulesOf(fieldName).required_unless, fieldName).toBe("currency_owner_not_applicable === true");
    }
  });

  it("keeps E11 selector evidence from closing attachment and other still-unverified gaps", () => {
    expect(rulesOf("currency_owner_not_applicable").selector_evidence_level).toBe("confirmed_live_E45");
    expect(rulesOf("currency_owner_first_name").evidence_level).toBe("needs_review_requiredness");
    expect(rulesOf("currency_recipient_first_name").evidence_level).toBe("needs_review_requiredness");

    expect(rulesOf("no_of_days_in_philippines").requiredness_evidence).toBe(
      "verified_live_air_and_sea_electronic_positive_physical_branch_only",
    );
    expect(rulesOf("last_travel_to_philippines").requiredness_evidence).toBe(
      "verified_live_air_and_sea_electronic_positive_physical_branch_only",
    );
    expect(rulesOf("customs_checklist_3_item_description").page_level_no_row_blocking).toBe("needs_review_not_reproduced_after_delete");
    expect(rulesOf("currency_item_currency").complete_option_list_evidence_level).toBe("verified_public_dynamic_source");
    expect(rulesOf("currency_item_currency").dynamic_option_source).toEqual(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.currencies);
    expect(rulesOf("currency_item_currency").option_identity).toBe("id");
    expect(rulesOf("currency_item_currency").label_identity).toBe("name_not_unique");
    expect(rulesOf("currency_monetary_instrument").complete_option_list_evidence_level).toBe("verified_public");
    expect(rulesOf("currency_monetary_instrument").official_value_type).toBe("numeric_id");

    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("travel_document");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("profile_photo");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("customs_attachment_file");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("customs_signature_file");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("official_reference_number");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("etravel_qr_code");
  });

  it("keeps confirmed Other Travel Details value keys distinct from their display labels", () => {
    expect(rulesOf("accompanied_under_18_count").official_key).toBe("accompanied_family_members.below_eighteen");
    expect(rulesOf("accompanied_18_plus_count").official_key).toBe("accompanied_family_members.above_or_equal_eighteen");
    expect(rulesOf("checked_baggage_count").official_key).toBe("no_of_checked_in_baggages");
    expect(rulesOf("checked_baggage_count").official_label_key).toBe("no_of_baggage");
    expect(rulesOf("handcarry_baggage_count").official_key).toBe("no_of_hand_carried_baggages");
    expect(rulesOf("first_time_visiting_philippines").official_key).toBe("first_time_visit");
  });

  it("freezes remaining launch gaps by evidence and implementation owner", () => {
    expect(PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE.official_evidence_required).toEqual([
      "attachment_requiredness_file_input",
      "currency_owner_recipient_full_requiredness",
      "customs_other_goods_no_row_page_blocking",
      "sea_non_disembarking_path",
      "sea_disembarking_question_applicability",
      "sea_port_customs_variants",
      "sea_electronic_customs_signature_variants",
      "sea_electronic_positive_post_signature_path",
      "final_submit_reference_qr_result_recovery",
    ]);
    expect(PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE.option_snapshot_required).toEqual([
      "currency_options_complete_current_snapshot",
      "monetary_instrument_options_complete_current_snapshot",
      "sea_ports_with_customs_flow_snapshot",
    ]);
    expect(PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE.frontend_shared_required).toEqual([
      "dynamic_form_attachment_file_condition_ui",
      "dynamic_form_structured_customs_currency_ui",
      "dynamic_form_sea_non_disembarking_and_port_customs_conditions",
      "shared_result_status_reference_qr_gate",
    ]);
    expect(PH_ETRAVEL_REMAINING_SCHEMA_GAP_FREEZE.runner_required).toEqual([
      "air_positive_customs_currency_phased_enablement",
      "owner_not_applicable_selector_strategy",
      "physical_branch_validation_strategy",
      "sea_port_customs_flow_runtime_detection",
      "final_result_recovery_without_resubmit",
    ]);

    const frozenApplicantFields = [
      "travel_document",
      "profile_photo",
      "customs_attachment_file",
      "customs_signature_file",
      "selected_port_customs_flow",
      "with_custom_declaration",
      "review_summary",
      "official_reference_number",
      "etravel_qr_code",
      "final_submit",
    ];
    for (const fieldName of frozenApplicantFields) {
      expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES, fieldName).not.toContain(fieldName);
    }
  });

  it("marks option values as official snapshot-backed or needs_review", () => {
    for (const field of PH_ETRAVEL_FORM_FIELDS) {
      for (const option of field.options ?? []) {
        const isSnapshotBacked = officialSnapshotValues.has(String(option.value)) || option.evidence_level === "official_snapshot";
        expect(
          isSnapshotBacked || option.evidence_level === "verified_public" || option.evidence_level === "needs_review",
          `${field.field_name}:${option.value}`,
        ).toBe(true);
      }
    }

    expect(PH_ETRAVEL_CURRENCY_SOURCE_OPTIONS.map((option) => option.value)).toEqual(["SALARY", "BUSINESS", "OTHER"]);
    expect(PH_ETRAVEL_CURRENCY_PURPOSE_OPTIONS.map((option) => option.value)).toEqual([
      "LEISURE",
      "MEDICAL",
      "PAYABLES",
      "EDUCATION",
      "OTHER",
    ]);
    for (const option of [
      ...PH_ETRAVEL_CURRENCY_SOURCE_OPTIONS,
      ...PH_ETRAVEL_CURRENCY_PURPOSE_OPTIONS,
      ...PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS,
    ]) {
      expect(option.evidence_level, option.value).toBe("verified_public");
      expect(option.official_source, option.value).toMatch(/2026-08-01|official public API/);
    }
    expect(PH_ETRAVEL_CURRENCY_SOURCE_OPTIONS.map((option) => option.value)).not.toEqual(expect.arrayContaining(["SAVINGS", "INVESTMENT"]));
    expect(PH_ETRAVEL_CURRENCY_PURPOSE_OPTIONS.map((option) => option.value)).not.toEqual(expect.arrayContaining(["TRAVEL", "PAYMENT"]));
  });

  it("uses E13's complete small lists and dynamic contracts for large official responses", () => {
    expect(PH_ETRAVEL_PURPOSE_OPTIONS.map(({ value, label_en }) => [value, label_en])).toEqual([
      ["OFW", "OFW"], ["POV006", "Business/Professional"], ["POV002", "Convention/Conference"],
      ["POV003", "Education/Training/Studies"], ["POV004", "Government/Official Mission"], ["POV005", "Health/Medical Reason"],
      ["POV001", "Holiday/Pleasure/Vacation"], ["POV010", "Incentive"], ["POV017", "Meetings"], ["POV999", "Others"],
      ["POV009", "Religion/Pilgrimage"], ["POV011", "Returning Resident"], ["POV018", "Trade Fair/Exhibition"],
      ["POV012", "Transit"], ["POV007", "Visit Friends/Relatives"], ["POV008", "Work/Employment"],
    ]);
    expect(PH_ETRAVEL_OCCUPATION_OPTIONS.map(({ value, label_en }) => [value, label_en])).toEqual([
      ["OCC003", "Agriculture"], ["OCC010", "Airline Crew"], ["OCC015", "Businessman"], ["OCC002", "Clerical/Sales"],
      ["OCC011", "Diplomat"], ["OCC013", "Domestic Helper"], ["OCC012", "Entertainer"], ["OCC006", "Housewife"],
      ["OCC005", "Military/Government Personnel"], ["OCC001", "Professional/Technical/Administrative"],
      ["OCC008", "Retired/Pensioner"], ["OCC009", "Seaman"], ["OCC007", "Student/Minor"],
      ["OCC014", "Unemployed"], ["OCC004", "Worker/Laborer"],
    ]);
    expect(PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS.map(({ value, label_en }) => [value, label_en])).toEqual([
      ["1", "CASH"], ["2", "BONDS"], ["3", "COMMERCIAL PAPERS"], ["4", "CONFIRMATION OF SALE/INVESTMENT"],
      ["5", "COSTUDIAL RECEIPTS"], ["6", "DEPOSIT CERTIFICATES"], ["7", "DEPOSIT SUBSTITUTE INSTRUMENTS"], ["8", "DRAFTS"],
      ["9", "MONEY ORDERS"], ["10", "NOTES"], ["11", "OTHER CHECKS"], ["12", "SECURITIES"], ["13", "TRADING ORDERS"],
      ["14", "TRANSACTION TICKETS"], ["15", "TRAVELER'S CHECK"], ["16", "TRUST CERTIFICATES"],
    ]);
    for (const list of [PH_ETRAVEL_PURPOSE_OPTIONS, PH_ETRAVEL_OCCUPATION_OPTIONS, PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS]) {
      expect(new Set(list.map((option) => option.value)).size).toBe(list.length);
      expect(list.every((option) => option.evidence_level === "verified_public")).toBe(true);
      expect(list.every((option) => /^E13(?:\/E45)? official public API/.test(option.official_source ?? ""))).toBe(true);
    }

    expect(PH_ETRAVEL_COUNTRY_OPTIONS).toEqual([]);
    expect(PH_ETRAVEL_SEA_PORT_OPTIONS).toEqual([]);
    expect(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.countries).toMatchObject({
      endpoint: "/api/v1/common/countries", response_identity: "code", response_label: "name_or_nationality_by_control",
    });
    expect(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.currencies).toMatchObject({
      endpoint: "/api/v1/common/currencies", response_identity: "id", response_label: "name",
    });
    expect(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_destination_ports.query).toContain("transportation_type=SEA");
    expect(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.sea_disembarking_ports.query).not.toContain("transportation_type=SEA");
    for (const source of Object.values(PH_ETRAVEL_DYNAMIC_OPTION_SOURCES)) {
      expect(source.evidence_level).toBe("verified_public");
      expect(source.official_source).toContain("intentionally not embedded");
    }
  });

  it("consumes E22 AIR and destination bundle wiring without promoting static client validation to server requiredness", () => {
    expect(byName("airline_name").required).toBe(false);
    expect(valuesOf("airline_name")).toEqual([]);
    expect(rulesOf("airline_name")).toMatchObject({
      official_key: "travel_company_code",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.air_travel_companies,
      client_clear_on_change: ["flight_number", "flight_number_special", "destination_port_code"],
      server_requiredness: "needs_review",
    });
    expect(valuesOf("origin_country")).toEqual([]);
    expect(rulesOf("origin_country")).toMatchObject({
      official_key: "origin_country_code",
      client_excludes_country_code: "PH",
      client_requiredness: "public_bundle_only",
      server_requiredness: "needs_review",
    });
    expect(byName("flight_number").required).toBe(false);
    expect(rulesOf("flight_number")).toMatchObject({
      official_key: "flight_number",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.air_flight_numbers,
      special_flight_sentinel: "SPECIAL FLIGHT",
      selected_option_metadata_sets: "destination_port_code <- travel_port_code",
      server_requiredness: "needs_review",
    });

    const specialFlight = byName("flight_number_special");
    expect(specialFlight.required).toBe(false);
    expect(specialFlight.field_type).toBe("text");
    expect(showIf("flight_number_special")).toBe("transport_type === AIR && flight_number === SPECIAL FLIGHT");
    expect(rulesOf("flight_number_special")).toMatchObject({
      official_key: "flight_number_special",
      derived_ui_state: "flight_number === SPECIAL FLIGHT",
      not_an_official_boolean: "is_special_flight",
      uppercase: true,
      minLength: 5,
      server_requiredness: "needs_review",
    });

    expect(showIf("return_date")).toBe(
      "(transport_type === AIR && passport_holder_type === FOREIGNER && (purpose_of_travel === POV001 || purpose_of_travel === POV007)) || (transport_type === SEA && purpose_of_travel === POV001)",
    );
    expect(byName("return_date").required).toBe(false);
    expect(rulesOf("return_date").client_minimum_divergence).toBe("renderer_today_vs_Yup_travel_date");
    expect(rulesOf("return_date").server_requiredness).toBe("needs_review");

    for (const fieldName of [
      "transit_country",
      "transit_airport",
      "transit_date",
      "destination_type",
      "destination_residence_address",
      "destination_hotel_name",
      "destination_transit_airport",
      "destination_country",
      "port_of_entry",
    ]) {
      expect(byName(fieldName).required, fieldName).toBe(false);
      expect(rulesOf(fieldName).server_requiredness, fieldName).toBe("needs_review");
    }
    expect(rulesOf("with_transit")).toMatchObject({
      official_key: "with_transit",
      public_bundle_name_and_id: "with_transit",
      client_clear_on_toggle: "does_not_clear_existing_children",
    });
    expect(rulesOf("destination_type").client_clear_on_change).toEqual([
      "destination_upon_arrival_in_philippines",
      "transit_port_code",
      "transit_destination_country_code",
      "is_destination_same_as_permanent_address",
    ]);

    expect(rulesOf("destination_same_as_residence")).toMatchObject({
      official_key: "is_destination_same_as_permanent_address",
      client_true_value_writes: "destination_upon_arrival_in_philippines <- profile display address",
      client_false_value_clears: "destination_upon_arrival_in_philippines",
      server_requiredness: "needs_review",
    });
    expect(rulesOf("destination_hotel_name")).toMatchObject({
      official_key: "destination_upon_arrival_in_philippines",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.hotels,
      option_identity: "no_stable_hotel_code_observed",
    });
    expect(rulesOf("destination_hotel_address")).toMatchObject({
      official: false,
      schema_status: "product_alias_without_E22_official_input_key",
      evidence_level: "needs_review",
    });
    expect(valuesOf("destination_transit_airport")).toEqual(["TP001", "TP1000", "TP2000", "TP3000"]);
    expect(rulesOf("destination_transit_airport")).toMatchObject({
      official_key: "transit_port_code",
      fixed_public_bundle_values: ["TP1000", "TP2000", "TP3000", "TP001"],
      server_requiredness: "needs_review",
    });
    expect(rulesOf("destination_country")).toMatchObject({
      official_key: "transit_destination_country_code",
      client_excludes_country_code: "PH",
      server_requiredness: "needs_review",
    });
    expect(rulesOf("port_of_entry")).toMatchObject({
      official_key: "destination_port_code",
      dynamic_option_source: PH_ETRAVEL_DYNAMIC_OPTION_SOURCES.air_destination_ports,
      port_metadata_contract: "dynamic_metadata_only_not_schema_requiredness_or_air_customs_flow",
      server_requiredness: "needs_review",
    });
    expect(valuesOf("port_of_entry")).toEqual([]);
  });

  it("keeps E17's result, runtime, and unsupported rows outside applicant questions", () => {
    expect(PH_ETRAVEL_ARRIVAL_CONTRACT_AUDIT).toEqual({
      canonical_rows: 111,
      confirmed_live_rows: 56,
      verified_public_rows: 19,
      needs_review_rows: 36,
      unsupported_or_diverted_rows: 8,
    });

    const manifest = PH_ETRAVEL_ORDINARY_ARRIVAL_APPLICANT_QUESTION_MANIFEST;
    const bySemanticKey = (key: string) => manifest.find((entry) => entry.semantic_key === key)!;
    for (const key of [
      "profile.photo_url",
      "residence.region_code",
      "attachments.travel_document",
    ]) {
      expect(bySemanticKey(key).evidence_level, key).toBe("needs_review");
      expect(bySemanticKey(key).schema_field, key).toBeUndefined();
    }
    expect(bySemanticKey("health.with_negative_antigen")).toMatchObject({
      owner: "schema",
      applicant_answer: true,
      schema_field: "with_negative_antigen",
      evidence_level: "verified_public_bundle",
    });
    expect(bySemanticKey("air.is_special_flight")).toMatchObject({
      owner: "runtime",
      applicant_answer: false,
      evidence_level: "verified_public_bundle",
      persistence_boundary: "derived_ui_state_not_official_payload",
    });
    expect(bySemanticKey("air.is_special_flight").schema_field).toBeUndefined();
    expect(bySemanticKey("air.special_flight_number")).toMatchObject({
      owner: "schema",
      applicant_answer: true,
      schema_field: "flight_number_special",
      evidence_level: "verified_public_bundle",
    });
    expect(bySemanticKey("result.reference_qr_render").legacy_aliases).toEqual(["result.qr_artifact"]);
    for (const key of ["result.reference_qr_render", "result.official_reference", "account.otp", "summary.final_submit", "privacy.copy"]) {
      expect(bySemanticKey(key).applicant_answer, key).toBe(false);
    }
  });

  it("requires signature canvas before Review without requiring an unconditional signature file", () => {
    const signature = byName("customs_signature");
    expect(signature.field_type).toBe("signature_pad");
    expect(signature.required).toBe(true);
    expect(signature.step_name).toBe("Declaration Attachments and Signature");
    expect(rulesOf("customs_signature").official_key).toBe("signature");
    expect(rulesOf("customs_signature").signature_source).toBe("PAD");
    expect(rulesOf("customs_signature").gate).toBe("review_precondition");
    expect(rulesOf("customs_signature").not_a_file_upload).toBe(true);
    expect(rulesOf("customs_signature").error_text_observed).toEqual([
      "Required",
      "Please make sure to fill out all required fields.",
    ]);
    expect(rulesOf("customs_signature").sea_electronic_positive_observed_path).toContain("E11");

    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("profile_photo");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("customs_signature_file");
    expect(byName("customs_signature_declaration").required).toBe(false);
    expect(rulesOf("customs_signature_declaration").not_a_checkbox).toBe(true);
  });

  it("models the Family Member(s) gate as a shared Review precondition", () => {
    const gate = byName("family_member_gate_confirmation");
    expect(gate.step_number).toBeGreaterThan(byName("customs_signature").step_number);
    expect(gate.step_name).toBe("Family Member(s)");
    expect(gate.field_type).toBe("confirmation_gate");
    expect(gate.required).toBe(true);
    expect(showIf("family_member_gate_confirmation")).toBe("selected_family_members_count === 0");
    expect(valuesOf("family_member_gate_confirmation")).toEqual(["NO_COMPANION_CONFIRMED", "RETURN_TO_SELECT_FAMILY"]);
    expect(rulesOf("family_member_gate_confirmation").gate).toBe("pre_review_family_member_gate");
    expect(rulesOf("family_member_gate_confirmation").air_electronic_customs_sequence).toBe("after_signature_before_review");
    expect(rulesOf("family_member_gate_confirmation").sea_manual_forms_sequence).toBe(
      "after_manual_customs_notice_before_review",
    );
    expect(rulesOf("family_member_gate_confirmation").sea_electronic_no_declaration_sequence).toBe(
      "after_signature_before_summary",
    );
    expect(rulesOf("family_member_gate_confirmation").sea_electronic_no_declaration_summary_evidence_level).toBe("verified_live");
    expect(rulesOf("family_member_gate_confirmation").sea_electronic_positive_post_signature_evidence_level).toBe(
      "needs_review",
    );
    expect(rulesOf("family_member_gate_confirmation").non_submitted_gate).toBe(true);
    expect(rulesOf("family_member_gate_confirmation").not_a_nested_applicant_field).toBe(true);
    expect(rulesOf("family_member_gate_confirmation").creates_individual_declarations).toBe(true);
    expect(showIf("family_member_gate_confirmation")).not.toContain("transport_type");
  });

  it("does not seed Review-only result fields as applicant questions", () => {
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("review_summary");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("new_travel_declaration_summary");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("official_reference_number");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("etravel_qr_code");
    expect(PH_ETRAVEL_OFFICIAL_FIELD_NAMES).not.toContain("final_submit");
  });

  it("keeps Chinese labels on every field", () => {
    for (const field of PH_ETRAVEL_FORM_FIELDS) {
      expect(field.validation_rules?.label_zh, field.field_name).toEqual(expect.any(String));
      expect((field.validation_rules?.label_zh as string).length, field.field_name).toBeGreaterThan(0);
    }
  });
});
