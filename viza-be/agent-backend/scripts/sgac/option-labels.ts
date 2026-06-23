import type { SgacOfficialOption } from "./official-options";

export type SgacOptionListKind = "city" | "country" | "nationality" | "purpose" | "literal";

const COUNTRY_ZH_OVERRIDES: Record<string, string> = {
  ANTIGUA: "安提瓜",
  BERMUDA: "百慕大",
  "BRITISH INDIAN OCEAN TERRITORY": "英属印度洋领地",
  "BRITISH VIRGIN ISLANDS": "英属维尔京群岛",
  CAMBODIA: "柬埔寨",
  "CAPE VERDE": "佛得角",
  "CAROLINE ISLANDS": "加罗林群岛",
  "CAYMAN ISLANDS": "开曼群岛",
  CROATIA: "克罗地亚",
  CURACAO: "库拉索",
  "DPR OF KOREA": "朝鲜",
  ESTONIA: "爱沙尼亚",
  ESWATINI: "斯威士兰",
  "FAEROE ISLANDS": "法罗群岛",
  "FALKLAND ISLANDS": "福克兰群岛",
  "FEDERATED STATES OF MICRONESIA": "密克罗尼西亚联邦",
  "FRENCH GUIANA": "法属圭亚那",
  "FRENCH POLYNESIA": "法属波利尼西亚",
  GEORGIA: "格鲁吉亚",
  GIBRALTAR: "直布罗陀",
  GREENLAND: "格陵兰",
  GUADELOUPE: "瓜德罗普",
  GUERNSEY: "根西岛",
  "ISLE OF MAN": "马恩岛",
  JERSEY: "泽西岛",
  "JOHNSTON ISLAND": "约翰斯顿岛",
  KOSOVO: "科索沃",
  KYRGYZSTAN: "吉尔吉斯斯坦",
  "LEEWARD ISLANDS": "背风群岛",
  LITHUANIA: "立陶宛",
  MARTINIQUE: "马提尼克",
  "MIDWAY ISLANDS": "中途岛",
  MONTENEGRO: "黑山",
  MONTSERRAT: "蒙特塞拉特",
  "NEW CALEDONIA": "新喀里多尼亚",
  "NIUE ISLAND": "纽埃",
  "NORFOLK ISLAND": "诺福克岛",
  "NORTH MACEDONIA": "北马其顿",
  "PACIFIC ISLANDS (US)": "美国太平洋岛屿",
  "PALESTINIAN TERRITORIES": "巴勒斯坦领土",
  "PITCAIRN ISLANDS": "皮特凯恩群岛",
  REUNION: "留尼汪",
  RUSSIA: "俄罗斯",
  "SAINT HELENA": "圣赫勒拿",
  "SAINT PIERRE AND MIQUELON": "圣皮埃尔和密克隆",
  SAMOA: "萨摩亚",
  "SINT MAARTEN": "圣马丁",
  "SLOVAK REPUBLIC": "斯洛伐克",
  "SOUTH KOREA": "韩国",
  TAJIKISTAN: "塔吉克斯坦",
  "TOKELAU ISLANDS": "托克劳群岛",
  "TURKS AND CAICOS ISLANDS": "特克斯和凯科斯群岛",
  UKRAINE: "乌克兰",
  "US VIRGIN ISLANDS": "美属维尔京群岛",
  "WAKE ISLAND": "威克岛",
  "WALLIS AND FUTUNA": "瓦利斯和富图纳",
  YEMEN: "也门",
};

const NATIONALITY_ZH_OVERRIDES: Record<string, string> = {
  "BRITISH NATIONAL OVERSEAS": "英国国民（海外）",
  "BRITISH OVERSEAS CITIZEN": "英国海外公民",
  "BRITISH OVERSEAS TERRITORIES CITIZ": "英国海外领土公民",
  "BRITISH PROTECTED PERSON": "受英国保护人士",
  "BRITISH SUBJECT": "英国臣民",
  KOSOVAR: "科索沃籍",
  PALESTINIAN: "巴勒斯坦籍",
  "REFUGEE (OTHER THAN XXB)": "难民（非 XXB）",
  "REFUGEE (XXB)": "难民（XXB）",
  STATELESS: "无国籍",
  TIMORESE: "东帝汶籍",
};

const PURPOSE_ZH_OVERRIDES: Record<string, string> = {
  Religion: "宗教活动",
  "Sports event": "体育赛事",
  "To take up residence": "定居",
};

function hasChinese(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function countryZh(value: string, fallback?: string): string | null {
  const normalized = normalizeKey(value);
  if (COUNTRY_ZH_OVERRIDES[normalized]) return COUNTRY_ZH_OVERRIDES[normalized];
  if (fallback && hasChinese(fallback)) return fallback;
  return null;
}

function normalizeCitySegment(segment: string, firstCountryEn: string, firstCountryZh: string | null): string {
  const trimmed = segment.trim();
  const normalized = normalizeKey(trimmed);
  const segmentCountryZh = countryZh(trimmed);
  if (segmentCountryZh) return segmentCountryZh;

  const othersPrefix = "OTHERS IN ";
  if (normalized.startsWith(othersPrefix) && firstCountryZh) {
    return `${firstCountryZh}其他地区`;
  }

  if (normalized === normalizeKey(firstCountryEn) && firstCountryZh) return firstCountryZh;
  return trimmed;
}

function cityLabelZh(option: SgacOfficialOption): string {
  const officialParts = option.value.split(",").map((part) => part.trim()).filter(Boolean);
  if (officialParts.length === 0) return option.labelZh;

  const existingParts = option.labelZh.split("，").map((part) => part.trim());
  const firstCountryZh = countryZh(officialParts[0], existingParts[0]);
  return officialParts
    .map((part, index) => index === 0 ? (firstCountryZh ?? part) : normalizeCitySegment(part, officialParts[0], firstCountryZh))
    .join("，");
}

function countryLabelZh(option: SgacOfficialOption): string {
  return countryZh(option.value, option.labelZh) ?? option.labelZh;
}

function nationalityLabelZh(option: SgacOfficialOption): string {
  return NATIONALITY_ZH_OVERRIDES[option.value] ?? option.labelZh;
}

function purposeLabelZh(option: SgacOfficialOption): string {
  return PURPOSE_ZH_OVERRIDES[option.value] ?? option.labelZh;
}

export function sgacOptionLabelZh(kind: SgacOptionListKind, option: SgacOfficialOption): string {
  switch (kind) {
    case "city":
      return cityLabelZh(option);
    case "country":
      return countryLabelZh(option);
    case "nationality":
      return nationalityLabelZh(option);
    case "purpose":
      return purposeLabelZh(option);
    case "literal":
      return option.labelZh;
  }
}

