import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { TH_TDAC_FORM_FIELDS } from "../../scripts/th-tdac/form-fields";
import {
  TDAC_COUNTRY_HEALTH_RULES,
  TDAC_COUNTRY_OPTIONS,
  TDAC_YELLOW_FEVER_COUNTRY_CODES,
  TDAC_YELLOW_FEVER_SHOW_IF,
} from "../../scripts/th-tdac/official-options";

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
      "yellow_fever_vaccination_certificate",
      "yellow_fever_vaccination_date",
      "health_symptoms_last_14_days",
      "health_symptoms_other",
    ]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  test("removes non-official legacy health fields", () => {
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

  test("classifies every official country option and the exact 42 yellow-fever countries", () => {
    expect(TDAC_COUNTRY_HEALTH_RULES).toHaveLength(TDAC_COUNTRY_OPTIONS.length);
    expect(new Set(TDAC_COUNTRY_HEALTH_RULES.map((rule) => rule.countryCode))).toEqual(
      new Set(TDAC_COUNTRY_OPTIONS.map((country) => country.value)),
    );
    expect(TDAC_COUNTRY_HEALTH_RULES.every(
      (rule) => rule.additionalQuestions === "none" || rule.additionalQuestions === "yellow_fever",
    )).toBe(true);
    expect(TDAC_YELLOW_FEVER_COUNTRY_CODES).toHaveLength(42);
    expect(TDAC_COUNTRY_HEALTH_RULES.filter(
      (rule) => rule.additionalQuestions === "yellow_fever",
    ).map((rule) => rule.countryCode).sort()).toEqual([...TDAC_YELLOW_FEVER_COUNTRY_CODES].sort());
  });

  test("shows official health questions for risk countries selected in any TDAC trigger field", () => {
    expect(field("yellow_fever_vaccination_certificate")?.conditional_logic).toMatchObject({
      showIf: TDAC_YELLOW_FEVER_SHOW_IF,
    });
    expect(TDAC_YELLOW_FEVER_SHOW_IF).toContain(
      "countries_visited_last_14_days contains_any",
    );
    expect(TDAC_YELLOW_FEVER_SHOW_IF).toContain("country_boarded in");
    expect(TDAC_YELLOW_FEVER_SHOW_IF).toContain("nationality in");
    expect(field("yellow_fever_vaccination_date")?.conditional_logic?.showIf).toContain(
      "yellow_fever_vaccination_certificate === yes",
    );
    expect(field("health_symptoms_other")?.conditional_logic?.showIf).toContain(
      "health_symptoms_last_14_days contains_any [other]",
    );
  });

  test("keeps official conditional dropdown structure", () => {
    expect(field("gender")?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "undefined", label_zh: "未定义", label_en: "UNDEFINED" }),
      ]),
    );
    expect(field("arrival_mode_of_transport")?.validation_rules?.dependent_options).toMatchObject({
      air: expect.any(Array),
      land: [
        expect.objectContaining({ value: "car", label_zh: "汽车", label_en: "CAR" }),
        expect.objectContaining({ value: "train", label_zh: "火车", label_en: "TRAIN" }),
        expect.objectContaining({ value: "others", label_zh: "其他（请说明）", label_en: "OTHERS (PLEASE SPECIFY)" }),
      ],
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
    expect(field("city_state_of_residence")?.field_type).toBe("select");
    expect(field("city_state_of_residence")?.validation_rules).toMatchObject({
      dependent_on: "country_territory_of_residence",
    });
    expect(field("nationality")?.options?.length).toBeGreaterThan(200);
    expect(field("province")?.options?.length).toBe(77);
    expect(field("address_in_thailand")?.validation_rules).toMatchObject({ maxLength: 215 });
  });

  test("matches the current official purpose dropdown exactly", () => {
    expect(field("purpose_of_travel")?.options).toEqual([
      expect.objectContaining({ value: "holiday", label_en: "HOLIDAY" }),
      expect.objectContaining({ value: "meeting", label_en: "MEETING" }),
      expect.objectContaining({ value: "sports", label_en: "SPORTS" }),
      expect.objectContaining({ value: "business", label_en: "BUSINESS" }),
      expect.objectContaining({ value: "incentive", label_en: "INCENTIVE" }),
      expect.objectContaining({ value: "medical_wellness", label_en: "MEDICAL & WELLNESS" }),
      expect.objectContaining({ value: "education", label_en: "EDUCATION" }),
      expect.objectContaining({ value: "convention", label_en: "CONVENTION" }),
      expect.objectContaining({ value: "employment", label_en: "EMPLOYMENT" }),
      expect.objectContaining({ value: "exhibition", label_en: "EXHIBITION" }),
      expect.objectContaining({ value: "others", label_en: "OTHERS (PLEASE SPECIFY)" }),
    ]);
    expect(field("purpose_of_travel")?.options).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "transit" }),
        expect.objectContaining({ value: "return_resident" }),
      ]),
    );
  });

  test("uses Chinese step titles in the seeded TDAC wizard", () => {
    expect(new Set(TH_TDAC_FORM_FIELDS.map((item) => item.step_name))).toEqual(
      new Set(["旅客信息", "抵达和离境信息", "住宿信息", "健康申报"]),
    );
  });

  test("requires accommodation fields only for non-transit travellers", () => {
    for (const name of ["accommodation_type", "province", "address_in_thailand"]) {
      expect(field(name)?.required, name).toBe(true);
      expect(field(name)?.conditional_logic, name).toMatchObject({ showIf: "is_transit_traveler !== yes" });
    }

    for (const name of ["district", "sub_district", "postcode"]) {
      expect(field(name)?.required, name).toBe(false);
      expect(field(name)?.conditional_logic, name).toMatchObject({ showIf: "is_transit_traveler !== yes" });
    }

    expect(field("accommodation_type_other")?.conditional_logic).toMatchObject({
      showIf: "is_transit_traveler !== yes && accommodation_type === others",
    });
    expect(field("is_transit_traveler")?.validation_rules).toMatchObject({
      auto_when_arrival_departure_same_day: true,
      locked_unless_arrival_departure_same_day: true,
    });
  });
});
