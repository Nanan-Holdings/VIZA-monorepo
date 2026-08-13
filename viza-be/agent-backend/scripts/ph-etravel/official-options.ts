import officialSnapshot from "./official-options.snapshot.json";

export type PhEtravelOption = {
  value: string;
  text: string;
  label_zh: string;
  label_en: string;
  official_label?: string;
  evidence_level?: "official_snapshot" | "verified_public" | "needs_review";
  official_source?: string;
};

export type PhEtravelDynamicOptionSource = {
  endpoint: string;
  query: readonly string[];
  response_identity: string;
  response_label: string;
  response_fields: readonly string[];
  evidence_level: "verified_public" | "needs_review";
  official_source: string;
};

type OfficialCodeName = { code: string; name: string };
type OfficialChecklistItem = { id: number; type: string; description: string; notes?: string | null };

export function phEtravelOption(
  value: string,
  labelZh: string,
  labelEn: string,
  officialLabel = labelEn,
  evidenceLevel: PhEtravelOption["evidence_level"] = "needs_review",
  officialSource?: string,
): PhEtravelOption {
  return {
    value,
    text: labelEn,
    label_zh: labelZh,
    label_en: labelEn,
    official_label: officialLabel,
    evidence_level: evidenceLevel,
    official_source: officialSource,
  };
}

const mapped = (
  items: OfficialCodeName[],
  labelsZh: Record<string, string> = {},
  fallbackZh?: (item: OfficialCodeName) => string,
  evidenceLevel: PhEtravelOption["evidence_level"] = "official_snapshot",
  officialSource = "official-options.snapshot.json",
): PhEtravelOption[] =>
  items.map((item) =>
    phEtravelOption(
      item.code,
      labelsZh[item.code] ?? fallbackZh?.(item) ?? item.name,
      item.name,
      item.name,
      evidenceLevel,
      officialSource,
    ),
  );

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
  POV014: "永久移民或长期居留", POV015: "参加欧洲互惠生项目", POV016: "参加美国交流访问者项目",
  POV017: "会议", POV018: "展会 / 博览会", POV999: "其他",
};
export const PH_ETRAVEL_PURPOSE_OPTIONS = mapped(
  officialSnapshot.arrivalPurposes,
  PURPOSE_ZH,
  undefined,
  "verified_public",
  "E13 official public API /api/v1/common/purpose_of_visits?for_arrival=1 2026-08-04",
);
export const PH_ETRAVEL_DEPARTURE_PURPOSE_OPTIONS = mapped(officialSnapshot.departurePurposes, PURPOSE_ZH);

const OCCUPATION_ZH: Record<string, string> = {
  OCC001: "专业 / 技术 / 行政人员", OCC002: "文员 / 销售", OCC003: "农业", OCC004: "工人 / 劳工",
  OCC005: "军人 / 政府人员", OCC006: "家庭主妇", OCC007: "学生 / 未成年人", OCC008: "退休 / 领取养老金者",
  OCC009: "海员", OCC010: "航空机组", OCC011: "外交人员", OCC012: "演艺人员", OCC013: "家政服务人员",
  OCC014: "无业", OCC015: "商人",
};
export const PH_ETRAVEL_OCCUPATION_OPTIONS = mapped(
  officialSnapshot.occupations,
  OCCUPATION_ZH,
  undefined,
  "verified_public",
  "E13 official public API /api/v1/common/occupations?paginate=0&q=&order_by=name&status_by=asc 2026-08-04",
);

