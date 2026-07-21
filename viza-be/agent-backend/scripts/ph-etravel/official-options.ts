import officialSnapshot from "./official-options.snapshot.json";

export type PhEtravelOption = {
  value: string;
  text: string;
  label_zh: string;
  label_en: string;
  official_label?: string;
};

type OfficialCodeName = { code: string; name: string };
type OfficialChecklistItem = { id: number; type: string; description: string; notes?: string | null };

export function phEtravelOption(
  value: string,
  labelZh: string,
  labelEn: string,
  officialLabel = labelEn,
): PhEtravelOption {
  return { value, text: labelEn, label_zh: labelZh, label_en: labelEn, official_label: officialLabel };
}

const mapped = (
  items: OfficialCodeName[],
  labelsZh: Record<string, string> = {},
  fallbackZh?: (item: OfficialCodeName) => string,
): PhEtravelOption[] =>
  items.map((item) => phEtravelOption(item.code, labelsZh[item.code] ?? fallbackZh?.(item) ?? item.name, item.name));

export const PH_ETRAVEL_TRAVEL_TYPES = [
  phEtravelOption("ARRIVAL", "入境菲律宾", "ARRIVAL — Entering the Philippines"),
  phEtravelOption("DEPARTURE", "离境菲律宾", "DEPARTURE — Leaving the Philippines"),
];

export const PH_ETRAVEL_TRANSPORT_TYPES = [
  phEtravelOption("AIR", "航空", "AIR"),
  phEtravelOption("SEA", "海路", "SEA"),
];

export const PH_ETRAVEL_SEX_OPTIONS = [
  phEtravelOption("MALE", "男", "Male"),
  phEtravelOption("FEMALE", "女", "Female"),
];

export const PH_ETRAVEL_PASSPORT_HOLDER_OPTIONS = [
  phEtravelOption("FILIPINO", "菲律宾护照", "PHILIPPINE PASSPORT"),
  phEtravelOption("FOREIGNER", "外国护照", "FOREIGN PASSPORT"),
];

const PURPOSE_ZH: Record<string, string> = {
  OFW: "海外菲律宾劳工（OFW）", POV001: "度假 / 休闲", POV002: "会议 / 大会", POV003: "教育 / 培训 / 学习",
  POV004: "政府 / 公务", POV005: "健康 / 医疗", POV006: "商务 / 专业活动", POV007: "探亲访友",
  POV008: "工作 / 就业", POV009: "宗教 / 朝圣", POV010: "奖励旅游", POV011: "返回居民", POV012: "过境",
  POV017: "会议", POV018: "展会 / 博览会", POV999: "其他",
};
export const PH_ETRAVEL_PURPOSE_OPTIONS = mapped(officialSnapshot.arrivalPurposes, PURPOSE_ZH);
export const PH_ETRAVEL_DEPARTURE_PURPOSE_OPTIONS = mapped(officialSnapshot.departurePurposes, PURPOSE_ZH);

const OCCUPATION_ZH: Record<string, string> = {
  OCC001: "专业 / 技术 / 行政人员", OCC002: "文员 / 销售", OCC003: "农业", OCC004: "工人 / 劳工",
  OCC005: "军人 / 政府人员", OCC006: "家庭主妇", OCC007: "学生 / 未成年人", OCC008: "退休 / 领取养老金者",
  OCC009: "海员", OCC010: "航空机组", OCC011: "外交人员", OCC012: "演艺人员", OCC013: "家政服务人员",
  OCC014: "无业", OCC015: "商人",
};
export const PH_ETRAVEL_OCCUPATION_OPTIONS = mapped(officialSnapshot.occupations, OCCUPATION_ZH);

const CHINESE_REGION_NAMES = new Intl.DisplayNames(["zh-CN"], { type: "region" });
export const PH_ETRAVEL_COUNTRY_OPTIONS = mapped(
  officialSnapshot.countries,
  {},
  (item) => CHINESE_REGION_NAMES.of(item.code) ?? item.name,
);

