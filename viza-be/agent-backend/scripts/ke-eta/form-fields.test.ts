import { describe, expect, it } from "vitest";
import { KE_ETA_FORM_FIELDS, KE_ETA_OFFICIAL_FIELD_NAMES } from "./form-fields";

describe("Kenya eTA form seed", () => {
  it("covers passport, contact, itinerary, accommodation, and declarations", () => {
    const names = new Set(KE_ETA_OFFICIAL_FIELD_NAMES);
    for (const field of [
      "passport_number",
      "email_address",
      "country_of_residence",
      "arrival_date",
      "departure_date",
      "entry_point",
      "purpose_of_travel",
      "accommodation_address",
      "processing_speed",
      "has_currency_over_usd_10000",
      "declaration_confirmed",
    ]) {
      expect(names.has(field)).toBe(true);
    }
  });

  it("keeps documents out of answers and separates English values from Chinese labels", () => {
    expect(KE_ETA_FORM_FIELDS.some((field) => field.field_type === "file")).toBe(false);
    const speed = KE_ETA_FORM_FIELDS.find((field) => field.field_name === "processing_speed");
    expect(speed?.options?.[0]).toMatchObject({
      value: "Standard",
      label_zh: "标准处理（最多约72小时）",
      label_en: "Standard (up to 72 hours)",
    });
  });

  it("records the standard USD 30 baseline without making the VIZA fee an answer", () => {
    const speed = KE_ETA_FORM_FIELDS.find((field) => field.field_name === "processing_speed");
    expect(speed?.validation_rules).toMatchObject({ standard_fee_usd: 30 });
    expect(KE_ETA_FORM_FIELDS.some((field) => field.field_name.includes("storage_path"))).toBe(false);
  });
});
