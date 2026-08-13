import type { VisaFormFieldOption, VisaFormFieldRow } from "../types/visa-form-fields";
import {
  getChineseLabel,
  getChineseOptionText,
  getChinesePlaceholder,
  getEnglishLabel,
  getEnglishOptionText,
  getEnglishPlaceholder,
} from "./ds160-translations";
import { TW_CITY_OPTIONS, TW_DISTRICTS_BY_CITY } from "./taiwan-administrative-units";

type BilingualSide = "zh" | "en";

type FieldLike = Pick<
  VisaFormFieldRow,
  "fieldName" | "fieldType" | "label" | "placeholder" | "required" | "stepName" | "validationRules" | "options" | "visaType"
>;

type OptionObject = Extract<VisaFormFieldOption, { value: string }>;
const LOCALIZED_OPTIONS_CACHE = new WeakMap<VisaFormFieldOption[], Partial<Record<BilingualSide, VisaFormFieldOption[]>>>();

export const VAGUE_CHINESE_LABELS = new Set([
  "声明",
  "补充",
  "过往",
  "申请其他",
  "地点申请",
  "信息",
  "详情",
  "其他",
  "内容",
  "问题",
  "选择",
  "填写",
  "说明",
]);

// UK Standard Visitor — complete, hand-checked field_name → Chinese label map.
// The seed only ships English labels; without these entries the long-form fell
// back to an auto-generator that produced broken/incorrect Chinese (e.g.
// "Postcode" → "英国住宿", "Mother's nationality" → "是否持有其他国籍？").
const UK_FIELD_NAME_ZH: Record<string, string> = {
  passport_upload: "上传护照资料页（照片或扫描件）",
  given_names: "名字（与护照一致）",
  surname: "姓氏（与护照一致）",
  other_names_used: "您是否曾使用过其他姓名？",
  previous_given_names: "曾用名字",
  previous_surname: "曾用姓氏",
  previous_name_change_date: "姓名变更日期",
  previous_name_change_reason: "姓名变更原因",
  date_of_birth: "出生日期",
  sex: "性别",
  country_of_nationality: "您的国籍是什么？",
  has_other_nationalities: "您是否持有其他国籍？",
  other_nationality: "其他国籍",
  country_of_birth: "出生国家/地区",
  place_of_birth: "出生地（城市或城镇）",
  is_applicant_under_18: "在您计划前往英国的当天，您是否未满18岁？",
  parent_consent_letter_held: "您是否持有父母双方或法定监护人签署的同意书？",
  accompanying_adult_name: "与您同行的成年人姓名",
  accompanying_adult_relationship: "同行成年人与您的关系",
  accompanying_adult_passport_number: "同行成年人的护照号码",
  passport_number: "护照号码",
  passport_issue_date: "护照签发日期",
  passport_expiry_date: "护照到期日期",
  passport_place_of_issue: "护照签发地点",
  has_other_passports: "您是否持有其他有效护照或旅行证件？",
  other_passport_nationality: "其他护照上显示的国籍",
  other_passport_number: "其他护照号码",
  other_passport_issue_date: "其他护照签发日期",
  other_passport_expiry_date: "其他护照到期日期",
  has_national_id_card: "您是否持有国民身份证？",
  national_id_number: "国民身份证号码",
  national_id_issuing_country: "签发该国民身份证的国家",
  has_held_brp: "您是否曾持有英国生物识别居留许可（BRP）？",
  brp_number: "BRP 编号",
  email_address: "电子邮箱地址",
  phone_number: "电话号码（含国家/地区区号）",
  has_alternative_phone: "您是否有备用电话号码？",
  alternative_phone_number: "备用电话号码",
  home_address_line_1: "家庭地址第一行",
  home_address_line_2: "家庭地址第二行（如适用）",
  home_address_city: "城镇或城市",
  home_address_state: "郡/州/省",
  home_address_postcode: "邮政编码",
  home_address_country: "国家/地区",
  how_long_at_address: "您在此地址居住了多久？",
  owns_home: "您是否拥有自己的住房？",
  correspondence_address_different: "您的通信地址是否与家庭住址不同？",
  correspondence_address_line_1: "通信地址第一行",
  correspondence_address_city: "通信地址城镇或城市",
  correspondence_address_country: "通信地址国家/地区",
  marital_status: "您目前的婚姻或民事伴侣关系状况？",
  partner_given_names: "配偶/伴侣的名字",
  partner_surname: "配偶/伴侣的姓氏",
  partner_date_of_birth: "配偶/伴侣的出生日期",
  partner_nationality: "配偶/伴侣的国籍",
  partner_travelling_with_you: "您的配偶/伴侣是否与您一同前往英国？",
  has_children: "您是否有未满18岁的子女？",
  number_of_children: "您有几名未满18岁的子女？",
  children_travelling_with_you: "您的子女中是否有人与您同行？",
  father_given_names: "父亲的名字",
  father_surname: "父亲的姓氏",
  father_date_of_birth: "父亲的出生日期",
  father_nationality: "父亲的国籍",
  mother_given_names: "母亲的名字",
  mother_surname: "母亲的姓氏",
  mother_date_of_birth: "母亲的出生日期",
  mother_nationality: "母亲的国籍",
  has_uk_accommodation_address: "您是否已安排好在英国入住的地址？",
  uk_accommodation_name: "您计划在英国何处入住？（如与他人同住，请填其全名）",
  uk_accommodation_type: "您在英国期间将住在哪里？",
  uk_accommodation_address_line_1: "英国住宿地址第一行",
  uk_accommodation_address_line_2: "英国住宿地址第二行（如适用）",
  uk_accommodation_city: "城镇或城市",
  uk_accommodation_postcode: "邮政编码",
  uk_accommodation_arrival_date: "您将于何时抵达那里？",
  uk_accommodation_departure_date: "您将于何时离开那里？",
  uk_accommodation_plan: "您在英国的住宿计划是什么？",
  uk_host_name: "接待/同住人的姓名",
  uk_host_relationship: "您与此人的关系",
  uk_host_email: "接待人的电子邮箱",
  uk_host_phone: "接待人的电话号码",
  uk_accommodation_other_explain: "请说明您的住宿安排",
  travelled_to_uk_before: "您是否曾前往英国？",
  prev_uk_visit_date: "抵达英国的日期",
  prev_uk_visit_duration: "您停留了多长时间？",
  prev_uk_visit_reason: "此次访问的原因",
  prev_uk_visa_type: "持有的英国签证类型（如有）",
  prev_uk_visa_reference: "英国签证参考号（如知道）",
  uk_national_insurance_number: "您是否有英国国民保险号（National Insurance number）？",
  uk_national_insurance_number_value: "英国国民保险号",
  visa_refused_uk: "您是否曾被拒发英国签证？",
  visa_refused_uk_details: "请说明该次拒签的具体情况",
  visa_refused_other_country: "您是否曾被任何其他国家拒发签证？",
  visa_refused_other_country_details: "请说明该次拒签的具体情况",
  deported_removed_refused_entry: "您是否曾被任何国家（包括英国）驱逐、遣返或拒绝入境？",
  deported_details: "请说明具体情况",
  has_schengen_visits: "过去10年内，您是否到访过任何申根国家？",
  schengen_visit_country: "到访的申根国家",
  schengen_visit_arrival: "抵达日期",
  schengen_visit_departure: "离开日期",
  schengen_visit_purpose: "访问目的",
  has_us_canada_anz_visits: "过去10年内，您是否到访过美国、加拿大、澳大利亚或新西兰？",
  us_canada_anz_visit_country: "到访的国家",
  us_canada_anz_visit_arrival: "抵达日期",
  us_canada_anz_visit_departure: "离开日期",
  us_canada_anz_visit_purpose: "访问目的",
  has_other_country_visits: "过去10年内，您是否到访过其他国家？",
  other_country_visit_country: "到访的国家",
  other_country_visit_arrival: "抵达日期",
  other_country_visit_departure: "离开日期",
  purpose_of_visit: "您此次访问英国的主要原因是什么？",
  uk_arrival_date: "您计划何时抵达英国？",
  uk_departure_date: "您计划何时离开英国？",
  visiting_family_in_uk: "您在英国期间是否会探访家人？",
  uk_family_member_name: "家庭成员的全名",
  uk_family_member_relationship: "您与此人的关系",
  uk_family_member_immigration_status: "该家庭成员在英国的移民身份",
  uk_family_member_address: "家庭成员的英国地址",
  uk_business_contact_name: "您的英国商务联系人姓名",
  uk_business_company_name: "英国公司名称",
  uk_business_company_address: "英国公司地址",
  uk_business_activity_description: "请描述您在英国的商务活动性质",
  uk_business_paid_by_uk: "访问期间，您是否会由英国公司或个人向您支付报酬？",
  study_institution_name: "学校、学院或大学名称",
  study_institution_address: "该院校在英国的地址",
  study_course_title: "课程名称",
  study_course_start_date: "课程开始日期",
  study_course_end_date: "课程结束日期",
  study_institution_accredited: "该院校是否经英国认可机构认证？",
  study_who_pays: "谁为您的课程付费？",
  medical_treatment_type: "您将接受哪种医疗治疗？",
  medical_facility_name: "医院或诊所名称",
  medical_facility_address: "医院或诊所地址",
  medical_doctor_name: "医生或顾问医师姓名",
  medical_estimated_cost: "治疗的预计费用",
  medical_payment_arrangement: "您将如何支付治疗费用？",
  transit_destination_country: "您将继续前往哪个国家？",
  transit_onward_journey_date: "续程行程的日期和时间",
  transit_onward_booking_reference: "续程行程的预订参考号",
  transit_destination_visa_status: "您是否持有前往目的地国家的有效签证或居留许可？",
  transit_destination_visa_details: "目的地国家签证/居留许可详情",
  marriage_ceremony_date: "婚礼/仪式日期",
  marriage_registrar_office_name: "婚姻登记处名称",
  marriage_registrar_office_address: "婚姻登记处地址",
  marriage_partner_full_name: "拟结婚配偶或民事伴侣的全名",
  marriage_partner_nationality: "拟结婚配偶或民事伴侣的国籍",
  marriage_freedom_to_marry_document: "您是否持有证明可自由结婚的文件（如离婚绝对判令、前配偶死亡证明）？",
  ppe_host_organisation_name: "邀请您的英国机构名称",
  ppe_host_organisation_address: "邀请机构的地址",
  ppe_engagement_description: "请说明受邀从事的付费许可活动",
  ppe_engagement_start_date: "活动开始日期",
  ppe_engagement_end_date: "活动结束日期",
  ppe_fee_amount: "您将获得的费用或报酬金额",
  academic_institution_name: "英国接待院校名称",
  academic_institution_address: "英国接待院校地址",
  academic_research_topic: "请描述您的研究或学术活动",
  academic_duration_months: "访问时长（月）",
  academic_qualifications_held: "您在所在领域已获得的最高学历/学术资格",
  academic_employer_letter_held: "您是否持有母国雇主确认此项研究的证明信？",
  organ_donor_recipient_name: "预期器官接受者的全名",
  organ_donor_relationship_to_recipient: "您与接受者的关系",
  organ_donor_recipient_legal_uk_status: "接受者是否为英国合法居民？",
  organ_donor_transplant_hospital: "进行移植手术的医院",
  organ_donor_transplant_date: "预定的移植或检测日期",
  organ_donor_consultant_name: "负责治疗的 GMC 注册专科医生姓名",
  organ_donor_consultant_letter_date: "顾问医师证明信的日期（须为3个月以内）",
  clinical_training_type: "您将参加哪种临床活动？",
  clinical_institution_name: "英国机构或皇家学院名称",
  clinical_institution_address: "英国机构地址",
  clinical_start_date: "开始日期",
  clinical_end_date: "结束日期",
  clinical_no_patient_treatment_confirm: "请确认您不会为英国患者提供治疗",
  employment_status: "您目前的就业状况？",
  employer_name: "雇主名称",
  employer_address: "雇主地址",
  employer_phone: "雇主电话号码",
  job_title: "职位名称",
  job_start_date: "您何时开始这份工作？",
  annual_income: "您的年收入是多少（以当地货币计）？",
  self_employed_business_name: "企业名称",
  self_employed_business_address: "企业地址",
  student_institution_name: "学校、学院或大学名称",
  student_institution_address: "院校地址",
  student_course_name: "所学课程/专业",
  employment_other_explain: "请说明您的情况",
  who_is_paying: "谁为您此次英国之行付费？",
  monthly_spending_money: "您在英国每月可用于花费的金额是多少？",
  total_cost_of_trip: "您此行的预计总费用是多少（含机票）？",
  sponsor_name: "担保人/资助方的全名",
  sponsor_relationship: "您与担保人/资助方的关系",
  sponsor_address: "担保人/资助方的地址",
  sponsor_email: "担保人/资助方的电子邮箱",
  sponsor_phone: "担保人/资助方的电话号码",
  finances_other_explain: "请说明您的资金安排",
  has_savings: "您是否有储蓄？",
  savings_amount: "储蓄总额（以当地货币计）",
  has_other_income: "您是否有其他收入或资金支持？",
  other_income_details: "请说明您的其他收入或资金支持",
  applying_with_dependants: "是否有其他人（配偶、子女或其他受抚养人）与您一同申请英国签证？",
  dependant_relationship: "与您的关系",
  dependant_given_names: "名字",
  dependant_surname: "姓氏",
  dependant_date_of_birth: "出生日期",
  dependant_nationality: "国籍",
  dependant_passport_number: "护照号码",
  has_medical_condition_affecting_travel: "您是否有可能影响出行能力的健康状况？",
  medical_condition_affecting_travel_details: "请说明您的健康状况",
  tb_test_required_acknowledged: "您是否需要肺结核（TB）检测证明？（如您来自指定国家且在英停留超过6个月则需要）",
  tb_test_certificate_date: "肺结核检测证明的日期",
  tb_test_clinic_name: "英国内政部认可诊所的名称",
  criminal_convictions: "您是否曾在任何国家被判犯罪（包括交通违法）？",
  criminal_convictions_details: "请说明任何犯罪定罪的具体情况",
  breach_uk_immigration_laws: "您是否曾违反英国移民法（如逾期居留、非法入境、非法工作）？",
  breach_uk_immigration_laws_details: "请说明违反移民法的具体情况",
  civil_penalty_uk: "您是否曾被英国内政部处以民事罚款（如未付 NHS 费用）？",
  civil_penalty_uk_details: "请说明该民事罚款的具体情况",
  public_funds_used_uk: "您是否曾领取本不应获得的英国公共福利金？",
  public_funds_used_uk_details: "请说明具体情况",
  terrorism_related: "您是否曾在任何国家参与、支持或鼓动恐怖活动？",
  terrorism_details: "请说明具体情况",
  war_crimes: "您是否曾参与或被怀疑参与战争罪、反人类罪或种族灭绝？",
  war_crimes_details: "请说明具体情况",
  organisations_concern: "您是否曾是涉及恐怖主义的组织成员，或曾向其提供支持？",
  organisations_concern_details: "请说明具体情况",
  bad_character: "您是否曾从事任何可能表明您不属于品行良好人士的其他活动？",
  bad_character_details: "请说明具体情况",
  additional_information: "关于本次申请，您还有其他需要告知我们的信息吗？",
  national_id_issuing_authority: "国民身份证签发机关",
  national_id_issue_date: "国民身份证签发日期（如适用）",
  national_id_expiry_date: "国民身份证到期日期（如适用）",
  years_at_address: "在此地址居住的年数",
  months_at_address: "额外月数",
  home_ownership: "您住房的产权状况",
  home_ownership_other_details: "请补充说明您的居住情况",
  immigration_status_in_residence_country: "您在居住国的移民身份",
  immigration_status_visa_expiry: "签证到期日期",
  immigration_status_pr_year: "您成为永久居民的年份",
  immigration_status_other_details: "请说明您的移民身份情况",
  planned_spend_currency: "计划花费——币种",
  planned_spend_amount: "您计划在此次访问中花费多少？",
  someone_paying_for_visit: "是否有人为您此次访问的费用付费？",
  spoken_language_preference: "如需讨论您的申请，您希望使用哪种语言？",
  spoken_language_other_details: "请注明语言",
  tourism_sub_purpose: "您此次旅游访问的主要原因",
  employer_address_line_1: "雇主地址第一行",
  employer_address_line_2: "雇主地址第二行（如适用）",
  employer_address_city: "雇主所在城镇/城市",
  employer_address_state: "雇主所在省/州",
  employer_address_postcode: "雇主邮政编码",
  employer_address_country: "雇主所在国家/地区",
  employer_phone_code: "雇主电话——国家/地区区号",
  employer_phone_number: "雇主电话——号码",
  job_start_month: "入职月份",
  job_start_year: "入职年份",
  monthly_earnings_currency: "月收入——币种",
  monthly_earnings_amount: "月收入（税后）",
  job_description: "请描述您的工作",
  has_other_income_or_savings: "您是否有其他收入或储蓄？",
  monthly_outgoings_currency: "每月支出——币种",
  monthly_outgoings_amount: "您每月支出的总金额",
};