export const PH_ETRAVEL_SUFFIX_OPTIONS = [
  phEtravelOption("JR", "Jr.", "Jr."), phEtravelOption("SR", "Sr.", "Sr."),
  phEtravelOption("II", "II", "II"), phEtravelOption("III", "III", "III"), phEtravelOption("IV", "IV", "IV"),
];

export const PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS = [
  phEtravelOption("AIRCRAFT PASSENGER", "航空旅客", "AIRCRAFT PASSENGER"),
  phEtravelOption("FLIGHT CREW", "机组人员", "FLIGHT CREW"),
  phEtravelOption("CRUISE CREW", "邮轮船员", "CRUISE CREW"),
  phEtravelOption("CRUISE PASSENGER", "邮轮旅客", "CRUISE PASSENGER"),
  phEtravelOption("VESSEL CREW", "船员", "VESSEL CREW"),
  phEtravelOption("VESSEL PASSENGER", "海运旅客", "VESSEL PASSENGER"),
];

export const PH_ETRAVEL_DESTINATION_TYPE_OPTIONS = [
  phEtravelOption("RESIDENCE", "住所", "Residence"),
  phEtravelOption("HOTEL", "酒店 / 度假村", "Hotel/Resort"),
  phEtravelOption("TRANSIT", "经机场过境", "Transit Via Airport"),
  phEtravelOption("TRAVEL_PORT", "港口", "Port"),
];

export const PH_ETRAVEL_AIRLINE_OPTIONS = mapped(
  officialSnapshot.airlines,
  {},
  (item) => `${item.name} 航空`,
);
export const PH_ETRAVEL_FLIGHT_NUMBER_OPTIONS: PhEtravelOption[] = [];
const PORT_ZH: Record<string, string> = {
  TP0115: "巴科洛德机场",
  DRP: "比科尔国际机场",
  TP0020: "保和—邦劳国际机场（新保和国际机场）",
  TP127: "卡加延北部国际机场",
  TP007: "卡提克兰机场（MPH）",
  TP001: "克拉克国际机场（CRK）",
  TP002: "达沃国际机场（DVO）",
  TP0112: "桑托斯将军城机场",
  TP003: "伊洛伊洛国际机场（ILO）",
  TP004: "卡利博国际机场（KLO）",
  TP0010: "拉金丁根机场—卡加延德奥罗",
  TP005: "拉瓦格国际机场（LAO）",
  TP006: "麦克坦—宿务国际机场（CEB）",
  TP1000: "尼诺伊·阿基诺国际机场 1 号航站楼（MNL）",
  TP2000: "尼诺伊·阿基诺国际机场 2 号航站楼（MNL）",
  TP3000: "尼诺伊·阿基诺国际机场 3 号航站楼（MNL）",
  NAIA4: "尼诺伊·阿基诺国际机场 4 号航站楼（MNL）",
  TP008: "公主港国际机场（PPS）",
  SFS: "苏比克湾国际机场（SFS）",
  TP0014: "三宝颜国际机场",
};
export const PH_ETRAVEL_AIR_PORT_OPTIONS = mapped(officialSnapshot.airPorts, PORT_ZH);
export const PH_ETRAVEL_PORT_OF_ENTRY_OPTIONS = PH_ETRAVEL_AIR_PORT_OPTIONS;
export const PH_ETRAVEL_SEA_PORT_OPTIONS = mapped(officialSnapshot.seaPorts);
export const PH_ETRAVEL_SICKNESS_SYMPTOM_OPTIONS = mapped(officialSnapshot.sicknessSymptoms);
export const PH_ETRAVEL_DECLARATION_CHECKLIST = officialSnapshot.declarationChecklist as OfficialChecklistItem[];

export const PH_ETRAVEL_YES_NO_OPTIONS = [
  phEtravelOption("yes", "是", "Yes"),
  phEtravelOption("no", "否", "No"),
];
