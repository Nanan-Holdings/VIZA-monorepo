export interface KrEArrivalOfficialOption {
  value: string;
  text: string;
  label_en: string;
  label_zh: string;
  official_label: string;
  code?: string;
}

function option(
  value: string,
  labelZh: string,
  officialLabel: string,
  code?: string,
): KrEArrivalOfficialOption {
  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: labelZh,
    official_label: officialLabel,
    ...(code ? { code } : {}),
  };
}

// These short lists are the stable controls observed in the official e-Arrival
// Card guide. Nationality, previous departure, airport/port, and flight/ship
// values are dynamic official data and are intentionally represented by the
// field metadata in form-fields.ts instead of an invented static list.
export const KR_E_ARRIVAL_SEX_OPTIONS = [
  option("F", "女", "Female", "F"),
  option("M", "男", "Male", "M"),
  option("X", "第三性别", "Third gender", "X"),
] as const;

export const KR_E_ARRIVAL_TRANSPORT_OPTIONS = [
  option("Air", "航空", "Air"),
  option("Sea", "海路", "Sea"),
] as const;

export const KR_E_ARRIVAL_PURPOSE_OPTIONS = [
  option("01", "旅游（个人）", "Tourism (individual)", "01"),
  option("02", "旅游（团体）", "Tourism (group)", "02"),
  option("03", "商务", "Business", "03"),
  option("04", "外交 / 公务", "Diplomacy/official duties", "04"),
  option("05", "治疗 / 医疗", "Treatment/Medical care", "05"),
  option("06", "探亲 / 探访亲友", "Visit (Family/relatives/friends, etc.)", "06"),
  option("07", "会议 / 活动", "Meeting/event", "07"),
  option("08", "就业", "Employment", "08"),
  option("09", "学习", "Studies", "09"),
  option("10", "体育比赛", "Sports game", "10"),
  option("99", "其他", "Others", "99"),
] as const;

export const KR_E_ARRIVAL_OCCUPATION_OPTIONS = [
  option("01", "办公室职员", "Office worker", "01"),
  option("02", "个体经营者", "Self-employed", "02"),
  option("03", "学生", "Student", "03"),
  option("04", "无业", "Unemployed", "04"),
  option("05", "家务", "Household activities", "05"),
  option("06", "公务员", "Public official", "06"),
  option("07", "农业和畜牧业", "Agriculture and livestock industry", "07"),
  option("99", "其他", "Others", "99"),
] as const;

export const KR_E_ARRIVAL_DYNAMIC_OPTION_SOURCES = {
  nationality: {
    endpoint: "/portal/apply/srchIbmsNatList.do",
    identity: "country_code",
    snapshot: "official-options.snapshot.json#nationality",
  },
  airports: {
    endpoint: "/portal/apply/srchAptList.do",
    identity: "airport_code",
    snapshot: "official-options.snapshot.json#airports",
  },
  flightAndShip: {
    endpoint: "/portal/apply/srchNavInfo.do",
    identity: "transport_number",
    snapshot: "official-options.snapshot.json#flightAndShip",
  },
  purposeAndOccupation: {
    endpoint: "/portal/apply/getApplyCd.do",
    identity: "code",
    snapshot: "official-options.snapshot.json#staticLists.purpose",
    static_code_snapshot: true,
  },
  additionalQuestions: {
    endpoint: "/portal/apply/srchAddItemList.do",
    identity: "question_code",
    snapshot: "official-options.snapshot.json#additionalQuestions",
    fail_closed_on_snapshot_miss: true,
  },
} as const;

export type KrEArrivalOptionListKind =
  | "sex"
  | "transport"
  | "purpose"
  | "occupation";