export const PH_ETRAVEL_DYNAMIC_OPTION_SOURCES = {
  countries: {
    endpoint: "/api/v1/common/countries",
    query: ["paginate=0", "q="],
    response_identity: "code",
    response_label: "name_or_nationality_by_control",
    response_fields: ["id", "code", "alpha_3_code", "name", "nationality"],
    evidence_level: "verified_public",
    official_source: "E13 official public API 2026-08-04; 250-row snapshot intentionally not embedded",
  },
  currencies: {
    endpoint: "/api/v1/common/currencies",
    query: ["paginate=0", "q="],
    response_identity: "id",
    response_label: "name",
    response_fields: ["id", "name", "shorten_name", "display_name", "country_id", "is_active"],
    evidence_level: "verified_public",
    official_source: "E13 official public API 2026-08-04; 263-row snapshot intentionally not embedded",
  },
  sea_destination_ports: {
    endpoint: "/api/v1/common/travel_ports",
    query: ["paginate=0", "q=", "order_by=name", "status_by=asc", "transportation_type=SEA"],
    response_identity: "code",
    response_label: "name",
    response_fields: ["id", "transportation_type", "code", "name", "theme", "with_custom_declaration", "is_active"],
    evidence_level: "verified_public",
    official_source: "E13 official public API 2026-08-04; 53-row SEA snapshot intentionally not embedded",
  },
  sea_disembarking_ports: {
    endpoint: "/api/v1/common/travel_ports",
    query: ["paginate=0", "q=", "order_by=name", "status_by=asc"],
    response_identity: "code",
    response_label: "name",
    response_fields: ["id", "transportation_type", "code", "name", "theme", "with_custom_declaration", "is_active"],
    evidence_level: "verified_public",
    official_source: "E14 official public bundle/API 2026-08-04; unfiltered 73-row snapshot intentionally not embedded",
  },
  air_travel_companies: {
    endpoint: "/api/v1/common/travel_companies",
    query: ["transportation_type=AIR"],
    response_identity: "code",
    response_label: "name",
    response_fields: ["code", "name", "transportation_type", "is_active"],
    evidence_level: "verified_public",
    official_source: "E22 official public bundle 2026-08-04; dynamic values intentionally not embedded and response acceptance remains needs_review",
  },
  air_flight_numbers: {
    endpoint: "/api/v1/common/flight_numbers",
    query: ["travel_company_code={selected official code}"],
    response_identity: "flight_number",
    response_label: "flight_number",
    response_fields: ["flight_number", "travel_company_code", "travel_port_code"],
    evidence_level: "verified_public",
    official_source: "E22 official public bundle 2026-08-04; dynamic values and flight-to-port metadata completeness intentionally not embedded",
  },
  hotels: {
    endpoint: "/api/v1/common/hotels",
    query: [],
    response_identity: "no_stable_hotel_code_observed",
    response_label: "name",
    response_fields: ["name", "region_name", "city"],
    evidence_level: "verified_public",
    official_source: "E22 official public bundle 2026-08-04; dynamic values intentionally not embedded and no stable hotel code is proven",
  },
  air_destination_ports: {
    endpoint: "/api/v1/common/travel_ports",
    query: ["transportation_type=AIR"],
    response_identity: "code",
    response_label: "name",
    response_fields: ["code", "name", "transportation_type", "with_custom_declaration", "is_active"],
    evidence_level: "verified_public",
    official_source: "E22 official public bundle 2026-08-04; dynamic values intentionally not embedded; customs metadata is not an AIR customs-flow decision",
  },
  sickness_symptoms: {
    endpoint: "/api/v1/common/sickness_symptoms",
    query: ["order_by=name", "status_by=asc", "is_active=1"],
    response_identity: "code",
    response_label: "name",
    response_fields: ["code", "name", "is_active"],
    evidence_level: "verified_public",
    official_source: "E23 official public bundle 2026-08-04; dynamic values intentionally not embedded and live/server option acceptance remains needs_review",
  },
} as const satisfies Record<string, PhEtravelDynamicOptionSource>;

// Large official response sets must be fetched from the documented source at use time.
export const PH_ETRAVEL_COUNTRY_OPTIONS: PhEtravelOption[] = [];

