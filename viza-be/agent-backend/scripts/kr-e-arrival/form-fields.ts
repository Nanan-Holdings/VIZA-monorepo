import {
  KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES,
  KR_E_ARRIVAL_OCCUPATION_OPTIONS,
  KR_E_ARRIVAL_PURPOSE_OPTIONS,
  KR_E_ARRIVAL_SEX_OPTIONS,
  KR_E_ARRIVAL_TRANSPORT_OPTIONS,
  type KrEArrivalOfficialOption,
} from "./official-options";
import { krEArrivalOptionLabelZh } from "./option-labels";

export const KR_E_ARRIVAL_CARD_VISA_TYPE = "KR_E_ARRIVAL_CARD";

export interface KrEArrivalFieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: Array<KrEArrivalOfficialOption>;
  conditional_logic?: Record<string, unknown>;
}

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({ label_zh: labelZh, ...extra });
const showIf = (expression: string) => ({ showIf: expression });
const localize = (kind: "sex" | "transport" | "purpose" | "occupation") =>
  (options: readonly KrEArrivalOfficialOption[]) =>
    options.map((item) => ({ ...item, label_zh: krEArrivalOptionLabelZh(kind, item) }));

const SEX_OPTIONS = localize("sex")(KR_E_ARRIVAL_SEX_OPTIONS);
const TRANSPORT_OPTIONS = localize("transport")(KR_E_ARRIVAL_TRANSPORT_OPTIONS);
const PURPOSE_OPTIONS = localize("purpose")(KR_E_ARRIVAL_PURPOSE_OPTIONS);
const OCCUPATION_OPTIONS = localize("occupation")(KR_E_ARRIVAL_OCCUPATION_OPTIONS);

