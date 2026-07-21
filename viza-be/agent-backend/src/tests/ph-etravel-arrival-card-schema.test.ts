import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

import { PH_ETRAVEL_FORM_FIELDS } from "../../scripts/ph-etravel/form-fields";

const seedSource = readFileSync(
  new URL("../../scripts/ph-etravel/form-fields.ts", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL("../../drizzle/0103_ph_etravel_arrival_card_package.sql", import.meta.url),
  "utf8",
);

function extractFieldNames(): string[] {
  return Array.from(seedSource.matchAll(/field_name:\s*"([^"]+)"/g), (match) => match[1]);
}

describe("Philippines eTravel Arrival Card schema seed", () => {
  test("uses a dedicated eTravel arrival-card visa type separate from 9(a)", () => {
    expect(seedSource).toContain('PH_ETRAVEL_VISA_TYPE = "PH_ETRAVEL_ARRIVAL_CARD"');
    expect(seedSource).not.toContain("PH_TEMPORARY_VISITOR_VISA");
    expect(migrationSource).toContain("PH_ETRAVEL_ARRIVAL_CARD");
    expect(migrationSource).toContain("not a Philippines 9(a) Temporary Visitor Visa");
  });

  test("collects official eTravel traveller, trip, health, customs, and declaration fields", () => {
    const fieldNames = new Set(extractFieldNames());

    for (const requiredField of [
      "registration_for",
      "first_name",
      "passport_number",
      "passport_issuing_authority",
      "passport_expiry_date",
      "nationality",
      "country_of_birth",
      "country_of_residence",
      "residence_address_line1",
      "occupation",
      "flight_arrival_date",
      "flight_departure_date",
      "travel_type",
      "transport_type",
      "traveller_type",
      "airline_name",
      "flight_number",
      "airport_of_origin",
      "port_of_entry",
      "destination_type",
      "has_recent_travel_history_30d",
      "has_exposure_to_sick_person_30d",
      "has_been_sick_30d",
      "checked_baggage_count",
      "handcarry_baggage_count",
      "final_declaration",
    ]) {
      expect(fieldNames.has(requiredField), `${requiredField} missing`).toBe(true);
    }
  });

  test("keeps runner-required dropdowns as official option values with Chinese display labels", () => {
    const optionsByField = new Map(PH_ETRAVEL_FORM_FIELDS.map((field) => [field.field_name, field.options ?? []]));

    expect(optionsByField.get("travel_type")?.some((option) => option.value === "ARRIVAL")).toBe(true);
    expect(optionsByField.get("travel_type")?.some((option) => option.value === "DEPARTURE")).toBe(false);
    expect(optionsByField.get("transport_type")?.some((option) => option.value === "AIR")).toBe(true);
    expect(optionsByField.get("occupation")?.some((option) => option.value === "OCC007")).toBe(true);
    expect(optionsByField.get("traveller_type")?.some((option) => option.value === "AIRCRAFT PASSENGER")).toBe(true);
    expect(optionsByField.get("airline_name")?.some((option) => option.value === "TC009")).toBe(true);
    expect(optionsByField.get("port_of_entry")?.some((option) => option.value === "TP1000")).toBe(true);

    for (const fieldName of ["travel_type", "transport_type", "occupation", "traveller_type", "airline_name", "port_of_entry"]) {
      for (const option of optionsByField.get(fieldName) ?? []) {
        expect(option.label_en || option.text).toBeTruthy();
        expect(option.label_zh, `${fieldName}: ${option.value}`).toMatch(/[\u3400-\u9fff]/);
      }
    }
  });

  test("keeps the official airport snapshot one-to-one without duplicate labels", () => {
    const ports = PH_ETRAVEL_FORM_FIELDS.find((field) => field.field_name === "port_of_entry")?.options ?? [];
    expect(ports).toHaveLength(20);
    expect(new Set(ports.map((option) => option.value)).size).toBe(ports.length);
    expect(new Set(ports.map((option) => option.label_zh)).size).toBe(ports.length);
  });

  test("collects the customs signature in supporting documents instead of the form", () => {
    expect(PH_ETRAVEL_FORM_FIELDS.some((field) => field.field_name === "customs_signature_file")).toBe(false);
  });

  test("includes bilingual Chinese labels for every field", () => {
    const fieldNames = extractFieldNames();
    const labelZhMatches = Array.from(seedSource.matchAll(/validation_rules:\s*rules\("([^"]+)"/g));

    expect(labelZhMatches.length).toBe(fieldNames.length);
    for (const match of labelZhMatches) {
      expect(/[\u3400-\u9fff]/.test(match[1])).toBe(true);
    }
  });
});
