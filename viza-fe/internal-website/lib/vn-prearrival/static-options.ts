import type { VisaFormFieldOption } from "@/types/visa-form-fields";
import staticOptions from "./official-static-options.json";

type OfficialOption = {
  code?: unknown;
  value?: unknown;
  vn_value?: unknown;
  en_value?: unknown;
  vietnam_value?: unknown;
  english_value?: unknown;
  cn_value?: unknown;
  name?: unknown;
  airport?: unknown;
  airline?: unknown;
  visa_type?: unknown;
  ward?: unknown;
  province_city?: unknown;
};

const sources = staticOptions.sources as Record<string, OfficialOption[] | undefined>;
const STATIC_OPTIONS_CACHE = new Map<string, VisaFormFieldOption[] | null>();

const PLACE_ZH_OVERRIDES: Record<string, string> = {
  "Abu Dhabi": "阿布扎比",
  Angola: "安哥拉",
  Argentina: "阿根廷",
  Australia: "澳大利亚",
  Austria: "奥地利",
  Algeria: "阿尔及利亚",
  Bangladesh: "孟加拉国",
  Battambang: "马德望",
  Belarus: "白俄罗斯",
  Belgium: "比利时",
  Beijing: "北京",
  Berlin: "柏林",
  Bonn: "波恩",
  Brazil: "巴西",
  Brunei: "文莱",
  "Brunei Darussalam": "文莱",
  Bulgaria: "保加利亚",
  Cambodia: "柬埔寨",
  Canada: "加拿大",
  Geneva: "日内瓦",
  Chile: "智利",
  China: "中国",
  "China (Taiwan)": "中国台湾",
  Cuba: "古巴",
  "Czech Republic": "捷克",
  Denmark: "丹麦",
  Dubai: "迪拜",
  Egypt: "埃及",
  Finland: "芬兰",
  France: "法国",
  Frankfurt: "法兰克福",
  Fukuoka: "福冈",
  Germany: "德国",
  Greece: "希腊",
  Guangzhou: "广州",
  HongKong: "中国香港",
  "Hong Kong": "中国香港",
  Hungary: "匈牙利",
  India: "印度",
  Indonesia: "印度尼西亚",
  Iran: "伊朗",
  Iraq: "伊拉克",
  Israel: "以色列",
  Italy: "意大利",
  Japan: "日本",
  "Khon Kaen": "孔敬",
  Kunming: "昆明",
  Korea: "韩国",
  "Korea (South)": "韩国",
  Kuwait: "科威特",
  Kazakhstan: "哈萨克斯坦",
  Laos: "老挝",
  Lebanon: "黎巴嫩",
  Libya: "利比亚",
  "Luang Prabang": "琅勃拉邦",
  Malaysia: "马来西亚",
  Mexico: "墨西哥",
  Mongolia: "蒙古",
  Morocco: "摩洛哥",
  Mozambique: "莫桑比克",
  Mumbai: "孟买",
  Myanmar: "缅甸",
  Nanning: "南宁",
  "New Delhi": "新德里",
  "New Zealand": "新西兰",
  "North Korea": "朝鲜",
  Netherlands: "荷兰",
  Nigeria: "尼日利亚",
  Norway: "挪威",
  Osaka: "大阪",
  Pakistan: "巴基斯坦",
  Pakse: "巴色",
  Panama: "巴拿马",
  Peru: "秘鲁",
  "Permanent Residence Card": "永久居留卡",
  Perth: "珀斯",
  Philippine: "菲律宾",
  Philippines: "菲律宾",
  "Phnom Penh": "金边",
  "Papua New Guinea": "巴布亚新几内亚",
  Poland: "波兰",
  Portugal: "葡萄牙",
  "Preah Sihanouk": "西哈努克",
  Qatar: "卡塔尔",
  Romania: "罗马尼亚",
  Russia: "俄罗斯",
  "Saudi Arabia": "沙特阿拉伯",
  "San Francisco": "旧金山",
  "Sao Paulo": "圣保罗",
  "Savannakhet": "沙湾拿吉",
  Serbia: "塞尔维亚",
  Shanghai: "上海",
  "Siem Reap": "暹粒",
  Singapore: "新加坡",
  Slovakia: "斯洛伐克",
  "South Africa": "南非",
  "South Korea": "韩国",
  Spain: "西班牙",
  "Sri Lanka": "斯里兰卡",
  Sydney: "悉尼",
  Sweden: "瑞典",
  Switzerland: "瑞士",
  Thailand: "泰国",
  "Thái Lan": "泰国",
  Tanzania: "坦桑尼亚",
  Tokyo: "东京",
  Turkey: "土耳其",
  Ukraine: "乌克兰",
  UAE: "阿联酋",
  "United Kingdom": "英国",
  "United States": "美国",
  "United States of America": "美国",
  USA: "美国",
  Uzbekistan: "乌兹别克斯坦",
  Vientiane: "万象",
  Vietnam: "越南",
  Vladivostok: "符拉迪沃斯托克",
  "Washington D.C.": "华盛顿哥伦比亚特区",
  Yemen: "也门",
};

