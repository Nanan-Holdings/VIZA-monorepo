import {
  type PhEtravelOption,
  PH_ETRAVEL_AIRLINE_OPTIONS,
  PH_ETRAVEL_AIR_PORT_OPTIONS,
  PH_ETRAVEL_COUNTRY_OPTIONS,
  PH_ETRAVEL_DECLARATION_CHECKLIST,
  PH_ETRAVEL_DEPARTURE_PURPOSE_OPTIONS,
  PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS,
  PH_ETRAVEL_OCCUPATION_OPTIONS,
  PH_ETRAVEL_PASSPORT_HOLDER_OPTIONS,
  PH_ETRAVEL_SEA_PORT_OPTIONS,
  PH_ETRAVEL_SEX_OPTIONS,
  PH_ETRAVEL_SUFFIX_OPTIONS,
  PH_ETRAVEL_TRANSPORT_TYPES,
  PH_ETRAVEL_YES_NO_OPTIONS,
  phEtravelOption,
} from "./official-options";
import type { PhEtravelFieldDef } from "./form-fields";

export const PH_ETRAVEL_DEPARTURE_VISA_TYPE = "PH_ETRAVEL_DEPARTURE_CARD";

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({ label_zh: labelZh, ...extra });
const showIf = (expression: string) => ({ showIf: expression });
const option = (value: string, labelZh: string, labelEn: string): PhEtravelOption =>
  phEtravelOption(value, labelZh, labelEn);

const FOR_WHOM_OPTIONS = [
  option("FOR_ME", "本人（当前用户）", "For me (Current User)"),
  option("FOR_OTHER", "他人（家人）", "For other (Family Member)"),
];
const DEPARTURE_ONLY = [option("DEPARTURE", "离境菲律宾", "DEPARTURE — Leaving the Philippines")];
const PASSENGER_TYPE_OPTIONS = [
  option("AIRCRAFT PASSENGER", "航空旅客", "AIRCRAFT PASSENGER"),
  option("VESSEL PASSENGER", "海运旅客", "VESSEL PASSENGER"),
];
const TRAVEL_TAX_PAYMENT_OPTIONS = [
  option("TICKET PURCHASE", "购票时已支付", "Paid with ticket purchase"),
  option("EXEMPTED", "获豁免", "Exempted"),
  option("DIRECTLY TO TIEZA", "直接向 TIEZA 支付", "Paid directly to TIEZA"),
];
const CURRENCY_TYPE_OPTIONS = [
  option("PHP", "菲律宾比索", "Philippine currency / monetary instruments"),
  option("FOREIGN", "外币", "Foreign currency / monetary instruments"),
  option("BOTH", "两者都有", "Both Philippine and foreign currency"),
];

const IS_AIR = "transport_type === AIR";
const IS_SEA = "transport_type === SEA";
const IS_FILIPINO = "passport_holder_type === FILIPINO";
const NEEDS_RETURN_DATE = "passport_holder_type === FILIPINO && purpose_of_travel in [POV001, POV007]";
const NEEDS_TRAVEL_TAX = "passport_holder_type === FILIPINO && purpose_of_travel !== OFW";
const HAS_GOODS = "has_goods_to_declare === yes";
const HAS_CURRENCY = "has_currency_to_declare === yes";

const CUSTOMS_FIELDS: PhEtravelFieldDef[] = PH_ETRAVEL_DECLARATION_CHECKLIST
  .filter((item) => item.type !== "CURRENCY")
  .map((item, index) => ({
    field_name: `customs_checklist_${item.id}`,
    label: item.description,
    field_type: "radio",
    required: true,
    step_number: 5,
    step_name: "Customs and Currency Declaration",
    display_order: 20 + index,
    options: PH_ETRAVEL_YES_NO_OPTIONS,
    conditional_logic: showIf(HAS_GOODS),
    validation_rules: rules(`海关申报项目 ${item.id}`, {
      official: true,
      official_id: item.id,
      official_type: item.type,
      official_notes: item.notes ?? null,
    }),
  }));