// Taiwan Online Entry Permit (TW_ENTRY_PERMIT) — complete field_name → Chinese
// label map. The seed only sets label_zh on OPTIONS (continents, embassy
// offices, occupations, etc.), never at the field level, and this visa is
// Chinese-only end to end (applicants are mainland Chinese nationals) — so
// every one of its field labels needs an explicit entry here, same as the
// UK map above, or the long-form falls back to the auto-generated
// "请填写：Continent" pattern.
const TW_FIELD_NAME_ZH: Record<string, string> = {
  continent: "所在洲别",
  embassy_office: "受理使领馆/代表处",
  // photo_upload and the 6 supporting-document field names are deliberately
  // NOT listed here — those field_type: "file" rows were removed from the
  // seed (they only ever rendered a dead placeholder box); real uploads for
  // Taiwan go through the Documents step (document_requirements), same as
  // every other country.
  first_time_applying: "是否为首次由境外/港澳申请来台观光",
  permit_type: "申请证别",
  permit_count: "申请证数",
  has_other_nationality_passport: "是否持有其他国籍护照？",
  eligibility_category: "申请资格类别",
  name_chinese: "中文姓名（繁体字）",
  name_english: "英文姓名（依护照大写拼写）",
  household_revoked: "目前户口登记状态",
  passport_number: "护照号码/香港签证身份证明书号码/澳门旅行证/大陆旅行证号码",
  passport_expiry_date: "护照效期/旅行证效期（西元）",
  overseas_residency_id_number: "侨居身份证号码（如永久居留证号码、居留证号码或签证号码）",
  mainland_id_number_not_applicable: "无大陆身份证号码",
  mainland_id_number: "大陆身份证号码",
  birth_place_is_mainland: "出生地（同所持旅游证件）",
  birth_place_other_country: "出生国家/地区",
  local_mobile_phone: "居住地手机号码（需填写国码）",
  current_occupation: "现职",
  occupation_experience: "经历",
  company_name: "公司名称及单位全衔或学校名称",
  job_title: "职称",
  is_taiwanese_spouse: "是否为台湾人民配偶？",
  traveling_with_parents: "父母是否同行？",
  overseas_address: "港、澳或海外地址",
  tw_contact_city: "县市",
  tw_contact_district: "乡镇市区",
  tw_contact_village: "村/里（非必填）",
  tw_contact_neighborhood: "邻（仅填数字）",
  tw_contact_road: "街、路段",
  tw_contact_lane: "巷（仅填数字）",
  tw_contact_alley: "弄（仅填数字）",
  tw_contact_building_number: "门牌号/楼/室（住饭店请填饭店名称）",
  tw_local_phone: "在台联络电话",
  tw_contact_mobile_not_applicable: "无在台联络手机号码",
  tw_contact_mobile: "在台联络手机号码",
  other_nationality_country: "所具其他国籍为",
  other_passport_number: "他国护（证）照号码",
  other_passport_expiry_date: "他国护（证）照有效期限",
  past_mainland_political_military_role: "申请人曾任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者",
  past_role_detail: "曾任职于",
  current_mainland_political_military_role: "申请人现任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员者",
  current_role_detail: "现任职于",
  never_held_mainland_political_military_role: "申请人未曾担任大陆地区党务、行政、军事或具政治性机关（构）、团体之职务或为其成员",
  accepted_terms: "我已阅读并接受下列条款与条件",
  kin_father_status: "父 — 存殁",
  kin_father_name: "父亲 — 姓名",
  kin_father_date_of_birth: "父亲 — 生日",
  kin_father_phone: "父亲 — 电话",
  kin_father_occupation: "父亲 — 现职",
  kin_father_service_unit: "父亲 — 服务单位",
  kin_father_job_title: "父亲 — 职称",
  kin_father_current_address_same_as_overseas: "父亲 — 现住址是否与申请人海外地址相同",
  kin_father_current_address: "父亲 — 现住址",
  kin_mother_status: "母 — 存殁",
  kin_mother_name: "母亲 — 姓名",
  kin_mother_date_of_birth: "母亲 — 生日",
  kin_mother_phone: "母亲 — 电话",
  kin_mother_occupation: "母亲 — 现职",
  kin_mother_service_unit: "母亲 — 服务单位",
  kin_mother_job_title: "母亲 — 职称",
  kin_mother_current_address_same_as_overseas: "母亲 — 现住址是否与申请人海外地址相同",
  kin_mother_current_address: "母亲 — 现住址",
  kin_spouse_status: "配偶 — 生存/已故/离婚状态",
  kin_spouse_name: "配偶 — 姓名",
  kin_spouse_date_of_birth: "配偶 — 出生日期",
  kin_spouse_phone: "配偶 — 电话",
  kin_spouse_occupation: "配偶 — 职业",
  kin_spouse_service_unit: "配偶 — 服务单位",
  kin_spouse_job_title: "配偶 — 职称",
  kin_spouse_current_address_same_as_overseas: "配偶 — 现住址是否与申请人海外地址相同",
  kin_spouse_current_address: "配偶 — 现住址",
  kin_child1_status: "子女一 — 生存/已故/离婚状态",
  kin_child1_name: "子女一 — 姓名",
  kin_child1_date_of_birth: "子女一 — 出生日期",
  kin_child1_phone: "子女一 — 电话",
  kin_child1_occupation: "子女一 — 职业",
  kin_child1_service_unit: "子女一 — 服务单位",
  kin_child1_job_title: "子女一 — 职称",
  kin_child1_current_address_same_as_overseas: "子女一 — 现住址是否与申请人海外地址相同",
  kin_child1_current_address: "子女一 — 现住址",
  kin_child2_status: "子女二 — 生存/已故/离婚状态",
  kin_child2_name: "子女二 — 姓名",
  kin_child2_date_of_birth: "子女二 — 出生日期",
  kin_child2_phone: "子女二 — 电话",
  kin_child2_occupation: "子女二 — 职业",
  kin_child2_service_unit: "子女二 — 服务单位",
  kin_child2_job_title: "子女二 — 职称",
  kin_child2_current_address_same_as_overseas: "子女二 — 现住址是否与申请人海外地址相同",
  kin_child2_current_address: "子女二 — 现住址",
};

