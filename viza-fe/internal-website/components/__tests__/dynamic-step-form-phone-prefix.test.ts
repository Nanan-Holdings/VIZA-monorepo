import { describe, expect, it } from "vitest";
import { splitInternationalPhonePrefix } from "@/components/dynamic-step-form";

const fields = [
  { fieldName: "phone_country_code", options: null },
  { fieldName: "mobile_phone", options: null },
];

describe("splitInternationalPhonePrefix", () => {
  it("moves a saved '+65 ...' profile phone into the calling-code select", () => {
    expect(
      splitInternationalPhonePrefix(fields, { phone_country_code: "", mobile_phone: "+65 80381309" }),
    ).toMatchObject({ phone_country_code: "+65", mobile_phone: "80381309" });
  });

  it("keeps the code the applicant already chose when it matches, and never overwrites a different one", () => {
    expect(
      splitInternationalPhonePrefix(fields, { phone_country_code: "+65", mobile_phone: "+65 8038 1309" }),
    ).toMatchObject({ phone_country_code: "+65", mobile_phone: "8038 1309" });
    expect(
      splitInternationalPhonePrefix(fields, { phone_country_code: "+86", mobile_phone: "+65 80381309" }),
    ).toMatchObject({ phone_country_code: "+86", mobile_phone: "+65 80381309" });
  });

  it("does not touch the field being typed, ambiguous input, or forms without a code select", () => {
    const typing = { phone_country_code: "", mobile_phone: "+65 80381309" };
    expect(splitInternationalPhonePrefix(fields, typing, "mobile_phone")).toBe(typing);
    const noSeparator = { phone_country_code: "", mobile_phone: "+6580381309" };
    expect(splitInternationalPhonePrefix(fields, noSeparator)).toBe(noSeparator);
    const single = { mobile_phone: "+65 80381309" };
    expect(splitInternationalPhonePrefix([{ fieldName: "mobile_phone", options: null }], single)).toBe(single);
  });
});
