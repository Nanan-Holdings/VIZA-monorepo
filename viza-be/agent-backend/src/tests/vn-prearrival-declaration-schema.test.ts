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
      "official_free_acknowledgement",
      "prearrival_window_acknowledgement",
      "health_declaration_status",
      "full_name",
      "date_of_birth",
      "sex",
      "nationality",
      "email_address",
      "phone_country_code",
      "phone_number",
      "passport_number",
      "passport_issue_date",
      "passport_expiry_date",
      "entry_permission_type",
      "arrival_date",
      "transport_mode",
      "flight_or_transport_number",
      "entry_port",
      "country_boarded",
      "purpose_of_entry",
      "address_in_vietnam",
      "province_city",
      "is_group_submission",
      "final_declaration",
    ]) {
      expect(fieldNames.has(requiredField), `${requiredField} missing`).toBe(true);
    }
  });

  test("models the official 72-hour pre-arrival window and health declaration inactive default", () => {
    const fields = new Map(VN_PREARRIVAL_FORM_FIELDS.map((field) => [field.field_name, field]));

    expect(fields.get("prearrival_window_acknowledgement")?.validation_rules?.submission_window_hours).toBe(72);
    expect(fields.get("arrival_date")?.validation_rules?.submission_window_hours).toBe(72);
    expect(fields.get("health_declaration_status")?.validation_rules?.default).toBe("inactive");
    expect(fields.get("health_declaration_status")?.options?.some((option) => option.value === "inactive")).toBe(true);
  });

  test("keeps official options bilingual while preserving runner-facing values", () => {
    const fields = new Map(VN_PREARRIVAL_FORM_FIELDS.map((field) => [field.field_name, field.options ?? []]));

    expect(fields.get("entry_port")?.some((option) => option.value === "tan_son_nhat_int_airport")).toBe(true);
    expect(fields.get("transport_mode")?.some((option) => option.value === "air")).toBe(true);
    expect(fields.get("entry_permission_type")?.some((option) => option.value === "evisa")).toBe(true);

    for (const fieldName of ["entry_port", "transport_mode", "entry_permission_type", "purpose_of_entry"]) {
      for (const option of fields.get(fieldName) ?? []) {
        expect(option.label_en || option.text).toBeTruthy();
        expect(option.label_zh, `${fieldName}: ${option.value}`).toMatch(/[\u3400-\u9fff]/);
      }
    }
  });
});