const AIRPORT_ZH_BY_CODE: Record<string, string> = {
  SGN: "新山一国际机场",
  HAN: "内排国际机场",
  DAD: "岘港国际机场",
  CXR: "金兰国际机场",
  PQC: "富国国际机场",
};

// The official pre-arrival API does not publish Chinese accommodation names or
// addresses. Keep the official Vietnamese value as the submission reference,
// while translating address structure and well-established Vietnamese place
// names for the Chinese column. Commercial property names stay unchanged.
const VIETNAM_ADDRESS_ZH: Record<string, string> = {
  "Bà Rịa - Vũng Tàu": "巴地-头顿",
  "Cẩm An": "锦安",
  "Cẩm Châu": "锦州",
  "Cẩm Hà": "锦河",
  "Cửa Đại": "大门",
  "Đà Nẵng": "岘港",
  "Điện Bàn": "奠盘",
  "Điện Ngọc": "奠玉",
  "Hà Nội": "河内",
  "Hậu Xá": "后舍",
  "Hoi An": "会安",
  "Hội An": "会安",
  "Hòa Vang": "和荣",
  "Khánh Hòa": "庆和",
  "Lý Thường Kiệt": "李常杰",
  "Minh An": "明安",
  "Nguyễn Hoàng": "阮黄",
  "Ngô Quyền": "吴权",
  "Nha Trang": "芽庄",
  "Phú Quốc": "富国",
  "Quảng Nam": "广南",
  "Sơn Phong": "山峰",
  "Tân An": "新安",
  "Thanh Hà": "清河",
  "Thoại Ngọc Hầu": "瑞玉侯",
  "Trần Hưng Đạo": "陈兴道",
  "Trần Nhân Tông": "陈仁宗",
  "Đống Đa": "栋多",
};

function localizeAccommodationAddress(vietnameseAddress: string, englishAddress: string): string {
  const source = vietnameseAddress || englishAddress;
  if (!source) return "";

  const localized = Object.entries(VIETNAM_ADDRESS_ZH)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [official, chinese]) => text.replaceAll(official, chinese), source)
    .replace(/\bPhường\b/gi, "坊")
    .replace(/\bXã\b/gi, "公社")
    .replace(/\bThị trấn\b/gi, "市镇")
    .replace(/\bThành phố\b/gi, "市")
    .replace(/\bTỉnh\b/gi, "省")
    .replace(/\bĐường\b/gi, "路")
    .replace(/\bTổ\s*/gi, "第")
    .replace(/\bKhối\b/gi, "街区")
    .replace(/\bThôn\b/gi, "村")
    .replace(/\bẤp\b/gi, "邑")
    .replace(/第(\d+)\s+/g, "第$1")
    .replace(/街区\s+/g, "街区")
    .replace(/\s*,\s*/g, "，")
    .replace(/\s+/g, " ")
    .trim();

  return localized;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function translatePlaceName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withParen = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
  if (withParen) {
    return `${translatePlaceName(withParen[1])}（${translatePlaceName(withParen[2])}）`;
  }
  return PLACE_ZH_OVERRIDES[trimmed] ?? trimmed;
}

