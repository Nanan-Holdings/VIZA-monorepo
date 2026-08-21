import { describe, expect, it } from "vitest";
import {
  isEnglishOnlyText,
  isVagueChineseLabel,
  normalizeBilingualFormField,
  resolveLocalizedFieldLabel,
  resolveLocalizedOptions,
  resolveOptionDisplayLabel,
} from "../bilingual-schema-contract";
import { TW_CITY_OPTIONS, TW_DISTRICTS_BY_CITY, TW_DISTRICT_COUNT } from "../taiwan-administrative-units";
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
    expect(resolveLocalizedFieldLabel(country, "en")).toBe("Country/Region of Birth");
    expect(resolveLocalizedFieldLabel(province, "zh")).toBe("出生省/州（如适用）");
    expect(resolveLocalizedFieldLabel(city, "zh")).toBe("出生城市");
  });

  it("uses country/region wording for every birth-country relationship field", () => {
    const cases = [
      ["country_of_birth", "出生国家/地区", "Country/Region of Birth"],
      ["birth_country", "出生国家/地区", "Country/Region of Birth"],
      ["spouse_country_of_birth", "配偶出生国家/地区", "Spouse's Country/Region of Birth"],
      ["partner_country_of_birth", "伴侣出生国家/地区", "Partner's Country/Region of Birth"],
      ["father_country_of_birth", "父亲出生国家/地区", "Father's Country/Region of Birth"],
      ["mother_country_of_birth", "母亲出生国家/地区", "Mother's Country/Region of Birth"],
    ] as const;

    for (const [fieldName, labelZh, labelEn] of cases) {
      const normalized = normalizeBilingualFormField(field({
        fieldName,
        label: fieldName.replaceAll("_", " "),
        fieldType: "country",
      }));
      expect(resolveLocalizedFieldLabel(normalized, "zh")).toBe(labelZh);
      expect(resolveLocalizedFieldLabel(normalized, "en")).toBe(labelEn);
    }
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

    expect(labels).toContain("您是否持有其他有效护照或旅行证件？");
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

  it("prefers Taiwan curated field-name labels over bad database label_zh metadata", () => {
    const samples = [
      field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName: "tw_contact_city",
        label: "TW Contact City",
        validationRules: { label_zh: "联系人城市" },
      }),
      field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName: "tw_contact_building_number",
        label: "TW Contact Building Number",
        validationRules: { label_zh: "联系人号码" },
      }),
      field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName: "tw_contact_mobile_not_applicable",
        label: "TW Contact Mobile Not Applicable",
        validationRules: { label_zh: "联系人" },
      }),
    ].map(normalizeBilingualFormField);

    expect(resolveLocalizedFieldLabel(samples[0], "zh")).toBe("县市");
    expect(resolveLocalizedFieldLabel(samples[1], "zh")).toBe("门牌号/楼/室（住饭店请填饭店名称）");
    expect(resolveLocalizedFieldLabel(samples[2], "zh")).toBe("无在台联络手机号码");
  });

  it("keeps Taiwan official field wording for shared passport, residence, contact, and declaration labels", () => {
    const expectedLabels = {
      household_revoked: "目前户口登记状态",
      passport_number: "护照号码/香港签证身份证明书号码/澳门旅行证/大陆旅行证号码",
      passport_expiry_date: "护照效期/旅行证效期（西元）",
      overseas_residency_id_number: "侨居身份证号码（如永久居留证号码、居留证号码或签证号码）",
      birth_place_is_mainland: "出生地（同所持旅游证件）",
      local_mobile_phone: "居住地手机号码（需填写国码）",
      current_occupation: "现职",
      occupation_experience: "经历",
      company_name: "公司名称及单位全衔或学校名称",
      job_title: "职称",
      is_taiwanese_spouse: "是否为台湾人民配偶？",
      overseas_address: "港、澳或海外地址",
      tw_contact_road: "街、路段",
      tw_contact_building_number: "门牌号/楼/室（住饭店请填饭店名称）",
      other_nationality_country: "所具其他国籍为",
      other_passport_number: "他国护（证）照号码",
      other_passport_expiry_date: "他国护（证）照有效期限",
      past_mainland_political_military_role: "申请人曾任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者",
      past_role_detail: "曾任职于",
      current_mainland_political_military_role: "申请人现任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者",
      current_role_detail: "现任职于",
      never_held_mainland_political_military_role: "申请人未曾担任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员",
      accepted_terms: "我已阅读并接受下列条款与条件",
    } as const;

    for (const [fieldName, expected] of Object.entries(expectedLabels)) {
      const normalized = normalizeBilingualFormField(field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName,
        label: fieldName,
      }));
      expect(resolveLocalizedFieldLabel(normalized, "zh")).toBe(expected);
    }
  });

  it("enforces Taiwan required overrides for stale local DB rows", () => {
    for (const fieldName of ["mainland_id_number", "company_name", "job_title", "kin_father_status", "kin_mother_status"] as const) {
      const normalized = normalizeBilingualFormField(field({
        visaType: "TW_ENTRY_PERMIT",
        fieldName,
        label: fieldName,
        required: false,
      }));

      expect(normalized.required).toBe(true);
    }

    const koreaSharedField = normalizeBilingualFormField(field({
      visaType: "KR_C39_SHORT_TERM_VISIT",
      fieldName: "job_title",
      label: "Job title",
      required: false,
    }));

    expect(koreaSharedField.required).toBe(false);

    const motherName = normalizeBilingualFormField(field({
      visaType: "TW_ENTRY_PERMIT",
      fieldName: "kin_mother_name",
      label: "Mother — Name",
      required: false,
    }));

    expect(motherName.required).toBe(false);

    const householdRevoked = normalizeBilingualFormField(field({
      visaType: "TW_ENTRY_PERMIT",
      fieldName: "household_revoked",
      label: "Household registration revoked",
      required: false,
      validationRules: { required_when: "eligibility_category === 2 && embassy_office in [50, 51]" },
      conditionalLogic: { showIf: "eligibility_category === 2 && embassy_office in [50, 51]" },
    }));

    expect(householdRevoked.required).toBe(false);
    expect(householdRevoked.validationRules?.required_when).toBe("eligibility_category === 2 && embassy_office in [50, 51]");
    expect(householdRevoked.conditionalLogic).toEqual({ showIf: "eligibility_category === 2 && embassy_office in [50, 51]" });
  });

  it("adds Taiwan occupation-dependent company/title visibility metadata for stale local DB rows", () => {
    const companyName = normalizeBilingualFormField(field({
      visaType: "TW_ENTRY_PERMIT",
      fieldName: "company_name",
      label: "Company name",
      required: false,
      conditionalLogic: null,
      validationRules: null,
    }));
    const jobTitle = normalizeBilingualFormField(field({
      visaType: "TW_ENTRY_PERMIT",
      fieldName: "job_title",
      label: "Job title",
      required: false,
      conditionalLogic: null,
      validationRules: null,
    }));

    expect(companyName.required).toBe(true);
    expect(companyName.conditionalLogic).toEqual({ showIf: "current_occupation not in [61,62]" });
    expect(companyName.validationRules?.required_when).toBe("current_occupation not in [61,62]");
    expect(jobTitle.required).toBe(true);
    expect(jobTitle.conditionalLogic).toEqual({ showIf: "current_occupation not in [14,61,62]" });
    expect(jobTitle.validationRules?.required_when).toBe("current_occupation not in [14,61,62]");
  });

  it("normalizes Taiwan contact city and district into official dependent selects", () => {
    const city = normalizeBilingualFormField(field({
      visaType: "TW_ENTRY_PERMIT",
      fieldName: "tw_contact_city",
      label: "City/County",
      fieldType: "select",
      options: [{ value: "16", text: "高雄市" }],
    }));
    const district = normalizeBilingualFormField(field({
      visaType: "TW_ENTRY_PERMIT",
      fieldName: "tw_contact_district",
      label: "District/township",
      fieldType: "text",
      required: false,
      options: null,
    }));

    expect(city.fieldType).toBe("select");
    expect(city.options).toHaveLength(TW_CITY_OPTIONS.length);
    expect(resolveOptionDisplayLabel(city.options, "1", "zh")).toBe("台北市");
    expect(resolveOptionDisplayLabel(city.options, "16", "zh")).toBe("高雄市");
    expect(resolveOptionDisplayLabel(city.options, "1", "en")).toBe("臺北市");
    expect(district.fieldType).toBe("select");
    expect(district.required).toBe(false);
    expect(district.options).toEqual([]);
    expect(district.validationRules).toMatchObject({
      dependent_on: "tw_contact_city",
      dependent_options_key: "taiwan_districts_by_city",
    });
    const localizedDistricts = district.validationRules?.dependent_options as typeof TW_DISTRICTS_BY_CITY;
    expect((city.options?.[0] as { value: string }).value).toBe("1");
    expect((localizedDistricts["1"][2] as { value: string; text: string; label_zh: string; official_label: string })).toMatchObject({
      value: "中山區",
      text: "中山区",
      label_zh: "中山区",
      official_label: "中山區",
    });
    expect(localizedDistricts["16"].map((option) => typeof option === "string" ? option : option.text)).toEqual(
      expect.arrayContaining(["新兴区", "前金区", "苓雅区", "盐埕区"]),
    );
    expect(localizedDistricts["7"].map((option) => typeof option === "string" ? option : option.text)).toEqual(
      expect.arrayContaining(["中坜区", "杨梅区", "观音区"]),
    );
    expect(localizedDistricts["14"].map((option) => typeof option === "string" ? option : option.text)).toEqual(
      expect.arrayContaining(["仑背乡", "麦寮乡", "林内乡", "元长乡"]),
    );
    expect(localizedDistricts["16"].map((option) => typeof option === "string" ? option : option.value)).toEqual(
      expect.arrayContaining(["新興區", "前金區", "苓雅區", "鹽埕區"]),
    );
    expect(localizedDistricts["1"].map((option) => typeof option === "string" ? option : option.text)).not.toContain("中山區");
    expect(localizedDistricts["1"].map((option) => typeof option === "string" ? option : option.text)).toContain("中山区");
    expect(TW_DISTRICTS_BY_CITY["1"].map((option) => typeof option === "string" ? option : option.text)).toContain("中山區");
    expect(TW_DISTRICT_COUNT).toBeGreaterThanOrEqual(368);
  });

  it("adds Taiwan landline reverse-required metadata without changing its default optional row", () => {
    const normalized = normalizeBilingualFormField(field({
      visaType: "TW_ENTRY_PERMIT",
      fieldName: "tw_local_phone",
      label: "Taiwan landline number",
      required: false,
    }));

    expect(normalized.required).toBe(false);
    expect(normalized.validationRules).toMatchObject({
      required_when: "tw_contact_mobile_not_applicable === true",
    });
  });

  it("keeps non-Taiwan metadata label_zh precedence for shared field names", () => {
    const normalized = normalizeBilingualFormField(field({
      visaType: "KR_C39_SHORT_TERM_VISIT",
      fieldName: "passport_number",
      label: "Passport number",
      validationRules: { label_zh: "护照号码（韩国测试文案）" },
    }));

    expect(resolveLocalizedFieldLabel(normalized, "zh")).toBe("护照号码（韩国测试文案）");
  });
});
