import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

import { VN_PREARRIVAL_FORM_FIELDS, VN_PREARRIVAL_VISA_TYPE } from "../../scripts/vn-prearrival/form-fields";

const seedSource = readFileSync(
  new URL("../../scripts/vn-prearrival/form-fields.ts", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL("../../drizzle/0106_vn_prearrival_declaration_package.sql", import.meta.url),
  "utf8",
);

function extractFieldNames(): string[] {
  return Array.from(seedSource.matchAll(/field_name:\s*"([^"]+)"/g), (match) => match[1]);
}

describe("Vietnam Pre-Arrival declaration schema seed", () => {
  test("uses a dedicated arrival declaration visa type separate from Vietnam e-Visa", () => {
    expect(VN_PREARRIVAL_VISA_TYPE).toBe("VN_PREARRIVAL_DECLARATION");
    expect(seedSource).not.toContain("VN_E_VISA");
    expect(migrationSource).toContain("VN_PREARRIVAL_DECLARATION");
    expect(migrationSource).toContain("separate from the Vietnam e-Visa");
  });

  test("collects traveller, passport, arrival, Viet Nam stay, and declaration fields", () => {
    const fieldNames = new Set(extractFieldNames());

    for (const requiredField of [
      "expected_arrival_date",
      "passport_type",
      "gender",
      "surname",
      "given_name",
      "date_of_birth",
      "nationality",
      "alias_email_address",
      "phone_country_code",
      "phone_number",
      "passport_number",
      "passport_expiry_date",
      "visa_information_acknowledgement",
      "visa_type",
      "visa_number",
      "visa_issue_date",
      "visa_expiry_date",
      "visa_issued_place",
      "departure_country_before_arrival",
      "purpose_of_travel",
      "mode_of_travel",
      "flight_number",
      "custom_flight_number",
      "border_gate_airport",
      "vehicle_identification_number",
      "land_border_gate",
      "sea_port",
      "accommodation_type",
      "province_city_of_hotel",
      "ward_commune_of_hotel",
      "hotel_accommodation_address",
      "custom_hotel_accommodation_address",
      "accommodation_address",
      "workplace_information",
      "departure_date_from_vietnam",
      "final_declaration",
    ]) {
      expect(fieldNames.has(requiredField), `${requiredField} missing`).toBe(true);
    }
  });

  test("models the official 72-hour pre-arrival window without inventing health fields", () => {
    const fields = new Map(VN_PREARRIVAL_FORM_FIELDS.map((field) => [field.field_name, field]));

    expect(fields.get("expected_arrival_date")?.validation_rules).toMatchObject({
      submission_window_hours: 72,
      max_days_from_today: 2,
      official_control: "radio_date_window",
    });
    expect(fields.has("arrival_date")).toBe(false);
    expect(fields.has("prearrival_window_acknowledgement")).toBe(false);
    expect(fields.has("health_declaration_status")).toBe(false);
  });

  test("keeps official options bilingual while preserving runner-facing values", () => {
    const fields = new Map(VN_PREARRIVAL_FORM_FIELDS.map((field) => [field.field_name, field.options ?? []]));

    expect(fields.get("border_gate_airport")?.some((option) => option.value === "SGN")).toBe(true);
    expect(fields.get("mode_of_travel")?.some((option) => option.value === "air")).toBe(true);
    expect(fields.get("visa_type")?.some((option) => option.value === "EV")).toBe(true);

    for (const fieldName of ["border_gate_airport", "mode_of_travel", "visa_type", "purpose_of_travel"]) {
      for (const option of fields.get(fieldName) ?? []) {
        expect(option.label_en || option.text).toBeTruthy();
        expect(option.label_zh, `${fieldName}: ${option.value}`).toMatch(/[\u3400-\u9fff]/);
      }
    }
  });
});
