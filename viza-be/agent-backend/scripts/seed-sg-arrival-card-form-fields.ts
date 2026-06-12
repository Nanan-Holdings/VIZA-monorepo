/**
 * Seed script: visa_form_fields for Singapore SG Arrival Card (SGAC).
 *
 * Scope: SG Arrival Card preparation for one foreign visitor. SG Arrival Card
 * is not a visa, is free of charge on ICA official channels, and is required
 * within three (3) days including the day of arrival before arrival in
 * Singapore unless an ICA exemption applies.
 *
 * Source baseline: ICA SG Arrival Card with Electronic Health Declaration.
 * VIZA collects, reviews, validates, and passes the traveller's saved
 * information to the submission-service SGAC ICA portal runner.
 *
 * Out of scope: Singapore Visit Visa / SAVE, pass applications, group
 * submission, and payment.
 *
 * Run: npx tsx scripts/seed-sg-arrival-card-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow } from "./bilingual-seed-row";

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

const VISA_TYPE = "SG_ARRIVAL_CARD";

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

function rules(
  labelZh: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { label_zh: labelZh, ...extra };
}

const YES_NO = [
  { value: "yes", text: "Yes", label_zh: "是", label_en: "Yes" },
  { value: "no", text: "No", label_zh: "否", label_en: "No" },
];

const SEX_OPTIONS = [
  { value: "male", text: "Male", label_zh: "男", label_en: "Male" },
  { value: "female", text: "Female", label_zh: "女", label_en: "Female" },
];

const MODE_OF_TRAVEL_OPTIONS = [
  { value: "air", text: "Air", label_zh: "航空", label_en: "Air" },
  { value: "sea", text: "Sea", label_zh: "海路", label_en: "Sea" },
  { value: "land", text: "Land", label_zh: "陆路", label_en: "Land" },
];

const TRAVEL_PURPOSE_OPTIONS = [
  { value: "holiday", text: "Holiday / Sightseeing / Leisure", label_zh: "旅游 / 观光 / 休闲", label_en: "Holiday / Sightseeing / Leisure" },
  { value: "business", text: "Business / Meeting / Conference", label_zh: "商务 / 会议 / 会展", label_en: "Business / Meeting / Conference" },
  { value: "family_friends", text: "Visit family or friends", label_zh: "探亲访友", label_en: "Visit family or friends" },
  { value: "education", text: "Education / Training", label_zh: "教育 / 培训", label_en: "Education / Training" },
  { value: "medical", text: "Medical treatment", label_zh: "医疗", label_en: "Medical treatment" },
  { value: "transit_with_clearance", text: "Transit with immigration clearance", label_zh: "过境并办理入境手续", label_en: "Transit with immigration clearance" },
  { value: "other", text: "Other", label_zh: "其他", label_en: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel", label_zh: "酒店", label_en: "Hotel" },
  { value: "residential", text: "Residential address / Host", label_zh: "住宅地址 / 接待人", label_en: "Residential address / Host" },
  { value: "others", text: "Others", label_zh: "其他", label_en: "Others" },
];

const ACCOMMODATION_OTHER_OPTIONS = [
  { value: "day_trip", text: "Day trip", label_zh: "一日游", label_en: "Day trip" },
  { value: "transit", text: "Transit", label_zh: "过境", label_en: "Transit" },
];

const COUNTRY_VISITED_HISTORY_OPTIONS = [
  { value: "none", text: "No recent travel to countries requiring declaration", label_zh: "没有需申报的近期旅行史", label_en: "No recent travel to countries requiring declaration" },
  { value: "yes", text: "Yes, I have recent travel history to declare", label_zh: "有需申报的近期旅行史", label_en: "Yes, I have recent travel history to declare" },
];

const UNDERSTAND_OPTION = [{ value: "yes", text: "I understand", label_zh: "我已知悉", label_en: "I understand" }];
const AUTHORIZE_OPTION = [{ value: "yes", text: "I authorize", label_zh: "我授权", label_en: "I authorize" }];
const AGREE_OPTION = [{ value: "yes", text: "I agree", label_zh: "我同意", label_en: "I agree" }];

const HAS_OTHER_PURPOSE = "purpose_of_travel === other";
const HAS_FLIGHT_OR_VESSEL = "mode_of_travel === air || mode_of_travel === sea";
const HAS_VEHICLE = "mode_of_travel === land";
const HAS_HOTEL = "accommodation_type === hotel";
const HAS_RESIDENTIAL = "accommodation_type === residential";
const HAS_OTHER_ACCOMMODATION = "accommodation_type === others";
const HAS_DECLARABLE_TRAVEL_HISTORY = "recent_country_visit_history === yes";
const HAS_SYMPTOMS = "has_health_symptoms === yes";

const FIELDS: FieldDef[] = [
  { field_name: "surname", label: "Surname / Family name", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 1, placeholder: "As shown in passport", validation_rules: rules("姓氏（与护照一致）", { maxLength: 50 }) },
  { field_name: "given_names", label: "Given name(s)", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 2, placeholder: "As shown in passport", validation_rules: rules("名字（与护照一致）", { maxLength: 80 }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 3, options: SEX_OPTIONS, validation_rules: rules("性别") },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 4, placeholder: "YYYY-MM-DD", validation_rules: rules("出生日期", { format: "YYYY-MM-DD" }) },
  { field_name: "nationality", label: "Nationality / Citizenship", field_type: "country", required: true, step_number: 1, step_name: "Traveller Information", display_order: 5, validation_rules: rules("国籍", { source: "ISO3166-1" }) },
  { field_name: "date_of_birth_country", label: "Country/Region of birth", field_type: "country", required: false, step_number: 1, step_name: "Traveller Information", display_order: 6, validation_rules: rules("出生国家/地区", { source: "ISO3166-1" }) },
  { field_name: "place_of_residence", label: "Place of residence / City", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 7, placeholder: "e.g. CHINA, BEIJING, BEIJING", validation_rules: rules("居住地 / 城市（用于匹配 ICA 选项）", { maxLength: 120 }) },
  { field_name: "email_address", label: "Email address for SGAC acknowledgement and e-Pass notices", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 8, placeholder: "name@example.com", validation_rules: rules("接收 SGAC 确认和 e-Pass 通知的邮箱", { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" }) },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 9, placeholder: "Including country code", validation_rules: rules("手机号码（含国家/地区区号）", { maxLength: 30 }) },
  { field_name: "has_used_different_name_to_enter_singapore", label: "Have you ever used a passport under a different name to enter Singapore?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 10, options: YES_NO, validation_rules: rules("是否曾用不同姓名的护照入境新加坡？") },

  { field_name: "passport_number", label: "Passport / Travel document number", field_type: "text", required: true, step_number: 2, step_name: "Passport Details", display_order: 1, placeholder: "As shown in passport", validation_rules: rules("护照或旅行证件号码", { maxLength: 20 }) },
  { field_name: "passport_issuing_country", label: "Passport / Travel document issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport Details", display_order: 2, validation_rules: rules("护照或旅行证件签发国家/地区", { source: "ISO3166-1" }) },
  { field_name: "passport_issue_date", label: "Passport / Travel document issue date", field_type: "date", required: false, step_number: 2, step_name: "Passport Details", display_order: 3, placeholder: "YYYY-MM-DD", validation_rules: rules("护照或旅行证件签发日期", { format: "YYYY-MM-DD", inline_group: "passport_dates" }) },
  { field_name: "passport_expiry_date", label: "Passport / Travel document expiry date", field_type: "date", required: true, step_number: 2, step_name: "Passport Details", display_order: 4, placeholder: "YYYY-MM-DD", validation_rules: rules("护照或旅行证件有效期至", { format: "YYYY-MM-DD", inline_group: "passport_dates" }) },
  { field_name: "passport_validity_acknowledgement", label: "I understand Singapore entry requirements may require sufficient passport validity and any required visa before travel.", field_type: "checkbox", required: true, step_number: 2, step_name: "Passport Details", display_order: 5, options: UNDERSTAND_OPTION, validation_rules: rules("我已知悉入境新加坡仍需满足护照有效期和签证等入境要求") },

  { field_name: "arrival_date", label: "Date of arrival in Singapore", field_type: "date", required: true, step_number: 3, step_name: "Trip to Singapore", display_order: 1, placeholder: "YYYY-MM-DD", validation_rules: rules("抵达新加坡日期", { format: "YYYY-MM-DD" }) },
  { field_name: "departure_date", label: "Date of departure from Singapore", field_type: "date", required: true, step_number: 3, step_name: "Trip to Singapore", display_order: 2, placeholder: "YYYY-MM-DD", validation_rules: rules("离开新加坡日期", { format: "YYYY-MM-DD" }) },
  { field_name: "purpose_of_travel", label: "Purpose of travel", field_type: "select", required: true, step_number: 3, step_name: "Trip to Singapore", display_order: 3, options: TRAVEL_PURPOSE_OPTIONS, validation_rules: rules("旅行目的", { display_label: "旅行目的 / Purpose of travel" }) },
  { field_name: "purpose_of_travel_other", label: "Specify other purpose of travel", field_type: "text", required: true, step_number: 3, step_name: "Trip to Singapore", display_order: 4, conditional_logic: { showIf: HAS_OTHER_PURPOSE }, validation_rules: rules("请说明其他旅行目的", { maxLength: 120 }) },
  { field_name: "last_city_or_port_before_singapore", label: "Last city / port before Singapore", field_type: "text", required: true, step_number: 3, step_name: "Trip to Singapore", display_order: 5, placeholder: "e.g. Shanghai, Kuala Lumpur, Bangkok", validation_rules: rules("抵达新加坡前最后停留城市或口岸", { maxLength: 80 }) },
  { field_name: "next_city_or_port_after_singapore", label: "Next city / port after Singapore", field_type: "text", required: false, step_number: 3, step_name: "Trip to Singapore", display_order: 6, placeholder: "If known", validation_rules: rules("离开新加坡后的下一站城市或口岸", { maxLength: 80 }) },
  { field_name: "mode_of_travel", label: "Mode of travel into Singapore", field_type: "select", required: true, step_number: 3, step_name: "Trip to Singapore", display_order: 7, options: MODE_OF_TRAVEL_OPTIONS, validation_rules: rules("入境新加坡交通方式") },
  { field_name: "transport_number", label: "Flight / vessel / coach / vehicle number", field_type: "text", required: true, step_number: 3, step_name: "Trip to Singapore", display_order: 8, placeholder: "e.g. SQ317, TR808, ferry or coach number", validation_rules: rules("航班、船班、巴士或车辆号码", { maxLength: 40 }) },
  { field_name: "carrier_name", label: "Airline / vessel / transport operator", field_type: "text", required: false, step_number: 3, step_name: "Trip to Singapore", display_order: 9, conditional_logic: { showIf: HAS_FLIGHT_OR_VESSEL }, placeholder: "e.g. Singapore Airlines, Scoot", validation_rules: rules("航空公司、船舶或交通运营方", { maxLength: 100 }) },
  { field_name: "vehicle_registration_number", label: "Vehicle registration number", field_type: "text", required: false, step_number: 3, step_name: "Trip to Singapore", display_order: 10, conditional_logic: { showIf: HAS_VEHICLE }, validation_rules: rules("车辆注册号码", { maxLength: 30 }) },

  { field_name: "accommodation_type", label: "Accommodation type in Singapore", field_type: "select", required: true, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 1, options: ACCOMMODATION_TYPE_OPTIONS, validation_rules: rules("在新加坡住宿类型") },
  { field_name: "accommodation_name", label: "Hotel name", field_type: "text", required: true, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 2, conditional_logic: { showIf: HAS_HOTEL }, placeholder: "e.g. Marina Bay Sands", validation_rules: rules("酒店名称", { maxLength: 120 }) },
  { field_name: "accommodation_other_type", label: "Accommodation (Others)", field_type: "select", required: true, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 3, conditional_logic: { showIf: HAS_OTHER_ACCOMMODATION }, options: ACCOMMODATION_OTHER_OPTIONS, validation_rules: rules("其他住宿类型") },
  { field_name: "accommodation_address", label: "Address in Singapore", field_type: "textarea", required: false, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 4, conditional_logic: { showIf: HAS_RESIDENTIAL }, placeholder: "Full address in Singapore", validation_rules: rules("在新加坡停留地址", { maxLength: 300 }) },
  { field_name: "accommodation_postcode", label: "Singapore postal code", field_type: "text", required: true, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 5, conditional_logic: { showIf: HAS_RESIDENTIAL }, validation_rules: rules("新加坡邮政编码", { pattern: "^[0-9]{6}$" }) },
  { field_name: "accommodation_block_number", label: "Block / house number", field_type: "text", required: true, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 6, conditional_logic: { showIf: HAS_RESIDENTIAL }, validation_rules: rules("门牌或楼号", { maxLength: 20 }) },
  { field_name: "accommodation_street_name", label: "Street name", field_type: "text", required: true, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 7, conditional_logic: { showIf: HAS_RESIDENTIAL }, validation_rules: rules("街道名称", { maxLength: 120 }) },
  { field_name: "accommodation_building_name", label: "Building name", field_type: "text", required: false, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 8, conditional_logic: { showIf: HAS_RESIDENTIAL }, validation_rules: rules("建筑名称", { maxLength: 120 }) },
  { field_name: "accommodation_floor_number", label: "Floor number", field_type: "text", required: false, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 9, conditional_logic: { showIf: HAS_RESIDENTIAL }, validation_rules: rules("楼层", { maxLength: 10 }) },
  { field_name: "accommodation_unit_number", label: "Unit number", field_type: "text", required: false, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 10, conditional_logic: { showIf: HAS_RESIDENTIAL }, validation_rules: rules("单位号", { maxLength: 10 }) },
  { field_name: "contact_person_in_singapore", label: "Contact person in Singapore (if any)", field_type: "text", required: false, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 11, validation_rules: rules("新加坡联系人（如有）", { maxLength: 120 }) },
  { field_name: "contact_phone_in_singapore", label: "Contact phone in Singapore (if any)", field_type: "text", required: false, step_number: 4, step_name: "Contact and Stay in Singapore", display_order: 12, validation_rules: rules("新加坡联系电话（如有）", { maxLength: 30 }) },

  { field_name: "recent_country_visit_history", label: "Recent travel history relevant to electronic health declaration", field_type: "radio", required: true, step_number: 5, step_name: "Electronic Health Declaration", display_order: 1, options: COUNTRY_VISITED_HISTORY_OPTIONS, validation_rules: rules("电子健康申报相关近期旅行史") },
  { field_name: "recent_country_visit_details", label: "Countries/regions and dates visited recently", field_type: "textarea", required: true, step_number: 5, step_name: "Electronic Health Declaration", display_order: 2, conditional_logic: { showIf: HAS_DECLARABLE_TRAVEL_HISTORY }, placeholder: "List countries/regions and dates", validation_rules: rules("请列明近期到访国家/地区及日期", { maxLength: 500 }) },
  { field_name: "has_health_symptoms", label: "Do you currently have fever, cough, breathlessness, vomiting, diarrhoea, rash, jaundice, or other symptoms to declare?", field_type: "radio", required: true, step_number: 5, step_name: "Electronic Health Declaration", display_order: 3, options: YES_NO, validation_rules: rules("当前是否有发热、咳嗽、呼吸困难、呕吐、腹泻、皮疹、黄疸或其他需申报症状？") },
  { field_name: "health_symptoms_details", label: "Health symptoms details", field_type: "textarea", required: true, step_number: 5, step_name: "Electronic Health Declaration", display_order: 4, conditional_logic: { showIf: HAS_SYMPTOMS }, placeholder: "Describe symptoms and onset date", validation_rules: rules("请说明健康症状及出现日期", { maxLength: 500 }) },
  { field_name: "yellow_fever_risk_acknowledgement", label: "I will check whether my recent travel history triggers any ICA health or vaccination requirement before official submission.", field_type: "checkbox", required: true, step_number: 5, step_name: "Electronic Health Declaration", display_order: 5, options: UNDERSTAND_OPTION, validation_rules: rules("我会在官方提交前核查近期旅行史是否触发 ICA 健康或疫苗要求") },
  { field_name: "health_declaration", label: "I understand false health declarations may be an offence under Singapore law.", field_type: "checkbox", required: true, step_number: 5, step_name: "Electronic Health Declaration", display_order: 6, options: UNDERSTAND_OPTION, validation_rules: rules("我已知悉虚假健康申报可能违反新加坡法律") },

  { field_name: "sgac_is_not_visa_acknowledgement", label: "I understand the SG Arrival Card is not a visa and does not replace visa or entry requirements.", field_type: "checkbox", required: true, step_number: 6, step_name: "Official Submission Checklist", display_order: 1, options: UNDERSTAND_OPTION, validation_rules: rules("我已知悉 SG Arrival Card 不是签证，不能替代签证或其他入境要求") },
  { field_name: "official_submission_timing_acknowledgement", label: "I understand SGAC should normally be submitted within three (3) days including the day of arrival before arriving in Singapore.", field_type: "checkbox", required: true, step_number: 6, step_name: "Official Submission Checklist", display_order: 2, options: UNDERSTAND_OPTION, validation_rules: rules("我已知悉 SGAC 通常应在抵达前 3 天内（含抵达当天）通过官方渠道提交") },
  { field_name: "official_submission_acknowledgement", label: "I authorize VIZA to submit my SG Arrival Card through the official ICA SGAC e-Service using the information I provided.", field_type: "checkbox", required: true, step_number: 6, step_name: "Official Submission Checklist", display_order: 3, options: AUTHORIZE_OPTION, validation_rules: rules("我授权 VIZA 使用我提供的信息通过 ICA 官方 SGAC e-Service 提交 SG Arrival Card") },
  { field_name: "final_declaration", label: "I declare that the information prepared here is true, complete, and matches my travel document and itinerary.", field_type: "checkbox", required: true, step_number: 6, step_name: "Official Submission Checklist", display_order: 4, options: AGREE_OPTION, validation_rules: rules("我声明以上资料真实、完整，并与旅行证件和行程一致") },
];

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

  const rows = FIELDS.map((field) => toBilingualSeedRow(VISA_TYPE, field));

  const batchSize = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
    } else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / batchSize) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }

  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