const TW_REQUIRED_FIELD_OVERRIDES = new Set([
  "mainland_id_number",
  "company_name",
  "job_title",
  "kin_father_status",
  "kin_mother_status",
]);

const TW_ADDRESS_TRADITIONAL_TO_SIMPLIFIED: Record<string, string> = {
  臺: "台",
  區: "区",
  縣: "县",
  鄉: "乡",
  鎮: "镇",
  內: "内",
  愛: "爱",
  車: "车",
  達: "达",
  島: "岛",
  釣: "钓",
  東: "东",
  鳳: "凤",
  豐: "丰",
  貢: "贡",
  關: "关",
  龜: "龟",
  國: "国",
  後: "后",
  華: "华",
  環: "环",
  雞: "鸡",
  將: "将",
  結: "结",
  壢: "坜",
  來: "来",
  蓮: "莲",
  連: "连",
  蘆: "芦",
  羅: "罗",
  馬: "马",
  門: "门",
  萬: "万",
  滿: "满",
  瑪: "玛",
  麥: "麦",
  廟: "庙",
  濃: "浓",
  鳥: "鸟",
  鵬: "鹏",
  橋: "桥",
  親: "亲",
  軍: "军",
  勢: "势",
  樹: "树",
  雙: "双",
  頭: "头",
  灣: "湾",
  烏: "乌",
  線: "线",
  興: "兴",
  學: "学",
  鹽: "盐",
  楊: "杨",
  義: "义",
  鶯: "莺",
  嶼: "屿",
  魚: "鱼",
  園: "园",
  雲: "云",
  長: "长",
  壯: "壮",
  莊: "庄",
  廣: "广",
  龍: "龙",
  復: "复",
  獅: "狮",
  銅: "铜",
  彌: "弥",
  霧: "雾",
  恆: "恒",
  綠: "绿",
  濱: "滨",
  壽: "寿",
  榮: "荣",
  歸: "归",
  鑼: "锣",
  館: "馆",
  腳: "脚",
  庫: "库",
  崙: "仑",
  巒: "峦",
  頂: "顶",
  邊: "边",
  坵: "丘",
  岡: "冈",
  棲: "栖",
  圍: "围",
  觀: "观",
  蘭: "兰",
  蘇: "苏",
  橫: "横",
  寶: "宝",
};

function simplifyTaiwanAddressLabel(label: string): string {
  return Array.from(label, (char) => TW_ADDRESS_TRADITIONAL_TO_SIMPLIFIED[char] ?? char).join("");
}

function localizeTaiwanAddressOption(option: VisaFormFieldOption): VisaFormFieldOption {
  if (typeof option === "string") {
    const simplified = simplifyTaiwanAddressLabel(option);
    return {
      value: option,
      text: simplified,
      label_zh: simplified,
      label_en: simplified,
      official_label: option,
    };
  }

  const sourceLabel = option.official_label ?? option.text ?? option.label_zh ?? option.value;
  const simplified = simplifyTaiwanAddressLabel(sourceLabel);
  return {
    ...option,
    text: simplified,
    label_zh: simplified,
    label_en: option.label_en ?? sourceLabel,
    official_label: sourceLabel,
  };
}

function localizeTaiwanAddressOptions(options: VisaFormFieldOption[]): VisaFormFieldOption[] {
  return options.map(localizeTaiwanAddressOption);
}

function localizeTaiwanDistrictsByCity(
  districtsByCity: typeof TW_DISTRICTS_BY_CITY,
): typeof TW_DISTRICTS_BY_CITY {
  return Object.fromEntries(
    Object.entries(districtsByCity).map(([cityValue, options]) => [
      cityValue,
      localizeTaiwanAddressOptions(options),
    ]),
  );
}

function normalizeTaiwanAddressField(field: VisaFormFieldRow): Partial<VisaFormFieldRow> {
  const fieldName = normalizeFieldName(field.fieldName);
  if (field.visaType !== "TW_ENTRY_PERMIT") return {};

  if (fieldName === "tw_contact_city") {
    return {
      fieldType: "select",
      options: localizeTaiwanAddressOptions(TW_CITY_OPTIONS),
    };
  }

  if (fieldName === "tw_contact_district") {
    return {
      fieldType: "select",
      validationRules: {
        ...(field.validationRules ?? {}),
        dependent_on: "tw_contact_city",
        dependent_options_key: "taiwan_districts_by_city",
        dependent_options: localizeTaiwanDistrictsByCity(TW_DISTRICTS_BY_CITY),
        source: "taiwan_official_address_districts",
      },
      options: [],
    };
  }

  if (fieldName === "tw_local_phone") {
    return {
      validationRules: {
        ...(field.validationRules ?? {}),
        required_when: "tw_contact_mobile_not_applicable === true",
        helper_zh: "若勾选无在台联络手机号码，本项必须填写。",
        helper_en: "Required only when no Taiwan contact mobile number is selected.",
      },
    };
  }

  return {};
}

function normalizeTaiwanOccupationDependentField(field: VisaFormFieldRow): Partial<VisaFormFieldRow> {
  const fieldName = normalizeFieldName(field.fieldName);
  if (field.visaType !== "TW_ENTRY_PERMIT") return {};

  if (fieldName === "company_name") {
    return {
      conditionalLogic: { showIf: "current_occupation not in [61,62]" },
      validationRules: {
        ...(field.validationRules ?? {}),
        required_when: "current_occupation not in [61,62]",
        helper_zh: "现职为待业或退休时不需要填写。",
        helper_en: "Hidden when current occupation is unemployed/job-seeking or retired.",
      },
    };
  }

  if (fieldName === "job_title") {
    return {
      conditionalLogic: { showIf: "current_occupation not in [14,61,62]" },
      validationRules: {
        ...(field.validationRules ?? {}),
        required_when: "current_occupation not in [14,61,62]",
        helper_zh: "现职为学生、待业或退休时不需要填写。",
        helper_en: "Hidden when current occupation is student, unemployed/job-seeking, or retired.",
      },
    };
  }

  return {};
}

