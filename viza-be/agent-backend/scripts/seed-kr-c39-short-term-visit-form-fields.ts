/**
 * Seed script: visa_form_fields for Korea C-3-9 Short-Term General Visa.
 *
 * Field definitions mirror Korean Annex 17 (별지 제17호서식) "사증발급신청서 /
 * VISA APPLICATION FORM", revision 2022.2.7. The form is the legally-defined
 * application template under the Enforcement Rules of the Immigration
 * Control Act and is identical for all C-3-x sub-categories — the
 * sub-category code is recorded in field 2.2 only. Source:
 * https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf (bilingual
 * KR/EN, 5 pages, 12 sections).
 *
 * Scope: C-3-9 Short-Term General Visit (≤90 days, multi-purpose,
 * single-entry) intended for mainland-China (PRC) residents who submit
 * through the local Korea Visa Application Center (KVAC.com.cn-operated)
 * since visa.go.kr self-service is not directly accessible to PRC
 * residents. The schema is form-content only — submission to KVAC happens
 * out-of-band (paper / counter intake), so there is no submission
 * automation target. Other Tourism-eligible nationalities can also use
 * this schema; their submission channel (visa.go.kr self-service or
 * embassy direct) is tracked in the gap report rather than the schema.
 *
 * Document uploads (photo 35x45mm, signature, hukou, employment cert,
 * bank statement, etc.) are intentionally out of schema per playbook §5.6
 * — they live in application_documents.
 *
 * Run: npx tsx scripts/seed-kr-c39-short-term-visit-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow, type BilingualSeedRow } from "./bilingual-seed-row";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VISA_TYPE = "KR_C39_SHORT_TERM_VISIT";

interface FieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: Array<{ value: string; text: string; label_zh?: string; label_en?: string; official_label?: string }>;
  conditional_logic?: Record<string, unknown>;
}

const YES_NO = [
  { value: "yes", text: "Yes" },
  { value: "no", text: "No" },
];

const FIELD_LABEL_ZH: Record<string, string> = {
  family_name_en: "姓（按护照英文大写）",
  given_names_en: "名（按护照英文大写）",
  name_in_chinese_characters: "中文姓名/汉字姓名",
  sex: "性别",
  date_of_birth: "出生日期",
  nationality: "国籍",
  country_of_birth: "出生国家/地区",
  national_identity_no: "本国身份证号码",
  has_used_other_names: "是否曾使用其他姓名出入韩国？",
  other_family_name: "曾用姓",
  other_given_name: "曾用名",
  is_dual_national: "是否拥有多个国籍？",
  other_nationalities: "其他国籍国家/地区",
  period_of_stay: "停留期限类别",
  status_of_stay: "拟申请停留资格",
  passport_type: "护照类型",
  passport_type_other: "其他护照类型（请说明）",
  passport_no: "护照号码",
  passport_country: "护照签发国家/地区",
  passport_place_of_issue: "护照签发地点",
  passport_date_of_issue: "护照签发日期",
  passport_date_of_expiry: "护照有效期至",
  has_other_passport: "是否持有其他有效护照？",
  other_passport_type: "其他护照类型",
  other_passport_type_other: "其他护照类型说明",
  other_passport_no: "其他护照号码",
  other_passport_country: "其他护照签发国家/地区",
  other_passport_expiry: "其他护照有效期至",
  home_country_address: "本国住址",
  current_address_same_as_home: "当前居住地址是否与本国住址相同？",
  current_residential_address: "当前居住地址（如不同）",
  cell_phone: "手机号码",
  telephone: "固定电话",
  email: "电子邮箱",
  emergency_full_name: "紧急联系人姓名",
  emergency_country_of_residence: "紧急联系人居住国家/地区",
  emergency_telephone: "紧急联系人电话",
  emergency_relationship: "紧急联系人与申请人的关系",
  marital_status: "当前婚姻状况",
  spouse_family_name_en: "配偶姓（英文）",
  spouse_given_names_en: "配偶名（英文）",
  spouse_dob: "配偶出生日期",
  spouse_nationality: "配偶国籍",
  spouse_address: "配偶居住地址",
  spouse_contact_no: "配偶联系电话",
  has_children: "是否有子女？",
  number_of_children: "子女数量",
  highest_education: "最高学历",
  highest_education_other: "其他最高学历（请说明）",
  school_name: "最近就读学校名称",
  school_location: "学校所在地（城市/省份/国家）",
  employment_status: "当前职业/就业状态",
  employment_status_other: "其他职业/就业状态（请说明）",
  employer_name: "公司/机构/学校名称",
  employer_position: "职位/课程",
  employer_address: "公司/机构/学校地址",
  employer_telephone: "公司/机构/学校联系电话",
  purpose_of_visit: "赴韩目的",
  purpose_of_visit_other: "其他赴韩目的（请说明）",
  intended_period_of_stay: "拟在韩停留天数",
  intended_date_of_entry: "拟入境韩国日期",
  address_in_korea: "在韩停留地址（含酒店）",
  contact_in_korea: "在韩联系电话",
  travelled_to_korea_5y: "过去5年内是否访问过韩国？",
  korea_visit_count: "过去5年访问韩国次数",
  korea_visit_purpose: "上次/既往赴韩目的",
  korea_visit_start_date: "既往赴韩停留开始日期",
  korea_visit_end_date: "既往赴韩停留结束日期",
  travelled_outside_5y: "过去5年内是否访问过居住国以外的国家/地区（韩国除外）？",
  foreign_trip_country: "境外旅行国家/地区",
  foreign_trip_purpose: "境外旅行目的",
  foreign_trip_start_date: "境外旅行开始日期",
  foreign_trip_end_date: "境外旅行结束日期",
  has_family_in_korea: "是否有家属目前在韩国停留？",
  family_in_korea_full_name: "在韩家属姓名（英文）",
  family_in_korea_dob: "在韩家属出生日期",
  family_in_korea_nationality: "在韩家属国籍",
  family_in_korea_relationship: "与在韩家属的关系",
  travelling_with_family: "是否与家属一同赴韩？",
  family_with_full_name: "同行家属姓名（英文）",
  family_with_dob: "同行家属出生日期",
  family_with_nationality: "同行家属国籍",
  family_with_relationship: "与同行家属的关系",
  has_inviter: "是否有人/机构邀请你赴韩？",
  inviter_name: "邀请人/机构名称",
  inviter_dob_or_brn: "邀请人出生日期或机构营业登记号",
  inviter_relationship: "邀请人与申请人的关系",
  inviter_address: "邀请人在韩国地址",
  inviter_phone: "邀请人联系电话",
  estimated_travel_costs_usd: "预计旅行费用（美元）",
  payer_name: "费用支付人/机构名称",
  payer_relationship: "费用支付人与申请人的关系",
  payer_support_type: "费用支持类型",
  payer_contact: "费用支付人联系电话",
  received_form_assistance: "是否有人协助填写本申请表？",
  assistant_full_name: "协助填写人姓名",
  assistant_dob: "协助填写人出生日期",
  assistant_telephone: "协助填写人电话",
  assistant_relationship: "协助填写人与申请人的关系",
  application_date: "申请日期",
  declaration_consent: "本人声明本申请表所填内容真实、正确，并知悉任何虚假陈述可能导致拒签或被拒绝入境韩国。",
};

const FIELD_PLACEHOLDER_ZH: Record<string, string> = {
  family_name_en: "请按护照填写英文姓",
  given_names_en: "请按护照填写英文名",
  name_in_chinese_characters: "中国大陆申请人请填写中文姓名",
  national_identity_no: "中国大陆居民请填写18位身份证号",
  other_nationalities: "例如：中国香港、中国澳门",
  passport_no: "请按护照填写",
  cell_phone: "请填写含国家/地区代码的号码",
  telephone: "请填写含国家/地区代码的号码",
  emergency_telephone: "请填写含国家/地区代码的号码",
  emergency_relationship: "例如：父母、配偶、兄弟姐妹",
  number_of_children: "例如：2",
  employer_telephone: "请填写含国家/地区代码的号码",
  purpose_of_visit: "C-3-9 通常选择旅游/过境或探亲访友",
  intended_period_of_stay: "C-3-9 最多90天",
  contact_in_korea: "请填写含韩国国家代码 +82 的号码",
  korea_visit_count: "例如：3",
  has_family_in_korea: "配偶、子女、父母、兄弟姐妹",
  family_in_korea_relationship: "例如：配偶、父母、兄弟姐妹、子女",
  family_with_relationship: "例如：配偶、父母、兄弟姐妹、子女",
  has_inviter: "韩国公民、在韩外国人、公司或机构",
  inviter_dob_or_brn: "YYYY/MM/DD 或10位营业登记号",
  inviter_relationship: "例如：朋友、商务伙伴、亲属",
  inviter_phone: "请填写含韩国国家代码 +82 的号码",
  estimated_travel_costs_usd: "例如：3000",
  payer_relationship: "例如：本人、雇主、父母",
  payer_support_type: "例如：现金、住宿、全部费用",
  payer_contact: "请填写含国家/地区代码的号码",
  assistant_telephone: "请填写含国家/地区代码的号码",
  assistant_relationship: "例如：代理、家人、朋友",
};

const GLOBAL_OPTION_LABEL_ZH: Record<string, string> = {
  yes: "是",
  no: "否",
  other: "其他",
};

const OPTION_LABEL_ZH_BY_FIELD: Record<string, Record<string, string>> = {
  sex: {
    male: "男",
    female: "女",
  },
  passport_type: {
    diplomatic: "外交护照",
    official: "公务护照",
    regular: "普通护照",
    other: "其他",
  },
  other_passport_type: {
    diplomatic: "外交护照",
    official: "公务护照",
    regular: "普通护照",
    other: "其他",
  },
  period_of_stay: {
    short_term: "短期（90天以内）",
    long_term: "长期（90天以上）",
  },
  status_of_stay: {
    "C-3-9": "C-3-9（短期一般访问）",
  },
  marital_status: {
    married: "已婚",
    divorced: "离婚",
    single: "未婚",
  },
  highest_education: {
    masters_or_doctoral: "硕士/博士",
    bachelors: "本科",
    high_school: "高中",
    other: "其他",
  },
  employment_status: {
    entrepreneur: "企业家/经营者",
    self_employed: "自雇",
    employed: "公司职员",
    civil_servant: "公务员",
    student: "学生",
    retired: "退休",
    unemployed: "无业",
    other: "其他",
  },
  purpose_of_visit: {
    tourism_transit: "旅游/过境",
    meeting_conference: "会议/会展",
    medical_tourism: "医疗旅游",
    business_trip: "短期商务",
    study_training: "学习/培训",
    work: "就业活动",
    trade_investment_ict: "贸易/投资/公司内部派驻",
    visiting_family_relatives_friends: "探亲访友",
    marriage_migrant: "结婚移民",
    diplomatic_official: "外交/公务",
    other: "其他",
  },
  declaration_consent: {
    yes: "我同意",
  },
};

function localizeKoreaOption(
  fieldName: string,
  option: NonNullable<BilingualSeedRow["options"]>[number],
): NonNullable<BilingualSeedRow["options"]>[number] {
  const value = typeof option === "string" ? option : option.value;
  const labelZh = OPTION_LABEL_ZH_BY_FIELD[fieldName]?.[value] ?? GLOBAL_OPTION_LABEL_ZH[value.toLowerCase()];
  if (!labelZh) return option;
  if (typeof option === "string") {
    return { value, text: option, label_en: option, official_label: option, label_zh: labelZh };
  }
  return { ...option, label_zh: labelZh };
}

function localizeKoreaRow(row: BilingualSeedRow): BilingualSeedRow {
  const labelZh = FIELD_LABEL_ZH[row.field_name];
  const placeholderZh = FIELD_PLACEHOLDER_ZH[row.field_name];
  return {
    ...row,
    validation_rules: {
      ...(row.validation_rules ?? {}),
      ...(labelZh ? { label_zh: labelZh } : {}),
      ...(placeholderZh ? { placeholder_zh: placeholderZh } : {}),
    },
    options: row.options?.map((option) => localizeKoreaOption(row.field_name, option)) ?? row.options,
  };
}

// ── Reusable gate constants ────────────────────────────────────────────────
const HAS_USED_OTHER_NAMES = "has_used_other_names === yes";
const IS_DUAL_NATIONAL = "is_dual_national === yes";
const PASSPORT_TYPE_OTHER = "passport_type === other";
const HAS_OTHER_PASSPORT = "has_other_passport === yes";
const OTHER_PASSPORT_TYPE_OTHER = "other_passport_type === other";
const HAS_DIFFERENT_RESIDENTIAL_ADDRESS = "current_address_same_as_home === no";
const IS_MARRIED = "marital_status === married";
const HAS_CHILDREN = "has_children === yes";
const EDUCATION_OTHER = "highest_education === other";
// 7.2 employer block hides for unemployed / retired (Annex 17 §7 instruction)
const IS_EMPLOYED_OR_STUDYING = "employment_status not in [unemployed, retired]";
const EMPLOYMENT_STATUS_OTHER = "employment_status === other";
const PURPOSE_OTHER = "purpose_of_visit === other";
const TRAVELLED_TO_KOREA_5Y = "travelled_to_korea_5y === yes";
const TRAVELLED_OUTSIDE_5Y = "travelled_outside_5y === yes";
const HAS_FAMILY_IN_KOREA = "has_family_in_korea === yes";
const TRAVELLING_WITH_FAMILY = "travelling_with_family === yes";
const HAS_INVITER = "has_inviter === yes";
const RECEIVED_FORM_ASSISTANCE = "received_form_assistance === yes";

// ── Enum option tables ─────────────────────────────────────────────────────

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

// Annex 17 §3.1
const PASSPORT_TYPE_OPTIONS = [
  { value: "diplomatic", text: "Diplomatic" },
  { value: "official", text: "Official" },
  { value: "regular", text: "Regular" },
  { value: "other", text: "Other" },
];

// Annex 17 §2.1 — locked to short_term for KR_C39_SHORT_TERM_VISIT, but the
// option list is preserved so future long-stay packages can reuse this seed
// shape.
const PERIOD_OF_STAY_OPTIONS = [
  { value: "short_term", text: "Short-term (≤ 90 days)" },
  { value: "long_term", text: "Long-term (> 90 days)" },
];

// Annex 17 §5.1 (no Widowed option in 2022.2.7 revision)
const MARITAL_STATUS_OPTIONS = [
  { value: "married", text: "Married" },
  { value: "divorced", text: "Divorced" },
  { value: "single", text: "Single" },
];

// Annex 17 §6.1
const HIGHEST_EDUCATION_OPTIONS = [
  { value: "masters_or_doctoral", text: "Master's / Doctoral" },
  { value: "bachelors", text: "Bachelor's" },
  { value: "high_school", text: "High School" },
  { value: "other", text: "Other" },
];

// Annex 17 §7.1
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "entrepreneur", text: "Entrepreneur" },
  { value: "self_employed", text: "Self-Employed" },
  { value: "employed", text: "Employed" },
  { value: "civil_servant", text: "Civil Servant" },
  { value: "student", text: "Student" },
  { value: "retired", text: "Retired" },
  { value: "unemployed", text: "Unemployed" },
  { value: "other", text: "Other" },
];

// Annex 17 §8.1 — official form is multi-checkbox ("check all that apply").
// Rendered as single-select in v1 (DynamicStepForm does not yet render
// multi-checkbox arrays); flagged as v1.1 renderer extension in
// docs/korea-visa-gap-report.md.
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism_transit", text: "Tourism / Transit" },
  { value: "meeting_conference", text: "Meeting / Conference" },
  { value: "medical_tourism", text: "Medical Tourism" },
  { value: "business_trip", text: "Business Trip" },
  { value: "study_training", text: "Study / Training" },
  { value: "work", text: "Work" },
  { value: "trade_investment_ict", text: "Trade / Investment / Intra-Company Transfer" },
  { value: "visiting_family_relatives_friends", text: "Visiting Family / Relatives / Friends" },
  { value: "marriage_migrant", text: "Marriage Migrant" },
  { value: "diplomatic_official", text: "Diplomatic / Official" },
  { value: "other", text: "Other" },
];

// Section 2.2 — locked to C-3-9 for this package. Single option.
const STATUS_OF_STAY_OPTIONS = [
  { value: "C-3-9", text: "C-3-9 (Short-Term General)" },
];

const FIELDS: FieldDef[] = [
  // ═════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Details  (Annex-17 §1)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "family_name_en", label: "Family name (in passport, block letters)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 50, inline_group: "applicant_name" } },
  { field_name: "given_names_en", label: "Given names (in passport, block letters)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 2, placeholder: "As shown in passport", validation_rules: { maxLength: 80, inline_group: "applicant_name" } },
  { field_name: "name_in_chinese_characters", label: "Name in Chinese characters / 漢字姓名", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 3, placeholder: "Required for PRC applicants", validation_rules: { maxLength: 30 } },
  { field_name: "sex", label: "Sex", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 4, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Details", display_order: 5, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD" } },
  { field_name: "nationality", label: "Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 6, validation_rules: { source: "ISO3166-1" } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 7, validation_rules: { source: "ISO3166-1" } },
  { field_name: "national_identity_no", label: "National Identity No.", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 8, placeholder: "PRC residents: 18-digit ID", validation_rules: { maxLength: 30 } },
  { field_name: "has_used_other_names", label: "Have you ever used other names to enter or depart Korea?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 9, options: YES_NO },
  { field_name: "other_family_name", label: "Other family name", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 10, conditional_logic: { showIf: HAS_USED_OTHER_NAMES }, validation_rules: { maxLength: 50, inline_group: "other_name", block_group: "other_names" } },
  { field_name: "other_given_name", label: "Other given name", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 11, conditional_logic: { showIf: HAS_USED_OTHER_NAMES }, validation_rules: { maxLength: 80, inline_group: "other_name", block_group: "other_names" } },
  { field_name: "is_dual_national", label: "Are you a citizen of more than one country?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 12, options: YES_NO },
  { field_name: "other_nationalities", label: "List the other countries of citizenship", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 13, conditional_logic: { showIf: IS_DUAL_NATIONAL }, placeholder: "e.g. Hong Kong SAR, Macao SAR", validation_rules: { maxLength: 200 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 2: Visa Category & Passport  (Annex-17 §2 + §3)
  // §2 is hard-locked to short_term + C-3-9 for this package.
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "period_of_stay", label: "Period of Stay", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 1, options: PERIOD_OF_STAY_OPTIONS, validation_rules: { locked_value: "short_term" } },
  { field_name: "status_of_stay", label: "Status of Stay", field_type: "select", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 2, options: STATUS_OF_STAY_OPTIONS, validation_rules: { locked_value: "C-3-9" } },
  { field_name: "passport_type", label: "Passport type", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 3, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_type_other", label: "Passport type — Other (please specify)", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 4, conditional_logic: { showIf: PASSPORT_TYPE_OTHER }, validation_rules: { maxLength: 80 } },
  { field_name: "passport_no", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 5, placeholder: "As shown in passport", validation_rules: { maxLength: 20 } },
  { field_name: "passport_country", label: "Country of passport", field_type: "country", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 6, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_place_of_issue", label: "Place of issue", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 7, validation_rules: { maxLength: 80 } },
  { field_name: "passport_date_of_issue", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 8, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", inline_group: "passport_dates" } },
  { field_name: "passport_date_of_expiry", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 9, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", inline_group: "passport_dates" } },
  { field_name: "has_other_passport", label: "Do you currently hold any other valid passport?", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 10, options: YES_NO },
  { field_name: "other_passport_type", label: "Other passport — type", field_type: "radio", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 11, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, options: PASSPORT_TYPE_OPTIONS, validation_rules: { block_group: "other_passport" } },
  { field_name: "other_passport_type_other", label: "Other passport — type other (please specify)", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 12, conditional_logic: { showIf: `${HAS_OTHER_PASSPORT} && ${OTHER_PASSPORT_TYPE_OTHER}` }, validation_rules: { maxLength: 80, block_group: "other_passport" } },
  { field_name: "other_passport_no", label: "Other passport — number", field_type: "text", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 13, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, validation_rules: { maxLength: 20, block_group: "other_passport" } },
  { field_name: "other_passport_country", label: "Other passport — country of passport", field_type: "country", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 14, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, validation_rules: { source: "ISO3166-1", block_group: "other_passport" } },
  { field_name: "other_passport_expiry", label: "Other passport — date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Visa Category & Passport", display_order: 15, conditional_logic: { showIf: HAS_OTHER_PASSPORT }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", block_group: "other_passport" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 3: Contact & Emergency Contact  (Annex-17 §4)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "home_country_address", label: "Home country address", field_type: "textarea", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 1, validation_rules: { maxLength: 300 } },
  { field_name: "current_address_same_as_home", label: "Is your current residential address the same as your home country address?", field_type: "radio", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 2, options: YES_NO },
  { field_name: "current_residential_address", label: "Current residential address (if different from home)", field_type: "textarea", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 3, conditional_logic: { showIf: HAS_DIFFERENT_RESIDENTIAL_ADDRESS }, validation_rules: { maxLength: 300 } },
  { field_name: "cell_phone", label: "Cell phone (mobile)", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 4, placeholder: "Including country code", validation_rules: { maxLength: 30, inline_group: "phones" } },
  { field_name: "telephone", label: "Telephone (landline)", field_type: "text", required: false, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 5, placeholder: "Including country code", validation_rules: { maxLength: 30, inline_group: "phones" } },
  { field_name: "email", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 6, placeholder: "name@example.com", validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },
  { field_name: "emergency_full_name", label: "Emergency contact — full name", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 7, validation_rules: { maxLength: 120, block_group: "emergency_contact" } },
  { field_name: "emergency_country_of_residence", label: "Emergency contact — country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "emergency_contact" } },
  { field_name: "emergency_telephone", label: "Emergency contact — telephone", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 9, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "emergency_contact" } },
  { field_name: "emergency_relationship", label: "Emergency contact — relationship to applicant", field_type: "text", required: true, step_number: 3, step_name: "Contact & Emergency Contact", display_order: 10, placeholder: "e.g. parent, spouse, sibling", validation_rules: { maxLength: 60, block_group: "emergency_contact" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 4: Marital & Family  (Annex-17 §5)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "marital_status", label: "Current marital status", field_type: "radio", required: true, step_number: 4, step_name: "Marital & Family", display_order: 1, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_family_name_en", label: "Spouse — family name (English)", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 2, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 50, inline_group: "spouse_name", block_group: "spouse" } },
  { field_name: "spouse_given_names_en", label: "Spouse — given names (English)", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 3, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 80, inline_group: "spouse_name", block_group: "spouse" } },
  { field_name: "spouse_dob", label: "Spouse — date of birth", field_type: "date", required: true, step_number: 4, step_name: "Marital & Family", display_order: 4, conditional_logic: { showIf: IS_MARRIED }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — nationality", field_type: "country", required: true, step_number: 4, step_name: "Marital & Family", display_order: 5, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "spouse_address", label: "Spouse — residential address", field_type: "textarea", required: true, step_number: 4, step_name: "Marital & Family", display_order: 6, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 300, block_group: "spouse" } },
  { field_name: "spouse_contact_no", label: "Spouse — contact number", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 7, conditional_logic: { showIf: IS_MARRIED }, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "spouse" } },
  { field_name: "has_children", label: "Do you have any children?", field_type: "radio", required: true, step_number: 4, step_name: "Marital & Family", display_order: 8, options: YES_NO },
  { field_name: "number_of_children", label: "Number of children", field_type: "text", required: true, step_number: 4, step_name: "Marital & Family", display_order: 9, conditional_logic: { showIf: HAS_CHILDREN }, placeholder: "e.g. 2", validation_rules: { pattern: "^[0-9]{1,2}$" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 5: Education & Employment  (Annex-17 §6 + §7)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "highest_education", label: "Highest education completed", field_type: "radio", required: true, step_number: 5, step_name: "Education & Employment", display_order: 1, options: HIGHEST_EDUCATION_OPTIONS },
  { field_name: "highest_education_other", label: "Highest education — Other (please specify)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 2, conditional_logic: { showIf: EDUCATION_OTHER }, validation_rules: { maxLength: 120 } },
  { field_name: "school_name", label: "Name of school (most recent)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 3, validation_rules: { maxLength: 120, block_group: "school" } },
  { field_name: "school_location", label: "School location (city / province / country)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 4, validation_rules: { maxLength: 200, block_group: "school" } },
  { field_name: "employment_status", label: "Current occupation / employment status", field_type: "radio", required: true, step_number: 5, step_name: "Education & Employment", display_order: 5, options: EMPLOYMENT_STATUS_OPTIONS },
  { field_name: "employment_status_other", label: "Employment status — Other (please specify)", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 6, conditional_logic: { showIf: EMPLOYMENT_STATUS_OTHER }, validation_rules: { maxLength: 120 } },
  { field_name: "employer_name", label: "Company / institution / school name", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 7, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, validation_rules: { maxLength: 120, block_group: "employer" } },
  { field_name: "employer_position", label: "Position / course", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 8, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, validation_rules: { maxLength: 80, block_group: "employer" } },
  { field_name: "employer_address", label: "Company / institution / school address", field_type: "textarea", required: true, step_number: 5, step_name: "Education & Employment", display_order: 9, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, validation_rules: { maxLength: 300, block_group: "employer" } },
  { field_name: "employer_telephone", label: "Company / institution / school telephone", field_type: "text", required: true, step_number: 5, step_name: "Education & Employment", display_order: 10, conditional_logic: { showIf: IS_EMPLOYED_OR_STUDYING }, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "employer" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 6: Trip & Visit  (Annex-17 §8.1–8.5)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_visit", label: "Purpose of visit to Korea", field_type: "select", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 1, options: PURPOSE_OF_VISIT_OPTIONS, placeholder: "C-3-9 typically: Tourism / Transit or Visiting Family / Relatives / Friends" },
  { field_name: "purpose_of_visit_other", label: "Purpose of visit — Other (please specify)", field_type: "text", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 2, conditional_logic: { showIf: PURPOSE_OTHER }, validation_rules: { maxLength: 200 } },
  { field_name: "intended_period_of_stay", label: "Intended period of stay (days)", field_type: "text", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 3, placeholder: "Maximum 90 for C-3-9", validation_rules: { pattern: "^(?:[1-9]|[1-8][0-9]|90)$" } },
  { field_name: "intended_date_of_entry", label: "Intended date of entry into Korea", field_type: "date", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 4, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD" } },
  { field_name: "address_in_korea", label: "Address in Korea (incl. hotels)", field_type: "textarea", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 5, validation_rules: { maxLength: 300 } },
  { field_name: "contact_in_korea", label: "Contact number in Korea", field_type: "text", required: true, step_number: 6, step_name: "Trip & Visit", display_order: 6, placeholder: "Including country code +82", validation_rules: { maxLength: 30 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 7: Travel History & Family in/with Korea  (Annex-17 §8.6–8.9)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "travelled_to_korea_5y", label: "Have you travelled to Korea in the last 5 years?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 1, options: YES_NO },
  { field_name: "korea_visit_count", label: "Number of times visited Korea (last 5 years)", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 2, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, placeholder: "e.g. 3", validation_rules: { pattern: "^[0-9]{1,2}$" } },
  { field_name: "korea_visit_purpose", label: "Prior Korea visit — purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 3, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "korea_visits", max_items: 10 } },
  { field_name: "korea_visit_start_date", label: "Prior Korea visit — period start", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 4, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "korea_visits", inline_group: "korea_visit_dates" } },
  { field_name: "korea_visit_end_date", label: "Prior Korea visit — period end", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 5, conditional_logic: { showIf: TRAVELLED_TO_KOREA_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "korea_visits", inline_group: "korea_visit_dates" } },
  { field_name: "travelled_outside_5y", label: "Have you travelled outside your country of residence (excl. Korea) in the last 5 years?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 6, options: YES_NO },
  { field_name: "foreign_trip_country", label: "Foreign trip — country", field_type: "country", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 7, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "foreign_trips_5y", max_items: 10 } },
  { field_name: "foreign_trip_purpose", label: "Foreign trip — purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 8, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "foreign_trips_5y" } },
  { field_name: "foreign_trip_start_date", label: "Foreign trip — period start", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 9, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "foreign_trips_5y", inline_group: "foreign_trip_dates" } },
  { field_name: "foreign_trip_end_date", label: "Foreign trip — period end", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 10, conditional_logic: { showIf: TRAVELLED_OUTSIDE_5Y }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "foreign_trips_5y", inline_group: "foreign_trip_dates" } },
  { field_name: "has_family_in_korea", label: "Do you have any family members currently staying in Korea?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 11, options: YES_NO, placeholder: "Spouse, children, parents, siblings" },
  { field_name: "family_in_korea_full_name", label: "Family in Korea — full name (English)", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 12, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "family_in_korea", max_items: 10 } },
  { field_name: "family_in_korea_dob", label: "Family in Korea — date of birth", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 13, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "family_in_korea" } },
  { field_name: "family_in_korea_nationality", label: "Family in Korea — nationality", field_type: "country", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 14, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "family_in_korea" } },
  { field_name: "family_in_korea_relationship", label: "Family in Korea — relationship to applicant", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 15, conditional_logic: { showIf: HAS_FAMILY_IN_KOREA }, placeholder: "e.g. spouse, parent, sibling, child", validation_rules: { maxLength: 60, repeatable: true, repeat_group: "family_in_korea" } },
  { field_name: "travelling_with_family", label: "Are you travelling to Korea with any family members?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 16, options: YES_NO },
  { field_name: "family_with_full_name", label: "Travelling-with family — full name (English)", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 17, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "family_travelling_with", max_items: 10 } },
  { field_name: "family_with_dob", label: "Travelling-with family — date of birth", field_type: "date", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 18, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", repeatable: true, repeat_group: "family_travelling_with" } },
  { field_name: "family_with_nationality", label: "Travelling-with family — nationality", field_type: "country", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 19, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "family_travelling_with" } },
  { field_name: "family_with_relationship", label: "Travelling-with family — relationship to applicant", field_type: "text", required: true, step_number: 7, step_name: "Travel History & Family", display_order: 20, conditional_logic: { showIf: TRAVELLING_WITH_FAMILY }, placeholder: "e.g. spouse, parent, sibling, child", validation_rules: { maxLength: 60, repeatable: true, repeat_group: "family_travelling_with" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 8: Invitation, Funding, Form Assistance & Declaration  (Annex-17 §9–§12)
  // Annex-17 §12.3 (applicant signature) is intentionally out of schema —
  // the form is paper-signed at KVAC. Photo §1.0 is also out of schema (file
  // upload via application_documents).
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_inviter", label: "Is anyone inviting you to Korea?", field_type: "radio", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 1, options: YES_NO, placeholder: "Korean national, foreign resident in Korea, company, or institute" },
  { field_name: "inviter_name", label: "Inviter — name (person or organisation)", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 2, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 120, block_group: "inviter" } },
  { field_name: "inviter_dob_or_brn", label: "Inviter — date of birth or business registration number", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 3, conditional_logic: { showIf: HAS_INVITER }, placeholder: "YYYY/MM/DD or 10-digit BRN", validation_rules: { maxLength: 30, block_group: "inviter" } },
  { field_name: "inviter_relationship", label: "Inviter — relationship to applicant", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 4, conditional_logic: { showIf: HAS_INVITER }, placeholder: "e.g. friend, business partner, relative", validation_rules: { maxLength: 80, block_group: "inviter" } },
  { field_name: "inviter_address", label: "Inviter — address in Korea", field_type: "textarea", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 5, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 300, block_group: "inviter" } },
  { field_name: "inviter_phone", label: "Inviter — phone number", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 6, conditional_logic: { showIf: HAS_INVITER }, placeholder: "Including country code +82", validation_rules: { maxLength: 30, block_group: "inviter" } },
  { field_name: "estimated_travel_costs_usd", label: "Estimated travel costs (USD)", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 7, placeholder: "e.g. 3000", validation_rules: { pattern: "^[0-9]{1,8}$" } },
  { field_name: "payer_name", label: "Payer — name (person or organisation)", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 8, validation_rules: { maxLength: 120, block_group: "payer" } },
  { field_name: "payer_relationship", label: "Payer — relationship to applicant", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 9, placeholder: "e.g. self, employer, parent", validation_rules: { maxLength: 80, block_group: "payer" } },
  { field_name: "payer_support_type", label: "Payer — type of support", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 10, placeholder: "e.g. cash, accommodation, all-in", validation_rules: { maxLength: 120, block_group: "payer" } },
  { field_name: "payer_contact", label: "Payer — contact number", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 11, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "payer" } },
  { field_name: "received_form_assistance", label: "Did you receive assistance completing this application?", field_type: "radio", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 12, options: YES_NO },
  { field_name: "assistant_full_name", label: "Assistant — full name", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 13, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, validation_rules: { maxLength: 120, block_group: "assistant" } },
  { field_name: "assistant_dob", label: "Assistant — date of birth", field_type: "date", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 14, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD", block_group: "assistant" } },
  { field_name: "assistant_telephone", label: "Assistant — telephone", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 15, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, placeholder: "Including country code", validation_rules: { maxLength: 30, block_group: "assistant" } },
  { field_name: "assistant_relationship", label: "Assistant — relationship to applicant", field_type: "text", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 16, conditional_logic: { showIf: RECEIVED_FORM_ASSISTANCE }, placeholder: "e.g. agent, family, friend", validation_rules: { maxLength: 80, block_group: "assistant" } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 17, placeholder: "YYYY/MM/DD", validation_rules: { format: "YYYY/MM/DD" } },
  { field_name: "declaration_consent", label: "I declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of Korea.", field_type: "checkbox", required: true, step_number: 8, step_name: "Invitation, Funding & Declaration", display_order: 18, options: [{ value: "yes", text: "I agree" }] },
];

// ─── Seed Runner ──────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);

  const { error: delError } = await supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", VISA_TYPE);
  if (delError) {
    console.error(`Error deleting existing ${VISA_TYPE} fields:`, delError.message);
  } else {
    console.log(`Cleared existing ${VISA_TYPE} fields`);
  }

  const rows = FIELDS.map((f) => localizeKoreaRow(toBilingualSeedRow(VISA_TYPE, f)));

  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
