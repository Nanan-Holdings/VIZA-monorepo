import { toBilingualSeedRow, type BilingualSeedField } from "../bilingual-seed-row";

export const KE_ETA_VISA_TYPE = "KE_ETA";

export type KeEtaFieldDef = BilingualSeedField;

type KeEtaOption = {
  value: string;
  text: string;
  label_zh: string;
  label_en: string;
  official_label: string;
};

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({
  label_zh: labelZh,
  official: true,
  ...extra,
});

const option = (value: string, labelZh: string, labelEn = value): KeEtaOption => ({
  value,
  text: labelEn,
  label_zh: labelZh,
  label_en: labelEn,
  official_label: labelEn,
});

const YES_NO = [option("yes", "是", "Yes"), option("no", "否", "No")];
const SEX_OPTIONS = [
  option("Male", "男", "Male"),
  option("Female", "女", "Female"),
  option("Other", "其他", "Other"),
];
const NATIONALITY_OPTIONS = [option("China", "中国")];
const PURPOSE_OPTIONS = [option("Tourism", "旅游", "Tourism")];
const PROCESSING_SPEED_OPTIONS = [
  option("Standard", "标准处理（最多约72小时）", "Standard (up to 72 hours)"),
  option("Expedited", "加急处理（以官方门户显示为准）", "Expedited (subject to official portal availability)"),
];