function translateIssuePlace(enValue: string): string {
  if (!enValue) return "";
  if (enValue === "Vietnam Immigration Department - Ministry of Public Security") {
    return "越南出入境管理局 - 公安部";
  }
  if (enValue === "Ministry of Foreign Affairs of Vietnam") {
    return "越南外交部";
  }
  const bonnOffice = enValue.match(/^Bonn Office of the Consulate General of Vietnam \((.+)\)$/);
  if (bonnOffice) return `越南驻波恩总领事馆办公室（${translatePlaceName(bonnOffice[1])}）`;
  const permanentMission = enValue.match(/^Permanent Mission of Vietnam in (.+)$/);
  if (permanentMission) return `越南常驻${translatePlaceName(permanentMission[1])}代表团`;
  const embassy = enValue.match(/^Embassy of Vietnam in (.+)$/);
  if (embassy) return `越南驻${translatePlaceName(embassy[1])}大使馆`;
  const consulate = enValue.match(/^Consulate General of Vietnam in (.+)$/);
  if (consulate) return `越南驻${translatePlaceName(consulate[1])}总领事馆`;
  return translatePlaceName(enValue);
}

function optionFromOfficial(item: OfficialOption, source: string): VisaFormFieldOption | null {
  const code = stringValue(item.code);
  const rawValue = stringValue(item.value);
  const enValue =
    stringValue(item.en_value) ||
    stringValue(item.english_value) ||
    stringValue(item.name) ||
    code ||
    rawValue;
  const zhValue = stringValue(item.cn_value) || stringValue(item.vn_value) || stringValue(item.vietnam_value) || enValue;
  if (!code && !enValue) return null;

  const airport = stringValue(item.airport);
  const airline = stringValue(item.airline);
  const officialLabel = source === "flight" && airport ? `${enValue} - ${airport}` : enValue;
  const value = source === "flight"
    ? code || (airport ? `${enValue}_${airport}` : enValue)
    : code || rawValue || enValue;
  const labelZh = source === "flight"
    ? officialLabel
    : source === "visa_issue_place"
      ? translateIssuePlace(enValue)
      : source === "airport"
        ? (AIRPORT_ZH_BY_CODE[code] ?? (zhValue || enValue))
        : source === "hotel"
          ? localizeAccommodationAddress(stringValue(item.vn_value), enValue)
        : zhValue;

  return {
    value,
    text: officialLabel,
    label_en: officialLabel,
    label_zh: labelZh,
    official_label: officialLabel,
    searchText: `${enValue} ${zhValue} ${labelZh} ${code} ${rawValue}`,
    ...(airport ? { airport } : {}),
    ...(airline ? { airline } : {}),
  };
}

function issuePlaceMatchesVisaType(item: OfficialOption, visaType: string): boolean {
  if (!visaType) return true;
  const visaTypes = stringValue(item.visa_type)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return visaTypes.length === 0 || visaTypes.includes(visaType);
}

export function getVnPrearrivalStaticOptions(source: string, parent = ""): VisaFormFieldOption[] | null {
  const normalizedSource = source.replace(/^prearrival_category:/, "");
  const cacheKey = `${normalizedSource}:${parent}`;
  if (STATIC_OPTIONS_CACHE.has(cacheKey)) return STATIC_OPTIONS_CACHE.get(cacheKey) ?? null;
  if (normalizedSource === "administrative_unit_level1") {
    // Administrative units live server-side so the client never infers them
    // from hotel strings and always receives the full local snapshot.
    STATIC_OPTIONS_CACHE.set(cacheKey, null);
    return null;
  }
  if (normalizedSource === "administrative_unit_level2") {
    STATIC_OPTIONS_CACHE.set(cacheKey, null);
    return null;
  }

  const rawItems = sources[normalizedSource];
  if (!rawItems) {
    STATIC_OPTIONS_CACHE.set(cacheKey, null);
    return null;
  }
  const items = normalizedSource === "visa_issue_place"
    ? rawItems.filter((item) => issuePlaceMatchesVisaType(item, parent))
    : normalizedSource === "hotel" && parent
      ? rawItems.filter((item) => stringValue(item.ward) === parent)
      : rawItems;
  const options = items.map((item) => optionFromOfficial(item, normalizedSource)).filter(Boolean) as VisaFormFieldOption[];
  STATIC_OPTIONS_CACHE.set(cacheKey, options);
  return options;
}
