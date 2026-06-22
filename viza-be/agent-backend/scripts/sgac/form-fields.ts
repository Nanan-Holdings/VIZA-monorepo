export const SGAC_VISA_TYPE = "SG_ARRIVAL_CARD";

export interface SgacFieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: Array<{ value: string; text: string; label_zh: string; label_en: string }>;
  conditional_logic?: Record<string, unknown>;
}

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({ label_zh: labelZh, ...extra });
const option = (value: string, labelZh: string, labelEn: string) => ({ value, text: labelEn, label_zh: labelZh, label_en: labelEn });
const YES_NO = [option("yes", "是", "Yes"), option("no", "否", "No")];
const SEX = [option("male", "男", "Male"), option("female", "女", "Female"), option("others", "其他", "Others")];
const MODES = [option("air", "航空", "Air"), option("land", "陆路", "Land"), option("sea", "海路", "Sea")];
const PURPOSES = [
  option("holiday", "旅游 / 观光 / 休闲", "Holiday/Sightseeing/Leisure"),
  option("business", "商务 / 会议 / 会展", "Business/Meeting/Conference/Convention/Exhibition"),
  option("family_friends", "探亲访友", "Visiting Friends/Relatives"),
  option("medical", "医疗", "Medical Care"),
  option("transit_with_clearance", "一日过境 / 免签过境设施", "1-day Transit/Visa Free Transit Facility (VFTF)"),
  option("other", "其他", "Others"),
];
const AIR_TYPES = [option("commercial", "商业航班", "Commercial Flight"), option("private", "私人飞机", "Private Aircraft")];
const ACCOMMODATION_TYPES = [option("hotel", "酒店", "Hotel"), option("residential", "住宅", "Residential"), option("others", "其他", "Others")];
const OTHER_ACCOMMODATION = [option("day_trip", "一日游", "Day Trip"), option("transit", "过境", "Transit")];

const showIf = (expression: string) => ({ showIf: expression });