export const PH_ETRAVEL_DEPARTURE_FORM_FIELDS: PhEtravelFieldDef[] = [
  { field_name: "registration_for", label: "Travel Registration", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 1, options: FOR_WHOM_OPTIONS, validation_rules: rules("登记对象", { official: true }) },
  { field_name: "transport_type", label: "Mode of Travel", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 2, options: PH_ETRAVEL_TRANSPORT_TYPES, validation_rules: rules("离境交通方式", { official: true }) },
  { field_name: "travel_type", label: "Travel Type", field_type: "radio", required: true, step_number: 1, step_name: "Travel Registration", display_order: 3, options: DEPARTURE_ONLY, validation_rules: rules("旅行类型", { official: true, defaultValue: "DEPARTURE", locked: true }) },
  { field_name: "data_privacy_agreement", label: "By clicking Continue, you agree to the Data Privacy and Affidavit of Undertaking.", field_type: "checkbox", required: true, step_number: 1, step_name: "Travel Registration", display_order: 4, validation_rules: rules("我同意数据隐私政策与承诺书", { official: true }) },

  { field_name: "profile_photo", label: "Profile Photo", field_type: "file", required: true, step_number: 2, step_name: "Traveller Information", display_order: 1, conditional_logic: showIf(IS_FILIPINO), validation_rules: rules("个人照片", { official: true, document_slot: "applicant_photo", acceptedFileTypes: ["image/jpeg", "image/png"] }) },
  { field_name: "first_name", label: "First Name", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 2, validation_rules: rules("名", { maxLength: 60, official: true, block_group: "passport_name" }) },
  { field_name: "middle_name", label: "Middle Name", field_type: "text", required: false, step_number: 2, step_name: "Traveller Information", display_order: 3, validation_rules: rules("中间名", { maxLength: 60, official: true, block_group: "passport_name" }) },
  { field_name: "last_name", label: "Last Name", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 4, validation_rules: rules("姓", { maxLength: 60, official: true, block_group: "passport_name" }) },
  { field_name: "suffix", label: "Suffix", field_type: "select", required: false, step_number: 2, step_name: "Traveller Information", display_order: 5, options: PH_ETRAVEL_SUFFIX_OPTIONS, validation_rules: rules("姓名后缀", { official: true, block_group: "passport_name" }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 6, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 7, options: PH_ETRAVEL_SEX_OPTIONS, validation_rules: rules("性别", { official: true }) },
  { field_name: "passport_holder_type", label: "Travel Document Holder", field_type: "radio", required: true, step_number: 2, step_name: "Traveller Information", display_order: 8, options: PH_ETRAVEL_PASSPORT_HOLDER_OPTIONS, validation_rules: rules("旅行证件持有人类型", { official: true }) },
  { field_name: "nationality", label: "Citizenship", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 9, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("公民身份", { official: true }) },
  { field_name: "country_of_birth", label: "Country of Birth", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 10, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("出生国家 / 地区", { official: true }) },
  { field_name: "occupation", label: "Occupation", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 11, options: PH_ETRAVEL_OCCUPATION_OPTIONS, validation_rules: rules("职业", { official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 12, validation_rules: rules("护照号码", { maxLength: 20, official: true }) },
  { field_name: "passport_issuing_authority", label: "Passport Issuing Authority", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 13, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("护照签发国家", { official: true }) },
  { field_name: "passport_issue_date", label: "Passport Issued Date", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 14, validation_rules: rules("护照签发日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "passport_expiry_date", label: "Passport Expiry Date", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 15, validation_rules: rules("护照有效期至", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "email", label: "Email Address", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 16, validation_rules: rules("电子邮箱", { format: "email", official: true }) },
  { field_name: "mobile_country_code", label: "Mobile Country Code", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 17, placeholder: "e.g. 63", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[+0-9]{1,5}$", official: true, inline_group: "mobile" }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 18, validation_rules: rules("手机号码", { pattern: "^[0-9]{6,15}$", official: true, inline_group: "mobile" }) },

  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 1, options: PH_ETRAVEL_DEPARTURE_PURPOSE_OPTIONS, validation_rules: rules("离境目的", { official: true }) },
  { field_name: "traveller_type", label: "Traveller Type", field_type: "select", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 2, options: PASSENGER_TYPE_OPTIONS, validation_rules: rules("旅客类型", { official: true }) },
  { field_name: "airline_name", label: "Name of Airline", field_type: "select", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 3, options: PH_ETRAVEL_AIRLINE_OPTIONS, conditional_logic: showIf(IS_AIR), validation_rules: rules("航空公司名称", { official: true }) },
  { field_name: "flight_number", label: "Flight Number", field_type: "select", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 4, options: PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS, conditional_logic: showIf(IS_AIR), validation_rules: rules("航班号", { official: true, dependsOn: "airline_name", official_options_source: "ph_etravel:flight_numbers" }) },
  { field_name: "vessel_name", label: "Name of Vessel", field_type: "text", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 5, conditional_logic: showIf(IS_SEA), validation_rules: rules("船舶名称", { official: true, maxLength: 120 }) },
  { field_name: "departure_airport", label: "Airport of Origin in the Philippines", field_type: "select", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 6, options: PH_ETRAVEL_AIR_PORT_OPTIONS, conditional_logic: showIf(IS_AIR), validation_rules: rules("菲律宾出境机场", { official: true }) },
  { field_name: "departure_seaport", label: "Seaport of Origin in the Philippines", field_type: "select", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 7, options: PH_ETRAVEL_SEA_PORT_OPTIONS, conditional_logic: showIf(IS_SEA), validation_rules: rules("菲律宾出境港口", { official: true }) },
  { field_name: "flight_departure_date", label: "Date of Departure", field_type: "date", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 8, validation_rules: rules("离开菲律宾日期", { format: "YYYY-MM-DD", official: true, inline_group: "departure_dates" }) },
  { field_name: "destination_country", label: "Country of Destination", field_type: "select", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 9, options: PH_ETRAVEL_COUNTRY_OPTIONS, validation_rules: rules("目的国家 / 地区", { official: true }) },
  { field_name: "destination_port", label: "Airport/Seaport of Destination", field_type: "text", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 10, validation_rules: rules("目的机场 / 港口", { official: true, maxLength: 120 }) },
  { field_name: "flight_arrival_date", label: "Date of Arrival at Destination", field_type: "date", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 11, validation_rules: rules("抵达目的地日期", { format: "YYYY-MM-DD", official: true, inline_group: "departure_dates" }) },
  { field_name: "return_date", label: "Expected Return Date to the Philippines", field_type: "date", required: true, step_number: 3, step_name: "Philippine Departure Details", display_order: 12, conditional_logic: showIf(NEEDS_RETURN_DATE), validation_rules: rules("预计返回菲律宾日期", { format: "YYYY-MM-DD", official: true }) },

  { field_name: "travel_tax_payment_type", label: "Travel Tax Details", field_type: "radio", required: true, step_number: 4, step_name: "Philippine Traveller Declarations", display_order: 1, options: TRAVEL_TAX_PAYMENT_OPTIONS, conditional_logic: showIf(NEEDS_TRAVEL_TAX), validation_rules: rules("旅行税缴纳方式", { official: true }) },
  { field_name: "travel_tax_reference_number", label: "Travel Tax Reference Number", field_type: "text", required: true, step_number: 4, step_name: "Philippine Traveller Declarations", display_order: 2, conditional_logic: showIf("travel_tax_payment_type in [EXEMPTED, DIRECTLY TO TIEZA]"), validation_rules: rules("旅行税参考编号", { official: true }) },
  { field_name: "travel_tax_ticket_number", label: "Ticket Number", field_type: "text", required: true, step_number: 4, step_name: "Philippine Traveller Declarations", display_order: 3, conditional_logic: showIf("travel_tax_payment_type in [TICKET PURCHASE]"), validation_rules: rules("机票号码", { official: true }) },
  { field_name: "cfo_registration_number", label: "Commission on Filipinos Overseas Registration Number", field_type: "text", required: true, step_number: 4, step_name: "Philippine Traveller Declarations", display_order: 4, conditional_logic: showIf("passport_holder_type === FILIPINO && purpose_of_travel in [POV014, POV015, POV016]"), validation_rules: rules("菲律宾海外委员会登记编号", { official: true }) },

  { field_name: "customs_information_acknowledgement", label: "I have read and understood the customs and currency declaration information.", field_type: "checkbox", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 1, validation_rules: rules("我已阅读并理解海关及货币申报说明", { official: true }) },
  { field_name: "has_goods_to_declare", label: "Do you have restricted, regulated, prohibited, dutiable, or commercial goods to declare?", field_type: "radio", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 2, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("是否有受限制、受监管、禁止、应税或商业货物需要申报？", { official: true }) },
  ...CUSTOMS_FIELDS,
  { field_name: "has_currency_to_declare", label: "Are you taking currency or monetary instruments above the permitted threshold out of the Philippines?", field_type: "radio", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 40, options: PH_ETRAVEL_YES_NO_OPTIONS, validation_rules: rules("携带出境的货币或货币工具是否超过允许限额？", { official: true }) },
  { field_name: "currency_type", label: "Currency Declaration Type", field_type: "select", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 41, options: CURRENCY_TYPE_OPTIONS, conditional_logic: showIf(HAS_CURRENCY), validation_rules: rules("货币申报类型", { official: true }) },
  { field_name: "currency_amount", label: "Total Amount", field_type: "text", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 42, conditional_logic: showIf(HAS_CURRENCY), validation_rules: rules("申报总额", { official: true, pattern: "^[0-9]+(?:\\.[0-9]{1,2})?$" }) },
  { field_name: "currency_source", label: "Source of Currency", field_type: "text", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 43, conditional_logic: showIf(HAS_CURRENCY), validation_rules: rules("货币来源", { official: true, maxLength: 160 }) },
  { field_name: "bsp_authorization_number", label: "BSP Prior Authorization Number", field_type: "text", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 44, conditional_logic: showIf("has_currency_to_declare === yes && currency_type in [PHP, BOTH]"), validation_rules: rules("菲律宾中央银行事先授权编号", { official: true }) },
  { field_name: "bsp_authorization_date", label: "BSP Authorization Date", field_type: "date", required: true, step_number: 5, step_name: "Customs and Currency Declaration", display_order: 45, conditional_logic: showIf("has_currency_to_declare === yes && currency_type in [PHP, BOTH]"), validation_rules: rules("菲律宾中央银行授权日期", { official: true, format: "YYYY-MM-DD" }) },

  { field_name: "customs_signature_declaration", label: "I certify that this customs and currency declaration is true and correct.", field_type: "checkbox", required: true, step_number: 6, step_name: "Declaration Signature", display_order: 1, validation_rules: rules("我确认海关及货币申报真实准确", { official: true }) },
  { field_name: "final_declaration", label: "I certify that all information provided is true and correct.", field_type: "checkbox", required: true, step_number: 6, step_name: "Declaration Signature", display_order: 2, validation_rules: rules("我确认全部信息真实准确", { official: true }) },
];

export const PH_ETRAVEL_DEPARTURE_OFFICIAL_FIELD_NAMES =
  PH_ETRAVEL_DEPARTURE_FORM_FIELDS.map((field) => field.field_name);
