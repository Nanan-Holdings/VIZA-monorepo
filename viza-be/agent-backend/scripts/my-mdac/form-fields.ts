import {
  type MdacOption,
  MY_MDAC_CITIES_BY_STATE,
  MY_MDAC_CITY_OPTIONS,
  MY_MDAC_STATES,
  mdacOption,
} from "./official-options";
import { localizeMdacCityOptionsByState, localizeMdacOptions } from "./option-labels";

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
  options?: MdacOption[];
  conditional_logic?: Record<string, unknown>;
}

const rules = (labelZh: string, extra: Record<string, unknown> = {}) => ({ label_zh: labelZh, ...extra });
const option = (value: string, labelZh: string, labelEn: string) => mdacOption(value, labelZh, labelEn);

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
  mdacOption("01", "酒店 / 汽车旅馆 / 休息屋", "HOTEL/MOTEL/REST HOUSE"),
  mdacOption("02", "亲友住所", "RESIDENCE OF FRIENDS/RELATIVES"),
  mdacOption("99", "其他", "OTHERS"),
];
const LOCALIZED_MY_MDAC_STATES = localizeMdacOptions("state", MY_MDAC_STATES);
const LOCALIZED_MY_MDAC_CITIES_BY_STATE = localizeMdacCityOptionsByState(MY_MDAC_CITIES_BY_STATE);
const LOCALIZED_MY_MDAC_CITY_OPTIONS = localizeMdacOptions("city", MY_MDAC_CITY_OPTIONS);

export const MY_MDAC_FORM_FIELDS: MyMdacFieldDef[] = [
  { field_name: "full_name", label: "Full Name as per Passport", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 1, validation_rules: rules("护照姓名", { official: true }) },
  { field_name: "passport_number", label: "Passport Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 2, validation_rules: rules("护照号码", { official: true }) },
  { field_name: "passport_expiry_date", label: "Passport Expiry Date", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 3, validation_rules: rules("护照有效期至", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "nationality", label: "Nationality/Citizenship", field_type: "country", required: true, step_number: 1, step_name: "Traveller Information", display_order: 4, validation_rules: rules("国籍 / 公民身份", { official: true }) },
  { field_name: "place_of_birth", label: "Place of Birth", field_type: "country", required: true, step_number: 1, step_name: "Traveller Information", display_order: 5, validation_rules: rules("出生地", { official: true }) },
  { field_name: "date_of_birth", label: "Date of Birth", field_type: "date", required: true, step_number: 1, step_name: "Traveller Information", display_order: 6, validation_rules: rules("出生日期", { format: "YYYY-MM-DD", official: true }) },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Traveller Information", display_order: 7, options: SEX, validation_rules: rules("性别", { official: true }) },
  { field_name: "email_address", label: "Email Address", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 8, validation_rules: rules("电子邮箱", { format: "email", official: true }) },
  { field_name: "mobile_country_code", label: "Mobile Country Code", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 9, placeholder: "e.g. 86", validation_rules: rules("手机国家 / 地区代码", { pattern: "^[0-9]{1,4}$", official: true }) },
  { field_name: "mobile_number", label: "Mobile Number", field_type: "text", required: true, step_number: 1, step_name: "Traveller Information", display_order: 10, validation_rules: rules("手机号码", { pattern: "^[0-9]{6,15}$", official: true }) },

  { field_name: "arrival_date", label: "Date of Arrival in Malaysia", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 1, validation_rules: rules("抵达马来西亚日期", { format: "YYYY-MM-DD", min_date: "today", official: true }) },
  { field_name: "departure_date", label: "Date of Departure from Malaysia", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 2, validation_rules: rules("离开马来西亚日期", { format: "YYYY-MM-DD", after_or_equal_field: "arrival_date", official: true }) },
  { field_name: "mode_of_travel", label: "Mode of Travel", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 3, options: MODES, validation_rules: rules("入境马来西亚交通方式", { official: true }) },
  { field_name: "transport_number", label: "Flight / Vehicle / Vessel Number", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 4, validation_rules: rules("航班 / 车辆 / 船舶编号", { official: true }) },
  { field_name: "last_embarkation_country", label: "Country/Region of Last Embarkation Before Malaysia", field_type: "country", required: true, step_number: 2, step_name: "Trip Information", display_order: 5, validation_rules: rules("抵达马来西亚前最后登程国家 / 地区", { official: true }) },
  { field_name: "port_of_entry", label: "Point of Entry", field_type: "text", required: true, step_number: 2, step_name: "Trip Information", display_order: 6, validation_rules: rules("入境口岸", { official: true }) },
  { field_name: "purpose_of_visit", label: "Purpose of Visit", field_type: "select", required: true, step_number: 2, step_name: "Trip Information", display_order: 7, options: PURPOSES, validation_rules: rules("访问目的", { official: true }) },

  { field_name: "accommodation_type", label: "Accommodation of Stay", field_type: "select", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 1, options: ACCOMMODATION_TYPES, validation_rules: rules("住宿类型", { official: true }) },
  { field_name: "address_in_malaysia", label: "Address (In Malaysia)", field_type: "textarea", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 2, validation_rules: rules("马来西亚地址", { official: true }) },
  { field_name: "state", label: "State", field_type: "select", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 3, options: LOCALIZED_MY_MDAC_STATES, validation_rules: rules("州属", { official: true }) },
  {
    field_name: "city",
    label: "City",
    field_type: "select",
    required: true,
    step_number: 3,
    step_name: "Stay in Malaysia",
    display_order: 4,
    options: LOCALIZED_MY_MDAC_CITY_OPTIONS,
    validation_rules: rules("城市", {
      dependent_on: "state",
      dependent_options: LOCALIZED_MY_MDAC_CITIES_BY_STATE,
      official: true,
    }),
  },
  { field_name: "postcode", label: "Postcode", field_type: "text", required: true, step_number: 3, step_name: "Stay in Malaysia", display_order: 5, validation_rules: rules("邮政编码", { official: true }) },
];