export const SGAC_FORM_FIELDS: SgacFieldDef[] = [
  { field_name: "arrival_date", label: "Date of Arrival (DD/MM/YYYY)", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 1, validation_rules: rules("抵达日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "full_name", label: "Full Name (In Passport)", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 2, placeholder: "Given Name followed by Surname", validation_rules: rules("护照上的完整姓名", { maxLength: 130, official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 3, validation_rules: rules("护照号码", { maxLength: 20, official: true }) },
  { field_name: "passport_expiry_date", label: "Date of Passport Expiry", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 4, validation_rules: rules("护照到期日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex as indicated in passport", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 5, options: SEX, validation_rules: rules("护照所示性别", { official: true }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 6, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "nationality", label: "Nationality/Citizenship", field_type: "country", required: true, step_number: 1, step_name: "Traveller Information", display_order: 7, validation_rules: rules("国籍 / 公民身份", { source: "ISO3166-1", official: true }) },
  { field_name: "place_of_birth_country", label: "Country/Place of Birth", field_type: "country", required: true, step_number: 1, step_name: "Traveller Information", display_order: 8, validation_rules: rules("出生国家 / 地区", { source: "ISO3166-1", official: true }) },
  { field_name: "place_of_residence", label: "Place of Residence", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 9, placeholder: "Country, state/province, city", validation_rules: rules("居住地", { maxLength: 120, official: true }) },
  { field_name: "email_address", label: "Email Address", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 10, placeholder: "name@example.com", validation_rules: rules("电子邮箱地址", { pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", official: true }) },
  { field_name: "mobile_country_code", label: "Country/Region Code", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 11, placeholder: "e.g. 86", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[0-9]{1,4}$", official: true }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 12, validation_rules: rules("手机号码", { pattern: "^[0-9]{6,15}$", official: true }) },
  { field_name: "has_used_different_name_to_enter_singapore", label: "Have you ever used a passport under a different name to enter Singapore?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 13, options: YES_NO, validation_rules: rules("是否曾使用不同姓名的护照入境新加坡？", { official: true }) },
  { field_name: "has_health_symptoms", label: "Do you currently have fever, cough, shortness of breath, headache, vomiting, dizziness or rash?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 14, options: YES_NO, validation_rules: rules("目前是否有发热、咳嗽、呼吸急促、头痛、呕吐、头晕或皮疹？", { official: true }) },
  { field_name: "recent_country_visit_history", label: "Have you visited countries/places in Africa or Latin America identified for Yellow Fever risk in the six days before arrival?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 15, options: YES_NO, validation_rules: rules("抵达前六天内是否到访黄热病风险国家或地区？", { official: true }) },

  { field_name: "last_city_or_port_before_singapore", label: "Last City/Port of Embarkation Before Singapore", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 1, validation_rules: rules("抵达新加坡前最后登程城市 / 港口", { maxLength: 100, official: true }) },
  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 2, options: PURPOSES, validation_rules: rules("旅行目的", { official: true }) },
  { field_name: "mode_of_travel", label: "Mode of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 3, options: MODES, validation_rules: rules("交通方式", { official: true }) },
  { field_name: "air_transport_type", label: "Type of Air Transport", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 4, options: AIR_TYPES, conditional_logic: showIf("mode_of_travel === air"), validation_rules: rules("航空交通类型", { official: true }) },
  { field_name: "carrier_name", label: "Name of Airline/Vessel/Transport Operator", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 5, conditional_logic: showIf("mode_of_travel === air || mode_of_travel === sea"), validation_rules: rules("航空公司 / 船舶 / 交通运营方名称", { maxLength: 100, official: true }) },
  { field_name: "transport_number", label: "Flight/Vessel/Vehicle Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 6, validation_rules: rules("航班 / 船班 / 车辆号码", { maxLength: 40, official: true }) },
  { field_name: "accommodation_type", label: "Type of Accommodation in Singapore", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 7, options: ACCOMMODATION_TYPES, validation_rules: rules("在新加坡的住宿类型", { official: true }) },
  { field_name: "accommodation_name", label: "Hotel Name", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 8, conditional_logic: showIf("accommodation_type === hotel"), validation_rules: rules("酒店名称", { maxLength: 120, official: true }) },
  { field_name: "accommodation_other_type", label: "Accommodation (Others)", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 9, options: OTHER_ACCOMMODATION, conditional_logic: showIf("accommodation_type === others"), validation_rules: rules("其他住宿类型", { official: true }) },
  { field_name: "accommodation_postcode", label: "Postal Code", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 10, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("邮政编码", { pattern: "^[0-9]{6}$", official: true }) },
  { field_name: "accommodation_block_number", label: "Block/House Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 11, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("门牌 / 楼号", { official: true }) },
  { field_name: "accommodation_street_name", label: "Street Name", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 12, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("街道名称", { official: true }) },
  { field_name: "accommodation_building_name", label: "Building Name", field_type: "text", required: false, step_number: 2, step_name: "Trip Information", display_order: 13, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("建筑名称", { official: true }) },
  { field_name: "accommodation_floor_number", label: "Floor Number", field_type: "text", required: false, step_number: 2, step_name: "Trip Information", display_order: 14, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("楼层", { official: true }) },
  { field_name: "accommodation_unit_number", label: "Unit Number", field_type: "text", required: false, step_number: 2, step_name: "Trip Information", display_order: 15, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("单位号", { official: true }) },
  { field_name: "departure_date", label: "Date of Departure from Singapore", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 16, validation_rules: rules("离开新加坡日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "next_city_or_port_after_singapore", label: "Next City/Port of Disembarkation After Singapore", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 17, validation_rules: rules("离开新加坡后的下一站城市 / 港口", { maxLength: 100, official: true }) },
];

export const SGAC_OFFICIAL_FIELD_NAMES = SGAC_FORM_FIELDS.map((field) => field.field_name);