export const KE_ETA_FORM_FIELDS: KeEtaFieldDef[] = [
  {
    field_name: "surname",
    label: "Surname / Family Name",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 1,
    validation_rules: rules("姓", { maxLength: 80, passport_source: true }),
  },
  {
    field_name: "given_names",
    label: "Given Names",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 2,
    validation_rules: rules("名", { maxLength: 100, passport_source: true }),
  },
  {
    field_name: "full_name",
    label: "Full Name (derived from surname and given names)",
    field_type: "computed",
    required: false,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 14,
    conditional_logic: { showIf: "false" },
    validation_rules: rules("全名（由姓和名组合）", {
      runner_canonical_key: "full_name",
      derived_from: ["surname", "given_names"],
      no_user_input: true,
      passport_source: true,
    }),
  },
  {
    field_name: "date_of_birth",
    label: "Date of Birth",
    field_type: "date",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 3,
    validation_rules: rules("出生日期", { format: "YYYY-MM-DD", passport_source: true }),
  },
  {
    field_name: "sex",
    label: "Sex",
    field_type: "select",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 4,
    options: SEX_OPTIONS,
    validation_rules: rules("性别", { passport_source: true }),
  },
  {
    field_name: "nationality",
    label: "Nationality",
    field_type: "select",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 5,
    options: NATIONALITY_OPTIONS,
    validation_rules: rules("国籍", { first_phase_value: "China", passport_source: true }),
  },
  {
    field_name: "passport_number",
    label: "Passport Number",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 6,
    validation_rules: rules("护照号码", { maxLength: 32, passport_source: true }),
  },
  {
    field_name: "passport_issue_date",
    label: "Passport Issue Date",
    field_type: "date",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 7,
    validation_rules: rules("护照签发日期", { format: "YYYY-MM-DD", passport_source: true }),
  },
  {
    field_name: "passport_expiry_date",
    label: "Passport Expiry Date",
    field_type: "date",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 8,
    validation_rules: rules("护照有效期至", { format: "YYYY-MM-DD", passport_source: true }),
  },
  {
    field_name: "passport_issuing_country",
    label: "Passport Issuing Country",
    field_type: "select",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 9,
    options: NATIONALITY_OPTIONS,
    validation_rules: rules("护照签发国家", { first_phase_value: "China", passport_source: true }),
  },
  {
    field_name: "email_address",
    label: "Email Address",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 10,
    validation_rules: rules("电子邮箱地址", {
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
      runner_policy: "use_managed_alias_for_official_account_and_forward_updates_with_consent",
    }),
  },
  {
    field_name: "phone_number",
    label: "Phone Number",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 11,
    validation_rules: rules("电话号码", { maxLength: 32 }),
  },
  {
    field_name: "residential_address",
    label: "Residential Address",
    field_type: "textarea",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 13,
    validation_rules: rules("居住地址", { maxLength: 500 }),
  },
  {
    field_name: "country_of_residence",
    label: "Country of Residence",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant and Passport",
    display_order: 12,
    validation_rules: rules("居住国家 / 地区", {
      country_field: true,
      first_phase_value: "China",
    }),
  },
  {
    field_name: "arrival_date",
    label: "Arrival Date in Kenya",
    field_type: "date",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 1,
    validation_rules: rules("抵达肯尼亚日期", { format: "YYYY-MM-DD", timezone: "Africa/Nairobi" }),
  },
  {
    field_name: "departure_date",
    label: "Departure Date from Kenya",
    field_type: "date",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 2,
    validation_rules: rules("离开肯尼亚日期", { format: "YYYY-MM-DD", must_be_on_or_after: "arrival_date" }),
  },
  {
    field_name: "entry_point",
    label: "Arrival Point / Port of Entry",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 3,
    validation_rules: rules("抵达口岸 / 入境点", { maxLength: 160, official_option_or_text: true }),
  },
  {
    field_name: "flight_number",
    label: "Arrival Flight Number",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 4,
    validation_rules: rules("抵达航班号", { maxLength: 32 }),
  },
  {
    field_name: "purpose_of_travel",
    label: "Purpose of Travel",
    field_type: "select",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 5,
    options: PURPOSE_OPTIONS,
    validation_rules: rules("访问目的", { first_phase_value: "Tourism" }),
  },
  {
    field_name: "accommodation_name",
    label: "Accommodation Name",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 6,
    validation_rules: rules("住宿名称", { maxLength: 200 }),
  },
  {
    field_name: "accommodation_address",
    label: "Accommodation Address",
    field_type: "textarea",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 7,
    validation_rules: rules("住宿地址", { maxLength: 500 }),
  },
  {
    field_name: "accommodation_phone",
    label: "Accommodation Telephone Number",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Travel and Accommodation",
    display_order: 8,
    validation_rules: rules("住宿联系电话", { maxLength: 32 }),
  },
  {
    field_name: "processing_speed",
    label: "Processing Speed",
    field_type: "select",
    required: true,
    step_number: 3,
    step_name: "Fee and Declaration",
    display_order: 1,
    options: PROCESSING_SPEED_OPTIONS,
    validation_rules: rules("处理速度", {
      official_fee_source: "https://etakenya.go.ke/faqs",
      standard_fee_usd: 30,
      expedited_surcharge_usd: 100,
      runtime_price_must_match_official_portal: true,
    }),
  },
  {
    field_name: "has_currency_over_usd_10000",
    label: "Will you bring currency or monetary instruments worth more than USD 10,000 or the foreign-currency equivalent into Kenya?",
    field_type: "radio",
    required: true,
    step_number: 3,
    step_name: "Fee and Declaration",
    display_order: 2,
    options: YES_NO,
    validation_rules: rules("您是否会携带价值超过 10,000 美元或等值外币的现金或货币工具进入肯尼亚？", {
      official_source: "Kenya eTA Customs Declaration",
      threshold_usd: 10000,
    }),
  },
  {
    field_name: "declaration_confirmed",
    label: "I confirm that the information and documents provided are complete and truthful.",
    field_type: "checkbox",
    required: true,
    step_number: 3,
    step_name: "Fee and Declaration",
    display_order: 3,
    validation_rules: rules("我确认所提供的信息和材料完整且真实", {
      final_review: true,
      boolean_contract: "must_be_true",
      official_value: "true",
    }),
  },
];

export const KE_ETA_OFFICIAL_FIELD_NAMES = KE_ETA_FORM_FIELDS.map((field) => field.field_name);

export function bilingualKeEtaRows() {
  return KE_ETA_FORM_FIELDS.map((field) => toBilingualSeedRow(KE_ETA_VISA_TYPE, field));
}
