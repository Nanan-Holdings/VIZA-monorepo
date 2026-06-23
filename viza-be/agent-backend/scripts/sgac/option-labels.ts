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

const CITY_SEGMENT_ZH_OVERRIDES: Record<string, string> = {
  "ABU DHABI": "阿布扎比",
  ADELAIDE: "阿德莱德",
  AFGHANISTAN: "阿富汗",
  ALBERTA: "艾伯塔省",
  ALGIERS: "阿尔及尔",
  AMSTERDAM: "阿姆斯特丹",
  ANHUI: "安徽",
  ANSHAN: "鞍山",
  ANKARA: "安卡拉",
  "ANDORRA LA VELLA": "安道尔城",
  ATHENS: "雅典",
  AUCKLAND: "奥克兰",
  BANGKOK: "曼谷",
  BEIJING: "北京",
  BENXI: "本溪",
  BENGALURU: "班加罗尔",
  BERLIN: "柏林",
  "BRITISH COLUMBIA": "不列颠哥伦比亚省",
  BRISBANE: "布里斯班",
  BUSAN: "釜山",
  CAIRO: "开罗",
  CALGARY: "卡尔加里",
  CAMBODIA: "柬埔寨",
  CANBERRA: "堪培拉",
  CHENGDU: "成都",
  CHENNAI: "钦奈",
  CHICAGO: "芝加哥",
  CHONGQING: "重庆",
  CHANGCHUN: "长春",
  CHANGSHA: "长沙",
  "CHRISTCHURCH": "基督城",
  "COCOS / KEELING ISLAND": "科科斯（基林）群岛",
  COLOMBO: "科伦坡",
  COPENHAGEN: "哥本哈根",
  DAEGU: "大邱",
  "DA NANG": "岘港",
  DALLAS: "达拉斯",
  DALIAN: "大连",
  DANDONG: "丹东",
  DARWIN: "达尔文",
  DELHI: "德里",
  DENPASAR: "登巴萨",
  DHAKA: "达卡",
  DOHA: "多哈",
  DUBAI: "迪拜",
  DUBLIN: "都柏林",
  EDINBURGH: "爱丁堡",
  FRANKFURT: "法兰克福",
  FUJIAN: "福建",
  FUZHOU: "福州",
  FOSHAN: "佛山",
  FUSHUN: "抚顺",
  FUKUOKA: "福冈",
  GANSU: "甘肃",
  GENEVA: "日内瓦",
  GUANGDONG: "广东",
  GUANGXI: "广西",
  GUANGZHOU: "广州",
  "GUANGZHOU / CANTON": "广州",
  GUILIN: "桂林",
  GUIYANG: "贵阳",
  GUIZHOU: "贵州",
  HAINAN: "海南",
  HAIKOU: "海口",
  HAMBURG: "汉堡",
  HANOI: "河内",
  HANGZHOU: "杭州",
  HARBIN: "哈尔滨",
  HEBEI: "河北",
  HEILONGJIANG: "黑龙江",
  HEFEI: "合肥",
  HENAN: "河南",
  HOHHOT: "呼和浩特",
  "HO CHI MINH CITY": "胡志明市",
  "HONG KONG": "香港",
  HOUSTON: "休斯敦",
  HUBEI: "湖北",
  HUNAN: "湖南",
  "INNER MONGOLIA": "内蒙古",
  INCHEON: "仁川",
  ISTANBUL: "伊斯坦布尔",
  JAKARTA: "雅加达",
  JIANGSU: "江苏",
  JIANGXI: "江西",
  JIAXING: "嘉兴",
  JILIN: "吉林",
  JINAN: "济南",
  JEJU: "济州",
  "JOHOR BAHRU": "新山",
  KABUL: "喀布尔",
  KUNMING: "昆明",
  KUALA: "瓜拉",
  "KUALA LUMPUR": "吉隆坡",
  KYOTO: "京都",
  LANZHOU: "兰州",
  LHASA: "拉萨",
  LIAONING: "辽宁",
  LIJIANG: "丽江",
  LONDON: "伦敦",
  LOSANGELES: "洛杉矶",
  "LOS ANGELES": "洛杉矶",
  LUOYANG: "洛阳",
  MADRID: "马德里",
  MANILA: "马尼拉",
  MELBOURNE: "墨尔本",
  MEXICO: "墨西哥",
  "MEXICO CITY": "墨西哥城",
  MILAN: "米兰",
  MOSCOW: "莫斯科",
  MUMBAI: "孟买",
  MUNICH: "慕尼黑",
  NAGOYA: "名古屋",
  NANCHANG: "南昌",
  NANJING: "南京",
  NANNING: "南宁",
  "NEW DELHI": "新德里",
  "NEW SOUTH WALES": "新南威尔士州",
  "NEW YORK": "纽约",
  "NEW YORK CITY": "纽约",
  NINGBO: "宁波",
  NINGXIA: "宁夏",
  OSAKA: "大阪",
  PARIS: "巴黎",
  PENANG: "槟城",
  PERTH: "珀斯",
  "PHNOM PENH": "金边",
  PHUKET: "普吉",
  "PAGO PAGO": "帕果帕果",
  QINGDAO: "青岛",
  QINGHAI: "青海",
  QIQIHAR: "齐齐哈尔",
  QUANZHOU: "泉州",
  QUEENSLAND: "昆士兰州",
  ROME: "罗马",
  SANYA: "三亚",
  SEOUL: "首尔",
  SHAANXI: "陕西",
  SHANDONG: "山东",
  SHANGHAI: "上海",
  SHANTOU: "汕头",
  SHANXI: "山西",
  SHENYANG: "沈阳",
  SHENZHEN: "深圳",
  SHIJIAZHUANG: "石家庄",
  SICHUAN: "四川",
  SUZHOU: "苏州",
  SYDNEY: "悉尼",
  TAIPEI: "台北",
  TAIYUAN: "太原",
  TASMANIA: "塔斯马尼亚州",
  TEHRAN: "德黑兰",
  "TIANJIN / TIENTSIN": "天津",
  TIRANA: "地拉那",
  TIBET: "西藏",
  TOKYO: "东京",
  TORONTO: "多伦多",
  URUMQI: "乌鲁木齐",
  VANCOUVER: "温哥华",
  VICTORIA: "维多利亚",
  WASHINGTON: "华盛顿",
  WENZHOU: "温州",
  WELLINGTON: "惠灵顿",
  "WESTERN AUSTRALIA": "西澳大利亚州",
  WUHAN: "武汉",
  WUXI: "无锡",
  "XI AN": "西安",
  XIAMEN: "厦门",
  XIANYANG: "咸阳",
  XINING: "西宁",
  XINJIANG: "新疆",
  XUZHOU: "徐州",
  YANTAI: "烟台",
  YINGKOU: "营口",
  YINCHUAN: "银川",
  YUNNAN: "云南",
  ZHEJIANG: "浙江",
  ZHENGZHOU: "郑州",
  ZURICH: "苏黎世",
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

function citySegmentZh(value: string): string | null {
  const normalized = normalizeKey(value.replace(/\([^)]*\)/g, "").replace(/\bPROVINCE\b/g, ""));
  return CITY_SEGMENT_ZH_OVERRIDES[normalized] ?? countryZh(normalized);
}

