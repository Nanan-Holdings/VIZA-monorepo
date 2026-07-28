import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { MY_MDAC_FORM_FIELDS } from "../../scripts/my-mdac/form-fields";
import { MY_MDAC_COUNTRIES } from "../../scripts/my-mdac/official-options";

const seedSource = readFileSync(
  new URL("../../scripts/my-mdac/form-fields.ts", import.meta.url),
  "utf8",
);

function fieldNames(): Set<string> {
  return new Set(MY_MDAC_FORM_FIELDS.map((field) => field.field_name));
}

describe("Malaysia MDAC arrival-card schema seed", () => {
  test("matches official MDAC field inventory without legacy point of entry", () => {
    const names = fieldNames();

    expect(seedSource).toContain('MY_MDAC_VISA_TYPE = "MY_MDAC_ARRIVAL_CARD"');
    expect(names.has("place_of_birth")).toBe(true);
    expect(names.has("state")).toBe(true);
    expect(names.has("city")).toBe(true);
    expect(names.has("point_of_entry")).toBe(false);
    expect(names.has("port_of_entry")).toBe(false);
    expect(names.has("entry_port")).toBe(false);
  });

  test("keeps MDAC dropdown labels localized for Chinese UI", () => {
    for (const field of MY_MDAC_FORM_FIELDS) {
      for (const option of field.options ?? []) {
        expect(option.label_zh, `${field.field_name}: ${option.value}`).not.toMatch(/^选项：|^Option:/);
        expect(option.label_zh, `${field.field_name}: ${option.value}`).not.toEqual(option.label_en);
      }

      const dependentOptions = field.validation_rules?.dependent_options;
      if (!dependentOptions || typeof dependentOptions !== "object") continue;

      for (const [parentValue, options] of Object.entries(dependentOptions)) {
        expect(Array.isArray(options), `${field.field_name}: ${parentValue}`).toBe(true);
        for (const option of options as Array<{ value: string; label_zh: string; label_en: string }>) {
          expect(option.label_zh, `${field.field_name}: ${parentValue}/${option.value}`).not.toMatch(/^选项：|^Option:/);
          expect(option.label_zh, `${field.field_name}: ${parentValue}/${option.value}`).not.toEqual(option.label_en);
        }
      }
    }
  });

  test("keeps known Sarawak city options translated after seeding", () => {
    const cityField = MY_MDAC_FORM_FIELDS.find((field) => field.field_name === "city");
    const dependentOptions = cityField?.validation_rules?.dependent_options as
      | Record<string, Array<{ value: string; label_zh: string; label_en: string }>>
      | undefined;
    const sarawakOptions = dependentOptions?.["13"] ?? [];

    expect(sarawakOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label_en: "ENGKILILI", label_zh: "英吉利里" }),
        expect.objectContaining({ label_en: "JULAU", label_zh: "如楼" }),
        expect.objectContaining({ label_en: "KABONG", label_zh: "加邦" }),
      ]),
    );
  });

  test("uses a complete MDAC country list for pre-arrival embarkation", () => {
    const lastEmbarkationCountry = MY_MDAC_FORM_FIELDS.find(
      (field) => field.field_name === "last_embarkation_country",
    );
    const countryValues = new Set(MY_MDAC_COUNTRIES.map((option) => option.value));
    const fieldValues = new Set((lastEmbarkationCountry?.options ?? []).map((option) => option.value));

    expect(MY_MDAC_COUNTRIES.length).toBeGreaterThanOrEqual(240);
    expect(fieldValues.size).toBe(MY_MDAC_COUNTRIES.length);
    expect(Array.from(countryValues)).toEqual(expect.arrayContaining(["CHN", "KOR", "MYS", "SGP", "THA", "USA"]));
    expect(Array.from(fieldValues)).toEqual(expect.arrayContaining(["CHN", "KOR", "MYS", "SGP", "THA", "USA"]));
  });
});
