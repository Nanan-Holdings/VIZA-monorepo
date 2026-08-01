import { describe, expect, it } from "vitest";
import {
  buildReusableAnswerPatch,
  canonicalizeUniversalProfileFieldName,
  getUniversalProfileCategory,
  isReusableUniversalProfileField,
} from "@/lib/universal-profile-fields";

describe("universal profile field catalog", () => {
  it("canonicalizes country-specific aliases without losing repeat suffixes", () => {
    expect(canonicalizeUniversalProfileFieldName("travel_document_number")).toBe("passport_number");
    expect(canonicalizeUniversalProfileFieldName("other_nationality__2")).toBe("other_nationality__2");
  });

  it("keeps reusable France and DS-160 facts but excludes a specific trip", () => {
    expect(isReusableUniversalProfileField({ fieldName: "civil_status", fieldType: "select", stepName: "Personal Details" })).toBe(true);
    expect(isReusableUniversalProfileField({ fieldName: "father_surname", fieldType: "text", stepName: "Family" })).toBe(true);
    expect(isReusableUniversalProfileField({ fieldName: "previous_visit_date_arrived", fieldType: "date", stepName: "Previous Travel" })).toBe(true);
    expect(isReusableUniversalProfileField({ fieldName: "intended_arrival_date", fieldType: "date", stepName: "Trip Details" })).toBe(false);
    expect(isReusableUniversalProfileField({ fieldName: "declaration_truthfulness", fieldType: "radio", stepName: "Declaration" })).toBe(false);
  });

  it("groups expanded facts into understandable profile sections", () => {
    expect(getUniversalProfileCategory("employer_name", "Current Work")).toBe("work_education");
    expect(getUniversalProfileCategory("spouse_nationality", "Family")).toBe("family");
    expect(getUniversalProfileCategory("visa_lost_or_stolen", "Previous Travel")).toBe("immigration_history");
  });

  it("expands canonical saved answers to the aliases used by future forms", () => {
    expect(buildReusableAnswerPatch([{
      canonicalKey: "passport_number",
      value: "E12345678",
      valueZh: "E12345678",
      valueEn: "E12345678",
    }])).toMatchObject({
      passport_number: "E12345678",
      travel_document_number: "E12345678",
      passportNumber: "E12345678",
    });
  });
});
