import {
  type PhEtravelOption,
  PH_ETRAVEL_AIRLINE_OPTIONS,
  PH_ETRAVEL_DESTINATION_TYPE_OPTIONS,
  PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS,
  PH_ETRAVEL_OCCUPATION_OPTIONS,
  PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS,
  PH_ETRAVEL_PURPOSE_OPTIONS,
  PH_ETRAVEL_SEX_OPTIONS,
  PH_ETRAVEL_SUFFIX_OPTIONS,
  PH_ETRAVEL_TRANSPORT_TYPES,
  PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS,
  PH_ETRAVEL_TRAVEL_TYPES,
  PH_ETRAVEL_YES_NO_OPTIONS,
  phEtravelOption,
} from "./official-options";

export const PH_ETRAVEL_VISA_TYPE = "PH_ETRAVEL_ARRIVAL_CARD";

export interface PhEtravelFieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: PhEtravelOption[];
  conditional_logic?: Record<string, unknown>;
}

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({ label_zh: labelZh, ...extra });
const showIf = (expression: string) => ({ showIf: expression });
const option = (value: string, labelZh: string, labelEn: string) => phEtravelOption(value, labelZh, labelEn);

const FOR_WHOM_OPTIONS = [
  option("FOR_ME", "本人（当前用户）", "For me (Current User)"),
  option("FOR_OTHER", "他人（家人）", "For other (Family Member)"),
];

const CIVIL_STATUS_OPTIONS = [
  option("SINGLE", "未婚", "Single"),
  option("MARRIED", "已婚", "Married"),
  option("WIDOWED", "丧偶", "Widowed"),
  option("DIVORCED", "离婚", "Divorced"),
  option("SEPARATED", "分居", "Separated"),
];

const COUNT_OPTIONS = [
  option("0", "0", "0"),
  option("1", "1", "1"),
  option("2", "2", "2"),
  option("3", "3", "3"),
  option("4", "4", "4"),
  option("5", "5", "5"),
  option("6", "6", "6"),
  option("7", "7", "7"),
  option("8", "8", "8"),
  option("9", "9", "9"),
  option("10", "10 或以上", "10 or more"),
];

const ANY_HEALTH_YES =
  "has_recent_travel_history_30d === yes || has_exposure_to_sick_person_30d === yes || has_been_sick_30d === yes";
const HAS_TRANSIT = "with_transit === yes";
const DESTINATION_RESIDENCE = "destination_type === RESIDENCE";
const DESTINATION_HOTEL = "destination_type === HOTEL_RESORT";
const DESTINATION_TRANSIT = "destination_type === TRANSIT_VIA_AIRPORT";
const HAS_FAMILY = "has_accompanied_family_members === yes";
const FLIGHT_OTHER = "flight_number === OTHER";
const AIRLINE_OTHER = "airline_name === OTHERS";
const HAS_CUSTOMS_DECLARATION = "has_baggage_or_currency_to_declare === yes";