function normalizeCitySegment(segment: string, firstCountryEn: string, firstCountryZh: string | null, partIndex: number): string {
  const trimmed = segment.trim();
  const normalized = normalizeKey(trimmed);
  const segmentCountryZh = citySegmentZh(trimmed);
  if (segmentCountryZh) return segmentCountryZh;

  const othersPrefix = "OTHERS IN ";
  if (normalized.startsWith(othersPrefix) && firstCountryZh) {
    const place = normalized.slice(othersPrefix.length);
    const placeZh = citySegmentZh(place) ?? firstCountryZh;
    return `${placeZh}其他地区`;
  }

  if (normalized === normalizeKey(firstCountryEn) && firstCountryZh) return firstCountryZh;
  if (hasChinese(trimmed)) return trimmed;
  return partIndex === 1 ? "指定地区" : "指定城市/港口";
}

function cityLabelZh(option: SgacOfficialOption): string {
  const officialParts = option.value.split(",").map((part) => part.trim()).filter(Boolean);
  if (officialParts.length === 0) return option.labelZh;

  const existingParts = option.labelZh.split("，").map((part) => part.trim());
  const firstCountryZh = countryZh(officialParts[0], existingParts[0]);
  return officialParts
    .map((part, index) => index === 0 ? (firstCountryZh ?? "指定国家/地区") : normalizeCitySegment(part, officialParts[0], firstCountryZh, index))
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
