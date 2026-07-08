import {
  VN_PREARRIVAL_ACCOMMODATION_OPTIONS,
  VN_PREARRIVAL_AIRPORT_OPTIONS,
  VN_PREARRIVAL_BORDER_GATE_OPTIONS,
  VN_PREARRIVAL_FLIGHT_OPTIONS,
  VN_PREARRIVAL_GENDER_OPTIONS,
  VN_PREARRIVAL_PASSPORT_TYPE_OPTIONS,
  VN_PREARRIVAL_PORT_OPTIONS,
  VN_PREARRIVAL_PURPOSE_OPTIONS,
  VN_PREARRIVAL_TRAVEL_MODE_OPTIONS,
  VN_PREARRIVAL_VISA_TYPE_OPTIONS,
  type VnPrearrivalOption,
} from "./official-options";

export const VN_PREARRIVAL_VISA_TYPE = "VN_PREARRIVAL_DECLARATION";

export interface VnPrearrivalFieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: VnPrearrivalOption[];
  conditional_logic?: Record<string, unknown>;
}

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({ label_zh: labelZh, ...extra });
const showIf = (expression: string) => ({ showIf: expression });

export const VN_PREARRIVAL_FORM_FIELDS: VnPrearrivalFieldDef[] = [
  {
    field_name: "expected_arrival_date",
    label: "Expected Arrival Date (DD/MM/YYYY GMT+7)",
    field_type: "date",
    required: true,
    step_number: 1,
    step_name: "Passenger Information",
    display_order: 1,
    validation_rules: rules("预计抵达日期（DD/MM/YYYY GMT+7）", {
      official: true,
      min_date: "today",
      max_days_from_today: 2,
      official_control: "radio_date_window",
    }),
  },
  {
    field_name: "passport_image",
    label: "Passport Image",
    field_type: "file",
    required: false,
    step_number: 1,
    step_name: "Passenger Information",
    display_order: 2,
    validation_rules: rules("护照照片", {
      official: true,
      helper_en: "Upload your passport photo (if available). The information will be updated automatically.",
    }),
  },
  { field_name: "passport_type", label: "Passport Type", field_type: "select", required: true, step_number: 1, step_name: "Passenger Information", display_order: 3, options: VN_PREARRIVAL_PASSPORT_TYPE_OPTIONS, validation_rules: rules("护照类型", { official: true, official_source: "prearrival_category:passport_type" }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 1, step_name: "Passenger Information", display_order: 4, validation_rules: rules("护照号码", { official: true, maxLength: 32 }) },
  { field_name: "passport_expiry_date", label: "Date of Expiry (DD/MM/YYYY)", field_type: "date", required: true, step_number: 1, step_name: "Passenger Information", display_order: 5, validation_rules: rules("护照有效期至（DD/MM/YYYY）", { official: true }) },
  { field_name: "gender", label: "Gender", field_type: "radio", required: true, step_number: 1, step_name: "Passenger Information", display_order: 6, options: VN_PREARRIVAL_GENDER_OPTIONS, validation_rules: rules("性别", { official: true }) },
  { field_name: "surname", label: "Surname", field_type: "text", required: false, step_number: 1, step_name: "Passenger Information", display_order: 7, validation_rules: rules("姓", { official: true, maxLength: 80 }) },
  { field_name: "given_name", label: "Given Name", field_type: "text", required: true, step_number: 1, step_name: "Passenger Information", display_order: 8, validation_rules: rules("名", { official: true, maxLength: 80 }) },
  { field_name: "date_of_birth", label: "Date of Birth (DD/MM/YYYY)", field_type: "date", required: true, step_number: 1, step_name: "Passenger Information", display_order: 9, validation_rules: rules("出生日期（DD/MM/YYYY）", { official: true }) },
  { field_name: "nationality", label: "Nationality", field_type: "country", required: true, step_number: 1, step_name: "Passenger Information", display_order: 10, validation_rules: rules("国籍", { official: true, official_source: "prearrival_category:nationality" }) },
  { field_name: "phone_country_code", label: "Country Code", field_type: "select", required: true, step_number: 1, step_name: "Passenger Information", display_order: 11, validation_rules: rules("电话国家 / 地区代码", { official: true, official_source: "prearrival_category:country_code", remote_search: true }) },
  { field_name: "phone_number", label: "Phone Number", field_type: "text", required: true, step_number: 1, step_name: "Passenger Information", display_order: 12, validation_rules: rules("电话号码", { official: true, pattern: "^[0-9]{6,15}$" }) },
  {
    field_name: "alias_email_address",
    label: "Email Address",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Passenger Information",
    display_order: 13,
    validation_rules: rules("电子邮箱", {
      official: true,
      format: "email",
      use_viza_alias_email: true,
      helper_en: "Use the VIZA-managed alias email so the OTP and official confirmation email can be received and forwarded to the traveller.",
    }),
  },
  {
    field_name: "visa_information_acknowledgement",
    label: "I have read and understood this information.",
    field_type: "checkbox",
    required: true,
    step_number: 1,
    step_name: "Passenger Information",
    display_order: 14,
    validation_rules: rules("我已阅读并理解此信息", { official: true, official_gate: "visa_information" }),
  },
  { field_name: "visa_type", label: "Visa Type / Purpose", field_type: "select", required: true, step_number: 1, step_name: "Passenger Information", display_order: 15, options: VN_PREARRIVAL_VISA_TYPE_OPTIONS, validation_rules: rules("签证类型 / 目的", { official: true, official_source: "prearrival_category:visa_type" }) },
  { field_name: "visa_number", label: "Number", field_type: "text", required: true, step_number: 1, step_name: "Passenger Information", display_order: 16, validation_rules: rules("编号", { official: true, maxLength: 64 }) },
  { field_name: "visa_issue_date", label: "Date of Issue (DD/MM/YYYY)", field_type: "date", required: false, step_number: 1, step_name: "Passenger Information", display_order: 17, validation_rules: rules("签发日期（DD/MM/YYYY）", { official: true }) },
  { field_name: "visa_expiry_date", label: "Date of Expiry (DD/MM/YYYY)", field_type: "date", required: true, step_number: 1, step_name: "Passenger Information", display_order: 18, validation_rules: rules("有效期至（DD/MM/YYYY）", { official: true }) },
  { field_name: "visa_issued_place", label: "Issued Place", field_type: "select", required: false, step_number: 1, step_name: "Passenger Information", display_order: 19, validation_rules: rules("签发地点", { official: true, official_source: "prearrival_category:visa_issue_place", remote_search: true }) },

  { field_name: "departure_country_before_arrival", label: "Departure country before Arrival in Vietnam", field_type: "country", required: true, step_number: 2, step_name: "Trip Information", display_order: 1, validation_rules: rules("抵达越南前出发国家 / 地区", { official: true, helper_en: "First Point of Departure if Transiting Through Multiple country" }) },
  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 2, options: VN_PREARRIVAL_PURPOSE_OPTIONS, validation_rules: rules("旅行目的", { official: true, official_source: "prearrival_category:purpose" }) },
  { field_name: "mode_of_travel", label: "Mode of Travel", field_type: "radio", required: true, step_number: 2, step_name: "Trip Information", display_order: 3, options: VN_PREARRIVAL_TRAVEL_MODE_OPTIONS, validation_rules: rules("旅行方式", { official: true }) },
  {
    field_name: "flight_number",
    label: "Flight Number",
    field_type: "select",
    required: true,
    step_number: 2,
    step_name: "Trip Information",
    display_order: 4,
    options: VN_PREARRIVAL_FLIGHT_OPTIONS,
    conditional_logic: showIf("mode_of_travel === air"),
    validation_rules: rules("航班号", {
      official: true,
      official_source: "prearrival_category:flight",
      remote_search: true,
      derives: { border_gate_airport: "airport" },
    }),
  },
  {
    field_name: "border_gate_airport",
    label: "Border Gate",
    field_type: "select",
    required: true,
    step_number: 2,
    step_name: "Trip Information",
    display_order: 5,
    placeholder: "Select Airport",
    options: VN_PREARRIVAL_AIRPORT_OPTIONS,
    conditional_logic: showIf("mode_of_travel === air"),
    validation_rules: rules("入境机场", {
      official: true,
      official_source: "prearrival_category:airport",
      locked_by: "flight_number",
      read_only: true,
    }),
  },
  { field_name: "vehicle_identification_number", label: "Vehicle identification number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 6, conditional_logic: showIf("mode_of_travel !== air"), validation_rules: rules("交通工具识别编号", { official: true, maxLength: 40 }) },
  { field_name: "land_border_gate", label: "Border Gate", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 7, options: VN_PREARRIVAL_BORDER_GATE_OPTIONS, conditional_logic: showIf("mode_of_travel === land"), validation_rules: rules("陆路口岸", { official: true, official_source: "prearrival_category:border_gate" }) },
  { field_name: "sea_port", label: "Border Gate", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 8, options: VN_PREARRIVAL_PORT_OPTIONS, conditional_logic: showIf("mode_of_travel === sea"), validation_rules: rules("海港口岸", { official: true, official_source: "prearrival_category:port" }) },
  { field_name: "accommodation_type", label: "Type of Accommodation in Vietnam", field_type: "radio", required: true, step_number: 2, step_name: "Trip Information", display_order: 9, options: VN_PREARRIVAL_ACCOMMODATION_OPTIONS, validation_rules: rules("在越南住宿类型", { official: true }) },
  { field_name: "province_city_of_hotel", label: "Province / City of Hotel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 10, validation_rules: rules("酒店所在省 / 市", { official: true, official_source: "prearrival_category:administrative_unit_level1", remote_search: true }) },
  { field_name: "ward_commune_of_hotel", label: "Ward / Commune of Hotel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 11, validation_rules: rules("酒店所在坊 / 社", { official: true, official_source: "prearrival_category:administrative_unit_level2", remote_search: true, depends_on: "province_city_of_hotel" }) },
  { field_name: "accommodation_address", label: "Accommodation Address", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 12, validation_rules: rules("住宿地址", { official: true, official_source: "prearrival_category:hotel", remote_search: true, depends_on: "ward_commune_of_hotel" }) },
  { field_name: "workplace_information", label: "Workplace Information", field_type: "textarea", required: false, step_number: 2, step_name: "Trip Information", display_order: 13, validation_rules: rules("工作单位信息", { official: true, maxLength: 300 }) },
  { field_name: "departure_date_from_vietnam", label: "Date of departure from Vietnam (DD/MM/YYYY GMT+7)", field_type: "date", required: false, step_number: 2, step_name: "Trip Information", display_order: 14, validation_rules: rules("离开越南日期（DD/MM/YYYY GMT+7）", { official: true }) },

  {
    field_name: "final_declaration",
    label: "I confirm that the information is correct.",
    field_type: "checkbox",
    required: true,
    step_number: 3,
    step_name: "Review & Submit",
    display_order: 1,
    validation_rules: rules("我确认信息正确", { official: true }),
  },
];
