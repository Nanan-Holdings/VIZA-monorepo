import { describe, expect, it } from "vitest";
import {
  isEnglishOnlyText,
  isVagueChineseLabel,
  normalizeBilingualFormField,
  resolveLocalizedFieldLabel,
  resolveLocalizedOptions,
  resolveOptionDisplayLabel,
} from "../bilingual-schema-contract";
import type { VisaFormFieldRow } from "../../types/visa-form-fields";

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: "test-field",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    fieldName: "test_field",
    label: "Test field",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Declaration",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

describe("bilingual schema contract", () => {
  it("expands long declaration fields into clear Chinese labels and helpers", () => {
    const normalized = normalizeBilingualFormField(field({
      fieldName: "declaration_fee_not_refunded_awareness",
      label: "I am aware that the visa fee is not refunded if the visa is refused.",
      fieldType: "radio",
      options: [
        { value: "yes", text: "Yes" },
        { value: "no", text: "No" },
      ],
    }));

    const labelZh = resolveLocalizedFieldLabel(normalized, "zh");
    const helperZh = normalized.validationRules?.helper_zh;

    expect(labelZh).toContain("签证申请被拒");
    expect(isVagueChineseLabel(labelZh)).toBe(false);
    expect(isEnglishOnlyText(labelZh)).toBe(false);
    expect(helperZh).toEqual(expect.stringContaining("退款规则"));
  });

  it("localizes option labels while preserving stored values", () => {
    const normalized = normalizeBilingualFormField(field({
      fieldName: "purpose_of_journey",
      label: "Purpose of journey",
      fieldType: "select",
      options: [
        { value: "tourism", text: "Tourism" },
        { value: "family_visit", text: "Family visit" },
      ],
    }));

    const zhOptions = resolveLocalizedOptions(normalized.options, "zh");
    const enOptions = resolveLocalizedOptions(normalized.options, "en");

    expect(zhOptions?.[0]).toMatchObject({ value: "tourism", text: "旅游" });
    expect(enOptions?.[0]).toMatchObject({ value: "tourism", text: "Tourism" });
    expect(resolveOptionDisplayLabel(normalized.options, "family_visit", "zh")).toBe("探亲访友");
    expect(resolveOptionDisplayLabel(normalized.options, "family_visit", "en")).toBe("Family visit");
  });

  it("resolves vague legacy labels from field meaning", () => {
    const normalized = normalizeBilingualFormField(field({
      fieldName: "has_previous_refusal",
      label: "Previous",
      fieldType: "radio",
      options: [
        { value: "yes", text: "Yes" },
        { value: "no", text: "No" },
      ],
    }));

    expect(resolveLocalizedFieldLabel(normalized, "zh")).toBe("是否曾被拒签、被拒绝入境或被要求离境？");
    expect(resolveLocalizedFieldLabel(normalized, "en")).toBe("Previous");
  });
});
