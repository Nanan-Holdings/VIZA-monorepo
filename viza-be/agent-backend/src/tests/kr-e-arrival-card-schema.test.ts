import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { KR_E_ARRIVAL_CARD_VISA_TYPE, KR_E_ARRIVAL_FORM_FIELDS } from "../../scripts/kr-e-arrival/form-fields";
import {
  KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES,
  KR_E_ARRIVAL_OCCUPATION_OPTIONS,
  KR_E_ARRIVAL_PURPOSE_OPTIONS,
  KR_E_ARRIVAL_SEX_OPTIONS,
} from "../../scripts/kr-e-arrival/official-options";
import { toBilingualSeedRow } from "../../scripts/bilingual-seed-row";

const migrationSource = readFileSync(
  new URL("../../drizzle/0151_kr_e_arrival_card.sql", import.meta.url),
  "utf8",
);
const officialFieldContractMigrationSource = readFileSync(
  new URL("../../drizzle/0161_kr_e_arrival_official_field_contract.sql", import.meta.url),
  "utf8",
);
const ragSource = readFileSync(
  new URL("../../../../knowledge-base/visa-rag-seeds/countries/south_korea.json", import.meta.url),
  "utf8",
);
const snapshot = JSON.parse(
  readFileSync(new URL("../../scripts/kr-e-arrival/official-options.snapshot.json", import.meta.url), "utf8"),
) as { snapshotVersion: string; reviewedAt: string; sourceEndpoints: Record<string, string> };

