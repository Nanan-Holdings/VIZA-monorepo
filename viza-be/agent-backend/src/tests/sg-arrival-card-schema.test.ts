import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { SGAC_FORM_FIELDS } from "../../scripts/sgac/form-fields";

const seedSource = readFileSync(
  new URL("../../scripts/sgac/form-fields.ts", import.meta.url),
  "utf8",
);
const officialOptionsSource = readFileSync(
  new URL("../../scripts/sgac/official-options.ts", import.meta.url),
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
    expect(officialOptionsSource).toContain('"value": "Holiday/Sightseeing/Leisure"');
    expect(officialOptionsSource).toContain('"value": "Others"');
  });

  test("keeps hotel name aligned with ICA autocomplete options instead of free text", () => {
    expect(seedSource).toContain('field_name: "accommodation_name", label: "Hotel Name", field_type: "select"');
    expect(seedSource).toContain('options: HOTEL_NAMES');
    expect(officialOptionsSource).toContain('"value": "MARINA BAY SANDS SINGAPORE"');
    expect(officialOptionsSource).toContain('"labelEn": "MARINA BAY SANDS SINGAPORE"');
  });

  test("keeps ICA autocomplete fields as official dropdowns instead of free text", () => {
    expect(seedSource).toContain('field_name: "nationality", label: "Nationality/Citizenship", field_type: "select"');
    expect(seedSource).toContain('options: NATIONALITIES');
    expect(seedSource).toContain('field_name: "place_of_birth_country", label: "Country/Place of Birth", field_type: "select"');
    expect(seedSource).toContain('options: BIRTH_COUNTRIES');
    expect(seedSource).toContain('field_name: "place_of_residence", label: "Place of Residence", field_type: "select"');
    expect(seedSource).toContain('field_name: "last_city_or_port_before_singapore", label: "Last City/Port of Embarkation Before Singapore", field_type: "select"');
    expect(seedSource).toContain('field_name: "next_city_or_port_after_singapore", label: "Next City/Port of Disembarkation After Singapore", field_type: "select"');
    expect(officialOptionsSource).toContain('"value": "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR"');
    expect(officialOptionsSource).toContain('"value": "CHINESE"');
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

  test("renders SGAC official dropdown labels as Chinese on the left side", () => {
    const optionsByField = new Map(SGAC_FORM_FIELDS.map((field) => [field.field_name, field.options ?? []]));
    const labelZh = (fieldName: string, value: string) => {
      const option = optionsByField.get(fieldName)?.find((item) => item.value === value);
      return option?.label_zh ?? "";
    };

    expect(labelZh("nationality", "BRITISH OVERSEAS TERRITORIES CITIZ")).toBe("英国海外领土公民");
    expect(labelZh("nationality", "BRITISH SUBJECT")).toBe("英国臣民");
    expect(labelZh("nationality", "KOSOVAR")).toBe("科索沃籍");
    expect(labelZh("nationality", "STATELESS")).toBe("无国籍");

    expect(labelZh("place_of_birth_country", "CAMBODIA")).toBe("柬埔寨");
    expect(labelZh("place_of_birth_country", "RUSSIA")).toBe("俄罗斯");
    expect(labelZh("place_of_birth_country", "UKRAINE")).toBe("乌克兰");

    expect(labelZh("place_of_residence", "CAMBODIA, PHNOM PENH, PHNOM PENH")).toBe("柬埔寨，PHNOM PENH，PHNOM PENH");
    expect(labelZh("place_of_residence", "RUSSIA, CENTRAL, MOSCOW")).toBe("俄罗斯，CENTRAL，MOSCOW");

    expect(labelZh("purpose_of_travel", "Religion")).toBe("宗教活动");
    expect(labelZh("purpose_of_travel", "Sports event")).toBe("体育赛事");
    expect(labelZh("purpose_of_travel", "To take up residence")).toBe("定居");
  });
});
