import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const seedSource = readFileSync(
  new URL("../../scripts/sgac/form-fields.ts", import.meta.url),
  "utf8",
);

function extractFieldNames(): string[] {
  return Array.from(seedSource.matchAll(/field_name:\s*"([^"]+)"/g), (match) => match[1]);
}

describe("Singapore SG Arrival Card schema seed", () => {
  test("uses a dedicated SGAC visa type with core arrival-card fields", () => {
    expect(seedSource).toContain('SGAC_VISA_TYPE = "SG_ARRIVAL_CARD"');

    const fieldNames = new Set(extractFieldNames());
    expect(fieldNames.size).toBeGreaterThanOrEqual(25);
    expect(fieldNames).toEqual(
      expect.objectContaining({
        has: expect.any(Function),
      }),
    );
    for (const requiredField of [
      "full_name",
      "date_of_birth",
      "nationality",
      "passport_number",
      "passport_expiry_date",
      "arrival_date",
      "purpose_of_travel",
      "mode_of_travel",
      "transport_number",
      "accommodation_type",
      "email_address",
      "mobile_country_code",
      "has_health_symptoms",
      "recent_country_visit_history",
    ]) {
      expect(fieldNames.has(requiredField), `${requiredField} missing`).toBe(true);
    }
    expect(fieldNames.has("purpose_of_visit"), "legacy purpose_of_visit must not be used for SGAC").toBe(false);
  });

  test("uses the SGAC canonical purpose field and bilingual label", () => {
    expect(seedSource).toContain('field_name: "purpose_of_travel"');
    expect(seedSource).toContain('label: "Purpose of Travel"');
    expect(seedSource).toContain('validation_rules: rules("旅行目的"');
    expect(seedSource).toContain('option("other", "其他", "Others")');
  });

  test("keeps arrival and departure dates together in trip information", () => {
    expect(seedSource).toContain(
      'field_name: "arrival_date", label: "Date of Arrival (DD/MM/YYYY)", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 1',
    );
    expect(seedSource).toContain(
      'field_name: "departure_date", label: "Date of Departure from Singapore", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 2',
    );
    expect(seedSource.match(/inline_group: "sgac_travel_dates"/g)?.length).toBe(2);
  });

  test("does not collect VIZA-only acknowledgements or non-ICA passport fields", () => {
    const fieldNames = new Set(extractFieldNames());
    for (const extraField of [
      "passport_issuing_country",
      "passport_issue_date",
      "passport_validity_acknowledgement",
      "yellow_fever_risk_acknowledgement",
      "health_declaration",
      "sgac_is_not_visa_acknowledgement",
      "official_submission_timing_acknowledgement",
      "official_submission_acknowledgement",
      "final_declaration",
      "contact_person_in_singapore",
      "contact_phone_in_singapore",
    ]) {
      expect(fieldNames.has(extraField), `${extraField} must not appear in the SGAC form`).toBe(false);
    }
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
