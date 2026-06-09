import { describe, expect, test } from "vitest";
import type { WizardStep } from "@/types/visa-form-fields";
import {
  getBilingualReviewValue,
  getLocalizedOptionText,
  getReviewOfficialLabel,
  getReviewSourceLabel,
} from "../dynamic-review-step";

function baseField(overrides: Partial<WizardStep["fields"][number]>): WizardStep["fields"][number] {
  return {
    id: overrides.fieldName ?? "field",
    visaType: "VN_E_VISA",
    fieldName: overrides.fieldName ?? "field",
    label: overrides.label ?? "Field",
    fieldType: overrides.fieldType ?? "text",
    required: true,
    stepNumber: 1,
    stepName: "Vietnam",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

describe("dynamic review localization", () => {
  test("uses Vietnam schema metadata for Chinese and official review labels", () => {
    const field = baseField({
      fieldName: "has_violated_vietnam_laws",
      label: "Have you violated Vietnamese laws/regulations?",
      fieldType: "radio",
      validationRules: {
        label_zh: "是否曾违反越南法律或法规？",
        label_en: "Have you violated Vietnamese laws/regulations?",
        official_label_en: "Have you violated Vietnamese laws/regulations?",
      },
    });

    expect(getReviewSourceLabel(field)).toBe("是否曾违反越南法律或法规？");
    expect(getReviewOfficialLabel(field)).toBe("Have you violated Vietnamese laws/regulations?");
  });

  test("localizes enum values without changing the stored official value", () => {
    const options = [
      {
        value: "single",
        text: "Single-entry",
        label_zh: "单次入境",
        label_en: "Single-entry",
        official_label: "Single-entry",
      },
    ];

    expect(getLocalizedOptionText("single", options, "zh")).toBe("单次入境");
    expect(getLocalizedOptionText("single", options, "en")).toBe("Single-entry");
  });

  test("prefers explicit Chinese companion values on the review left side", () => {
    const field = baseField({
      fieldName: "purpose_of_entry",
      label: "Purpose of entry",
      fieldType: "text",
    });
    const answers = {
      purpose_of_entry: "Tourism",
      purpose_of_entry_zh: "旅游",
    };

    expect(getBilingualReviewValue(answers, "purpose_of_entry", "Tourism", field, "zh")).toBe("旅游");
    expect(getBilingualReviewValue(answers, "purpose_of_entry", "Tourism", field, "en")).toBe("Tourism");
  });
});