export const PH_ETRAVEL_FORM_FIELDS: PhEtravelFieldDef[] = [
  { field_name: "registration_for", label: "Travel Registration", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 1, options: FOR_WHOM_OPTIONS, validation_rules: rules("登记对象", { official: true }) },
  { field_name: "transport_type", label: "Mode of Travel", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 2, options: PH_ETRAVEL_TRANSPORT_TYPES, validation_rules: rules("交通方式", { official: true }) },
  { field_name: "travel_type", label: "Travel Type", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 3, options: PH_ETRAVEL_TRAVEL_TYPES, validation_rules: rules("旅行类型", { official: true }) },
  { field_name: "is_special_flight", label: "Special Flight", field_type: "checkbox", required: false, step_number: 1, step_name: "Travel Registration", display_order: 4, validation_rules: rules("特殊航班", { official: true }) },
  { field_name: "official_free_acknowledgement", label: "I understand the official eTravel registration is free of charge.", field_type: "checkbox", required: true, step_number: 1, step_name: "Travel Registration", display_order: 5, validation_rules: rules("我理解菲律宾 eTravel 官方登记免费", { official_notice: true }) },

  { field_name: "first_name", label: "First Name", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 1, validation_rules: rules("名", { maxLength: 60, official: true, block_group: "passport_name" }) },
  { field_name: "middle_name", label: "Middle Name", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 2, validation_rules: rules("中间名", { maxLength: 60, official: true, block_group: "passport_name" }) },
  { field_name: "last_name", label: "Last Name", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 3, validation_rules: rules("姓", { maxLength: 60, official: true, block_group: "passport_name" }) },
  { field_name: "suffix", label: "Suffix", field_type: "select", required: false, step_number: 2, step_name: "Traveller Information", display_order: 4, options: PH_ETRAVEL_SUFFIX_OPTIONS, validation_rules: rules("姓名后缀", { official: true, block_group: "passport_name" }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 5, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 6, options: PH_ETRAVEL_SEX_OPTIONS, validation_rules: rules("性别", { official: true }) },
  { field_name: "civil_status", label: "Civil Status", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 7, options: CIVIL_STATUS_OPTIONS, validation_rules: rules("婚姻状况", { official: true }) },
  { field_name: "nationality", label: "Nationality/Citizenship", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 8, validation_rules: rules("国籍 / 公民身份", { official: true }) },
  { field_name: "country_of_birth", label: "Country of Birth", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 9, validation_rules: rules("出生国家 / 地区", { official: true }) },
  { field_name: "occupation", label: "Occupation", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 10, options: PH_ETRAVEL_OCCUPATION_OPTIONS, validation_rules: rules("职业", { official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 11, validation_rules: rules("护照号码", { maxLength: 20, official: true }) },
  { field_name: "passport_issuing_authority", label: "Passport Issuing Authority", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 12, validation_rules: rules("护照签发机关 / 国家", { official: true }) },
  { field_name: "passport_issue_date", label: "Passport Issue Date", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 13, validation_rules: rules("护照签发日期", { format: "YYYY-MM-DD", official: true, inline_group: "passport_dates" }) },
  { field_name: "passport_expiry_date", label: "Passport Expiry Date", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 14, validation_rules: rules("护照有效期至", { format: "YYYY-MM-DD", official: true, inline_group: "passport_dates" }) },
  { field_name: "email_address", label: "Email Address", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 15, placeholder: "name@example.com", validation_rules: rules("电子邮箱", { pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", official: true }) },
  { field_name: "mobile_country_code", label: "Mobile Country Code", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 16, placeholder: "e.g. 86", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[+0-9]{1,5}$", official: true }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 17, validation_rules: rules("手机号码", { pattern: "^[0-9]{6,15}$", official: true }) },
  { field_name: "country_of_residence", label: "Permanent Country of Residence", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 18, validation_rules: rules("永久居住国家 / 地区", { official: true, block_group: "residence_address" }) },
  { field_name: "residence_address_line1", label: "No./Bldg./City/State/Province", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 19, validation_rules: rules("门牌 / 楼宇 / 城市 / 州省", { maxLength: 160, official: true, block_group: "residence_address" }) },
  { field_name: "residence_address_line2", label: "Address Line 2", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 20, validation_rules: rules("地址第二行", { maxLength: 160, official: true, block_group: "residence_address" }) },

  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 1, options: PH_ETRAVEL_PURPOSE_OPTIONS, validation_rules: rules("旅行目的", { official: true }) },
  { field_name: "traveller_type", label: "Traveller Type", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 2, options: PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS, validation_rules: rules("旅客类型", { official: true }) },
  { field_name: "airline_name", label: "Name of Airline", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 3, options: PH_ETRAVEL_AIRLINE_OPTIONS, validation_rules: rules("航空公司名称", { official: true }) },
  { field_name: "airline_name_other", label: "Other Airline Name", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 4, conditional_logic: showIf(AIRLINE_OTHER), validation_rules: rules("其他航空公司名称", { maxLength: 100, official: true }) },
  { field_name: "flight_number", label: "Flight Number", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 5, options: PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS, validation_rules: rules("航班号", { official: true, dependsOn: "airline_name" }) },
  { field_name: "flight_number_other", label: "Other Flight Number", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 6, conditional_logic: showIf(FLIGHT_OTHER), validation_rules: rules("其他航班号", { maxLength: 20, official: true }) },
  { field_name: "origin_country", label: "Country of Origin", field_type: "country", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 7, validation_rules: rules("出发国家 / 地区", { official: true }) },
  { field_name: "airport_of_origin", label: "Airport of Origin", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 8, validation_rules: rules("出发机场", { maxLength: 120, official: true }) },
  { field_name: "flight_departure_date", label: "Date of Departure of Flight", field_type: "date", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 9, validation_rules: rules("入境航班起飞日期", { format: "YYYY-MM-DD", inline_group: "ph_etravel_flight_dates", official: true }) },
  { field_name: "flight_arrival_date", label: "Date of Arrival of Flight", field_type: "date", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 10, validation_rules: rules("入境航班抵达日期", { format: "YYYY-MM-DD", inline_group: "ph_etravel_flight_dates", official: true }) },
  { field_name: "port_of_entry", label: "Airport/Port of Destination in the Philippines", field_type: "select", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 11, options: PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS, validation_rules: rules("菲律宾目的机场 / 入境口岸", { official: true }) },
  { field_name: "with_transit", label: "With Transit (Connecting Flight)?", field_type: "checkbox", required: false, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 12, validation_rules: rules("是否有中转 / 联程航班", { official: true }) },
  { field_name: "transit_country", label: "Country of Transit", field_type: "country", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 13, conditional_logic: showIf(HAS_TRANSIT), validation_rules: rules("中转国家 / 地区", { official: true, block_group: "transit_details" }) },
  { field_name: "transit_airport", label: "Airport of Transit", field_type: "text", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 14, conditional_logic: showIf(HAS_TRANSIT), validation_rules: rules("中转机场", { maxLength: 120, official: true, block_group: "transit_details" }) },
  { field_name: "transit_date", label: "Date of Transit", field_type: "date", required: true, step_number: 3, step_name: "Travel Details - Philippine Arrival", display_order: 15, conditional_logic: showIf(HAS_TRANSIT), validation_rules: rules("中转日期", { format: "YYYY-MM-DD", official: true, block_group: "transit_details" }) },

  { field_name: "destination_type", label: "Destination upon arrival in the Philippines", field_type: "radio", required: true, step_number: 4, step_name: "Destination in the Philippines", display_order: 1, options: PH_ETRAVEL_DESTINATION_TYPE_OPTIONS, validation_rules: rules("抵达菲律宾后的目的地类型", { official: true }) },
  { field_name: "destination_same_as_residence", label: "Same as Permanent Country of Residence", field_type: "checkbox", required: false, step_number: 4, step_name: "Destination in the Philippines", display_order: 2, conditional_logic: showIf(DESTINATION_RESIDENCE), validation_rules: rules("与永久居住地址相同", { official: true }) },
  { field_name: "destination_residence_address", label: "Residence Address", field_type: "textarea", required: true, step_number: 4, step_name: "Destination in the Philippines", display_order: 3, conditional_logic: showIf(DESTINATION_RESIDENCE), validation_rules: rules("菲律宾居住地址", { maxLength: 240, official: true }) },
  { field_name: "destination_hotel_name", label: "Hotel, Resorts, AirBnB, Tourist destinations, etc.", field_type: "text", required: true, step_number: 4, step_name: "Destination in the Philippines", display_order: 4, conditional_logic: showIf(DESTINATION_HOTEL), validation_rules: rules("酒店 / 度假村 / 民宿 / 旅游目的地名称", { maxLength: 160, official: true }) },
  { field_name: "destination_hotel_address", label: "Hotel/Resort Address", field_type: "textarea", required: true, step_number: 4, step_name: "Destination in the Philippines", display_order: 5, conditional_logic: showIf(DESTINATION_HOTEL), validation_rules: rules("酒店 / 度假村地址", { maxLength: 240, official: true }) },
  { field_name: "destination_transit_airport", label: "Airport", field_type: "select", required: true, step_number: 4, step_name: "Destination in the Philippines", display_order: 6, conditional_logic: showIf(DESTINATION_TRANSIT), options: PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS, validation_rules: rules("菲律宾过境机场", { official: true }) },
  { field_name: "destination_country", label: "Country of Destination", field_type: "country", required: true, step_number: 4, step_name: "Destination in the Philippines", display_order: 7, conditional_logic: showIf(DESTINATION_TRANSIT), validation_rules: rules("最终目的国家 / 地区", { official: true }) },

  { field_name: "has_recent_travel_history_30d", label: "Do you have any recent travel history in the last 30 days?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 1, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("过去 30 天是否有近期旅行史？", { official: true }) },
  { field_name: "has_exposure_to_sick_person_30d", label: "Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 2, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("出行前 30 天是否接触过患病或已知患有传染性 / 感染性疾病的人？", { official: true }) },
  { field_name: "has_been_sick_30d", label: "Have you been sick in the past 30 days?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 3, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("过去 30 天是否生病？", { official: true }) },
  { field_name: "health_symptoms_details", label: "Health Declaration Details", field_type: "textarea", required: true, step_number: 5, step_name: "Health Declaration", display_order: 4, conditional_logic: showIf(ANY_HEALTH_YES), validation_rules: rules("健康申报详情", { maxLength: 300, official: true }) },

  { field_name: "has_accompanied_family_members", label: "Accompanied family members?", field_type: "radio", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 1, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否有同行家人？", { official: true }) },
  { field_name: "accompanied_under_18_count", label: "Below 18 yrs. old", field_type: "select", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 2, options: COUNT_OPTIONS, conditional_logic: showIf(HAS_FAMILY), validation_rules: rules("18 岁以下同行家人人数", { official: true, inline_group: "family_counts" }) },
  { field_name: "accompanied_18_plus_count", label: "18 yrs. old and above", field_type: "select", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 3, options: COUNT_OPTIONS, conditional_logic: showIf(HAS_FAMILY), validation_rules: rules("18 岁及以上同行家人人数", { official: true, inline_group: "family_counts" }) },
  { field_name: "family_member_full_name", label: "Family Member - Full Name", field_type: "text", required: true, step_number: 6, step_name: "Family Member(s)", display_order: 4, conditional_logic: showIf(HAS_FAMILY), validation_rules: rules("同行家人姓名", { maxLength: 120, official: true, repeatable: true, repeat_group: "family_members", max_items: 10 }) },
  { field_name: "family_member_relationship", label: "Family Member - Relationship", field_type: "text", required: true, step_number: 6, step_name: "Family Member(s)", display_order: 5, conditional_logic: showIf(HAS_FAMILY), validation_rules: rules("同行家人与申请人关系", { maxLength: 80, official: true, repeatable: true, repeat_group: "family_members" }) },
  { field_name: "family_member_age_group", label: "Family Member - Age Group", field_type: "select", required: true, step_number: 6, step_name: "Family Member(s)", display_order: 6, conditional_logic: showIf(HAS_FAMILY), options: [option("BELOW_18", "18 岁以下", "Below 18 yrs. old"), option("18_AND_ABOVE", "18 岁及以上", "18 yrs. old and above")], validation_rules: rules("同行家人年龄组", { official: true, repeatable: true, repeat_group: "family_members" }) },
  { field_name: "checked_baggage_count", label: "Checked-in (pcs)", field_type: "select", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 7, options: COUNT_OPTIONS, validation_rules: rules("托运行李件数", { official: true, inline_group: "baggage_counts" }) },
  { field_name: "handcarry_baggage_count", label: "Hand-carried (pcs)", field_type: "select", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 8, options: COUNT_OPTIONS, validation_rules: rules("手提行李件数", { official: true, inline_group: "baggage_counts" }) },
  { field_name: "first_time_visiting_philippines", label: "First time visiting Philippines?", field_type: "radio", required: true, step_number: 6, step_name: "Other Travel Details", display_order: 9, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否第一次访问菲律宾？", { official: true }) },

  { field_name: "customs_information_acknowledgement", label: "I confirm that I have read and understood the customs and currency declaration information above.", field_type: "checkbox", required: true, step_number: 7, step_name: "Customs Declaration", display_order: 1, validation_rules: rules("我确认已阅读并理解海关及货币申报说明", { official: true }) },
  { field_name: "has_baggage_or_currency_to_declare", label: "Do you have baggage or currency to declare?", field_type: "radio", required: true, step_number: 7, step_name: "Customs Declaration", display_order: 2, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否有行李或货币需要申报？", { official: true }) },
  { field_name: "has_dutiable_goods", label: "Are you bringing restricted, regulated, prohibited, or dutiable goods?", field_type: "radio", required: true, step_number: 7, step_name: "Customs Declaration", display_order: 3, options: PH_ETRAVEL_YES_NO_OPTIONS, conditional_logic: showIf(HAS_CUSTOMS_DECLARATION), validation_rules: rules("是否携带受限制、受监管、禁止或需纳税物品？", { official: true }) },
  { field_name: "dutiable_goods_details", label: "Goods Declaration Details", field_type: "textarea", required: true, step_number: 7, step_name: "Customs Declaration", display_order: 4, conditional_logic: showIf("has_dutiable_goods === yes"), validation_rules: rules("物品申报详情", { maxLength: 500, official: true }) },
  { field_name: "has_currency_over_threshold", label: "Are you carrying currency or monetary instruments over the Philippine declaration thresholds?", field_type: "radio", required: true, step_number: 7, step_name: "Customs Declaration", display_order: 5, options: PH_ETRAVEL_YES_NO_OPTIONS, conditional_logic: showIf(HAS_CUSTOMS_DECLARATION), validation_rules: rules("是否携带超过菲律宾申报门槛的现金或货币工具？", { official: true }) },
  { field_name: "currency_declaration_details", label: "Currency Declaration Details", field_type: "textarea", required: true, step_number: 7, step_name: "Customs Declaration", display_order: 6, conditional_logic: showIf("has_currency_over_threshold === yes"), validation_rules: rules("货币申报详情", { maxLength: 500, official: true }) },

  { field_name: "customs_signature_file", label: "For Customs - Declaration Signature", field_type: "file", required: true, step_number: 8, step_name: "Declaration Signature", display_order: 1, validation_rules: rules("海关申报电子签名", { official: true, accepted_file_types: ["image/png", "image/jpeg", "application/pdf"], max_size_mb: 5 }) },
  { field_name: "customs_signature_declaration", label: "By clicking Next, I certify under pain of falsification that this declaration is true and correct to the best of my knowledge.", field_type: "checkbox", required: true, step_number: 8, step_name: "Declaration Signature", display_order: 2, validation_rules: rules("我确认本申报真实、正确，且已知虚假申报后果", { official: true }) },
  { field_name: "final_declaration", label: "I certify that the information provided is true and correct.", field_type: "checkbox", required: true, step_number: 8, step_name: "Declaration Signature", display_order: 3, validation_rules: rules("我确认所填信息真实准确", { official: true }) },
];

export const PH_ETRAVEL_OFFICIAL_FIELD_NAMES = PH_ETRAVEL_FORM_FIELDS.map((field) => field.field_name);