export const KR_E_ARRIVAL_FORM_FIELDS: KrEArrivalFieldDef[] = [
  { field_name: "surname", label: "Surname", field_type: "text", required: true, step_number: 1, step_name: "Passport and Personal Information", display_order: 1, validation_rules: rules("姓（按护照）", { official: true, maxLength: 80, source: "official_e_arrival_card" }) },
  { field_name: "given_name", label: "Given Name", field_type: "text", required: true, step_number: 1, step_name: "Passport and Personal Information", display_order: 2, validation_rules: rules("名（按护照）", { official: true, maxLength: 80, source: "official_e_arrival_card" }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 1, step_name: "Passport and Personal Information", display_order: 3, validation_rules: rules("出生日期", { official: true, official_control: "date_parts", format: "YYYY-MM-DD" }) },
  {
    field_name: "nationality",
    label: "Nationality",
    field_type: "country",
    required: true,
    step_number: 1,
    step_name: "Passport and Personal Information",
    display_order: 4,
    validation_rules: rules("国籍", { official: true, official_control: "country_search", remote_search: true, dynamic_option_source: KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.nationality, option_identity: "country_code", snapshot: "official-options.snapshot.json#nationality" }),
  },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Passport and Personal Information", display_order: 5, options: SEX_OPTIONS, validation_rules: rules("性别", { official: true, official_control: "native_select", official_key: "sex", option_identity: "value", value_is_official_code: true, label_identity: "official_label", snapshot: "official-options.snapshot.json#sex" }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 1, step_name: "Passport and Personal Information", display_order: 6, validation_rules: rules("护照号码", { official: true, maxLength: 32 }) },
  { field_name: "passport_expiry_date", label: "Passport Expiry Date", field_type: "date", required: true, step_number: 1, step_name: "Passport and Personal Information", display_order: 7, validation_rules: rules("护照有效期至", { official: true, official_control: "date_parts", format: "YYYY-MM-DD" }) },
  { field_name: "dod_id_number", label: "DoD ID Number (if applicable)", field_type: "text", required: false, step_number: 1, step_name: "Passport and Personal Information", display_order: 8, validation_rules: rules("国防部身份证号码（如适用）", { official: true, applicable_to: "USFK/SOFA travellers only", maxLength: 32 }) },
  { field_name: "arrival_mode", label: "Arrival Means", field_type: "radio", required: true, step_number: 2, step_name: "Arrival and Departure", display_order: 1, options: TRANSPORT_OPTIONS, validation_rules: rules("抵达方式", { official: true, official_control: "air_or_sea_buttons", option_identity: "value", value_is_official_code: true }) },
  { field_name: "arrival_date", label: "Date of Arrival", field_type: "date", required: true, step_number: 2, step_name: "Arrival and Departure", display_order: 2, validation_rules: rules("抵达日期", { official: true, official_control: "formatted_date_text", format: "YYYY-MM-DD", timezone: "Asia/Seoul", submission_window: "arrival_date_minus_two_calendar_days_through_arrival_date", valid_for_hours_after_submission: 72 }) },
  { field_name: "arrival_flight_number", label: "Arrival Flight Number", field_type: "text", required: true, step_number: 2, step_name: "Arrival and Departure", display_order: 3, conditional_logic: showIf('arrival_mode === "A"'), validation_rules: rules("抵达航班号", { official: true, official_control: "airline_search", maxLength: 20, dynamic_option_source: KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.flightAndShip, allow_manual_fallback: true }) },
  { field_name: "arrival_ship_name", label: "Arrival Ship Name", field_type: "text", required: true, step_number: 2, step_name: "Arrival and Departure", display_order: 4, conditional_logic: showIf('arrival_mode === "S"'), validation_rules: rules("抵达船名", { official: true, official_control: "ship_name_text", maxLength: 80 }) },
  { field_name: "previous_departure_country", label: "Country of Previous Departure", field_type: "country", required: false, step_number: 2, step_name: "Arrival and Departure", display_order: 5, validation_rules: rules("上一个出发国家 / 地区", { official: true, remote_search: true, dynamic_option_source: KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.nationality, option_identity: "country_code", populated_by_transport_lookup: true, optional_manual_fallback: true }) },
  { field_name: "previous_departure_city", label: "City of Previous Departure", field_type: "text", required: false, step_number: 2, step_name: "Arrival and Departure", display_order: 6, validation_rules: rules("上一个出发城市", { official: true, maxLength: 100, populated_by_transport_lookup: true, optional_manual_fallback: true }) },
  { field_name: "departure_mode", label: "Departure Means", field_type: "radio", required: true, step_number: 2, step_name: "Arrival and Departure", display_order: 7, options: TRANSPORT_OPTIONS, validation_rules: rules("离境方式", { official: true, official_control: "air_or_sea_buttons", option_identity: "value", value_is_official_code: true }) },
  { field_name: "departure_date", label: "Date of Departure", field_type: "date", required: true, step_number: 2, step_name: "Arrival and Departure", display_order: 8, validation_rules: rules("离境日期", { official: true, official_control: "formatted_date_text", format: "YYYY-MM-DD", must_be_on_or_after: "arrival_date" }) },
  { field_name: "departure_flight_number", label: "Departure Flight Number", field_type: "text", required: false, step_number: 2, step_name: "Arrival and Departure", display_order: 9, conditional_logic: showIf('departure_mode === "A"'), validation_rules: rules("离境航班号（选填）", { official: true, official_control: "airline_search", maxLength: 20, dynamic_option_source: KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.flightAndShip, allow_manual_fallback: true }) },
  { field_name: "departure_ship_name", label: "Departure Ship Name", field_type: "text", required: false, step_number: 2, step_name: "Arrival and Departure", display_order: 10, conditional_logic: showIf('departure_mode === "S"'), validation_rules: rules("离境船名（选填）", { official: true, official_control: "ship_name_text", maxLength: 80 }) },
  { field_name: "next_destination_country", label: "Next Destination Country", field_type: "country", required: false, step_number: 2, step_name: "Arrival and Departure", display_order: 11, validation_rules: rules("下一目的国家 / 地区（选填）", { official: true, remote_search: true, dynamic_option_source: KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES.nationality, populated_by_transport_lookup: true, optional_manual_fallback: true }) },
  { field_name: "next_destination_city", label: "Next Destination City", field_type: "text", required: false, step_number: 2, step_name: "Arrival and Departure", display_order: 12, validation_rules: rules("下一目的城市（选填）", { official: true, maxLength: 120, populated_by_transport_lookup: true, optional_manual_fallback: true }) },

  { field_name: "purpose_of_entry", label: "Purpose of Entry", field_type: "select", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 1, options: PURPOSE_OPTIONS, validation_rules: rules("入境目的", { official: true, official_control: "native_select", official_key: "purpose_of_entry", option_identity: "value", value_is_official_code: true, label_identity: "official_label", snapshot: "official-options.snapshot.json#purpose", static_code_snapshot: true }) },
  { field_name: "purpose_other", label: "Other Purpose of Entry", field_type: "text", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 2, conditional_logic: showIf('purpose_of_entry === "99"'), validation_rules: rules("其他入境目的", { official: true, maxLength: 160, required_when: 'purpose_of_entry === "99"' }) },
  { field_name: "occupation", label: "Occupation", field_type: "select", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 3, options: OCCUPATION_OPTIONS, validation_rules: rules("职业", { official: true, official_control: "native_select", official_key: "occupation", option_identity: "value", value_is_official_code: true, label_identity: "official_label", snapshot: "official-options.snapshot.json#occupation", static_code_snapshot: true }) },
  { field_name: "occupation_other", label: "Other Occupation", field_type: "text", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 4, conditional_logic: showIf('occupation === "99"'), validation_rules: rules("其他职业", { official: true, maxLength: 160, required_when: 'occupation === "99"' }) },
  { field_name: "stay_address_search", label: "Search and Select Address in Korea", field_type: "address_lookup", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 5, placeholder: "Search by Korean/English road address or postal code", validation_rules: rules("搜索并选择韩国住宿地址", { official: true, source: "korea_e_arrival_card_address_search", remote_search: true, minimum_query_length: 2, official_control: "address_lookup_popup", derived_fields: ["stay_address_ko", "stay_address_en", "stay_postal_code"] }) },
  { field_name: "stay_address_ko", label: "Address in Korea (Korean)", field_type: "text", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 6, validation_rules: rules("韩国住宿地址（韩文，自动填写）", { official: true, maxLength: 300, address_language: "ko", read_only: true, derived_from: "stay_address_search" }) },
  { field_name: "stay_address_en", label: "Address in Korea (English)", field_type: "text", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 7, validation_rules: rules("韩国住宿地址（英文，自动填写）", { official: true, maxLength: 300, address_language: "en", read_only: true, derived_from: "stay_address_search" }) },
  { field_name: "stay_postal_code", label: "Postal Code in Korea", field_type: "text", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 8, validation_rules: rules("韩国邮政编码（自动填写，5 位数字）", { official: true, pattern: "^[0-9]{5}$", read_only: true, derived_from: "stay_address_search", specific_error_zh: "韩国邮政编码需要 5 位数字。", specific_error_en: "Korean postal code must contain exactly 5 digits." }) },
  { field_name: "stay_address_detail", label: "Detailed Address in Korea (optional)", field_type: "text", required: false, step_number: 3, step_name: "Stay in Korea", display_order: 9, validation_rules: rules("韩国详细地址（房间号等，选填）", { official: true, maxLength: 160, official_control: "detail_address_text" }) },
  { field_name: "stay_contact_phone", label: "Contact Number in Korea", field_type: "text", required: true, step_number: 3, step_name: "Stay in Korea", display_order: 10, validation_rules: rules("韩国联系电话", { official: true, maxLength: 32 }) },

  { field_name: "declaration_confirmed", label: "I declare that the information provided is true and correct.", field_type: "checkbox", required: true, step_number: 4, step_name: "Final Review and Declaration", display_order: 1, validation_rules: rules("我声明所提供的信息真实且正确。", { official: true, final_review: true, bilingual_review: true, boolean_contract: "must_be_true", official_value: "true", official_statement_en: "I declare that the information provided is true and correct." }) },
];

export const KR_E_ARRIVAL_OFFICIAL_FIELD_NAMES = KR_E_ARRIVAL_FORM_FIELDS.map((field) => field.field_name);
