import {
  type PhEtravelOption,
  PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS,
  PH_ETRAVEL_PURPOSE_OPTIONS,
  PH_ETRAVEL_SEX_OPTIONS,
  PH_ETRAVEL_TRANSPORT_TYPES,
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

const CIVIL_STATUS_OPTIONS = [
  option("SINGLE", "未婚", "Single"),
  option("MARRIED", "已婚", "Married"),
  option("WIDOWED", "丧偶", "Widowed"),
  option("DIVORCED", "离婚", "Divorced"),
  option("SEPARATED", "分居", "Separated"),
];

const BAGGAGE_COUNT_OPTIONS = [
  option("0", "0 件", "0"),
  option("1", "1 件", "1"),
  option("2", "2 件", "2"),
  option("3", "3 件", "3"),
  option("4", "4 件", "4"),
  option("5", "5 件或以上", "5 or more"),
];

export const PH_ETRAVEL_FORM_FIELDS: PhEtravelFieldDef[] = [
  { field_name: "travel_type", label: "Travel Type", field_type: "select", required: true, step_number: 1, step_name: "eTravel Scope", display_order: 1, options: PH_ETRAVEL_TRAVEL_TYPES, validation_rules: rules("旅行类型", { official: true }) },
  { field_name: "transport_type", label: "Transportation Type", field_type: "select", required: true, step_number: 1, step_name: "eTravel Scope", display_order: 2, options: PH_ETRAVEL_TRANSPORT_TYPES, validation_rules: rules("交通方式", { official: true }) },
  { field_name: "official_free_acknowledgement", label: "I understand the official eTravel registration is free of charge.", field_type: "checkbox", required: true, step_number: 1, step_name: "eTravel Scope", display_order: 3, validation_rules: rules("我理解菲律宾 eTravel 官方登记免费", { official_notice: true }) },

  { field_name: "full_name", label: "Full Name as per Passport", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 1, validation_rules: rules("护照姓名", { maxLength: 130, official: true }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 2, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 3, options: PH_ETRAVEL_SEX_OPTIONS, validation_rules: rules("性别", { official: true }) },
  { field_name: "civil_status", label: "Civil Status", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 4, options: CIVIL_STATUS_OPTIONS, validation_rules: rules("婚姻状况", { official: true }) },
  { field_name: "nationality", label: "Nationality/Citizenship", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 5, validation_rules: rules("国籍 / 公民身份", { official: true }) },
  { field_name: "country_of_birth", label: "Country of Birth", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 6, validation_rules: rules("出生国家 / 地区", { official: true }) },
  { field_name: "country_of_residence", label: "Country of Residence", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 7, validation_rules: rules("居住国家 / 地区", { official: true }) },
  { field_name: "occupation", label: "Occupation", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 8, validation_rules: rules("职业", { maxLength: 80, official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 9, validation_rules: rules("护照号码", { maxLength: 20, official: true }) },
  { field_name: "passport_expiry_date", label: "Passport Expiry Date", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 10, validation_rules: rules("护照有效期至", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "email_address", label: "Email Address", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 11, placeholder: "name@example.com", validation_rules: rules("电子邮箱", { pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", official: true }) },
  { field_name: "mobile_country_code", label: "Mobile Country Code", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 12, placeholder: "e.g. 86", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[0-9]{1,4}$", official: true }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 13, validation_rules: rules("手机号码", { pattern: "^[0-9]{6,15}$", official: true }) },

  { field_name: "arrival_date", label: "Date of Arrival in the Philippines", field_type: "date", required: true, step_number: 3, step_name: "Trip Information", display_order: 1, validation_rules: rules("抵达菲律宾日期", { format: "YYYY-MM-DD", inline_group: "ph_etravel_dates", official: true }) },
  { field_name: "departure_date", label: "Date of Departure from the Philippines", field_type: "date", required: true, step_number: 3, step_name: "Trip Information", display_order: 2, validation_rules: rules("离开菲律宾日期", { format: "YYYY-MM-DD", inline_group: "ph_etravel_dates", official: true }) },
  { field_name: "origin_country", label: "Country/Region of Origin", field_type: "country", required: true, step_number: 3, step_name: "Trip Information", display_order: 3, validation_rules: rules("出发国家 / 地区", { official: true }) },
  { field_name: "port_of_entry", label: "Port of Entry", field_type: "select", required: true, step_number: 3, step_name: "Trip Information", display_order: 4, options: PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS, validation_rules: rules("入境口岸", { official: true }) },
  { field_name: "flight_number", label: "Flight / Voyage Number", field_type: "text", required: true, step_number: 3, step_name: "Trip Information", display_order: 5, placeholder: "e.g. PR101", validation_rules: rules("航班 / 航次编号", { maxLength: 40, official: true }) },
  { field_name: "airline_or_vessel_name", label: "Airline / Vessel Name", field_type: "text", required: false, step_number: 3, step_name: "Trip Information", display_order: 6, validation_rules: rules("航空公司 / 船名", { maxLength: 100, official: true }) },
  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 3, step_name: "Trip Information", display_order: 7, options: PH_ETRAVEL_PURPOSE_OPTIONS, validation_rules: rules("旅行目的", { official: true }) },
  { field_name: "philippines_address", label: "Hotel / Address in the Philippines", field_type: "textarea", required: true, step_number: 3, step_name: "Trip Information", display_order: 8, validation_rules: rules("菲律宾住宿 / 地址", { maxLength: 200, official: true }) },

  { field_name: "has_health_symptoms", label: "Have you been sick in the past 30 days or exposed to a person with communicable disease?", field_type: "radio", required: true, step_number: 4, step_name: "Health Declaration", display_order: 1, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("过去 30 天是否生病或接触传染病患者？", { official: true }) },
  { field_name: "health_symptoms_details", label: "Health Declaration Details", field_type: "textarea", required: true, step_number: 4, step_name: "Health Declaration", display_order: 2, conditional_logic: showIf("has_health_symptoms === yes"), validation_rules: rules("健康申报详情", { maxLength: 300, official: true }) },

  { field_name: "has_checked_baggage", label: "Do you have checked baggage?", field_type: "radio", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 1, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否有托运行李？", { official: true }) },
  { field_name: "checked_baggage_count", label: "Number of Checked Baggage", field_type: "select", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 2, options: BAGGAGE_COUNT_OPTIONS, conditional_logic: showIf("has_checked_baggage === yes"), validation_rules: rules("托运行李件数", { official: true }) },
  { field_name: "has_handcarry_baggage", label: "Do you have hand-carried baggage?", field_type: "radio", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 3, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否有手提行李？", { official: true }) },
  { field_name: "handcarry_baggage_count", label: "Number of Hand-Carried Baggage", field_type: "select", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 4, options: BAGGAGE_COUNT_OPTIONS, conditional_logic: showIf("has_handcarry_baggage === yes"), validation_rules: rules("手提行李件数", { official: true }) },
  { field_name: "has_dutiable_goods", label: "Are you bringing restricted, regulated, prohibited, or dutiable goods?", field_type: "radio", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 5, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否携带受限制、受监管、禁止或需纳税物品？", { official: true }) },
  { field_name: "dutiable_goods_details", label: "Goods Declaration Details", field_type: "textarea", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 6, conditional_logic: showIf("has_dutiable_goods === yes"), validation_rules: rules("物品申报详情", { maxLength: 500, official: true }) },
  { field_name: "has_currency_over_threshold", label: "Are you carrying currency or monetary instruments over the Philippine declaration thresholds?", field_type: "radio", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 7, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否携带超过菲律宾申报门槛的现金或货币工具？", { official: true }) },
  { field_name: "currency_declaration_details", label: "Currency Declaration Details", field_type: "textarea", required: true, step_number: 5, step_name: "Customs Declaration", display_order: 8, conditional_logic: showIf("has_currency_over_threshold === yes"), validation_rules: rules("货币申报详情", { maxLength: 500, official: true }) },

  { field_name: "final_declaration", label: "I certify that the information provided is true and correct.", field_type: "checkbox", required: true, step_number: 6, step_name: "Declaration", display_order: 1, validation_rules: rules("我确认所填信息真实准确", { official: true }) },
];

export const PH_ETRAVEL_OFFICIAL_FIELD_NAMES = PH_ETRAVEL_FORM_FIELDS.map((field) => field.field_name);
