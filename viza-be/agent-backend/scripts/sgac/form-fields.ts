import {
  SGAC_BIRTH_COUNTRY_OPTIONS,
  SGAC_CARRIER_CODE_OPTIONS,
  SGAC_CITY_OPTIONS,
  SGAC_HOTEL_NAME_OPTIONS,
  SGAC_NATIONALITY_OPTIONS,
  SGAC_PURPOSE_OF_TRAVEL_OPTIONS,
} from "./official-options";
import { sgacOptionLabelZh, type SgacOptionListKind } from "./option-labels";

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
const officialOption = (kind: SgacOptionListKind) => (item: { value: string; labelZh: string; labelEn: string }) =>
  option(item.value, sgacOptionLabelZh(kind, item), item.labelEn);
const YES_NO = [option("yes", "是", "Yes"), option("no", "否", "No")];
const SEX = [option("male", "男", "Male"), option("female", "女", "Female"), option("others", "其他", "Others")];
const MODES = [option("air", "航空", "Air"), option("land", "陆路", "Land"), option("sea", "海路", "Sea")];
const AIR_TYPES = [
  option("commercial", "商业航班", "Commercial Flight"),
  option("private", "私人 / 货运航空 / 其他", "Private/Cargo Airline/Others"),
];
const LAND_TYPES = [
  option("bus", "巴士", "Bus"),
  option("car", "汽车", "Car"),
  option("lorry", "货车", "Lorry"),
  option("motorcycle", "摩托车", "Motorcycle"),
  option("rail", "铁路", "Rail"),
  option("van", "厢式车", "Van"),
];
const SEA_TYPES = [
  option("cruise", "邮轮", "Cruise"),
  option("commercial_vessel", "商业船舶", "Commercial Vessel"),
  option("ferry", "渡轮", "Ferry"),
  option("private_craft", "私人船只", "Private Craft"),
];
const ACCOMMODATION_TYPES = [option("hotel", "酒店", "Hotel"), option("residential", "住宅", "Residential"), option("others", "其他", "Others")];
const OTHER_ACCOMMODATION = [option("day_trip", "一日游", "Day Trip"), option("transit", "过境", "Transit")];
const CRUISE_NAMES = [
  "ADONIA",
  "ADORA MEDITERRANEA",
  "AEGEAN ODYSSEY",
  "AEGEAN PARADISE",
  "AIDAAURA",
  "AIDABELLA",
  "AIDADIVA",
  "AIDALUNA",
  "AIDAMAR",
  "AIDANOVA",
  "AIDAPERLA",
  "AIDAPRIMA",
  "AIDASOL",
  "AIDASTELLA",
  "ANTHEM OF THE SEAS",
  "AZAMARA JOURNEY",
  "AZAMARA QUEST",
  "CELEBRITY MILLENNIUM",
  "DIAMOND PRINCESS",
  "GENTING DREAM",
  "MARINER OF THE SEAS",
  "OVATION OF THE SEAS",
  "QUANTUM OF THE SEAS",
  "RESORTS WORLD ONE",
  "SPECTRUM OF THE SEAS",
  "SUPERSTAR GEMINI",
  "SUPERSTAR VIRGO",
  "VOYAGER OF THE SEAS",
].map((name) => officialOption("cruise")({ value: name, labelZh: name, labelEn: name }));
const CITY_PORTS = SGAC_CITY_OPTIONS.map(officialOption("city"));
const NATIONALITIES = SGAC_NATIONALITY_OPTIONS.map(officialOption("nationality"));
const BIRTH_COUNTRIES = SGAC_BIRTH_COUNTRY_OPTIONS.map(officialOption("country"));
const PURPOSES = SGAC_PURPOSE_OF_TRAVEL_OPTIONS.map(officialOption("purpose"));
const HOTEL_NAMES = SGAC_HOTEL_NAME_OPTIONS.map(officialOption("hotel"));
const CARRIER_CODES = SGAC_CARRIER_CODE_OPTIONS.map((item) => option(item.value, item.labelZh.replace(/^选项：/, ""), item.labelEn));

const showIf = (expression: string) => ({ showIf: expression });