export const PH_ETRAVEL_SUFFIX_OPTIONS = [
  phEtravelOption("JR", "小（Jr.）", "Jr."), phEtravelOption("SR", "老（Sr.）", "Sr."),
  phEtravelOption("II", "二世（II）", "II"), phEtravelOption("III", "三世（III）", "III"), phEtravelOption("IV", "四世（IV）", "IV"),
];

export const PH_ETRAVEL_AIR_PASSENGER_TRAVELLER_TYPE_OPTIONS = [
  phEtravelOption("AIRCRAFT PASSENGER", "航空旅客", "AIRCRAFT PASSENGER"),
];

export const PH_ETRAVEL_SEA_PASSENGER_TRAVELLER_TYPE_OPTIONS = [
  phEtravelOption("VESSEL PASSENGER", "海运旅客", "VESSEL PASSENGER"),
];

export const PH_ETRAVEL_UNSUPPORTED_ARRIVAL_TRAVELLER_TYPE_OPTIONS = [
  phEtravelOption("FLIGHT CREW", "机组人员", "FLIGHT CREW"),
  phEtravelOption("CRUISE CREW", "邮轮船员", "CRUISE CREW"),
  phEtravelOption("CRUISE PASSENGER", "邮轮旅客", "CRUISE PASSENGER"),
  phEtravelOption("VESSEL CREW", "船员", "VESSEL CREW"),
];

export const PH_ETRAVEL_TRAVELLER_TYPE_OPTIONS = [
  ...PH_ETRAVEL_AIR_PASSENGER_TRAVELLER_TYPE_OPTIONS,
  ...PH_ETRAVEL_SEA_PASSENGER_TRAVELLER_TYPE_OPTIONS,
];

export const PH_ETRAVEL_AIR_DESTINATION_TYPE_OPTIONS = [
  phEtravelOption("RESIDENCE", "住所", "Residence"),
  phEtravelOption("HOTEL", "酒店 / 度假村", "Hotel/Resort"),
  phEtravelOption("TRANSIT", "经机场过境", "Transit Via Airport"),
];

export const PH_ETRAVEL_SEA_DESTINATION_TYPE_OPTIONS = [
  phEtravelOption("RESIDENCE", "住所", "Residence"),
  phEtravelOption("HOTEL", "酒店 / 度假村", "Hotel/Resort"),
  phEtravelOption("TRAVEL_PORT", "港口", "Port"),
];

