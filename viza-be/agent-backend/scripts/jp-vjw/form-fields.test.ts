import { describe, expect, it } from "vitest";
import {
  JP_VISIT_JAPAN_WEB_FORM_FIELDS,
  JP_VISIT_JAPAN_WEB_OFFICIAL_FIELD_NAMES,
} from "./form-fields";
import { JP_CUSTOMS_AIRPORT_OPTIONS, JP_CUSTOMS_AIRPORT_SOURCE } from "./official-airports";

describe("Japan Visit Japan Web form seed", () => {
  it("covers passport, arrival, accommodation, immigration, and customs answers", () => {
    const names = new Set(JP_VISIT_JAPAN_WEB_OFFICIAL_FIELD_NAMES);
    for (const field of [
      "passport_number",
      "arrival_date",
      "arrival_airport",
      "arrival_airline",
      "flight_number",
      "occupation",
      "residence_city",
      "last_embarkation_country",
      "accommodation_prefecture",
      "accommodation_city",
      "accommodation_address",
      "has_been_deported",
      "has_criminal_record",
      "has_controlled_substances_or_weapons",
      "has_prohibited_goods",
      "has_restricted_goods",
      "has_gold_or_gold_products",
      "customs_declaration",
      "customs_declaration_confirmed",
      "immigration_declaration",
      "final_declaration",
    ]) {
      expect(names.has(field)).toBe(true);
    }
  });

  it("keeps current Visit Japan Web airline and customs controls separate", () => {
    const legacyCombined = JP_VISIT_JAPAN_WEB_FORM_FIELDS.find(
      (field) => field.field_name === "has_prohibited_or_restricted_goods",
    );
    expect(legacyCombined).toMatchObject({ field_type: "computed", required: false });
    expect(legacyCombined?.conditional_logic).toEqual({ showIf: "false" });
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "arrival_airline")).toMatchObject({
      field_type: "text",
      required: true,
    });
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "occupation")).toMatchObject({
      field_type: "select",
      required: true,
      options: expect.arrayContaining([
        expect.objectContaining({ value: "0800", label_zh: "学生", label_en: "Student" }),
        expect.objectContaining({ value: "0990", label_zh: "其他", label_en: "Other" }),
      ]),
    });
    for (const fieldName of ["has_prohibited_goods", "has_restricted_goods", "has_gold_or_gold_products"]) {
      expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === fieldName)).toMatchObject({
        field_type: "radio",
        required: true,
      });
    }
  });

  it("keeps files out of answers and preserves Chinese-only display labels", () => {
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.some((field) => field.field_type === "file")).toBe(false);
    const nationality = JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "nationality");
    expect(nationality?.options?.[0]).toMatchObject({ value: "China", label_zh: "中国", label_en: "China" });
  });

  it("collects the current official Japan address controls and phone shape", () => {
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "accommodation_prefecture")).toMatchObject({
      field_type: "text",
      required: true,
      validation_rules: expect.objectContaining({ official_control: "prefecture" }),
    });
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "accommodation_city")).toMatchObject({
      field_type: "text",
      required: true,
      validation_rules: expect.objectContaining({ official_control: "city", maxLength: 45 }),
    });
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "accommodation_phone")?.validation_rules).toMatchObject({
      pattern: "^[0-9]{10,15}$",
      official_control: "telephoneNumberInJapan",
    });
  });

  it("publishes the versioned Japan Customs airport options with official values", () => {
    const airportField = JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "arrival_airport");
    const values = JP_CUSTOMS_AIRPORT_OPTIONS.map((entry) => entry.value);

    expect(JP_CUSTOMS_AIRPORT_OPTIONS).toHaveLength(33);
    expect(new Set(values)).toHaveLength(values.length);
    expect(airportField?.options).toEqual(JP_CUSTOMS_AIRPORT_OPTIONS);
    expect(airportField?.validation_rules).toMatchObject({
      label_zh: "计划入境机场",
      official_options_source: JP_CUSTOMS_AIRPORT_SOURCE.url,
      official_options_effective_date: "2025-07-01",
      option_identity: "official_english_name",
    });
    expect(JP_CUSTOMS_AIRPORT_OPTIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "Narita international Airport", label_zh: "成田国际机场" }),
      expect.objectContaining({ value: "Tokyo international Airport", label_zh: "东京国际机场（羽田机场）" }),
      expect.objectContaining({ value: "Kansai international Airport", label_zh: "关西国际机场" }),
    ]));
    for (const entry of JP_CUSTOMS_AIRPORT_OPTIONS) {
      expect(entry.label_en).toBe(entry.value);
      expect(entry.official_label).toBe(entry.value);
      expect(entry.label_zh.trim()).not.toBe("");
    }
  });

  it("requires the final immigration and customs confirmations", () => {
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "customs_declaration_confirmed")?.required).toBe(true);
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "immigration_declaration")?.required).toBe(true);
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "customs_declaration")?.required).toBe(false);
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "customs_declaration")?.validation_rules).toMatchObject({
      do_not_ask_as_single_customs_question: true,
    });
  });

  it("places the immigration confirmation after every immigration question and explains the acknowledgement", () => {
    const immigrationQuestions = JP_VISIT_JAPAN_WEB_FORM_FIELDS.filter((field) =>
      field.step_number === 3 && field.validation_rules?.immigration_question === true
    );
    const confirmation = JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "immigration_declaration");

    expect(immigrationQuestions).toHaveLength(3);
    expect(confirmation).toMatchObject({
      step_number: 3,
      step_name: "Immigration Declaration",
      display_order: 4,
    });
    expect(confirmation?.display_order).toBeGreaterThan(
      Math.max(...immigrationQuestions.map((field) => field.display_order)),
    );
    expect(confirmation?.validation_rules).toMatchObject({
      label_zh: "我已核对上述入境申报信息，并确认完整且真实",
      helper_priority: "critical",
    });
  });
});
