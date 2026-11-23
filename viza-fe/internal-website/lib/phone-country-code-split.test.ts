import { describe, expect, it } from "vitest";
import { splitInternationalPhone, splitPhoneCountryCodeForSchema } from "./phone-country-code-split";

const INDONESIA_FIELDS = [
  { fieldName: "phone_country_code", validationRules: { source: "country_calling_codes" } },
  { fieldName: "mobile_phone", validationRules: { pattern: "^\\d{4,15}$", maxLength: 16 } },
];

describe("splitInternationalPhone", () => {
  it.each([
    ["+65 80381309", "+65", "80381309"],
    ["+65-8038-1309", "+65", "80381309"],
    ["(+65) 8038 1309", "+65", "80381309"],
    ["006580381309", "+65", "80381309"],
    ["+6580381309", "+65", "80381309"],
    ["+86 138 0013 8000", "+86", "13800138000"],
    ["+1 415 555 0100", "+1", "4155550100"],
    ["+62 812-3456-7890", "+62", "81234567890"],
  ])("splits %s", (raw, code, number) => {
    expect(splitInternationalPhone(raw)).toEqual({ countryCode: code, nationalNumber: number });
  });

  it("leaves numbers without an international prefix alone", () => {
    expect(splitInternationalPhone("80381309")).toBeNull();
    expect(splitInternationalPhone("")).toBeNull();
    expect(splitInternationalPhone("+65 abc")).toBeNull();
  });
});

describe("splitPhoneCountryCodeForSchema", () => {
  it("fills the Indonesia country code and keeps only digits in the number", () => {
    expect(splitPhoneCountryCodeForSchema({ mobile_phone: "+65 80381309" }, INDONESIA_FIELDS)).toEqual({
      mobile_phone: "80381309",
      phone_country_code: "+65",
    });
  });

  it("never overwrites a country code the applicant chose", () => {
    expect(
      splitPhoneCountryCodeForSchema({ mobile_phone: "+65 80381309", phone_country_code: "+62" }, INDONESIA_FIELDS),
    ).toEqual({ mobile_phone: "80381309", phone_country_code: "+62" });
  });

  it("leaves an already valid number unchanged", () => {
    const values = { mobile_phone: "80381309", phone_country_code: "+65" };
    expect(splitPhoneCountryCodeForSchema(values, INDONESIA_FIELDS)).toBe(values);
  });

  it("does not touch forms that expect the full international number", () => {
    const ds160 = [{ fieldName: "mobile_phone", validationRules: { has_does_not_apply: true } }];
    const values = { mobile_phone: "+65 80381309" };
    expect(splitPhoneCountryCodeForSchema(values, ds160)).toBe(values);
    const noPattern = [...INDONESIA_FIELDS.slice(0, 1), { fieldName: "mobile_phone", validationRules: {} }];
    expect(splitPhoneCountryCodeForSchema(values, noPattern)).toBe(values);
  });
});
