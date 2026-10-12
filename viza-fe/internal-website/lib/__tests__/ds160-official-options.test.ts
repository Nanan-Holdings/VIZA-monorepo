import { describe, expect, it } from "vitest";
import { getMissingDynamicFormFields } from "../application-tab-completion";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";
import { DS160_OFFICIAL_OPTION_PAIRS, getDs160OfficialOptions, getDs160OfficialOptionSource, resolveDs160OfficialOptionValue } from "../ds160-official-options";

function fingerprint(pairs: readonly (readonly [string, string])[]): string {
  const text = JSON.stringify([...pairs].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

describe("DS-160 live official options captured 2026-09-21", () => {
  it("accepts a displayed legacy country in completion but keeps ambiguous regions invalid", () => {
    const field: VisaFormFieldRow = {
      id: "birth-country", visaType: "DS160", fieldName: "country_of_birth", label: "Birth country",
      fieldType: "country", required: true, stepNumber: 1, stepName: "Personal", displayOrder: 1,
      placeholder: null, conditionalLogic: null, validationRules: { source: "CEAC_BIRTH_COUNTRIES" },
      options: getDs160OfficialOptions("CEAC_BIRTH_COUNTRIES") ?? null,
    };
    const steps = [{ stepNumber: 1, stepName: "Personal", fields: [field] }];
    for (const value of ["CN", "中国", "CHINA"]) {
      expect(getMissingDynamicFormFields(steps, { country_of_birth: value })).toEqual([]);
    }
    expect(getMissingDynamicFormFields(steps, { country_of_birth: "Mexico" }))
      .toEqual([expect.objectContaining({ fieldName: "country_of_birth", reason: "invalid" })]);
  });
  it("matches independently collected live DOM counts and value/label fingerprints", () => {
    const evidence = {
      CEAC_GEOGRAPHY: [252, "ba2b437e"], CEAC_BIRTH_COUNTRIES: [280, "b6fa93d8"],
      CEAC_NATIONALITIES: [211, "932de210"], CEAC_OTHER_NATIONALITIES: [211, "960e46d5"],
      CEAC_FAMILY_NATIONALITIES: [212, "5209c753"], CEAC_PASSPORT_ISSUERS: [216, "e713dfca"],
      CEAC_US_STATES: [56, "b55b4aad"],
    };
    for (const [source, pairs] of Object.entries(DS160_OFFICIAL_OPTION_PAIRS)) {
      expect([pairs.length, fingerprint(pairs)]).toEqual(evidence[source as keyof typeof evidence]);
      expect(new Set(pairs.map(([code]) => code)).size).toBe(pairs.length);
    }
  });
  it("shows Chinese labels for every option and preserves exact official labels and codes", () => {
    for (const source of Object.keys(DS160_OFFICIAL_OPTION_PAIRS)) {
      const options = getDs160OfficialOptions(source)!;
      expect(options).toBe(getDs160OfficialOptions(source));
      for (const option of options) {
        expect(typeof option).toBe("object");
        if (typeof option === "string") continue;
        expect(option.label_zh).toMatch(/[\u3400-\u9fff]/);
        expect(option.label_zh).not.toMatch(/[A-Za-z]/);
        expect(option.official_value).toBeTruthy();
        expect(option.label_en).toBe(option.official_label);
      }
    }
  });
  it("distinguishes birth, nationality, issuer, address and US-state lists", () => {
    const source = (fieldName: string, configured = "ISO3166-1") => getDs160OfficialOptionSource({ visaType: "DS160", fieldName, validationRules: { source: configured } });
    expect(source("nationality_country")).toBe("CEAC_NATIONALITIES");
    expect(source("former_spouse_country_of_birth__2")).toBe("CEAC_BIRTH_COUNTRIES");
    expect(source("other_nationality_country__1")).toBe("CEAC_OTHER_NATIONALITIES");
    expect(source("passport_issuing_country")).toBe("CEAC_PASSPORT_ISSUERS");
    expect(source("passport_issuance_country")).toBe("CEAC_GEOGRAPHY");
    expect(source("military_country__1")).toBe("CEAC_FAMILY_NATIONALITIES");
    expect(source("us_address_state", "US_STATES")).toBe("CEAC_US_STATES");
    expect(source("ds160_preparer_country")).toBe("CEAC_GEOGRAPHY");
    expect(DS160_OFFICIAL_OPTION_PAIRS.CEAC_US_STATES.some(([code]) => code === "FM")).toBe(false);
    expect(DS160_OFFICIAL_OPTION_PAIRS.CEAC_NATIONALITIES.some(([code]) => code === "USA")).toBe(false);
    expect(DS160_OFFICIAL_OPTION_PAIRS.CEAC_OTHER_NATIONALITIES.some(([code]) => code === "USA")).toBe(true);
  });
  it("displays legacy values without silently selecting a different region", () => {
    expect(resolveDs160OfficialOptionValue("CEAC_GEOGRAPHY", "China")).toBe("CHINA");
    expect(resolveDs160OfficialOptionValue("CEAC_GEOGRAPHY", "中国")).toBe("CHINA");
    expect(resolveDs160OfficialOptionValue("CEAC_GEOGRAPHY", "CN")).toBe("CHINA");
    expect(resolveDs160OfficialOptionValue("CEAC_BIRTH_COUNTRIES", "CN")).toBe("CHINA");
    expect(resolveDs160OfficialOptionValue("CEAC_NATIONALITIES", "CN")).toBe("CHINA");
    expect(resolveDs160OfficialOptionValue("CEAC_GEOGRAPHY", "United States")).toBe("UNITED STATES OF AMERICA");
    expect(resolveDs160OfficialOptionValue("CEAC_BIRTH_COUNTRIES", "Mexico")).toBe("Mexico");
    expect(resolveDs160OfficialOptionValue("CEAC_NATIONALITIES", "HONG KONG BNO")).toBe("HONG KONG BNO");
    expect(resolveDs160OfficialOptionValue("CEAC_US_STATES", "NY")).toBe("NY");
  });
});