export const SGAC_FORM_FIELDS: SgacFieldDef[] = [
  { field_name: "full_name", label: "Full Name (In Passport)", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 1, placeholder: "Given Name followed by Surname", validation_rules: rules("护照上的完整姓名", { maxLength: 130, official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 2, validation_rules: rules("护照号码", { maxLength: 20, official: true }) },
  { field_name: "passport_expiry_date", label: "Date of Passport Expiry", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 3, validation_rules: rules("护照到期日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex as indicated in passport", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 4, options: SEX, validation_rules: rules("护照所示性别", { official: true }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 5, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "nationality", label: "Nationality/Citizenship", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 6, options: NATIONALITIES, validation_rules: rules("国籍 / 公民身份", { source: "ICA_SGAC_NATCD_3_BYTE", official: true }) },
  { field_name: "place_of_birth_country", label: "Country/Place of Birth", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 7, options: BIRTH_COUNTRIES, validation_rules: rules("出生国家 / 地区", { source: "ICA_SGAC_BIRTH_CTRY", official: true }) },
  { field_name: "place_of_residence", label: "Place of Residence", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 8, options: CITY_PORTS, validation_rules: rules("居住地", { source: "ICA_SGAC_CITY", official: true }) },
  { field_name: "email_address", label: "Email Address", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 9, placeholder: "name@example.com", validation_rules: rules("电子邮箱地址", { pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", official: true }) },
  { field_name: "mobile_country_code", label: "Country/Region Code", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 10, placeholder: "e.g. 86", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[0-9]{1,4}$", official: true }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 11, validation_rules: rules("手机号码", { pattern: "^[0-9]{6,15}$", official: true }) },
  { field_name: "has_used_different_name_to_enter_singapore", label: "Have you ever used a passport under a different name to enter Singapore?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 12, options: YES_NO, validation_rules: rules("是否曾使用不同姓名的护照入境新加坡？", { official: true }) },
  { field_name: "has_health_symptoms", label: "Do you currently have fever, cough, shortness of breath, headache, vomiting, dizziness or rash?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 13, options: YES_NO, validation_rules: rules("目前是否有发热、咳嗽、呼吸急促、头痛、呕吐、头晕或皮疹？", { official: true }) },
  { field_name: "recent_country_visit_history", label: "Have you visited countries/places in Africa or Latin America identified for Yellow Fever risk in the six days before arrival?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 14, options: YES_NO, conditional_logic: showIf("has_health_symptoms === no"), validation_rules: rules("抵达前六天内是否到访黄热病风险国家或地区？", { official: true }) },
  { field_name: "recent_high_risk_region_visit_history", label: "Have you visited Bangladesh, India, Africa, the Middle East or Latin America in the past 21 days prior to your arrival in Singapore?", field_type: "radio", required: true, step_number: 1, step_name: "Traveller Information", display_order: 15, options: YES_NO, conditional_logic: showIf("has_health_symptoms === yes"), validation_rules: rules("抵达新加坡前 21 天内是否到访孟加拉国、印度、非洲、中东或拉丁美洲？", { official: true }) },

  { field_name: "arrival_date", label: "Date of Arrival (DD/MM/YYYY)", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 1, validation_rules: rules("抵达日期", { format: "YYYY-MM-DD", inline_group: "sgac_travel_dates", official: true }) },
  { field_name: "departure_date", label: "Date of Departure from Singapore", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 2, validation_rules: rules("离开新加坡日期", { format: "YYYY-MM-DD", inline_group: "sgac_travel_dates", official: true }) },
  { field_name: "last_city_or_port_before_singapore", label: "Last City/Port of Embarkation Before Singapore", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 3, options: CITY_PORTS, validation_rules: rules("抵达新加坡前最后登程城市 / 港口", { source: "ICA_SGAC_CITY", official: true }) },
  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 4, options: PURPOSES, validation_rules: rules("旅行目的", { official: true }) },
  { field_name: "mode_of_travel", label: "Mode of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 5, options: MODES, validation_rules: rules("交通方式", { official: true }) },
  { field_name: "air_transport_type", label: "Mode of Transport", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 6, options: AIR_TYPES, conditional_logic: showIf("mode_of_travel === air"), validation_rules: rules("航空交通方式", { official: true }) },
  { field_name: "carrier_code", label: "Carrier Code", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 7, options: CARRIER_CODES, conditional_logic: showIf("mode_of_travel === air && air_transport_type === commercial"), validation_rules: rules("航空公司代码", { source: "ICA_SGAC_CARRIER_CD", official: true }) },
  { field_name: "transport_number", label: "Flight Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 8, conditional_logic: showIf("mode_of_travel === air"), validation_rules: rules("航班号", { maxLength: 40, official: true }) },
  { field_name: "carrier_name", label: "Carrier Name/Flight Number", field_type: "text", required: false, step_number: 2, step_name: "Trip Information", display_order: 9, conditional_logic: showIf("mode_of_travel === air && air_transport_type === private"), validation_rules: rules("承运人名称 / 航班号", { maxLength: 100, official: true }) },
  { field_name: "land_transport_type", label: "Mode of Transport", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 10, options: LAND_TYPES, conditional_logic: showIf("mode_of_travel === land"), validation_rules: rules("陆路交通方式", { official: true }) },
  { field_name: "vehicle_number", label: "Vehicle Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 11, conditional_logic: showIf("mode_of_travel === land"), validation_rules: rules("车辆号码", { maxLength: 40, official: true }) },
  { field_name: "sea_transport_type", label: "Mode of Transport", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 12, options: SEA_TYPES, conditional_logic: showIf("mode_of_travel === sea"), validation_rules: rules("海路交通方式", { official: true }) },
  { field_name: "cruise_name", label: "Cruise Name", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 13, options: CRUISE_NAMES, conditional_logic: showIf("mode_of_travel === sea && sea_transport_type === cruise"), validation_rules: rules("邮轮名称", { source: "ICA_SGAC_CRUISE_NAME_AUTOCOMPLETE", official: true }) },
  { field_name: "vessel_name", label: "Vessel Name", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 14, conditional_logic: showIf("mode_of_travel === sea && sea_transport_type !== cruise && sea_transport_type !== _empty"), validation_rules: rules("船舶名称", { maxLength: 100, official: true }) },
  { field_name: "accommodation_type", label: "Type of Accommodation in Singapore", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 15, options: ACCOMMODATION_TYPES, validation_rules: rules("在新加坡的住宿类型", { official: true }) },
  { field_name: "accommodation_name", label: "Hotel Name", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 16, options: HOTEL_NAMES, conditional_logic: showIf("accommodation_type === hotel"), validation_rules: rules("酒店名称", { official: true, source: "ICA_SGAC_HOTEL_NAME_AUTOCOMPLETE" }) },
  { field_name: "accommodation_other_type", label: "Accommodation (Others)", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 17, options: OTHER_ACCOMMODATION, conditional_logic: showIf("accommodation_type === others"), validation_rules: rules("其他住宿类型", { official: true }) },
  { field_name: "accommodation_postcode", label: "Postal Code", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 18, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("邮政编码", { pattern: "^[0-9]{6}$", official: true }) },
  { field_name: "accommodation_block_number", label: "Block Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 19, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("楼号 / 门牌号", { official: true }) },
  { field_name: "accommodation_street_name", label: "Street Name", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 20, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("街道名称", { official: true }) },
  { field_name: "accommodation_building_name", label: "Building Name", field_type: "text", required: false, step_number: 2, step_name: "Trip Information", display_order: 21, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("建筑名称", { official: true }) },
  { field_name: "accommodation_floor_number", label: "Floor Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 22, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("楼层", { allow_does_not_apply: true, official: true }) },
  { field_name: "accommodation_unit_number", label: "Unit Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 23, conditional_logic: showIf("accommodation_type === residential"), validation_rules: rules("单位号", { allow_does_not_apply: true, official: true }) },
  { field_name: "next_city_or_port_after_singapore", label: "Next City/Port of Disembarkation After Singapore", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 24, options: CITY_PORTS, validation_rules: rules("离开新加坡后的下一站城市 / 港口", { source: "ICA_SGAC_CITY", official: true }) },
];

export const SGAC_OFFICIAL_FIELD_NAMES = SGAC_FORM_FIELDS.map((field) => field.field_name);