describe("Korea e-Arrival Card backend schema", () => {
  it("uses a separate package and has the official identity, trip, purpose, occupation, stay fields", () => {
    expect(KR_E_ARRIVAL_CARD_VISA_TYPE).toBe("KR_E_ARRIVAL_CARD");
    const names = new Set(KR_E_ARRIVAL_FORM_FIELDS.map((field) => field.field_name));
    for (const field of [
      "surname",
      "given_name",
      "date_of_birth",
      "nationality",
      "sex",
      "passport_number",
      "passport_expiry_date",
      "arrival_mode",
      "arrival_date",
      "arrival_flight_number",
      "arrival_ship_name",
      "departure_mode",
      "departure_date",
      "purpose_of_entry",
      "occupation",
      "stay_address_search",
      "stay_address_ko",
      "stay_address_en",
      "stay_address_detail",
      "stay_postal_code",
      "stay_contact_phone",
      "declaration_confirmed",
    ]) {
      expect(names.has(field), `${field} missing`).toBe(true);
    }
    expect(names.has("visa_number")).toBe(false);
    expect(names.has("email_address")).toBe(false);
    expect(names.has("official_payment_card_number")).toBe(false);
    const declaration = KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "declaration_confirmed");
    expect(declaration).toMatchObject({ field_type: "checkbox", required: true, step_number: 4 });
    expect(declaration?.validation_rules).toMatchObject({
      boolean_contract: "must_be_true",
      official_value: "true",
      official_statement_en: "I declare that the information provided is true and correct.",
    });
    expect(KR_E_ARRIVAL_FORM_FIELDS.length).toBeGreaterThanOrEqual(25);
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "arrival_mode"))
      .toMatchObject({ field_type: "radio", required: true });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "departure_mode"))
      .toMatchObject({ field_type: "radio", required: true });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "arrival_flight_number")?.conditional_logic)
      .toEqual({ showIf: 'arrival_mode === "A"' });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "arrival_ship_name")?.conditional_logic)
      .toEqual({ showIf: 'arrival_mode === "S"' });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "date_of_birth")?.validation_rules)
      .toMatchObject({ official_control: "date_parts" });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "passport_expiry_date")?.validation_rules)
      .toMatchObject({ official_control: "date_parts" });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "arrival_date")?.validation_rules)
      .toMatchObject({ official_control: "formatted_date_text" });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "nationality")?.validation_rules)
      .toMatchObject({ official_control: "country_search" });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "stay_address_search"))
      .toMatchObject({ field_type: "address_lookup", required: true });
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "stay_address_search")?.validation_rules)
      .toMatchObject({
        source: "korea_e_arrival_card_address_search",
        remote_search: true,
        derived_fields: ["stay_address_ko", "stay_address_en", "stay_postal_code"],
      });
    for (const fieldName of ["stay_address_ko", "stay_address_en", "stay_postal_code"]) {
      expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === fieldName)?.validation_rules)
        .toMatchObject({ read_only: true, derived_from: "stay_address_search" });
    }
  });

  it("keeps official English values and Chinese labels separate", () => {
    for (const field of KR_E_ARRIVAL_FORM_FIELDS) {
      expect(field.validation_rules?.label_zh, field.field_name).toMatch(/[\u3400-\u9fff]/);
      for (const option of field.options ?? []) {
        expect(option.label_en).toBe(option.official_label);
        expect(option.text).toBe(option.official_label);
        expect(option.label_zh, `${field.field_name}:${option.value}`).toMatch(/[\u3400-\u9fff]/);
      }
    }
    expect(KR_E_ARRIVAL_SEX_OPTIONS.map((item) => item.value)).toEqual(["F", "M", "X"]);
    expect(KR_E_ARRIVAL_SEX_OPTIONS.map((item) => item.official_label)).toEqual([
      "Female",
      "Male",
      "Third gender",
    ]);
    expect(KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "arrival_mode")?.options)
      .toMatchObject([
        { value: "A", code: "A", official_label: "Air" },
        { value: "S", code: "S", official_label: "Sea" },
      ]);
    for (const option of [...KR_E_ARRIVAL_SEX_OPTIONS, ...KR_E_ARRIVAL_PURPOSE_OPTIONS, ...KR_E_ARRIVAL_OCCUPATION_OPTIONS]) {
      expect(option.code).toBe(option.value);
      expect(option.text).toBe(option.official_label);
    }
    const seededSex = toBilingualSeedRow("KR_E_ARRIVAL_CARD", KR_E_ARRIVAL_FORM_FIELDS.find((field) => field.field_name === "sex")!);
    expect(seededSex.options?.[0]).toMatchObject({ value: "F", code: "F", official_label: "Female" });
    expect(KR_E_ARRIVAL_PURPOSE_OPTIONS.map((item) => item.value)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "99",
    ]);
    expect(KR_E_ARRIVAL_PURPOSE_OPTIONS.map((item) => item.official_label)).toEqual([
      "Tourism (individual)",
      "Tourism (group)",
      "Business",
      "Diplomacy/official duties",
      "Treatment/Medical care",
      "Visit (Family/relatives/friends, etc.)",
      "Meeting/event",
      "Employment",
      "Studies",
      "Sports game",
      "Others",
    ]);
    expect(KR_E_ARRIVAL_OCCUPATION_OPTIONS.map((item) => item.value)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "99",
    ]);
    expect(KR_E_ARRIVAL_OCCUPATION_OPTIONS.map((item) => item.official_label)).toEqual([
      "Office worker",
      "Self-employed",
      "Student",
      "Unemployed",
      "Household activities",
      "Public official",
      "Agriculture and livestock industry",
      "Others",
    ]);
  });

  it("records dynamic official sources and reviewed snapshot metadata", () => {
    expect(KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.nationality.endpoint).toContain("srchIbmsNatList.do");
    expect(KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.airports.endpoint).toContain("srchAptList.do");
    expect(KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.flightAndShip.endpoint).toContain("srchNavInfo.do");
    expect(KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.additionalQuestions.endpoint).toContain("srchAddItemList.do");
    expect(KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.additionalQuestions.fail_closed_on_snapshot_miss).toBe(true);
    expect(KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.purposeAndOccupation.static_code_snapshot).toBe(true);
    expect(snapshot.snapshotVersion).toBe("2026-08-22");
    expect(snapshot.reviewedAt).toBe("2026-08-22");
    expect(snapshot.sourceEndpoints.submit).toContain("insertEacApply.do");
    expect(snapshot.sourceEndpoints.additionalQuestions).toContain("srchAddItemList.do");
    const snapshotJson = JSON.parse(
      readFileSync(new URL("../../scripts/kr-e-arrival/official-options.snapshot.json", import.meta.url), "utf8"),
    ) as { staticLists: { sex: Array<{ value: string; label_en: string }>; purpose: Array<{ value: string; label_en: string }>; occupation: Array<{ value: string; label_en: string }> } };
    expect(snapshotJson.staticLists.sex.map((item) => item.value)).toEqual(["F", "M", "X"]);
    expect(snapshotJson.staticLists.sex.map((item) => item.label_en)).toEqual(["Female", "Male", "Third gender"]);
    expect(snapshotJson.staticLists.purpose[5]).toMatchObject({
      value: "06",
      label_en: "Visit (Family/relatives/friends, etc.)",
    });
    expect(snapshotJson.staticLists.occupation[snapshotJson.staticLists.occupation.length - 1]).toMatchObject({ value: "99", label_en: "Others" });
  });

  it("adds the package, free government-fee metadata, and both Korea runner products", () => {
    expect(migrationSource).toContain("KR_E_ARRIVAL_CARD");
    expect(migrationSource).toContain("kr_arrival_card");
    expect(migrationSource).toContain("government_fee_cents");
    expect(migrationSource).toContain("amount_cents");
    expect(migrationSource).toContain("kr_eac_live_assisted_cancelled");
    expect(migrationSource).toContain("kr_eform");
    expect(migrationSource).toContain("kr_arrival_card");
    expect(migrationSource).toContain("runner_job_active_flow_key_check");
    expect(migrationSource).toContain("enqueue_runner_pool_job(uuid,text,text,timestamptz,integer,text,jsonb,timestamptz)");
    expect(migrationSource).toContain("claim_runner_pool_job_core(text,integer,boolean,timestamptz,uuid,boolean)");
    expect(migrationSource).toContain("guard_runner_job_running_insert()");
    expect(migrationSource).toContain("requeue_runner_job(uuid)");
    expect(migrationSource).toContain("runner_pool_depth");
    expect(migrationSource).toContain("flow_key = ''kr_eform''::text");
    expect(migrationSource).toContain("flow_key IN (''kr_eform''::text, ''kr_arrival_card''::text)");
    expect(migrationSource).toContain("claim_submission_queue_batch(text,integer,integer,uuid,integer,text[],boolean)");
    expect(migrationSource).toContain("mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)");
    expect(migrationSource).toContain("cancel_application_submission(uuid,uuid,text)");
    expect(migrationSource).toContain("flow_key IN ('kr_eform', 'kr_arrival_card')");
    expect(migrationSource).toContain("v_application_visa_type");
    expect(migrationSource).toContain("v_expired_application_visa_type");
    expect(migrationSource).toContain("KR_C39_SHORT_TERM_VISIT");
    expect(migrationSource).toContain("KR_E_ARRIVAL_CARD");
    expect(migrationSource).toContain("application.visa_type");
    expect(migrationSource).toMatch(
      /v_application_visa_type IS DISTINCT FROM \(\r?\n\s+CASE v_flow/,
    );
    expect(migrationSource).not.toContain("v_application_visa_type IS DISTINCT FROM CASE v_flow");
    expect(migrationSource).toContain("v_expired_old_row.flow_key = 'kr_arrival_card'");
    expect(migrationSource).toContain("NEW.flow_key = 'kr_arrival_card'");
    expect(migrationSource).toContain("job.flow_key = 'kr_arrival_card'");
    expect(migrationSource).toContain("claimed_application.visa_type");
    expect(migrationSource).toContain("active_application.visa_type");
    expect(migrationSource).toContain("active_global_application.visa_type");
    expect(migrationSource).toContain("job.metadata -> 'concurrency_load_synthetic'");
    const cancellationSection = migrationSource.slice(migrationSource.indexOf("cancel RPC"));
    expect(cancellationSection).toContain("kr_eac_live_assisted_scheduled");
    expect(cancellationSection).toContain("kr_eac_live_assisted_pending");
    expect(cancellationSection).toContain("kr_eac_dry_run_pending");
    expect(cancellationSection).toContain("KR_E_ARRIVAL_CARD");
  });

  it("migrates the live schema to the official Korea control contract", () => {
    expect(officialFieldContractMigrationSource.startsWith("-- Korea e-Arrival Card official control contract.")).toBe(true);
    expect(officialFieldContractMigrationSource).toContain("'address_lookup'");
    expect(officialFieldContractMigrationSource).toContain("'stay_address_search'");
    expect(officialFieldContractMigrationSource).toContain("'stay_address_ko'");
    expect(officialFieldContractMigrationSource).toContain("'stay_address_en'");
    expect(officialFieldContractMigrationSource).toContain("'stay_postal_code'");
    expect(officialFieldContractMigrationSource).toContain("'date_parts'");
    expect(officialFieldContractMigrationSource).toContain("'formatted_date_text'");
    expect(officialFieldContractMigrationSource).not.toContain("+-- Korea e-Arrival");
  });

  it("adds a separate Korea e-Arrival RAG product and keeps visa/K-ETA distinct", () => {
    expect(ragSource).toContain('"visaType": "KR_E_ARRIVAL_CARD"');
    expect(ragSource).toContain("e-arrivalcard.go.kr");
    expect(ragSource).toContain("KR_C39_SHORT_TERM_VISIT");
    expect(ragSource).toContain("K-ETA");
  });
});
