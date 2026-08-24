import { describe, expect, it } from "vitest";
import {
  JP_VISIT_JAPAN_WEB_FORM_FIELDS,
  JP_VISIT_JAPAN_WEB_OFFICIAL_FIELD_NAMES,
} from "./form-fields";
import {
  JP_VJW_AIRLINE_OPTIONS,
  JP_VJW_CITIES_BY_PREFECTURE,
  JP_VJW_EMBARKATION_POINT_OPTIONS,
  JP_VJW_OFFICIAL_MASTER_SOURCE,
  JP_VJW_PREFECTURE_OPTIONS,
} from "./official-master";

function field(name: string) {
  const result = JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((entry) => entry.field_name === name);
  expect(result, `missing ${name}`).toBeDefined();
  return result!;
}

describe("Japan Visit Japan Web form seed", () => {
  it("matches every visible current VJW control type", () => {
    const expectedTypes: Record<string, string> = {
      surname: "text",
      given_names: "text",
      date_of_birth: "date",
      nationality: "select",
      passport_number: "text",
      passport_expiry_date: "date",
      residence_country: "text",
      occupation: "select",
      residence_city: "text",
      arrival_date: "date",
      arrival_airline: "select",
      flight_number: "text",
      departure_city_or_port: "text",
      purpose_of_visit: "select",
      planned_stay_days: "number",
      accommodation_postal_code: "text",
      accommodation_prefecture: "select",
      accommodation_city: "select",
      accommodation_address: "text",
      accommodation_name: "text",
      accommodation_phone: "text",
      has_been_deported: "radio",
      has_criminal_record: "radio",
      has_controlled_substances_or_weapons: "radio",
      has_prohibited_goods: "radio",
      has_restricted_goods: "radio",
      has_gold_or_gold_products: "radio",
      has_dutiable_goods: "radio",
      has_commercial_goods: "radio",
      has_goods_for_other_person: "radio",
      has_unaccompanied_baggage: "radio",
      has_cash_or_valuables_over_threshold: "radio",
      customs_declaration_confirmed: "checkbox",
    };

    for (const [name, type] of Object.entries(expectedTypes)) {
      expect(field(name).field_type, name).toBe(type);
    }
  });

  it("hides legacy intake fields that the current official flow does not ask", () => {
    for (const name of [
      "passport_type",
      "sex",
      "passport_issuing_country",
      "email_address",
      "phone_number",
      "arrival_airport",
      "last_embarkation_country",
      "immigration_declaration",
    ]) {
      expect(field(name)).toMatchObject({
        field_type: "computed",
        required: false,
        conditional_logic: { showIf: "false" },
      });
    }
  });

  it("publishes the reviewed VJW 3.16 dropdown and autocomplete masters", () => {
    expect(JP_VJW_OFFICIAL_MASTER_SOURCE).toMatchObject({
      schemaVersion: "VJW-3.16",
      sourceUrl: "https://www.vjw.digital.go.jp/main/main.1dcb51ecdb7a1ed7.js",
      sha256: "64d37b919f3a2ecfe9b6ceee2ec58c31239965ca3e7c1c51e063e0dfe93bb3cc",
      publicationPolicy: "manual-review-required-before-production-update",
    });
    expect(JP_VJW_AIRLINE_OPTIONS).toHaveLength(174);
    expect(JP_VJW_PREFECTURE_OPTIONS).toHaveLength(47);
    expect(JP_VJW_EMBARKATION_POINT_OPTIONS).toHaveLength(187);
    expect(Object.values(JP_VJW_CITIES_BY_PREFECTURE).flat()).toHaveLength(1892);
    expect(new Set(JP_VJW_AIRLINE_OPTIONS.map((entry) => entry.value))).toHaveLength(174);
    expect(field("arrival_airline").options).toEqual(JP_VJW_AIRLINE_OPTIONS);
    expect(field("accommodation_prefecture").options).toEqual(JP_VJW_PREFECTURE_OPTIONS);
    expect(field("accommodation_city").validation_rules).toMatchObject({
      dependent_on: "accommodation_prefecture",
      dependent_options: JP_VJW_CITIES_BY_PREFECTURE,
    });
    expect(field("departure_city_or_port").validation_rules).toMatchObject({
      official_control_type: "text_autocomplete_with_free_entry",
      allow_custom_value: true,
    });
  });

  it("uses official stored codes while keeping the applicant-facing labels Chinese", () => {
    expect(field("nationality").options?.[0]).toMatchObject({
      value: "CHN",
      label_zh: "中国",
      label_en: "China",
    });
    expect(field("purpose_of_visit").options?.[0]).toMatchObject({
      value: "0",
      label_zh: "旅游",
      label_en: "Tourism",
    });
    expect(field("occupation").options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "0800", label_zh: "学生", label_en: "Student" }),
      expect.objectContaining({ value: "0990", label_zh: "其他", label_en: "Other" }),
    ]));
  });

  it("matches the official optional postal code and single final confirmation", () => {
    expect(field("accommodation_postal_code")).toMatchObject({ field_type: "text", required: false });
    expect(field("accommodation_address")).toMatchObject({ field_type: "text", required: true });
    expect(field("customs_declaration_confirmed")).toMatchObject({
      label: "The above entry is true and correct.",
      field_type: "checkbox",
      required: true,
      validation_rules: expect.objectContaining({
        label_zh: "我确认上述填写内容真实且正确",
        official_control: "confirmChk",
      }),
    });
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.filter((entry) =>
      entry.field_type === "checkbox" && entry.required
    )).toHaveLength(1);
  });

  it("keeps files out of answers and preserves every compatibility key", () => {
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.some((entry) => entry.field_type === "file")).toBe(false);
    expect(new Set(JP_VISIT_JAPAN_WEB_OFFICIAL_FIELD_NAMES)).toEqual(
      new Set(JP_VISIT_JAPAN_WEB_FORM_FIELDS.map((entry) => entry.field_name)),
    );
  });
});
