import { describe, expect, it } from "vitest";
import {
  JP_VISIT_JAPAN_WEB_FORM_FIELDS,
  JP_VISIT_JAPAN_WEB_OFFICIAL_FIELD_NAMES,
} from "./form-fields";

describe("Japan Visit Japan Web form seed", () => {
  it("covers passport, arrival, accommodation, immigration, and customs answers", () => {
    const names = new Set(JP_VISIT_JAPAN_WEB_OFFICIAL_FIELD_NAMES);
    for (const field of [
      "passport_number",
      "arrival_date",
      "arrival_airport",
      "flight_number",
      "last_embarkation_country",
      "accommodation_address",
      "has_been_deported",
      "has_criminal_record",
      "has_controlled_substances_or_weapons",
      "has_prohibited_or_restricted_goods",
      "customs_declaration",
      "customs_declaration_confirmed",
      "immigration_declaration",
      "final_declaration",
    ]) {
      expect(names.has(field)).toBe(true);
    }
  });

  it("keeps files out of answers and preserves Chinese-only display labels", () => {
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.some((field) => field.field_type === "file")).toBe(false);
    const nationality = JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "nationality");
    expect(nationality?.options?.[0]).toMatchObject({ value: "China", label_zh: "中国", label_en: "China" });
  });

  it("requires the final immigration and customs confirmations", () => {
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "customs_declaration_confirmed")?.required).toBe(true);
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "immigration_declaration")?.required).toBe(true);
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "customs_declaration")?.required).toBe(false);
    expect(JP_VISIT_JAPAN_WEB_FORM_FIELDS.find((field) => field.field_name === "customs_declaration")?.validation_rules).toMatchObject({
      do_not_ask_as_single_customs_question: true,
    });
  });
});
