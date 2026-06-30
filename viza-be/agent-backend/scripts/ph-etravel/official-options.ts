export type PhEtravelOption = {
  value: string;
  text: string;
  label_zh: string;
  label_en: string;
  official_label?: string;
};

export function phEtravelOption(
  value: string,
  labelZh: string,
  labelEn: string,
  officialLabel = labelEn,
): PhEtravelOption {
  return {
    value,
    text: labelEn,
    label_zh: labelZh,
    label_en: labelEn,
    official_label: officialLabel,
  };
}

export const PH_ETRAVEL_TRAVEL_TYPES = [
  phEtravelOption("ARRIVAL", "入境菲律宾", "Arrival"),
  phEtravelOption("DEPARTURE", "离境菲律宾", "Departure"),
];

export const PH_ETRAVEL_TRANSPORT_TYPES = [
  phEtravelOption("AIR", "航空", "Air"),
  phEtravelOption("SEA", "海路", "Sea"),
];

export const PH_ETRAVEL_SEX_OPTIONS = [
  phEtravelOption("MALE", "男", "Male"),
  phEtravelOption("FEMALE", "女", "Female"),
];

export const PH_ETRAVEL_PURPOSE_OPTIONS = [
  phEtravelOption("HOLIDAY", "度假 / 观光", "Holiday / Vacation"),
  phEtravelOption("BUSINESS", "商务 / 专业活动", "Business / Professional"),
  phEtravelOption("VISIT_FRIENDS_RELATIVES", "探亲访友", "Visit Friends / Relatives"),
  phEtravelOption("TRANSIT", "过境", "Transit"),
  phEtravelOption("RETURNING_RESIDENT", "返回菲律宾居住", "Returning Resident"),
  phEtravelOption("TRADE_FAIR_EXHIBITION", "展会 / 博览会", "Trade Fair / Exhibition"),
  phEtravelOption("MEDICAL", "医疗", "Medical"),
  phEtravelOption("EDUCATION", "教育", "Education"),
  phEtravelOption("OTHERS", "其他", "Others"),
];

export const PH_ETRAVEL_OCCUPATION_OPTIONS = [
  phEtravelOption("BUSINESSMAN", "商人", "Businessman"),
  phEtravelOption("CLERICAL_SALES", "文员 / 销售", "Clerical/Sales"),
  phEtravelOption("DIPLOMAT", "外交人员", "Diplomat"),
  phEtravelOption("DOMESTIC_HELPER", "家政服务人员", "Domestic Helper"),
  phEtravelOption("ENTERTAINER", "演艺人员", "Entertainer"),
  phEtravelOption("MILITARY_GOVERNMENT", "军人 / 政府人员", "Military/Government"),
  phEtravelOption("PROFESSIONAL_TECHNICAL_ADMIN", "专业 / 技术 / 行政人员", "Professional/Technical/Administrative"),
  phEtravelOption("RETIRED", "退休", "Retired"),
  phEtravelOption("SEAMAN", "海员", "Seaman"),
  phEtravelOption("STUDENT_MINOR", "学生 / 未成年人", "Student/Minor"),
  phEtravelOption("WORKER_LABORER", "工人 / 劳工", "Worker/Laborer"),
  phEtravelOption("OTHERS", "其他", "Others"),
];

export const PH_ETRAVEL_SUFFIX_OPTIONS = [
  phEtravelOption("JR", "Jr.", "Jr."),
  phEtravelOption("SR", "Sr.", "Sr."),
  phEtravelOption("II", "II", "II"),
  phEtravelOption("III", "III", "III"),
  phEtravelOption("IV", "IV", "IV"),
];

export const PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS = [
  phEtravelOption("AIRCRAFT_PASSENGER", "航空旅客", "Aircraft Passenger"),
  phEtravelOption("FLIGHT_CREW", "机组人员", "Flight Crew"),
];

export const PH_ETRAVEL_DESTINATION_TYPE_OPTIONS = [
  phEtravelOption("RESIDENCE", "住所", "Residence"),
  phEtravelOption("HOTEL_RESORT", "酒店 / 度假村", "Hotel/Resort"),
  phEtravelOption("TRANSIT_VIA_AIRPORT", "经机场过境", "Transit Via Airport"),
];

export const PH_ETRAVEL_AIRLINE_OPTIONS = [
  phEtravelOption("PHILIPPINE_AIRLINES", "菲律宾航空", "Philippine Airlines"),
  phEtravelOption("CEBU_PACIFIC", "宿务太平洋航空", "Cebu Pacific"),
  phEtravelOption("AIRASIA", "亚洲航空", "AirAsia"),
  phEtravelOption("SINGAPORE_AIRLINES", "新加坡航空", "Singapore Airlines"),
  phEtravelOption("SCOOT", "酷航", "Scoot"),
  phEtravelOption("SKYJET_AIRLINES", "Skyjet 航空", "Skyjet Airlines"),
  phEtravelOption("SHENZHEN_AIRLINES", "深圳航空", "Shenzhen Airlines"),
  phEtravelOption("SEAIR_INTERNATIONAL_INC", "SEAIR 国际航空", "SEAIR INTERNATIONAL INC."),
  phEtravelOption("OTHERS", "其他航空公司", "Others"),
];

export const PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS = [
  phEtravelOption("MF8657", "MF8657", "MF8657"),
  phEtravelOption("MF8658", "MF8658", "MF8658"),
  phEtravelOption("MF8659", "MF8659", "MF8659"),
  phEtravelOption("MF8660", "MF8660", "MF8660"),
  phEtravelOption("MF8695", "MF8695", "MF8695"),
  phEtravelOption("OTHER", "其他 / 手动填写", "Other / manual entry"),
];

export const PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS = [
  phEtravelOption("NINOY AQUINO INTERNATIONAL AIRPORT", "尼诺伊·阿基诺国际机场（马尼拉）", "Ninoy Aquino International Airport"),
  phEtravelOption("MACTAN-CEBU INTERNATIONAL AIRPORT", "麦克坦-宿务国际机场", "Mactan-Cebu International Airport"),
  phEtravelOption("CLARK INTERNATIONAL AIRPORT", "克拉克国际机场", "Clark International Airport"),
  phEtravelOption("DAVAO INTERNATIONAL AIRPORT", "达沃国际机场", "Davao International Airport"),
  phEtravelOption("ILOILO INTERNATIONAL AIRPORT", "伊洛伊洛国际机场", "Iloilo International Airport"),
  phEtravelOption("KALIBO INTERNATIONAL AIRPORT", "卡利博国际机场", "Kalibo International Airport"),
  phEtravelOption("PUERTO PRINCESA INTERNATIONAL AIRPORT", "公主港国际机场", "Puerto Princesa International Airport"),
  phEtravelOption("LAOAG INTERNATIONAL AIRPORT", "佬沃国际机场", "Laoag International Airport"),
  phEtravelOption("ZAMBOANGA INTERNATIONAL AIRPORT", "三宝颜国际机场", "Zamboanga International Airport"),
  phEtravelOption("MANILA SOUTH HARBOR", "马尼拉南港", "Manila South Harbor"),
  phEtravelOption("MANILA NORTH HARBOR", "马尼拉北港", "Manila North Harbor"),
  phEtravelOption("CEBU PORT", "宿务港", "Cebu Port"),
];

export const PH_ETRAVEL_YES_NO_OPTIONS = [
  phEtravelOption("yes", "是", "Yes"),
  phEtravelOption("no", "否", "No"),
];
