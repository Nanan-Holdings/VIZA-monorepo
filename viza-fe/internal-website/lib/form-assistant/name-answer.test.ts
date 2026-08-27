import { describe, expect, it } from "vitest";
import { parseDirectCurrentFieldAnswer } from "./service";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

function field(overrides: Partial<VisaFormFieldRow> = {}): VisaFormFieldRow {
  return {
    id: "id",
    visaType: "schengen_c",
    fieldName: "surname_at_birth",
    label: "Surname at birth",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Personal details",
    displayOrder: 1,
    placeholder: null,
    validationRules: { label_zh: "出生时姓氏/曾用姓氏", maxLength: 60 },
    options: null,
    conditionalLogic: null,
    ...overrides,
  } as VisaFormFieldRow;
}

describe("plain name answers", () => {
  it("accepts a single Chinese surname", () => {
    expect(parseDirectCurrentFieldAnswer("刘", field())).toEqual({
      fieldName: "surname_at_birth",
      value: "刘",
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it("accepts a multi-word Latin name", () => {
    expect(parseDirectCurrentFieldAnswer("Siu Nga Fiona", field({ fieldName: "given_names" }))?.value)
      .toBe("Siu Nga Fiona");
  });

  it("does not accept a vague answer", () => {
    expect(parseDirectCurrentFieldAnswer("不知道", field())).toBeNull();
  });

  it("does not accept a sentence", () => {
    expect(parseDirectCurrentFieldAnswer("我想改一下上一题的答案", field())).toBeNull();
  });

  it("leaves address fields to the model", () => {
    expect(
      parseDirectCurrentFieldAnswer("Penang", field({ fieldName: "accommodation_city", label: "City" })),
    ).toBeNull();
  });
});
