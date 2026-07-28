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

  it("uses specific Vietnamese province and border-gate labels instead of generic fallbacks", () => {
    const province = normalizeBilingualFormField(field({
      fieldName: "intended_province_city",
      label: "Intended province/city in Viet Nam",
      fieldType: "select",
      options: [
        { value: "an_giang", text: "AN GIANG" },
        { value: "ho_chi_minh_city", text: "HO CHI MINH CITY" },
      ],
    }));
    const gate = normalizeBilingualFormField(field({
      fieldName: "intended_border_gate_of_exit",
      label: "Intended border gate of exit",
      fieldType: "select",
      options: [
        { value: "bo_y_landport", text: "Bo Y Landport" },
        { value: "cat_bi_int_airport_hai_phong", text: "Cat Bi Int Airport (Hai Phong)" },
      ],
    }));

    expect(resolveLocalizedOptions(province.options, "zh")).toEqual([
      expect.objectContaining({ value: "an_giang", text: "安江省" }),
      expect.objectContaining({ value: "ho_chi_minh_city", text: "胡志明市" }),
    ]);
    expect(resolveLocalizedOptions(gate.options, "zh")).toEqual([
      expect.objectContaining({ value: "bo_y_landport", text: "Bo Y 陆路口岸" }),
      expect.objectContaining({ value: "cat_bi_int_airport_hai_phong", text: "Cat Bi 国际机场（Hai Phong）" }),
    ]);
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

  it("keeps Korea C-3-9 curated Chinese labels and options specific", () => {
    const samples = [
      field({
        visaType: "KR_C39_SHORT_TERM_VISIT",
        fieldName: "is_dual_national",
        label: "Are you a citizen of more than one country?",
        fieldType: "radio",
        validationRules: { label_zh: "是否拥有多个国籍？" },
        options: [{ value: "yes", text: "Yes", label_zh: "是" }, { value: "no", text: "No", label_zh: "否" }],
      }),
      field({
        visaType: "KR_C39_SHORT_TERM_VISIT",
        fieldName: "emergency_telephone",
        label: "Emergency contact — telephone",
        validationRules: { label_zh: "紧急联系人电话", placeholder_zh: "请填写含国家/地区代码的号码" },
      }),
      field({
        visaType: "KR_C39_SHORT_TERM_VISIT",
        fieldName: "number_of_children",
        label: "Number of children",
        validationRules: { label_zh: "子女数量" },
      }),
      field({
        visaType: "KR_C39_SHORT_TERM_VISIT",
        fieldName: "marital_status",
        label: "Current marital status",
        fieldType: "radio",
        validationRules: { label_zh: "当前婚姻状况" },
        options: [
          { value: "married", text: "Married", label_zh: "已婚" },
          { value: "divorced", text: "Divorced", label_zh: "离婚" },
          { value: "single", text: "Single", label_zh: "未婚" },
        ],
      }),
    ].map(normalizeBilingualFormField);

    expect(resolveLocalizedFieldLabel(samples[0], "zh")).toBe("是否拥有多个国籍？");
    expect(resolveLocalizedFieldLabel(samples[1], "zh")).toBe("紧急联系人电话");
    expect(resolveLocalizedFieldLabel(samples[2], "zh")).toBe("子女数量");
    expect(resolveOptionDisplayLabel(samples[3].options, "single", "zh")).toBe("未婚");
    expect(resolveOptionDisplayLabel(samples[3].options, "single", "zh")).not.toBe("单次");
  });
});
