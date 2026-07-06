import {
  VN_PREARRIVAL_ENTRY_PERMISSION_OPTIONS,
  VN_PREARRIVAL_ENTRY_PORT_OPTIONS,
  VN_PREARRIVAL_PURPOSE_OPTIONS,
  VN_PREARRIVAL_SEX_OPTIONS,
  VN_PREARRIVAL_TRANSPORT_MODE_OPTIONS,
  VN_PREARRIVAL_YES_NO_OPTIONS,
  type VnPrearrivalOption,
  vnPrearrivalOption,
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

const HEALTH_STATUS_OPTIONS = [
  vnPrearrivalOption("inactive", "未启用常态健康申报", "Not routinely required"),
  vnPrearrivalOption("active_guidance_applies", "卫生部已发布适用指引", "Active Ministry of Health guidance applies"),
];

export const VN_PREARRIVAL_FORM_FIELDS: VnPrearrivalFieldDef[] = [
  {
    field_name: "official_free_acknowledgement",
    label: "I understand the official Vietnam Pre-Arrival Information declaration is free of charge.",
    field_type: "checkbox",
    required: true,
    step_number: 1,
    step_name: "Official Notices",
    display_order: 1,
    validation_rules: rules("我理解越南官方入境前申报免费", { official_notice: true }),
  },
  {
    field_name: "prearrival_window_acknowledgement",
    label: "I understand this declaration should be submitted within 72 hours before arrival when required.",
    field_type: "checkbox",
    required: true,
    step_number: 1,
    step_name: "Official Notices",
    display_order: 2,
    validation_rules: rules("我理解该申报通常应在抵达前 72 小时内提交", {
      official_notice: true,
      submission_window_hours: 72,
    }),
  },
  {
    field_name: "health_declaration_status",
    label: "Current Vietnam health declaration status",
    field_type: "select",
    required: true,
    step_number: 1,
    step_name: "Official Notices",
    display_order: 3,
    options: HEALTH_STATUS_OPTIONS,
    validation_rules: rules("当前越南健康申报状态", {
      official_notice: true,
      default: "inactive",
      helper_en:
        "Vietnam health declarations are not routinely mandatory for all travellers as of July 1, 2026; use this only when the Ministry of Health activates guidance.",
      helper_zh:
        "截至 2026-07-01，越南健康申报不是对所有旅客常态强制；仅在卫生部发布特定指引时适用。",
    }),
  },
  {
    field_name: "health_guidance_acknowledgement",
    label: "I understand Vietnam's new health declaration system is not tokhaiyte.vn and should only be used when official Ministry of Health guidance applies.",
    field_type: "checkbox",
    required: true,
    step_number: 1,
    step_name: "Official Notices",
    display_order: 4,
    conditional_logic: showIf("health_declaration_status === active_guidance_applies"),
    validation_rules: rules("我理解越南新的健康申报系统不是 tokhaiyte.vn，且仅在卫生部官方指引适用时使用", {
      official_notice: true,
    }),
  },

  { field_name: "full_name", label: "Full name as shown in passport", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 1, validation_rules: rules("护照姓名", { official: true, maxLength: 120 }) },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 2, step_name: "Traveller Information", display_order: 2, validation_rules: rules("出生日期", { official: true, format: "YYYY-MM-DD" }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 2, step_name: "Traveller Information", display_order: 3, options: VN_PREARRIVAL_SEX_OPTIONS, validation_rules: rules("性别", { official: true }) },
  { field_name: "nationality", label: "Nationality", field_type: "country", required: true, step_number: 2, step_name: "Traveller Information", display_order: 4, validation_rules: rules("国籍", { official: true, source: "ISO3166-1" }) },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 5, validation_rules: rules("电子邮箱", { official: true, format: "email" }) },
  { field_name: "phone_country_code", label: "Phone country code", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 6, placeholder: "e.g. 86", validation_rules: rules("电话国家 / 地区代码", { official: true, pattern: "^[0-9]{1,4}$" }) },
  { field_name: "phone_number", label: "Phone number", field_type: "text", required: true, step_number: 2, step_name: "Traveller Information", display_order: 7, validation_rules: rules("电话号码", { official: true, pattern: "^[0-9]{6,15}$" }) },

  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 3, step_name: "Passport and Entry Permission", display_order: 1, validation_rules: rules("护照号码", { official: true, maxLength: 32 }) },
  { field_name: "passport_issue_date", label: "Passport issue date", field_type: "date", required: true, step_number: 3, step_name: "Passport and Entry Permission", display_order: 2, validation_rules: rules("护照签发日期", { official: true, format: "YYYY-MM-DD" }) },
  { field_name: "passport_expiry_date", label: "Passport expiry date", field_type: "date", required: true, step_number: 3, step_name: "Passport and Entry Permission", display_order: 3, validation_rules: rules("护照有效期至", { official: true, format: "YYYY-MM-DD" }) },
  { field_name: "entry_permission_type", label: "Visa / entry permission type", field_type: "select", required: true, step_number: 3, step_name: "Passport and Entry Permission", display_order: 4, options: VN_PREARRIVAL_ENTRY_PERMISSION_OPTIONS, validation_rules: rules("签证 / 入境许可类型", { official: true }) },
  { field_name: "entry_permission_number", label: "Visa / entry permission number", field_type: "text", required: false, step_number: 3, step_name: "Passport and Entry Permission", display_order: 5, validation_rules: rules("签证 / 入境许可编号", { official: true, maxLength: 64 }) },

  { field_name: "arrival_date", label: "Arrival date in Viet Nam", field_type: "date", required: true, step_number: 4, step_name: "Arrival Information", display_order: 1, validation_rules: rules("抵达越南日期", { official: true, format: "YYYY-MM-DD", min_date: "today", submission_window_hours: 72 }) },
  { field_name: "transport_mode", label: "Mode of transport", field_type: "select", required: true, step_number: 4, step_name: "Arrival Information", display_order: 2, options: VN_PREARRIVAL_TRANSPORT_MODE_OPTIONS, validation_rules: rules("入境交通方式", { official: true }) },
  { field_name: "flight_or_transport_number", label: "Flight / vehicle / vessel number", field_type: "text", required: true, step_number: 4, step_name: "Arrival Information", display_order: 3, validation_rules: rules("航班 / 车辆 / 船舶编号", { official: true, maxLength: 40 }) },
  { field_name: "entry_port", label: "Border gate / airport of entry", field_type: "select", required: true, step_number: 4, step_name: "Arrival Information", display_order: 4, options: VN_PREARRIVAL_ENTRY_PORT_OPTIONS, validation_rules: rules("入境口岸 / 机场", { official: true, current_mandatory_port: "tan_son_nhat_int_airport" }) },
  { field_name: "country_boarded", label: "Country/region of embarkation before Viet Nam", field_type: "country", required: true, step_number: 4, step_name: "Arrival Information", display_order: 5, validation_rules: rules("抵达越南前登程国家 / 地区", { official: true, source: "ISO3166-1" }) },
  { field_name: "purpose_of_entry", label: "Purpose of entry", field_type: "select", required: true, step_number: 4, step_name: "Arrival Information", display_order: 6, options: VN_PREARRIVAL_PURPOSE_OPTIONS, validation_rules: rules("入境目的", { official: true }) },
  { field_name: "purpose_of_entry_other", label: "Other purpose, please specify", field_type: "text", required: true, step_number: 4, step_name: "Arrival Information", display_order: 7, conditional_logic: showIf("purpose_of_entry === other"), validation_rules: rules("其他入境目的说明", { official: true, maxLength: 120 }) },

  { field_name: "address_in_vietnam", label: "Address in Viet Nam", field_type: "textarea", required: true, step_number: 5, step_name: "Stay in Viet Nam", display_order: 1, validation_rules: rules("越南停留地址", { official: true, maxLength: 300 }) },
  { field_name: "province_city", label: "Province/city in Viet Nam", field_type: "text", required: true, step_number: 5, step_name: "Stay in Viet Nam", display_order: 2, validation_rules: rules("越南省 / 市", { official: true }) },
  { field_name: "ward_commune", label: "Ward/commune in Viet Nam", field_type: "text", required: false, step_number: 5, step_name: "Stay in Viet Nam", display_order: 3, validation_rules: rules("越南坊 / 社", { official: true }) },
  { field_name: "contact_in_vietnam_name", label: "Contact / accommodation name in Viet Nam", field_type: "text", required: false, step_number: 5, step_name: "Stay in Viet Nam", display_order: 4, validation_rules: rules("越南联系人 / 住宿名称", { official: true, maxLength: 160 }) },
  { field_name: "contact_in_vietnam_phone", label: "Contact phone in Viet Nam", field_type: "text", required: false, step_number: 5, step_name: "Stay in Viet Nam", display_order: 5, validation_rules: rules("越南联系电话", { official: true, maxLength: 40 }) },

  { field_name: "is_group_submission", label: "Is this a group / family submission?", field_type: "radio", required: true, step_number: 6, step_name: "Declaration", display_order: 1, options: VN_PREARRIVAL_YES_NO_OPTIONS, validation_rules: rules("是否为团体 / 家庭申报？", { official: true, v1_supported_value: "no" }) },
  { field_name: "final_declaration", label: "I certify that the information provided is true, accurate, and complete.", field_type: "checkbox", required: true, step_number: 6, step_name: "Declaration", display_order: 2, validation_rules: rules("我确认所填信息真实、准确、完整", { official: true }) },
];
