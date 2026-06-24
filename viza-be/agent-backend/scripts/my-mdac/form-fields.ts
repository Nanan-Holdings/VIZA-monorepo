export const MY_MDAC_VISA_TYPE = "MY_MDAC_ARRIVAL_CARD";

export interface MyMdacFieldDef {
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
const showIf = (expression: string) => ({ showIf: expression });

const YES_NO = [option("yes", "是", "Yes"), option("no", "否", "No")];
const SEX = [option("male", "男", "Male"), option("female", "女", "Female")];
const MODES = [option("air", "航空", "Air"), option("land", "陆路", "Land"), option("sea", "海路", "Sea")];
const PURPOSES = [
  option("holiday", "度假 / 观光 / 休闲", "Holiday/Sightseeing/Leisure"),
  option("business", "商务", "Business"),
  option("visit_family_or_friends", "探亲访友", "Visit Family/Friends"),
  option("medical", "医疗", "Medical"),
  option("education", "教育", "Education"),
  option("transit", "过境", "Transit"),
  option("others", "其他", "Others"),
];
const ACCOMMODATION_TYPES = [
  option("hotel", "酒店", "Hotel"),
  option("residential", "住宅 / 亲友住址", "Residential"),
  option("others", "其他", "Others"),
];

export const MY_MDAC_FORM_FIELDS: MyMdacFieldDef[] = [
  { field_name: "full_name", label: "Full Name as per Passport", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 1, validation_rules: rules("护照姓名", { official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 2, validation_rules: rules("护照号码", { official: true }) },
  { field_name: "passport_expiry_date", label: "Passport Expiry Date", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 3, validation_rules: rules("护照有效期至", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "nationality", label: "Nationality/Citizenship", field_type: "country", required: true, step_number: 1, step_name: "Traveller Information", display_order: 4, validation_rules: rules("国籍 / 公民身份", { official: true }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 5, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 6, options: SEX, validation_rules: rules("性别", { official: true }) },
  { field_name: "email_address", label: "Email Address", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 7, validation_rules: rules("电子邮箱", { format: "email", official: true }) },
  { field_name: "mobile_country_code", label: "Mobile Country Code", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 8, placeholder: "e.g. 86", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[0-9]{1,4}$", official: true }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 9, validation_rules: rules("手机号码", { pattern: "^[0-9]{6,15}$", official: true }) },

  { field_name: "arrival_date", label: "Date of Arrival in Malaysia", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 1, validation_rules: rules("抵达马来西亚日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "departure_date", label: "Date of Departure from Malaysia", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 2, validation_rules: rules("离开马来西亚日期", { format: "YYYY-MM-DD", mustBeOnOrAfterField: "arrival_date", official: true }) },
  { field_name: "mode_of_travel", label: "Mode of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 3, options: MODES, validation_rules: rules("入境马来西亚交通方式", { official: true }) },
  { field_name: "transport_number", label: "Flight / Vehicle / Vessel Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 4, validation_rules: rules("航班 / 车辆 / 船舶编号", { official: true }) },
  { field_name: "last_embarkation_country", label: "Country/Region of Last Embarkation Before Malaysia", field_type: "country", required: true, step_number: 2, step_name: "Trip Information", display_order: 5, validation_rules: rules("抵达马来西亚前最后登程国家 / 地区", { official: true }) },
  { field_name: "port_of_entry", label: "Point of Entry", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 6, validation_rules: rules("入境口岸", { official: true }) },
  { field_name: "purpose_of_visit", label: "Purpose of Visit", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 7, options: PURPOSES, validation_rules: rules("访问目的", { official: true }) },

  { field_name: "accommodation_type", label: "Type of Accommodation in Malaysia", field_type: "select", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 1, options: ACCOMMODATION_TYPES, validation_rules: rules("在马来西亚住宿类型", { official: true }) },
  { field_name: "accommodation_name", label: "Hotel / Host Name", field_type: "text", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 2, conditional_logic: showIf("accommodation_type === hotel || accommodation_type === residential"), validation_rules: rules("酒店 / 接待人名称", { official: true }) },
  { field_name: "address_in_malaysia", label: "Address in Malaysia", field_type: "textarea", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 3, validation_rules: rules("马来西亚地址", { official: true }) },
  { field_name: "city", label: "City", field_type: "text", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 4, validation_rules: rules("城市", { official: true }) },
  { field_name: "state", label: "State", field_type: "text", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 5, validation_rules: rules("州属", { official: true }) },
  { field_name: "postcode", label: "Postcode", field_type: "text", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 6, validation_rules: rules("邮政编码", { official: true }) },

  { field_name: "mdac_not_visa_acknowledgement", label: "I understand MDAC is not a visa and does not replace visa or entry requirements.", field_type: "checkbox", required: true, step_number: 4, step_name: "Official Submission Checklist", display_order: 1, options: YES_NO, validation_rules: rules("我已知悉 MDAC 不是签证，不能替代签证或入境要求。", { official: true }) },
  { field_name: "mdac_three_day_window_acknowledgement", label: "I understand MDAC should normally be submitted within three days before arrival through the official channel.", field_type: "checkbox", required: true, step_number: 4, step_name: "Official Submission Checklist", display_order: 2, options: YES_NO, validation_rules: rules("我已知悉 MDAC 通常应在抵达前三天内通过官方渠道提交。", { official: true }) },
  { field_name: "final_declaration", label: "I declare that the information prepared here is true, complete, and matches my travel document and itinerary.", field_type: "checkbox", required: true, step_number: 4, step_name: "Official Submission Checklist", display_order: 3, options: YES_NO, validation_rules: rules("我声明以上资料真实、完整，并与旅行证件和行程一致。", { official: true }) },
];