const FIELD_NAME_ZH_OVERRIDES: Record<string, string> = {
  full_name: "护照上的完整姓名",
  applicant_full_name: "申请人护照上的完整姓名",
  preferred_name: "偏好使用的姓名（如有）",
  surname: "姓氏（与护照一致）",
  surnames: "姓氏（与护照一致）",
  surname_at_birth: "出生时姓氏/曾用姓氏",
  surname_at_birth_different: "出生时姓氏是否与当前姓氏不同？",
  family_name: "姓氏（与护照一致）",
  last_name: "姓氏（与护照一致）",
  given_name: "名字（与护照一致）",
  given_names: "名字（与护照一致）",
  first_name: "名字（与护照一致）",
  middle_name: "中间名",
  name_in_arabic: "阿拉伯文姓名（如适用）",
  name_in_chinese: "中文姓名（如适用）",
  name_in_passport_chinese_chars: "护照上的中文/日文/韩文姓名（如适用）",
  signature_full_name: "签名确认用完整姓名",
  assistant_full_name: "代填/协助人员完整姓名",
  date_of_birth: "出生日期",
  dob: "出生日期",
  birth_date: "出生日期",
  place_of_birth: "出生地点（城市/地区）",
  place_of_birth_city: "出生城市",
  place_of_birth_country: "出生国家/地区",
  place_of_birth_province: "出生省/州",
  place_of_birth_state: "出生州/省",
  place_of_birth_state_or_province: "出生州/省",
  city_of_birth: "出生城市",
  birth_city: "出生城市",
  town_of_birth: "出生城镇/城市",
  state_of_birth: "出生州/省（如适用）",
  birth_state: "出生州/省（如适用）",
  birth_province: "出生省/州（如适用）",
  birth_province_or_state: "出生省/州（如适用）",
  state_or_province_of_birth: "出生州/省（如适用）",
  country_of_birth: "出生国家/地区",
  birth_country: "出生国家/地区",
  religion: "宗教信仰",
  current_nationality: "当前国籍",
  nationality: "国籍",
  nationality_at_birth: "出生时国籍",
  nationality_at_birth_different: "出生时国籍是否与当前国籍不同？",
  identity_card_number: "身份证或本国身份号码（如有）",
  has_other_nationalities: "是否持有或曾持有其他国籍？",
  has_multiple_nationalities: "是否还拥有或曾拥有其他国籍？",
  other_nationality: "其他国籍",
  has_violated_vietnam_laws: "是否曾违反越南法律或法规？",
  sex: "性别",
  gender: "性别",
  marital_status: "婚姻状况",
  civil_status: "婚姻/民事伴侣状态",
  is_applicant_under_18: "在您计划前往英国的当天，您是否未满18岁？",
  has_national_id_card: "您是否持有国民身份证？",
  national_id_issuing_country: "签发该国民身份证的国家",
  has_held_brp: "您是否曾持有英国生物识别居留许可（BRP）？",
  brp_number: "BRP 编号",
  has_alternative_phone: "您是否有其他电话号码？",
  alternative_phone_number: "其他电话号码",
  how_long_at_address: "您在此地址居住了多长时间？",
  owns_home: "您是否拥有自有住房？",
  correspondence_address_different: "您的通讯地址与家庭住址不同吗？",
  correspondence_address_line_1: "通讯地址第一行",
  correspondence_address_city: "通讯地址城市/城镇",
  correspondence_address_country: "通讯地址国家/地区",
  years_at_address: "在此地址居住的年数",
  months_at_address: "额外月数",
  home_ownership: "您住房的产权状况",
  home_ownership_other_details: "请补充说明您的居住情况",
  immigration_status_in_residence_country: "您在居住国的移民身份",
  immigration_status_visa_expiry: "签证到期日期",
  immigration_status_pr_year: "您成为永久居民的年份",
  immigration_status_other_details: "请说明您的移民情况",
  passport_upload: "上传护照资料页（照片或扫描件）",
  passport_number: "护照号码",
  travel_document_number: "旅行证件号码",
  passport_type: "护照类型",
  travel_document_type: "旅行证件类型",
  passport_issue_date: "护照签发日期",
  passport_issuance_date: "护照签发日期",
  travel_document_issue_date: "旅行证件签发日期",
  passport_expiry_date: "护照到期日期",
  passport_expiration_date: "护照到期日期",
  travel_document_expiry_date: "旅行证件有效期至",
  passport_issuing_country: "护照签发国家/地区",
  travel_document_issuing_country: "旅行证件签发国家/地区",
  passport_issuing_authority: "护照签发机关/签发地点",
  visa_type_requested: "申请单次或多次入境电子签证",
  visa_valid_from: "希望电子签证从哪一天开始生效？",
  visa_valid_to: "希望电子签证有效期到哪一天结束？",
  email_address: "电子邮箱地址",
  re_enter_email_address: "再次输入电子邮箱地址",
  phone_number: "电话号码（含国家代码）",
  phone: "电话号码",
  telephone_number: "电话号码",
  telephone: "固定电话号码",
  cell_phone: "手机号码",
  assistant_telephone: "代填/协助人员电话号码",
  mobile_phone: "手机号码",
  mobile_number: "手机号码",
  home_address_line_1: "家庭地址第一行",
  home_address_line1: "家庭住址街道/门牌/公寓信息",
  home_address_line_2: "家庭地址第二行（如适用）",
  home_address_line2: "家庭地址第二行（如适用）",
  home_city: "家庭住址城市",
  home_address_city: "家庭住址城市",
  home_address_state: "家庭住址州/省",
  home_address_postcode: "家庭住址邮政编码",
  home_address_country: "家庭住址国家/地区",
  residential_address_line_1: "居住地址第一行",
  residential_address_line_2: "居住地址第二行（如适用）",
  residential_address_suburb: "居住地址所在市镇/城区",
  residential_address_state: "居住地址州/省",
  residential_address_postcode: "居住地址邮政编码",
  residential_address_country: "居住地址国家/地区",
  postal_address_line_1: "邮寄地址第一行",
  postal_address_line_2: "邮寄地址第二行（如适用）",
  postal_address_suburb: "邮寄地址所在市镇/城区",
  postal_address_state: "邮寄地址州/省",
  postal_address_postcode: "邮寄地址邮政编码",
  postal_address_country: "邮寄地址国家/地区",
  home_country: "家庭住址国家/地区",
  mailing_address_same_as_home: "邮寄地址是否与家庭地址相同？",
  current_occupation: "当前职业",
  occupation: "职业",
  occupation_info: "当前职业详细信息",
  current_profession: "当前职业/职业类别",
  position_title: "职位/职称",
  job_title: "职位名称",
  job_description: "工作职责说明",
  employer_name: "雇主名称",
  employer_or_school: "雇主、学校或经营机构名称",
  school_name: "学校名称",
  company_or_school_name: "公司/机构/学校名称",
  position_course: "职位或课程名称",
  company_address: "公司/机构/学校地址",
  company_phone: "公司/机构/学校电话",
  emergency_contact_full_name: "紧急联系人姓名",
  emergency_contact_current_address: "紧急联系人当前住址",
  emergency_contact_telephone: "紧急联系人电话",
  emergency_contact_relationship: "紧急联系人关系",
  purpose_of_trip: "赴美目的",
  purpose_of_journey: "本次旅行目的",
  purpose_of_entry: "入境目的",
  visit_purpose: "访问主要目的",
  main_purpose_of_visit: "访问主要目的",
  specify_purpose: "请具体说明访问目的",
  planned_arrival_date: "计划抵达日期",
  intended_arrival_date: "预计抵达日期",
  arrival_date: "计划抵达日期",
  departure_from_origin_date: "从居住国出发日期",
  planned_departure_date: "计划离开日期",
  intended_departure_date: "预计离开日期",
  visits_french_overseas_territories: "是否前往法国海外领地",
  departure_date: "计划离开日期",
  intended_length_of_stay: "预计停留时间",
  intended_length_of_stay_value: "预计停留时间（数值）",
  intended_length_of_stay_unit: "预计停留时间单位",
  phone_in_vietnam: "越南境内电话号码",
  residential_address_in_vietnam: "在越南拟停留地址",
  intended_province_city: "在越南拟停留省/市",
  intended_ward_commune: "在越南拟停留坊/社",
  intended_border_gate_of_entry: "预计入境口岸",
  intended_border_gate_of_exit: "预计出境口岸",
  port_of_entry: "预计入境口岸",
  first_port_of_arrival: "首次抵达口岸",
  first_port_other_specify: "请说明其他抵达口岸",
  carrier_name: "航空公司、船舶或交通承运人名称",
  flight_number: "航班或列车号码（如已知）",
  flight_or_voyage_number: "航班或航次号码",
  declaration_temporary_residence: "是否承诺抵达后按越南法律申报临时居住？",
  visited_vietnam_in_last_year: "过去一年是否曾到访越南？",
  visited_vietnam_purpose_detail: "上次访问越南的目的和入境日期",
  countries_visited_last_10_years: "过去十年曾访问的国家/地区",
  has_relatives_in_vietnam: "是否有亲属目前居住在越南？",
  has_children: "是否有子女？",
  has_child_soldier: "是否曾招募或使用儿童兵？",
  has_withheld_child_custody: "是否曾在美国境外扣留美国公民子女并违反美国法院授予他人的监护权？",
  relative_full_name_in_vn: "在越亲属姓名",
  relative_date_of_birth: "在越亲属出生日期",
  relative_nationality: "在越亲属国籍",
  relative_relationship: "与在越亲属的关系",
  relative_address_in_vn: "在越亲属地址",
  child_full_name: "同一本护照上同行的14岁以下儿童姓名",
  child_sex: "同行儿童性别",
  child_date_of_birth: "同行儿童出生日期",
  intended_expenses_usd: "预计费用（美元）",
  bought_travel_insurance: "是否已购买本次旅行保险？",
  health_insurance_provider: "旅行/健康保险提供方名称",
  health_insurance_policy_number: "旅行/健康保险保单号码",
  needs_special_assistance: "访问期间是否需要行动、视力、听力或其他特殊协助？",
  expense_coverage: "谁承担申请人的旅行费用？",
  violation_of_vietnam_laws_details: "请说明违反越南法律或法规的具体情况",
  accommodation_name: "住宿地点或接待方名称",
  accommodation_address: "住宿地点或接待方地址",
  accommodation_type: "住宿类型",
  accommodation_district: "香港住宿所在地区",
  accommodation_emirate: "阿联酋住宿所在酋长国",
  host_surname: "邀请人/接待方姓氏",
  host_given_names: "邀请人/接待方名字",
  host_full_name: "邀请人/接待方完整姓名",
  host_relationship: "邀请人/接待方与申请人的关系",
  host_address_line_1: "邀请人/接待方地址第一行",
  host_city: "邀请人/接待方所在城市",
  host_country: "邀请人/接待方所在国家",
  host_phone: "邀请人/接待方电话",
  host_email: "邀请人/接待方电子邮箱",
  cost_covered_by: "谁将承担本次旅行和停留费用？",
  funding_source: "谁将支付本次旅行费用？",
  currency_amount_details: "请说明携带现金或货币的币种和金额",
  sponsor_type: "担保人/资助方类型",
  sponsor_name: "担保人/资助方名称",
  sponsor_relationship: "担保人/资助方与申请人的关系",
  sponsor_address: "担保人/资助方地址",
  sponsor_full_name: "担保人/资助方完整姓名",
  sponsor_au_residency: "担保人在澳大利亚的居留身份",
  funder_full_name: "出资人/担保人完整姓名",
  funder_relationship: "出资人与申请人的关系",
  spouse_full_name: "配偶/伴侣完整姓名",
  spouse_nationality: "配偶/伴侣国籍",
  has_previous_refusal: "是否曾被拒签、被拒绝入境或被要求离境？",
  ever_refused_schengen_visa: "是否曾被拒发申根签证？",
  has_criminal_history: "是否有需要申报的犯罪记录？",
  overstay_details: "请说明逾期停留或违反签证条件的具体情况",
  court_order_details: "请说明逮捕令、限制令或法院命令的具体情况",
  war_crimes_details: "请说明战争罪、反人类罪或相关人权侵害事项的具体情况",
  organisations_concern_details: "请说明相关组织、活动或成员关系的具体情况",
  bad_character_details: "请说明相关犯罪、不良记录或品行问题的具体情况",
  additional_notes: "补充说明 / 其他可能影响本次申请的信息",
  additional_information: "补充说明 / 其他可能影响本次申请的信息",
  review_confirmation: "我确认以上信息准确无误，并与旅行证件一致",
  has_different_filler: "本申请是否由申请人本人以外的其他人填写？",
  filler_surname: "填表人姓氏",
  filler_given_names: "填表人名字",
  filler_address: "填表人地址",
  filler_email: "填表人电子邮箱",
  filler_phone: "填表人电话号码",
  place_of_application: "申请提交地点 / 当前申请所在地",
  us_social_security_number: "美国社会安全号码（如适用）",
  refusal_country: "拒签或签证取消的国家/地区",
  refusal_visa_type: "被拒或被取消的签证类型",
  refusal_date: "拒签或签证取消日期",
  refusal_reason: "拒签或签证取消原因",
  sponsor_security_bond_aware: "是否知悉担保人可能需要缴纳保证金？",
  has_terrorism_or_security_history:
    "是否曾涉及恐怖主义、间谍、破坏活动或其他可能危害公共秩序/国家安全的活动？",
  has_drug_or_trafficking_history:
    "是否曾涉及吸毒、卖淫、人口贩运、走私或非法武器持有？",
  has_health_symptoms: "当前是否有发热、咳嗽、呼吸困难、腹泻、呕吐、皮疹或黄疸等症状？",
  carrying_restricted_items: "是否携带限制或禁止入境物品？",
  has_tb_history: "是否曾被诊断为结核病，或胸部 X 光检查曾显示异常？",
  has_tuberculosis_history: "是否曾患有或接受过结核病（TB）治疗？",
  is_pregnant: "是否怀孕？",
  has_been_subject_to_court_order: "是否曾受到逮捕令、限制令或法院命令约束？",
  has_other_passports: "是否目前持有或曾经持有其他护照？",
  has_other_phones: "过去五年是否使用过其他电话号码？",
  has_other_emails: "过去五年是否使用过其他电子邮箱地址？",
  has_other_social_media: "是否愿意提供过去五年使用过的其他网站或应用账号信息？",
  has_chinese_household_registration: "是否持有中华人民共和国户口登记（户口）？",
  has_other_income: "是否有其他收入或资金支持？",
  has_other_income_or_savings: "是否有其他收入或储蓄？",
  has_savings: "是否有储蓄？",
  savings_amount: "储蓄总额（以当地货币填写）",
  planned_spend_currency: "计划花费币种",
  funds_currency: "资金币种",
  stream: "申请人选择的澳大利亚访客签证类别",
  applying_outside_australia: "申请人当前是否在澳大利亚境外？",
  applying_all_outside_australia: "本申请中的所有申请人当前是否都在澳大利亚境外？",
  significant_dates_in_australia: "请说明申请人必须在澳大利亚停留的重要日期",
  specialised_non_ongoing_work: "申请人是否将在澳大利亚从事高度专业化的短期非持续性工作？",
  entertainer_or_supporting_entertainer: "申请人是否将在澳大利亚作为演艺人员演出，或支持演艺人员/团体演出？",
  production_director_or_participant: "申请人是否将导演、制作或参与将在澳大利亚展示的演出或作品？",
  accompanied_by_other_applicants: "是否与本申请中的其他人组成家庭组一同申请？",
  travelled_to_korea_5y: "过去五年是否曾前往韩国？",
  au_immi_totp_secret: "ImmiAccount 身份验证器密钥（base32）",
  ads_tour_code: "ADS 团队旅游代码",
  ads_tour_leader_name: "ADS 团队领队/导游姓名",
  frequent_residing_in_china: "是否将在中国大陆采集生物识别信息？",
  highest_education: "已完成的最高教育程度",
  restricted_items_details: "请说明所携带限制或禁止物品的具体情况",
  organ_donor_consultant_name: "负责治疗的 GMC 注册专科医生姓名",
  academic_qualifications_held: "所在领域已获得的最高学历/学术资格",
  ppe_engagement_description: "请说明受邀从事的付费许可活动",
  ppe_fee_amount: "将获得的费用或报酬金额",
  race: "种族/族群",
  race_ethnicity: "种族/族群（按马来西亚移民要求填写）",
  declaration_consent: "我声明本申请所填信息真实、正确，并知悉虚假陈述可能导致拒签或被拒绝入境",
  declaration_information_true: "我声明本申请所填信息完整、正确且为最新信息",
  declaration_understands_consequences: "我已知悉：提供虚假或误导性信息属于严重违规，可能导致签证被拒、取消或被要求离境",
  declaration_consent_to_share_data: "我同意为审理本申请而与相关澳大利亚政府机构及境外主管机关共享我的个人信息",
  declaration_consent_health_examinations: "我同意按主管部门要求接受必要的健康检查",
  declaration_consent_biometrics: "我同意在被要求时提供生物识别数据（照片和指纹）",
  declaration_date: "签署日期",
  declaration_fee_not_refunded_awareness: "我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。",
  declaration_insurance_multi_entry_awareness: "我已知悉：如获发多次入境签证，每次进入成员国领土时均需持有足够的旅行医疗保险。",
  declaration_vis_consent: "我已知悉并同意签证申请数据、照片和指纹的收集、处理与保存",
  declaration_data_rights_awareness: "我已知悉我对 VIS 中个人数据的查询、更正和依法删除权利",
  declaration_truthfulness: "我声明本申请所填信息真实、正确且完整",
  declaration_awareness_refusal: "我已知悉虚假陈述可能导致拒签、已发签证被撤销并承担法律责任",
  declaration_undertaking_to_leave: "我承诺在获发签证的有效期届满前离开成员国领土",
  final_declaration: "我声明以上信息真实、准确且完整，并愿对虚假申报承担相应责任",

  // UK Standard Visitor — full field_name → zh set. Spread LAST so these win
  // over any generic entry above for shared field names.
  ...UK_FIELD_NAME_ZH,

};

