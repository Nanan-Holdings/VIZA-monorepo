export const TH_TDAC_VISA_TYPE = "TH_TDAC_ARRIVAL_CARD";

export interface ThTdacFieldDef {
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
  option("meeting", "会议", "Meeting"),
  option("education", "教育", "Education"),
  option("medical", "医疗", "Medical"),
  option("employment", "就业", "Employment"),
  option("transit", "过境", "Transit"),
  option("others", "其他", "Others"),
];
const ACCOMMODATION_TYPES = [
  option("hotel", "酒店", "Hotel"),
  option("friend_or_relative", "亲友住址", "Friend/Relative's Residence"),
  option("apartment", "公寓 / 住宅", "Apartment/Residence"),
  option("others", "其他", "Others"),
];

export const TH_TDAC_FORM_FIELDS: ThTdacFieldDef[] = [
  { field_name: "full_name", label: "Full Name as per Passport", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 1, validation_rules: rules("护照姓名", { official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 2, validation_rules: rules("护照号码", { official: true }) },
  { field_name: "nationality", label: "Nationality/Citizenship", field_type: "country", required: true, step_number: 1, step_name: "Traveller Information", display_order: 3, validation_rules: rules("国籍 / 公民身份", { official: true }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 4, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 5, options: SEX, validation_rules: rules("性别", { official: true }) },
  { field_name: "occupation", label: "Occupation", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 6, validation_rules: rules("职业", { official: true }) },
  { field_name: "email_address", label: "Email Address", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 7, validation_rules: rules("电子邮箱", { format: "email", official: true }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 8, validation_rules: rules("手机号码", { official: true }) },

  { field_name: "arrival_date", label: "Date of Arrival in Thailand", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 1, validation_rules: rules("抵达泰国日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "departure_date", label: "Date of Departure from Thailand", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 2, validation_rules: rules("离开泰国日期", { format: "YYYY-MM-DD", mustBeOnOrAfterField: "arrival_date", official: true }) },
  { field_name: "purpose_of_travel", label: "Purpose of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 3, options: PURPOSES, validation_rules: rules("旅行目的", { official: true }) },
  { field_name: "mode_of_travel", label: "Mode of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 4, options: MODES, validation_rules: rules("入境泰国交通方式", { official: true }) },
  { field_name: "flight_number", label: "Flight Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 5, conditional_logic: showIf("mode_of_travel === air"), validation_rules: rules("航班号", { official: true }) },
  { field_name: "vehicle_or_vessel_number", label: "Vehicle / Vessel Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 6, conditional_logic: showIf("mode_of_travel === land || mode_of_travel === sea"), validation_rules: rules("车辆 / 船舶编号", { official: true }) },
  { field_name: "country_boarded", label: "Country/Region Where You Boarded", field_type: "country", required: true, step_number: 2, step_name: "Trip Information", display_order: 7, validation_rules: rules("出发登程国家 / 地区", { official: true }) },
  { field_name: "port_of_arrival", label: "Port of Arrival", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 8, validation_rules: rules("抵达口岸", { official: true }) },

  { field_name: "accommodation_type", label: "Accommodation Type in Thailand", field_type: "select", required: true, step_number: 3, step_name: "Stay in Thailand", display_order: 1, options: ACCOMMODATION_TYPES, validation_rules: rules("在泰国住宿类型", { official: true }) },
  { field_name: "address_in_thailand", label: "Address in Thailand", field_type: "textarea", required: true, step_number: 3, step_name: "Stay in Thailand", display_order: 2, validation_rules: rules("泰国地址", { official: true }) },
  { field_name: "province", label: "Province", field_type: "text", required: true, step_number: 3, step_name: "Stay in Thailand", display_order: 3, validation_rules: rules("府 / 省", { official: true }) },
  { field_name: "district", label: "District", field_type: "text", required: true, step_number: 3, step_name: "Stay in Thailand", display_order: 4, validation_rules: rules("县 / 区", { official: true }) },
  { field_name: "subdistrict", label: "Subdistrict", field_type: "text", required: false, step_number: 3, step_name: "Stay in Thailand", display_order: 5, validation_rules: rules("分区 / 镇", { official: true }) },
  { field_name: "postcode", label: "Postcode", field_type: "text", required: false, step_number: 3, step_name: "Stay in Thailand", display_order: 6, validation_rules: rules("邮政编码", { official: true }) },

  { field_name: "countries_visited_last_14_days", label: "Countries/Regions Visited Within 14 Days Before Arrival", field_type: "textarea", required: true, step_number: 4, step_name: "Health Declaration", display_order: 1, validation_rules: rules("抵达前 14 天内到访国家 / 地区", { official: true }) },
  { field_name: "has_health_symptoms", label: "Do you currently have symptoms to declare?", field_type: "radio", required: true, step_number: 4, step_name: "Health Declaration", display_order: 2, options: YES_NO, validation_rules: rules("目前是否有需要申报的健康症状？", { official: true }) },

  { field_name: "tdac_not_visa_acknowledgement", label: "I understand TDAC is not a visa and does not replace visa or entry requirements.", field_type: "checkbox", required: true, step_number: 5, step_name: "Official Submission Checklist", display_order: 1, options: YES_NO, validation_rules: rules("我已知悉 TDAC 不是签证，不能替代签证或入境要求。", { official: true }) },
  { field_name: "tdac_three_day_window_acknowledgement", label: "I understand TDAC should normally be submitted within three days before arrival through the official channel.", field_type: "checkbox", required: true, step_number: 5, step_name: "Official Submission Checklist", display_order: 2, options: YES_NO, validation_rules: rules("我已知悉 TDAC 通常应在抵达前三天内通过官方渠道提交。", { official: true }) },
  { field_name: "final_declaration", label: "I declare that the information prepared here is true, complete, and matches my travel document and itinerary.", field_type: "checkbox", required: true, step_number: 5, step_name: "Official Submission Checklist", display_order: 3, options: YES_NO, validation_rules: rules("我声明以上资料真实、完整，并与旅行证件和行程一致。", { official: true }) },
];
