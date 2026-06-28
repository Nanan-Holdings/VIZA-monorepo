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
  phEtravelOption("ARRIVAL", "抵达菲律宾", "Arrival"),
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
  phEtravelOption("BUSINESS", "商务", "Business / Professional"),
  phEtravelOption("VISIT_FAMILY", "探亲访友", "Visit Family / Friends"),
  phEtravelOption("TRANSIT", "过境", "Transit"),
  phEtravelOption("MEDICAL", "医疗", "Medical"),
  phEtravelOption("EDUCATION", "教育", "Education"),
  phEtravelOption("OTHERS", "其他", "Others"),
];

export const PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS = [
  phEtravelOption("NINOY AQUINO INTERNATIONAL AIRPORT", "尼诺阿基诺国际机场（马尼拉）", "Ninoy Aquino International Airport"),
  phEtravelOption("MACTAN-CEBU INTERNATIONAL AIRPORT", "麦克坦-宿务国际机场", "Mactan-Cebu International Airport"),
  phEtravelOption("CLARK INTERNATIONAL AIRPORT", "克拉克国际机场", "Clark International Airport"),
  phEtravelOption("DAVAO INTERNATIONAL AIRPORT", "达沃国际机场", "Davao International Airport"),
  phEtravelOption("ILOILO INTERNATIONAL AIRPORT", "伊洛伊洛国际机场", "Iloilo International Airport"),
  phEtravelOption("KALIBO INTERNATIONAL AIRPORT", "卡利博国际机场", "Kalibo International Airport"),
  phEtravelOption("PUERTO PRINCESA INTERNATIONAL AIRPORT", "公主港国际机场", "Puerto Princesa International Airport"),
  phEtravelOption("LAOAG INTERNATIONAL AIRPORT", "拉瓦格国际机场", "Laoag International Airport"),
  phEtravelOption("ZAMBOANGA INTERNATIONAL AIRPORT", "三宝颜国际机场", "Zamboanga International Airport"),
  phEtravelOption("MANILA SOUTH HARBOR", "马尼拉南港", "Manila South Harbor"),
  phEtravelOption("MANILA NORTH HARBOR", "马尼拉北港", "Manila North Harbor"),
  phEtravelOption("CEBU PORT", "宿务港", "Cebu Port"),
];

export const PH_ETRAVEL_YES_NO_OPTIONS = [
  phEtravelOption("yes", "是", "Yes"),
  phEtravelOption("no", "否", "No"),
];