const LABEL_ZH_OVERRIDES: Record<string, string> = {
  "Is the application being filled in by someone other than the applicant?":
    "本申请是否由申请人本人以外的其他人填写？",
  "Place of application": "申请提交地点 / 当前申请所在地",
  "I am aware that the visa fee is not refunded if the visa is refused.":
    "我已知悉：如果签证申请被拒，已支付的签证费用通常不予退还。",
  "Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States.":
    "我已知悉：如获发多次入境签证，首次停留及之后每次进入成员国领土时均需持有足够的旅行医疗保险。",
  "I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years.":
    "我已知悉并同意：为审理本申请，相关机构必须收集申请表所需数据，并在适用情况下采集我的照片和指纹；我在申请表中提供的个人数据、指纹和照片将提交给相关成员国主管机关处理，用于作出签证申请决定，并可能存入签证信息系统（VIS），最长保存五年。",
  "I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted.":
    "我已知悉：我有权在任一成员国查询 VIS 中与本人有关的数据及传输该数据的成员国，并可请求更正不准确数据或依法删除被非法处理的数据。",
  "I declare that to the best of my knowledge all particulars supplied by me are correct and complete.":
    "我声明：据我所知，本人提供的全部信息均真实、正确且完整。",
  "I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application.":
    "我已知悉：任何虚假陈述都可能导致本申请被拒或已获签证被撤销，并可能使我根据审理成员国法律承担相应责任。",
  "I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States.":
    "我承诺：如获发签证，将在签证有效期届满前离开成员国领土；我已获告知，持有签证只是进入成员国欧洲领土的前提条件之一。",
  "Have you ever been refused a visa or entry?": "是否曾被拒签、被拒绝入境或被要求离境？",
  "Do you have any criminal history to declare?": "是否有需要申报的犯罪记录？",
  "Additional notes for review": "补充说明 / 其他可能影响本次申请的信息",
  "I confirm all details are accurate and match my travel documents.":
    "我确认以上信息准确无误，并与旅行证件一致",
  "Is there anything else you would like to tell us about your application?":
    "是否还有其他可能影响本次申请的信息需要补充说明？",
  "To": "结束日期 / 有效期至",
  "Type": "类型（请按本题所属证件或申请事项选择）",
  "Explain": "请说明该问题回答为“是”的具体情况",
  "Details": "请提供相关具体情况",
  "Other": "其他情况（请具体说明）",
};

