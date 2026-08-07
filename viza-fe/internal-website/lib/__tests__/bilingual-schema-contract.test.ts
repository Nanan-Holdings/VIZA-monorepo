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

  it("does not copy declaration labels into helper text", () => {
    const officialLabel =
      "I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted.";
    const normalized = normalizeBilingualFormField(field({
      fieldName: "declaration_data_rights_awareness",
      label: officialLabel,
      fieldType: "radio",
      options: [
        { value: "yes", text: "Yes" },
        { value: "no", text: "No" },
      ],
      validationRules: {
        helper_en: `  ${officialLabel}  `,
      },
    }));

    expect(normalized.validationRules?.helper_en).toBeUndefined();
    expect(normalized.validationRules?.helper_zh).toBeTruthy();
    expect(normalized.validationRules?.helper_zh).not.toBe(
      resolveLocalizedFieldLabel(normalized, "zh"),
    );
  });

  it("omits generated helpers when no distinct guidance exists", () => {
    const normalized = normalizeBilingualFormField(field({
      fieldName: "declaration_custom_notice",
      label:
        "I acknowledge this official declaration and confirm that I have carefully reviewed every statement supplied with this application before selecting an answer to this question.",
      fieldType: "radio",
      options: [
        { value: "yes", text: "Yes" },
        { value: "no", text: "No" },
      ],
    }));

    expect(normalized.validationRules?.helper_en).toBeUndefined();
    expect(normalized.validationRules?.helper_zh).toBeUndefined();
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

  it("keeps Japan travel-history guidance but suppresses Character & Declaration tips", () => {
    const travelHistoryFields = [
      ["refused_visa_or_entry_japan", "Have you ever been refused a visa to, or denied entry into, Japan?"],
      ["refused_visa_other_country", "Have you ever been refused a visa to, or denied entry into, any other country?"],
    ] as const;
    const characterFields = [
      ["has_criminal_record", "Have you ever been convicted of a crime in any country?"],
      ["has_been_deported", "Have you ever been deported from Japan or any other country?"],
      ["has_overstayed_japan", "Have you ever overstayed a visa or stayed in Japan illegally?"],
      ["has_drug_or_trafficking_history", "Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons?"],
      ["final_declaration", "I hereby declare that the statements made in this application are true and correct."],
    ] as const;

    for (const [fieldName, label] of travelHistoryFields) {
      const normalized = normalizeBilingualFormField(field({
        visaType: "JP_TOURIST",
        fieldName,
        label,
        fieldType: "radio",
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      }));

      expect(normalized.validationRules?.helper_en).toBeTruthy();
      expect(normalized.validationRules?.helper_en).not.toBe(label);
    }

    for (const [fieldName, label] of characterFields) {
      const normalized = normalizeBilingualFormField(field({
        visaType: "JP_TOURIST",
        fieldName,
        label,
        fieldType: fieldName === "final_declaration" ? "checkbox" : "radio",
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
        validationRules: {
          helper_en: "Legacy helper still stored in the database",
          helper_zh: "数据库中仍存有的旧提示",
        },
      }));

      expect(normalized.validationRules?.helper_en).toBeUndefined();
      expect(normalized.validationRules?.helper_zh).toBeUndefined();
    }
  });

  it("localizes official nationality names while preserving official values", () => {
    const normalized = normalizeBilingualFormField(field({
      visaType: "VN_PRE_ARRIVAL",
      fieldName: "nationality",
      label: "Nationality",
      fieldType: "country",
      options: [
        { value: "China", text: "China" },
        { value: "Dominican Republic", text: "Dominican Republic" },
        { value: "Lao People's Democratic Republic", text: "Lao People's Democratic Republic" },
        { value: "Republic of Moldova", text: "Republic of Moldova" },
      ],
    }));

    expect(resolveLocalizedOptions(normalized.options, "zh")).toEqual([
      expect.objectContaining({ value: "China", text: "中国" }),
      expect.objectContaining({ value: "Dominican Republic", text: "多米尼加共和国" }),
      expect.objectContaining({ value: "Lao People's Democratic Republic", text: "老挝" }),
      expect.objectContaining({ value: "Republic of Moldova", text: "摩尔多瓦" }),
    ]);
    expect(resolveLocalizedOptions(normalized.options, "en")).toEqual([
      expect.objectContaining({ value: "China", text: "China" }),
      expect.objectContaining({ value: "Dominican Republic", text: "Dominican Republic" }),
      expect.objectContaining({ value: "Lao People's Democratic Republic", text: "Lao People's Democratic Republic" }),
      expect.objectContaining({ value: "Republic of Moldova", text: "Republic of Moldova" }),
    ]);
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

  it("uses accurate Chinese-only DS-160 labels and marital-status options", () => {
    const travelPlans = normalizeBilingualFormField(field({
      visaType: "DS160",
      fieldName: "has_specific_travel_plans",
      label: "Have you made specific travel plans?",
      fieldType: "radio",
      validationRules: { label_zh: "是否计划?" },
      options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
    }));
    const payer = normalizeBilingualFormField(field({
      visaType: "DS160",
      fieldName: "trip_payer_type",
      label: "Person/Entity Paying for Your Trip",
      fieldType: "select",
      validationRules: { label_zh: "谁为您此次英国之行付费？" },
      options: [{ value: "self", text: "SELF" }],
    }));
    const maritalStatus = normalizeBilingualFormField(field({
      visaType: "DS160",
      fieldName: "marital_status",
      label: "Marital Status",
      fieldType: "select",
      options: [
        { value: "married", text: "MARRIED" },
        { value: "common_law", text: "COMMON LAW MARRIAGE" },
        { value: "civil_union", text: "CIVIL UNION/DOMESTIC PARTNERSHIP" },
        { value: "single", text: "SINGLE" },
        { value: "widowed", text: "WIDOWED" },
        { value: "divorced", text: "DIVORCED" },
        { value: "legally_separated", text: "LEGALLY SEPARATED" },
        { value: "other", text: "OTHER" },
      ],
    }));

    expect(resolveLocalizedFieldLabel(travelPlans, "zh")).toBe("是否已有具体旅行计划？");
    expect(resolveLocalizedFieldLabel(payer, "zh")).toBe("谁为您的旅行付费？");
    expect(resolveLocalizedOptions(payer.options, "zh")?.[0]).toMatchObject({ text: "本人" });
    expect(resolveLocalizedOptions(maritalStatus.options, "zh")?.map((option) => (
      typeof option === "string" ? option : option.text
    ))).toEqual([
      "已婚",
      "事实婚姻",
      "民事结合/家庭伴侣关系",
      "未婚",
      "丧偶",
      "离婚",
      "合法分居",
      "其他",
    ]);
  });

  it("replaces legacy Taiwan permit labels with natural Chinese wording", () => {
    const samples = [
      field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName: "accepted_terms",
        label: "I have read and accept the following terms and conditions",
        fieldType: "checkbox",
        validationRules: { label_zh: "请填写：Accepted Terms" },
      }),
      field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName: "kin_child1_current_address_same_as_overseas",
        label: "Kin Child1 Current Address Same As Overseas",
        fieldType: "radio",
        validationRules: {
          label_zh: "Child 1 (子女) — Current address same as applicant's overseas address",
        },
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      }),
      field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName: "current_mainland_political_military_role",
        label: "Applicant currently holds a mainland political or military role",
        fieldType: "radio",
        validationRules: { label_zh: "当前" },
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      }),
    ].map(normalizeBilingualFormField);

    expect(samples.map((sample) => resolveLocalizedFieldLabel(sample, "zh"))).toEqual([
      "我已阅读并同意以下条款与声明",
      "第一名子女—当前住址是否与申请人的港澳或海外住址相同？",
      "您目前是否在中国大陆党政军机关、政治性组织或相关团体任职或具有成员身份？",
    ]);
  });

  it("localizes health, border-point, and official-form options without changing values", () => {
    const symptoms = normalizeBilingualFormField(field({
      visaType: "PH_ETRAVEL_ARRIVAL_CARD",
      fieldName: "sickness_symptom",
      label: "Symptoms",
      fieldType: "checkbox",
      options: [
        { value: "Cough", text: "Cough" },
        { value: "Difficulty of Breathing", text: "Difficulty of Breathing" },
        { value: "Rashes, vesicles or blisters", text: "Rashes, vesicles or blisters" },
      ],
    }));
    const checkpoints = normalizeBilingualFormField(field({
      visaType: "SG_VISITOR_VISA",
      fieldName: "port_of_entry",
      label: "Port of entry",
      fieldType: "select",
      options: [
        { value: "woodlands", text: "Woodlands Checkpoint (Causeway / land)" },
        { value: "tuas", text: "Tuas Checkpoint (Second Link / land)" },
      ],
    }));

    expect(resolveLocalizedOptions(symptoms.options, "zh")).toEqual([
      expect.objectContaining({ value: "Cough", text: "咳嗽" }),
      expect.objectContaining({ value: "Difficulty of Breathing", text: "呼吸困难" }),
      expect.objectContaining({ value: "Rashes, vesicles or blisters", text: "皮疹、水疱或疱疹" }),
    ]);
    expect(resolveLocalizedOptions(checkpoints.options, "zh")).toEqual([
      expect.objectContaining({ value: "woodlands", text: "兀兰关卡（新柔长堤，陆路）" }),
      expect.objectContaining({ value: "tuas", text: "大士关卡（第二通道，陆路）" }),
    ]);
  });

  it("keeps yes-or-no questions as complete Chinese questions", () => {
    const samples = [
      field({
        visaType: "DS160",
        fieldName: "has_social_media",
        label: "Have you used any social media platforms in the last five years?",
        fieldType: "radio",
      }),
      field({
        visaType: "EU_SCHENGEN_C_SHORT_STAY",
        fieldName: "event_invitation_letter_held",
        label: "Do you have an invitation letter from the organiser?",
        fieldType: "radio",
        validationRules: { label_zh: "活动" },
      }),
      field({
        visaType: "JP_TOURIST",
        fieldName: "has_inviter_in_japan",
        label: "Do you have an inviter or guarantor in Japan?",
        fieldType: "radio",
        validationRules: { label_zh: "邀请人" },
      }),
    ].map(normalizeBilingualFormField);

    expect(samples.map((sample) => resolveLocalizedFieldLabel(sample, "zh"))).toEqual([
      "过去五年内是否使用过任何社交媒体平台？",
      "您是否持有活动主办方出具的邀请函？",
      "您在日本是否有邀请人或担保人？",
    ]);
  });
});