export const PH_ETRAVEL_DESTINATION_TYPE_OPTIONS = [
  ...PH_ETRAVEL_AIR_DESTINATION_TYPE_OPTIONS,
  PH_ETRAVEL_SEA_DESTINATION_TYPE_OPTIONS[2],
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
export const PH_ETRAVEL_AIR_TRANSIT_PORT_OPTIONS = PH_ETRAVEL_AIR_PORT_OPTIONS.filter((option) =>
  ["TP1000", "TP2000", "TP3000", "TP001"].includes(option.value),
);
export const PH_ETRAVEL_SEA_PORT_OPTIONS: PhEtravelOption[] = [];
export const PH_ETRAVEL_SICKNESS_SYMPTOM_OPTIONS = mapped(officialSnapshot.sicknessSymptoms);
export const PH_ETRAVEL_DECLARATION_CHECKLIST = officialSnapshot.declarationChecklist as OfficialChecklistItem[];

export const PH_ETRAVEL_YES_NO_OPTIONS = [
  phEtravelOption("yes", "是", "Yes"),
  phEtravelOption("no", "否", "No"),
];

// E23 Health radios use boolean client values rather than the declaration
// yes/no string contract above. Server payload parity remains unverified.
export const PH_ETRAVEL_HEALTH_BOOLEAN_OPTIONS = [
  phEtravelOption("true", "是", "Yes", "Yes", "verified_public", "E23 official public bundle 2026-08-04"),
  phEtravelOption("false", "否", "No", "No", "verified_public", "E23 official public bundle 2026-08-04"),
];

export const PH_ETRAVEL_CURRENCY_TYPE_OPTIONS = [
  phEtravelOption("PHP", "菲律宾比索（PHP）", "Philippine Peso"),
  phEtravelOption("USD", "美元 / 等值外币", "US Dollar or foreign currency equivalent"),
];

const MONETARY_INSTRUMENTS_E13: OfficialCodeName[] = [
  { code: "1", name: "CASH" },
  { code: "2", name: "BONDS" },
  { code: "3", name: "COMMERCIAL PAPERS" },
  { code: "4", name: "CONFIRMATION OF SALE/INVESTMENT" },
  { code: "5", name: "COSTUDIAL RECEIPTS" },
  { code: "6", name: "DEPOSIT CERTIFICATES" },
  { code: "7", name: "DEPOSIT SUBSTITUTE INSTRUMENTS" },
  { code: "8", name: "DRAFTS" },
  { code: "9", name: "MONEY ORDERS" },
  { code: "10", name: "NOTES" },
  { code: "11", name: "OTHER CHECKS" },
  { code: "12", name: "SECURITIES" },
  { code: "13", name: "TRADING ORDERS" },
  { code: "14", name: "TRANSACTION TICKETS" },
  { code: "15", name: "TRAVELER'S CHECK" },
  { code: "16", name: "TRUST CERTIFICATES" },
];
const MONETARY_INSTRUMENT_ZH: Record<string, string> = {
  "1": "现金", "2": "债券", "3": "商业票据", "4": "出售 / 投资确认书",
  "5": "托管收据", "6": "存款证明", "7": "存款替代工具", "8": "汇票",
  "9": "汇款单", "10": "票据", "11": "其他支票", "12": "证券",
  "13": "交易指令", "14": "交易票据", "15": "旅行支票", "16": "信托证明",
};
export const PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS = mapped(
  MONETARY_INSTRUMENTS_E13,
  MONETARY_INSTRUMENT_ZH,
  undefined,
  "verified_public",
  "E13 official public API /api/v1/common/monetary_instruments?paginate=0&q= 2026-08-04",
);

export const PH_ETRAVEL_CURRENCY_SOURCE_OPTIONS = [
  phEtravelOption("SALARY", "工资 / 收入", "Salary", "Salary", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
  phEtravelOption("BUSINESS", "业务收入", "Business", "Business", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
  phEtravelOption("OTHER", "其他（请说明）", "Other (Specify)", "Other (Specify)", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
];

export const PH_ETRAVEL_CURRENCY_PURPOSE_OPTIONS = [
  phEtravelOption("LEISURE", "休闲", "Leisure", "Leisure", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
  phEtravelOption("MEDICAL", "医疗", "Medical", "Medical", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
  phEtravelOption("PAYABLES", "应付款", "Payables", "Payables", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
  phEtravelOption("EDUCATION", "教育", "Education", "Education", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
  phEtravelOption("OTHER", "其他（请说明）", "Other (Specify)", "Other (Specify)", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
];

export const PH_ETRAVEL_CURRENCY_TRANSPORT_METHOD_OPTIONS = [
  phEtravelOption("is_physically_transferred_by_person", "由本人或随行人员携带", "If physically transferred by a person", "is_physically_transferred_by_person", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
  phEtravelOption("is_shipped_thru_courier_service", "通过快递 / 货运服务运输", "If shipped through courrier services", "is_shipped_thru_courier_service", "verified_public", "PH-A live logged-in UI 2026-08-01 DOM value"),
];

export const PH_ETRAVEL_FAMILY_COMPANION_GATE_OPTIONS = [
  phEtravelOption("NO_COMPANION_CONFIRMED", "确认没有同行家属", "Yes - no companion", "Yes", "verified_public", "Coordinator live AIR Review evidence 2026-08-01"),
  phEtravelOption("RETURN_TO_SELECT_FAMILY", "返回选择家属", "No - return to family member selection", "No", "verified_public", "Coordinator live AIR Review evidence 2026-08-01"),
];