const FIELD_NAME_EN_OVERRIDES: Record<string, string> = {
  identity_card_number: "Identity card number",
  visa_valid_from: "Grant e-Visa valid from",
  visa_valid_to: "Grant e-Visa valid to",
  passport_number: "Passport number",
  passport_type: "Passport type",
  emergency_contact_full_name: "Emergency contact full name",
  emergency_contact_current_address: "Emergency contact current residential address",
  emergency_contact_telephone: "Emergency contact telephone number",
  emergency_contact_relationship: "Emergency contact relationship",
  occupation_info: "Current occupation details",
  position_course: "Position or course of study",
  company_phone: "Company/agency/school telephone number",
  intended_province_city: "Intended province/city in Viet Nam",
  intended_ward_commune: "Intended ward/commune in Viet Nam",
  declaration_temporary_residence: "I commit to declare temporary residence according to Vietnamese law",
  relative_relationship: "Relationship to the relative in Viet Nam",
  bought_travel_insurance: "Have you bought travel insurance?",
  expense_coverage: "Who will cover the applicant's trip expenses?",
  violation_of_vietnam_laws_details: "Details of Vietnamese law/regulation violation",
};

const PLACEHOLDER_ZH_BY_FIELD_NAME: Record<string, string> = {
  place_of_birth: "请填写出生城市或地区",
  place_of_birth_city: "请填写出生城市",
  place_of_birth_country: "请选择出生国家/地区",
  place_of_birth_province: "请填写出生省/州",
  place_of_birth_state: "请填写出生州/省",
  birth_city: "请填写出生城市",
  birth_country: "请选择出生国家/地区",
  birth_province_or_state: "请填写出生省/州（如适用）",
  city_of_birth: "请填写出生城市",
  country_of_birth: "请选择出生国家/地区",
  state_of_birth: "请填写出生州/省（如适用）",
  intended_ward_commune: "请在选择省/市后填写坊/社",
  phone_number: "例如：+62 812 3456 7890",
  email_address: "例如：name@example.com",
  how_long_at_address: "例如：3 年",
  home_address_line_1: "门牌号 + 街道，例如：南京西路 88 号 / 88 Nanjing West Road",
  home_address_line1: "门牌号 + 街道，例如：南京西路 88 号 / 88 Nanjing West Road",
  home_address_line_2: "小区/楼栋/单元/房号（如无可留空），例如：阳光花园 3 号楼 2 单元 501 室",
  home_address_line2: "小区/楼栋/单元/房号（如无可留空），例如：阳光花园 3 号楼 2 单元 501 室",
};

const HELPER_ZH_BY_FIELD_NAME: Record<string, string> = {
  declaration_fee_not_refunded_awareness:
    "该项用于确认您理解官方签证费的退款规则。请仅在已阅读并同意该声明后选择“是”。",
  declaration_insurance_multi_entry_awareness:
    "多次入境签证持有人通常需在首次和后续每次访问时都具备符合要求的旅行医疗保险。",
  declaration_vis_consent:
    "为审理本申请，相关机构必须收集申请表所需数据，并在适用情况下采集照片和指纹；相关个人数据、指纹和照片会提交给主管机关处理，用于签证决定，并可能依法存入 VIS 或其他官方系统并保存规定期限。",
  declaration_data_rights_awareness:
    "该项确认您理解自己可依法查询、更正或请求删除签证信息系统中的个人数据。",
  declaration_truthfulness:
    "该项确认您对本申请中所填信息的真实性、准确性和完整性负责。",
  declaration_awareness_refusal:
    "该项确认您理解虚假陈述可能导致拒签、已发签证被撤销，并可能产生法律责任。",
  declaration_undertaking_to_leave:
    "该项确认您承诺按签证条件离境，并理解签证本身不保证最终入境。",
  final_declaration:
    "请确认您理解并接受：如提交虚假或不完整信息，可能承担官方规定的法律或行政后果。",
  us_social_security_number:
    "如您没有美国社会安全号码或不记得号码，请按官方表单提供的“不适用/不知道”选项处理。",
  sponsor_security_bond_aware:
    "澳大利亚访客签证担保类别可能要求担保人缴纳保证金；请确认您理解这一可能要求。",
  has_terrorism_or_security_history:
    "该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。",
};

const OPTION_ZH_BY_VALUE: Record<string, string> = {
  yes: "是",
  no: "否",
  true: "是",
  false: "否",
  male: "男",
  female: "女",
  other: "其他",
  others: "其他",
  temporaryvisa: "我持有临时签证",
  permanentresident: "我是永久居民",
  own: "我拥有该住房",
  rent: "我租住该住房",
  single: "单次",
  multiple: "多次",
  double: "两次",
  ordinary: "普通护照",
  ordinary_passport: "普通护照",
  diplomatic: "外交护照",
  diplomatic_passport: "外交护照",
  service: "公务护照",
  official: "公务人员",
  official_passport: "公务护照",
  special: "特殊护照",
  passport: "护照",
  id_card: "国民身份证",
  tourism: "旅游",
  tourist: "旅游",
  business: "商务",
  business_visit: "短期商务访问",
  family_visit: "探亲访友",
  visiting_family_friends: "探亲访友",
  visiting_relatives: "探亲访友",
  transit: "过境",
  airport_transit: "机场过境",
  cultural: "文化活动",
  sports: "体育活动",
  official_visit: "公务访问",
  medical: "医疗原因",
  study: "短期学习",
  self: "本人承担",
  personal: "个人承担",
  sponsor: "担保人/资助方承担",
  host: "邀请人/接待方",
  family: "家庭成员",
  company: "公司/雇主",
  organisation: "机构",
  organization: "机构",
  both: "本人和担保人共同承担",
  not_sure: "暂不确定",
  hotel: "酒店或其他商业住宿",
  private_host: "与邀请人同住",
  rented: "租赁住宿",
  evisa: "电子签证",
  eta: "电子旅行许可",
  visa_free: "免签",
  voa: "落地签",
  tourist_single: "旅游签证（单次入境）",
  tourist_30d: "旅游签证（30天）",
  evisa_single: "电子签证（单次入境）",
  imuga_arrival: "IMUGA 旅客申报 / 落地签",
  etravel_only: "eTravel 入境申报",
  form_id_936_single: "ID 936 访问签证（单次入境）",
};

const VIETNAM_PROVINCE_ZH_BY_VALUE: Record<string, string> = {
  an_giang: "安江省",
  bac_ninh: "北宁省",
  ca_mau: "金瓯省",
  cao_bang: "高平省",
  can_tho: "芹苴市",
  da_nang: "岘港市",
  dak_lak: "得乐省",
  dien_bien: "奠边省",
  dong_nai: "同奈省",
  dong_thap: "同塔省",
  gia_lai: "嘉莱省",
  ha_noi: "河内市",
  ha_tinh: "河静省",
  hai_phong: "海防市",
  ho_chi_minh_city: "胡志明市",
  hue: "顺化市",
  hung_yen: "兴安省",
  khanh_hoa: "庆和省",
  lai_chau: "莱州省",
  lam_dong: "林同省",
  lang_son: "谅山省",
  lao_cai: "老街省",
  nghe_an: "乂安省",
  ninh_binh: "宁平省",
  phu_tho: "富寿省",
  quang_ngai: "广义省",
  quang_ninh: "广宁省",
  quang_tri: "广治省",
  son_la: "山罗省",
  tay_ninh: "西宁省",
  thai_nguyen: "太原省",
  thanh_hoa: "清化省",
  tuyen_quang: "宣光省",
  vinh_long: "永隆省",
};

function normalizeVietnamOptionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCaseLatin(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .replace(/\bInt\b/g, "Int");
}

function getVietnamGateChineseLabel(value: string, rawText: string): string | null {
  const text = clean(rawText || value);
  if (!text) return null;

  const parenthetical = text.match(/\(([^)]+)\)/);
  const suffix = parenthetical ? `（${parenthetical[1].trim()}）` : "";
  const withoutParenthetical = text.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const typeRules: Array<[RegExp, string]> = [
    [/\b(?:international\s+airport|int\s+airport|airport)\b/i, "国际机场"],
    [/\blandport\b/i, "陆路口岸"],
    [/\bseaport\b/i, "海港"],
    [/\bport\b/i, "港口"],
    [/\bborder\s+gate\b/i, "口岸"],
  ];

  for (const [pattern, typeLabel] of typeRules) {
    if (!pattern.test(withoutParenthetical)) continue;
    const placeName = withoutParenthetical
      .replace(pattern, "")
      .replace(/\s+/g, " ")
      .trim();
    return `${placeName ? titleCaseLatin(placeName) : titleCaseLatin(withoutParenthetical)} ${typeLabel}${suffix}`;
  }

  return null;
}

function getVietnamSpecificChineseOptionLabel(value: string, rawText: string): string | null {
  const valueKey = normalizeVietnamOptionKey(value);
  const textKey = normalizeVietnamOptionKey(rawText);
  const provinceLabel = VIETNAM_PROVINCE_ZH_BY_VALUE[valueKey] ?? VIETNAM_PROVINCE_ZH_BY_VALUE[textKey];
  if (provinceLabel) return provinceLabel;

  return getVietnamGateChineseLabel(value, rawText);
}

const COUNTRY_ZH: Record<string, string> = {
  Australia: "澳大利亚",
  Canada: "加拿大",
  Cambodia: "柬埔寨",
  Egypt: "埃及",
  France: "法国",
  Germany: "德国",
  "Hong Kong": "香港",
  Indonesia: "印度尼西亚",
  India: "印度",
  Japan: "日本",
  Korea: "韩国",
  Laos: "老挝",
  Macau: "澳门",
  Malaysia: "马来西亚",
  Maldives: "马尔代夫",
  "New Zealand": "新西兰",
  Philippines: "菲律宾",
  Russia: "俄罗斯",
  Singapore: "新加坡",
  "South Africa": "南非",
  "Sri Lanka": "斯里兰卡",
  Thailand: "泰国",
  Turkey: "土耳其",
  UAE: "阿联酋",
  "United Arab Emirates": "阿联酋",
  "United Kingdom": "英国",
  UK: "英国",
  "United States": "美国",
  "U.S.": "美国",
  US: "美国",
  Vietnam: "越南",
  "Viet Nam": "越南",
};

