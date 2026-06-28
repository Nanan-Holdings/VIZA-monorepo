import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { TH_TDAC_FORM_FIELDS } from "../../scripts/th-tdac/form-fields";

const seedSource = readFileSync(
  new URL("../../scripts/th-tdac/form-fields.ts", import.meta.url),
  "utf8",
);

function fieldNames(): Set<string> {
  return new Set(TH_TDAC_FORM_FIELDS.map((field) => field.field_name));
}

function field(name: string) {
  return TH_TDAC_FORM_FIELDS.find((item) => item.field_name === name);
}

describe("Thailand TDAC arrival-card schema seed", () => {
  test("matches official TDAC field inventory", () => {
    const names = fieldNames();

    expect(seedSource).toContain('TH_TDAC_VISA_TYPE = "TH_TDAC_ARRIVAL_CARD"');
    for (const name of [
      "family_name",
      "first_name",
      "middle_name",
      "passport_number",
      "nationality",
      "date_of_birth",
      "gender",
      "occupation",
      "visa_number",
      "country_territory_of_residence",
      "city_state_of_residence",
      "phone_country_code",
      "phone_number",
      "email_address",
      "arrival_date",
      "country_boarded",
      "purpose_of_travel",
      "purpose_of_travel_other",
      "arrival_mode_of_travel",
      "arrival_mode_of_transport",
      "arrival_transport_other",
      "arrival_transport_number",
      "departure_date",
      "departure_mode_of_travel",
      "departure_mode_of_transport",
      "departure_transport_other",
      "departure_transport_number",
      "is_transit_traveler",
      "accommodation_type",
      "accommodation_type_other",
      "province",
      "district",
      "sub_district",
      "postcode",
      "address_in_thailand",
      "countries_visited_last_14_days",
    ]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  test("removes non-official legacy health yes/no fields", () => {
    const names = fieldNames();

    for (const name of [
      "has_health_symptoms",
      "health_declaration",
      "recent_country_visit_history",
      "yellow_fever_risk_visit",
    ]) {
      expect(names.has(name), name).toBe(false);
    }
  });

  test("keeps official conditional dropdown structure", () => {
    expect(field("gender")?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "undefined", label_zh: "未定义", label_en: "UNDEFINED" }),
      ]),
    );
    expect(field("arrival_mode_of_transport")?.validation_rules?.dependent_options).toMatchObject({
      air: expect.any(Array),
      land: expect.any(Array),
      sea: expect.any(Array),
    });
    expect(field("departure_mode_of_transport")?.validation_rules?.dependent_options).toMatchObject({
      air: expect.any(Array),
      land: expect.any(Array),
      sea: expect.any(Array),
    });
    expect(field("district")?.validation_rules).toMatchObject({ dependent_on: "province" });
    expect(field("sub_district")?.validation_rules).toMatchObject({ dependent_on: "district" });
    expect(field("countries_visited_last_14_days")?.field_type).toBe("multi_select");
  });
});
