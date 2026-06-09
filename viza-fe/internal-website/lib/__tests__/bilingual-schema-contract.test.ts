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

  it("uses explicit birthplace labels instead of token-order Chinese fallbacks", () => {
    const country = normalizeBilingualFormField(field({
      fieldName: "place_of_birth_country",
      label: "Place of birth — Country",
      fieldType: "country",
    }));
    const province = normalizeBilingualFormField(field({
      fieldName: "birth_province_or_state",
      label: "State/Province of birth",
    }));
    const city = normalizeBilingualFormField(field({
      fieldName: "birth_city",
      label: "City of birth",
    }));

    expect(resolveLocalizedFieldLabel(country, "zh")).toBe("出生国家/地区");
    expect(resolveLocalizedFieldLabel(province, "zh")).toBe("出生省/州（如适用）");
    expect(resolveLocalizedFieldLabel(city, "zh")).toBe("出生城市");
  });

  it("uses curated labels for Schengen surname-at-birth fields", () => {
    const normalized = normalizeBilingualFormField(field({
      fieldName: "surname_at_birth_different",
      label: "Is your surname at birth different from your current surname?",
      fieldType: "radio",
      options: [
        { value: "yes", text: "Yes" },
        { value: "no", text: "No" },
      ],
    }));

    expect(resolveLocalizedFieldLabel(normalized, "zh")).toBe("出生时姓氏是否与当前姓氏不同？");
    expect(resolveLocalizedFieldLabel(normalized, "en")).toBe("Is your surname at birth different from your current surname?");
  });

  it("keeps recurring country-seed questions specific on the Chinese side", () => {
    const samples = [
      field({
        fieldName: "has_other_passports",
        label: "Do you currently hold or have you previously held any other passport?",
        fieldType: "radio",
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      }),
      field({
        fieldName: "position_title",
        label: "Position / Title",
        required: false,
      }),
      field({
        fieldName: "has_tuberculosis_history",
        label: "Have you ever had, or been treated for, tuberculosis (TB)?",
        fieldType: "radio",
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      }),
      field({
        fieldName: "declaration_consent_to_share_data",
        label: "I consent to the Department of Home Affairs sharing my personal information with other Australian government agencies and overseas authorities for the purposes of assessing this application.",
        fieldType: "checkbox",
      }),
    ].map(normalizeBilingualFormField);

    const labels = samples.map((sample) => resolveLocalizedFieldLabel(sample, "zh"));

    expect(labels).toContain("是否目前持有或曾经持有其他护照？");
    expect(labels).toContain("职位/职称");
    expect(labels).toContain("是否曾患有或接受过结核病（TB）治疗？");
    expect(labels).toContain("我同意为审理本申请而与相关澳大利亚政府机构及境外主管机关共享我的个人信息");
    for (const labelZh of labels) {
      expect(labelZh.startsWith("请填写：")).toBe(false);
      expect(isVagueChineseLabel(labelZh)).toBe(false);
      expect(isEnglishOnlyText(labelZh)).toBe(false);
    }
  });
});