const FIELD_TOKEN_ZH: Record<string, string> = {
  account: "账号",
  accommodation: "住宿",
  address: "地址",
  adult: "成年人",
  agency: "机构",
  applicant: "申请人",
  application: "申请",
  arrival: "抵达",
  authority: "机构",
  birth: "出生",
  border: "边境",
  business: "商务",
  card: "卡",
  child: "儿童",
  children: "儿童",
  city: "城市",
  company: "公司",
  contact: "联系人",
  country: "国家/地区",
  course: "课程",
  criminal: "犯罪记录",
  current: "当前",
  date: "日期",
  declaration: "声明确认",
  denied: "被拒绝",
  departure: "离开",
  details: "具体情况",
  document: "证件",
  education: "教育",
  email: "电子邮箱",
  employer: "雇主",
  employment: "工作",
  entry: "入境",
  expenses: "费用",
  expiry: "到期",
  family: "家庭",
  father: "父亲",
  final: "最终",
  financial: "资金",
  first: "名字",
  from: "开始",
  full: "完整",
  gate: "口岸",
  given: "名字",
  has: "是否",
  history: "记录",
  home: "家庭住址",
  host: "邀请人/接待方",
  identity: "身份",
  insurance: "保险",
  intended: "预计",
  issue: "签发",
  issuing: "签发",
  length: "时长",
  laws: "法律法规",
  legal: "法定",
  marital: "婚姻",
  means: "方式",
  member: "成员",
  mother: "母亲",
  name: "名称",
  names: "姓名",
  nationality: "国籍",
  number: "号码",
  occupation: "职业",
  other: "其他",
  parental: "父母/监护人",
  passport: "护照",
  payer: "付费人",
  permit: "许可",
  phone: "电话",
  place: "地点",
  plans: "计划",
  previous: "以往",
  province: "省",
  purpose: "目的",
  refusal: "拒签/拒绝入境",
  refused: "拒签/拒绝入境",
  relationship: "关系",
  relative: "亲属",
  relatives: "亲属",
  residence: "居住",
  residential: "居住",
  school: "学校",
  security: "安全",
  sex: "性别",
  sponsor: "担保人/资助方",
  state: "州/省",
  stay: "停留",
  surname: "姓氏",
  telephone: "电话",
  temporary: "临时",
  travel: "旅行",
  trip: "旅行",
  type: "类型",
  valid: "有效",
  visa: "签证",
  visit: "访问",
  visited: "曾访问",
  ward: "坊/社",
  work: "工作",
};

function hasCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function hasLatin(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function getRuleText(field: FieldLike, keys: string[]): string | null {
  const rules = field.validationRules;
  if (!rules) return null;
  for (const key of keys) {
    const value = rules[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function isVagueChineseLabel(value: string | null | undefined): boolean {
  return VAGUE_CHINESE_LABELS.has(clean(value));
}

export function isEnglishOnlyText(value: string | null | undefined): boolean {
  const text = clean(value);
  return Boolean(text && hasLatin(text) && !hasCjk(text));
}

export function isChineseOnlyText(value: string | null | undefined): boolean {
  const text = clean(value);
  return Boolean(text && hasCjk(text) && !hasLatin(text));
}

function normalizeFieldName(fieldName: string): string {
  return fieldName
    .replace(/-(zh|en)$/i, "")
    .replace(/__\d+$/, "")
    .toLowerCase();
}

function humanizeFieldName(fieldName: string): string {
  return normalizeFieldName(fieldName)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token === "id" ? "ID" : token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function fieldNameToChinese(fieldName: string): string | null {
  const normalized = normalizeFieldName(fieldName);
  const direct = FIELD_NAME_ZH_OVERRIDES[normalized];
  if (direct) return direct;

  const tokens = normalized.split(/[_\s-]+/).filter(Boolean);
  const translated = tokens.map((token) => FIELD_TOKEN_ZH[token]).filter(Boolean);
  if (translated.length === 0) return null;

  const joined = translated.join("");
  if (joined === "是否") return null;
  if (joined.startsWith("是否")) return `${joined}？`;
  return joined;
}

function countryNameToChinese(value: string): string {
  let output = value;
  const entries = Object.entries(COUNTRY_ZH).sort(([left], [right]) => right.length - left.length);
  for (const [en, zh] of entries) {
    output = output.replace(new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), zh);
  }
  return output.replace(/\bthe\s+(?=[\u3400-\u9fff])/gi, "");
}

function deriveQuestionLabel(field: FieldLike): string | null {
  const label = clean(field.label);
  const fieldName = normalizeFieldName(field.fieldName);

  if (fieldName.includes("details")) {
    if (/refus|denied|deport|removal|cancel/i.test(fieldName)) {
      return "请说明拒签、签证取消、拒绝入境、遣返或撤回入境申请的具体情况";
    }

    if (/criminal|arrest|convict|offen[cs]e|charge/i.test(fieldName)) {
      return "请说明犯罪、逮捕、指控或定罪记录的具体情况";
    }

    if (/security|terror|espionage|sabotage|background/i.test(fieldName)) {
      return "请说明安全或公共秩序相关背景的具体情况";
    }

    if (/^provide details/i.test(label)) {
      return "请提供本题要求的具体情况";
    }
  }

  if (/^have you ever been refused a visa to, or denied entry into, any other country\??$/i.test(label)) {
    return "是否曾被其他国家拒发签证或拒绝入境？";
  }

  const refusedCountry = label.match(/^Have you ever been refused a visa to, or denied entry into, (.+?)\??$/i);
  if (refusedCountry) {
    return `是否曾被${countryNameToChinese(refusedCountry[1])}拒发签证或拒绝入境？`;
  }

  if (/refused.*visa|visa.*refused|denied entry|removal|deported/i.test(label)) {
    return "是否曾被拒签、被拒绝入境、被遣返或被要求离境？";
  }

  if (/criminal history|arrested|convicted|offense|crime/i.test(label)) {
    return "是否有需要申报的犯罪、逮捕或定罪记录？";
  }

  if (/violated.*laws|law.*violation/i.test(label)) {
    return "是否曾违反相关国家/地区的法律或法规？";
  }

  if (/other nationalit/i.test(label) || fieldName.includes("other_nationalit")) {
    return "是否持有或曾持有其他国籍？";
  }

  if (/other valid passports|travel documents/i.test(label)) {
    return "是否持有其他有效护照或旅行证件？";
  }

  if (/travel(?:ing|ling)? with|travel companions/i.test(label)) {
    return "是否有其他人与您同行？";
  }

  if (/have you ever visited (.+?) before\??$/i.test(label)) {
    const visitedCountry = label.match(/have you ever visited (.+?) before\??$/i);
    return visitedCountry ? `是否曾访问${countryNameToChinese(visitedCountry[1])}？` : "是否曾访问该国家/地区？";
  }

  if (/same country or location/i.test(label)) {
    return "您是否在上次签证签发的同一国家或地点申请，且该地是您的主要居住地？";
  }

  if (/who (?:will )?(?:cover|pay|is paying)/i.test(label)) {
    return "谁将承担本次旅行和停留费用？";
  }

  if (/^do you|^are you|^have you|^has your|^will you|^is your|^was previous/i.test(label)) {
    const fromName = fieldNameToChinese(field.fieldName);
    if (fromName && fromName !== "是否") return fromName.endsWith("？") ? fromName : `是否${fromName}？`;
  }

  return null;
}

function deriveChineseFromLabel(field: FieldLike): string | null {
  const label = clean(field.label);
  if (!label) return null;
  if (hasCjk(label) && !isVagueChineseLabel(label)) return label;

  const exact = LABEL_ZH_OVERRIDES[label];
  if (exact) return exact;

  const question = deriveQuestionLabel(field);
  if (question) return question;

  const generated = getChineseLabel(label, field.fieldName);
  if (hasCjk(generated) && !isVagueChineseLabel(generated) && generated !== label) {
    return generated;
  }

  return null;
}

export function deriveChineseFieldLabel(field: FieldLike): string {
  const normalizedFieldName = normalizeFieldName(field.fieldName);
  const direct = FIELD_NAME_ZH_OVERRIDES[normalizedFieldName];
  const taiwanDirect = TW_FIELD_NAME_ZH[normalizedFieldName] ?? direct;
  if (field.visaType === "TW_ENTRY_PERMIT" && taiwanDirect) return taiwanDirect;

  const metadataLabel = getRuleText(field, ["label_zh", "zh_label"]);
  if (metadataLabel && hasCjk(metadataLabel) && !isVagueChineseLabel(metadataLabel)) return metadataLabel;

  if (direct) return direct;

  const labelDerived = deriveChineseFromLabel(field);
  if (labelDerived) return labelDerived;

  const nameDerived = fieldNameToChinese(field.fieldName);
  if (nameDerived && !isVagueChineseLabel(nameDerived)) return nameDerived;

  return `请填写：${humanizeFieldName(field.fieldName) || clean(field.label) || "本项申请信息"}`;
}

export function deriveEnglishFieldLabel(field: FieldLike): string {
  const metadataLabel = getRuleText(field, ["label_en", "official_label_en", "official_label", "en_label"]);
  if (metadataLabel && !hasCjk(metadataLabel)) return metadataLabel;

  const direct = FIELD_NAME_EN_OVERRIDES[normalizeFieldName(field.fieldName)];
  if (direct) return direct;

  const label = clean(field.label);
  if (label && !hasCjk(label)) return getEnglishLabel(label);

  return humanizeFieldName(field.fieldName);
}

function deriveChinesePlaceholder(field: FieldLike, labelZh: string): string | null {
  const direct = PLACEHOLDER_ZH_BY_FIELD_NAME[normalizeFieldName(field.fieldName)];
  if (direct) return direct;

  const metadataPlaceholder = getRuleText(field, ["placeholder_zh", "zh_placeholder"]);
  if (metadataPlaceholder && hasCjk(metadataPlaceholder)) return metadataPlaceholder;

  const raw = clean(field.placeholder);
  if (raw) {
    const translated = getChinesePlaceholder(raw, field.fieldName);
    if (translated && hasCjk(translated)) return translated;
  }

  if (field.fieldType === "select" || field.fieldType === "country") return "请选择...";
  if (field.fieldType === "date") return "请选择日期";
  if (field.fieldType === "text" || field.fieldType === "textarea") return `请填写${labelZh.replace(/[？?。]$/g, "")}`;
  return null;
}

function deriveEnglishPlaceholder(field: FieldLike, labelEn: string): string | null {
  const metadataPlaceholder = getRuleText(field, ["placeholder_en", "en_placeholder"]);
  if (metadataPlaceholder && !hasCjk(metadataPlaceholder)) return metadataPlaceholder;

  const raw = clean(field.placeholder);
  if (raw) {
    const translated = getEnglishPlaceholder(raw);
    if (translated && !hasCjk(translated)) return translated;
  }

  if (field.fieldType === "select" || field.fieldType === "country") return "Select...";
  if (field.fieldType === "date") return "Select date";
  if (field.fieldType === "text" || field.fieldType === "textarea") return `Enter ${labelEn.toLowerCase()}`;
  return null;
}

function needsHelper(field: FieldLike, labelEn: string): boolean {
  const fieldName = normalizeFieldName(field.fieldName);
  const text = `${fieldName} ${labelEn}`;
  return (
    fieldName.includes("declaration") ||
    fieldName.includes("consent") ||
    fieldName.includes("awareness") ||
    fieldName.includes("undertaking") ||
    /criminal|refusal|refused|denied|visa_history|security|background|terror|espionage|sabotage|convict|offen[cs]e|arrest|deport|removal|cancelled|violation|violated|public order|national security/i.test(text) ||
    labelEn.length > 140
  );
}

function deriveHelperZh(field: FieldLike, labelZh: string, labelEn: string): string | null {
  const existing = getRuleText(field, ["helper_zh", "zh_helper", "description_zh"]);
  if (existing && hasCjk(existing)) return existing;

  const fieldName = normalizeFieldName(field.fieldName);
  const text = `${fieldName} ${labelEn}`;
  const direct = HELPER_ZH_BY_FIELD_NAME[fieldName];
  if (direct) return direct;

  if (!needsHelper(field, labelEn)) return null;

  if (/refusal|refused|denied|deport|removal|cancelled|canceled|visa_history/i.test(text)) {
    if (/details|explain|reason|country|date|type/i.test(text)) {
      return "请填写相关国家/地区、日期、地点、签证类型、拒绝或取消原因，以及最终处理结果。";
    }
    return "请如实说明是否曾有拒签、签证取消、拒绝入境、遣返或撤回入境申请等情况；如回答“是”，请准备说明国家/地区、日期、原因和结果。";
  }

  if (/criminal|arrest|convict|offen[cs]e|crime|charge|sentence|prosecution/i.test(text)) {
    return "请按官方题目如实申报任何逮捕、指控、定罪、赦免或处罚记录；如回答“是”，请说明国家/地区、日期、事项和处理结果。";
  }

  if (/violat|overstay|breach|law/i.test(text)) {
    return "请说明违反相关法律法规或签证条件的国家/地区、日期、事项、处理结果及当前状态。";
  }

  if (/security|terror|espionage|sabotage|public order|national security|background|weapons|traffick|narcotic|genocide/i.test(text)) {
    return "该项涉及安全、公共秩序或国家安全背景审查；请按官方题目如实回答，并在需要时说明事件、时间、地点和处理结果。";
  }

  if (/details|explain|describe|provide details/i.test(text)) {
    return "请按照上一题或本题要求填写国家/地区、日期、地点、原因和结果等具体情况。";
  }

  if (labelZh.length > 60) return labelZh;
  return `请完整阅读并确认该官方题目含义：${labelZh}`;
}

function deriveHelperEn(field: FieldLike, labelEn: string): string | null {
  const existing = getRuleText(field, ["helper_en", "en_helper", "description_en"]);
  if (existing && !hasCjk(existing)) return existing;
  if (!needsHelper(field, labelEn)) return null;
  return labelEn;
}

function optionText(option: VisaFormFieldOption): string {
  if (typeof option === "string") return option;
  return clean(option.text) || clean(option.label_en) || clean(option.official_label) || clean(option.value);
}

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function deriveChineseOptionLabel(option: VisaFormFieldOption): string {
  if (typeof option !== "string") {
    const existing = clean(option.label_zh);
    if (existing && hasCjk(existing)) return existing;
  }

  const value = optionValue(option);
  const rawText = optionText(option);
  const normalizedValue = value.toLowerCase();
  const exact = OPTION_ZH_BY_VALUE[normalizedValue] ?? OPTION_ZH_BY_VALUE[rawText.toLowerCase()];
  if (exact) return exact;

  const vietnamSpecific = getVietnamSpecificChineseOptionLabel(value, rawText);
  if (vietnamSpecific) return vietnamSpecific;

  const translated = getChineseOptionText(rawText);
  if (translated && hasCjk(translated) && translated !== rawText) return translated;

  const fromValue = fieldNameToChinese(value);
  if (fromValue && !isVagueChineseLabel(fromValue)) return fromValue;

  return countryNameToChinese(rawText || value);
}

function deriveEnglishOptionLabel(option: VisaFormFieldOption): string {
  if (typeof option !== "string") {
    const existing = clean(option.label_en) || clean(option.official_label) || clean(option.text);
    if (existing && !hasCjk(existing)) return getEnglishOptionText(existing);
  }
  return getEnglishOptionText(optionText(option));
}

export function normalizeBilingualOption(option: VisaFormFieldOption): VisaFormFieldOption {
  const value = optionValue(option);
  const text = optionText(option) || value;
  const labelEn = deriveEnglishOptionLabel(option);
  const labelZh = deriveChineseOptionLabel(option);

  if (typeof option === "string") {
    return {
      value,
      text,
      label_zh: labelZh,
      label_en: labelEn,
      official_label: text,
    };
  }

  return {
    ...option,
    value,
    text: option.text ?? labelEn,
    label_zh: labelZh,
    label_en: labelEn,
    official_label: option.official_label ?? text,
  };
}

export function normalizeBilingualFormField<T extends VisaFormFieldRow>(field: T): T {
  const taiwanAddressOverride = normalizeTaiwanAddressField(field);
  const taiwanOccupationOverride = normalizeTaiwanOccupationDependentField(field);
  const fieldWithOverrides = {
    ...field,
    ...taiwanAddressOverride,
    ...taiwanOccupationOverride,
    validationRules: {
      ...(field.validationRules ?? {}),
      ...(taiwanAddressOverride.validationRules ?? {}),
      ...(taiwanOccupationOverride.validationRules ?? {}),
    },
  };
  const labelZh = deriveChineseFieldLabel(fieldWithOverrides);
  const labelEn = deriveEnglishFieldLabel(fieldWithOverrides);
  const placeholderZh = deriveChinesePlaceholder(fieldWithOverrides, labelZh);
  const placeholderEn = deriveEnglishPlaceholder(fieldWithOverrides, labelEn);
  const helperZh = deriveHelperZh(fieldWithOverrides, labelZh, labelEn);
  const helperEn = deriveHelperEn(fieldWithOverrides, labelEn);
  const requiredOverride =
    fieldWithOverrides.visaType === "TW_ENTRY_PERMIT" && TW_REQUIRED_FIELD_OVERRIDES.has(normalizeFieldName(fieldWithOverrides.fieldName));

  return {
    ...fieldWithOverrides,
    required: requiredOverride ? true : fieldWithOverrides.required,
    validationRules: {
      ...(fieldWithOverrides.validationRules ?? {}),
      label_zh: labelZh,
      label_en: labelEn,
      official_label_en: labelEn,
      ...(placeholderZh ? { placeholder_zh: placeholderZh } : {}),
      ...(placeholderEn ? { placeholder_en: placeholderEn } : {}),
      ...(helperZh ? { helper_zh: helperZh } : {}),
      ...(helperEn ? { helper_en: helperEn } : {}),
    },
    options: fieldWithOverrides.options?.map(normalizeBilingualOption) ?? fieldWithOverrides.options,
  };
}

export function normalizeBilingualWizardSteps<T extends { fields: VisaFormFieldRow[] }>(steps: T[]): T[] {
  return steps.map((step) => ({
    ...step,
    fields: step.fields.map(normalizeBilingualFormField),
  }));
}

export function resolveLocalizedFieldLabel(field: FieldLike, side: BilingualSide): string {
  return side === "zh" ? deriveChineseFieldLabel(field) : deriveEnglishFieldLabel(field);
}

export function resolveLocalizedPlaceholder(field: FieldLike, side: BilingualSide): string | null {
  const label = resolveLocalizedFieldLabel(field, side);
  return side === "zh" ? deriveChinesePlaceholder(field, label) : deriveEnglishPlaceholder(field, label);
}

export function resolveLocalizedOptions(
  options: VisaFormFieldOption[] | null,
  side: BilingualSide,
): VisaFormFieldOption[] | null {
  if (!options) return null;
  const cached = LOCALIZED_OPTIONS_CACHE.get(options)?.[side];
  if (cached) return cached;
  const localized = options.map((option) => {
    const normalized = normalizeBilingualOption(option);
    const normalizedObject = normalized as OptionObject;
    return {
      ...normalizedObject,
      text: side === "zh" ? normalizedObject.label_zh : normalizedObject.label_en,
    };
  });
  const nextCache = LOCALIZED_OPTIONS_CACHE.get(options) ?? {};
  nextCache[side] = localized;
  LOCALIZED_OPTIONS_CACHE.set(options, nextCache);
  return localized;
}

export function resolveOptionDisplayLabel(
  options: VisaFormFieldOption[] | null | undefined,
  value: string,
  side: BilingualSide,
): string | null {
  if (!options || !Array.isArray(options)) return null;
  const normalizedValue = value.toLowerCase();
  for (const option of options) {
    const normalized = normalizeBilingualOption(option) as OptionObject;
    if (normalized.value.toLowerCase() !== normalizedValue) continue;
    return side === "zh"
      ? (normalized.label_zh ?? normalized.text ?? normalized.value)
      : (normalized.official_label ?? normalized.label_en ?? normalized.text ?? normalized.value);
  }
  return null;
}
