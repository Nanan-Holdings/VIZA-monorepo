import type { SgacOfficialOption } from "./official-options";
import { readFileSync } from "node:fs";

export type SgacOptionListKind = "city" | "country" | "nationality" | "purpose" | "hotel" | "cruise" | "carrier" | "literal";

interface SgacZhTranslationCache {
  city?: Record<string, string>;
  hotel?: Record<string, string>;
  cruise?: Record<string, string>;
}

function loadTranslationCache(): SgacZhTranslationCache {
  try {
    return JSON.parse(readFileSync(new URL("./option-translations.zh.json", import.meta.url), "utf8")) as SgacZhTranslationCache;
  } catch {
    return {};
  }
}

const TRANSLATION_CACHE = loadTranslationCache();

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
  CAMBODIAN: "柬埔寨籍",
  CROATIAN: "克罗地亚籍",
  ESTONIAN: "爱沙尼亚籍",
  GEORGIAN: "格鲁吉亚籍",
  KOSOVAR: "科索沃籍",
  KYRGYZSTAN: "吉尔吉斯斯坦籍",
  LITHUANIAN: "立陶宛籍",
  MACEDONIAN: "北马其顿籍",
  MICRONESIAN: "密克罗尼西亚籍",
  MONTENEGRIN: "黑山籍",
  PALESTINIAN: "巴勒斯坦籍",
  "REFUGEE (OTHER THAN XXB)": "难民（其他类别）",
  "REFUGEE (XXB)": "难民（指定类别）",
  RUSSIAN: "俄罗斯籍",
  SAMOAN: "萨摩亚籍",
  SWAZI: "斯威士兰籍",
  STATELESS: "无国籍",
  TAJIKISTANI: "塔吉克斯坦籍",
  TIMORESE: "东帝汶籍",
  UKRAINIAN: "乌克兰籍",
  YEMENI: "也门籍",
};

const PURPOSE_ZH_OVERRIDES: Record<string, string> = {
  Religion: "宗教活动",
  "Sports event": "体育赛事",
  "To take up residence": "定居",
};

const AIRLINE_NAME_ZH_OVERRIDES: Record<string, string> = {
  "AERO DILI": "帝力航空",
  "AIR CANADA": "加拿大航空",
  "AIR CHINA": "中国国际航空",
  "AIR EUROPA LINEAS AEREAS, S.A.": "欧罗巴航空",
  "AIR FRANCE": "法国航空",
  "AIR INDIA": "印度航空",
  "AIR INDIA EXPRESS": "印度快运航空",
  "AIR JAPAN": "日本航空",
  "AIR MACAU": "澳门航空",
  "AIR MAURITIUS": "毛里求斯航空",
  "AIR NEW ZEALAND": "新西兰航空",
  "AIR NIUGINI": "新几内亚航空",
  "AIR SERBIA": "塞尔维亚航空",
  "AIRASIA BERHAD": "亚洲航空",
  "AIRASIA CAMBODIA": "柬埔寨亚洲航空",
  "AIRASIA X BERHAD": "亚航长途",
  AIRCALIN: "喀里多尼亚航空",
  "ALASKA AIRLINES": "阿拉斯加航空",
  "ALL NIPPON AIRWAYS": "全日空航空",
  "AMERICAN AIRLINES": "美国航空",
  "ATLAS AIR": "阿特拉斯航空",
  "BANGKOK AIRWAYS": "曼谷航空",
  "BATIK AIR": "巴迪航空",
  "BATIK AIR MALAYSIA": "马来西亚巴迪航空",
  "BRITISH AIRWAYS": "英国航空",
  "CAMBODIA AIRWAYS": "柬埔寨航空",
  "CAMBODIA ANGKOR AIR": "柬埔寨吴哥航空",
  "CATHAY PACIFIC": "国泰航空",
  "CEBU PACIFIC AIR": "宿务太平洋航空",
  "ASIANA AIRLINES": "韩亚航空",
  "BIMAN BANGLADESH AIRLINES": "孟加拉航空",
  "CHINA AIRLINES": "中华航空",
  "CHINA EASTERN AIRLINES": "中国东方航空",
  "CHINA SOUTHERN AIRLINES": "中国南方航空",
  "CHONGQING AIRLINES": "重庆航空",
  "DELTA AIRLINES": "达美航空",
  "DHL AIR UK": "英国敦豪航空",
  "DRUK AIR": "不丹皇家航空",
  EMIRATES: "阿联酋航空",
  "ETHIOPIAN AIRLINES": "埃塞俄比亚航空",
  "ETIHAD AIRWAYS": "阿提哈德航空",
  "EVA AIRWAYS": "长荣航空",
  "FIJI AIRWAYS": "斐济航空",
  FINNAIR: "芬兰航空",
  FIREFLY: "飞萤航空",
  FLYNAS: "沙特飞鸟航空",
  "GARUDA INDONESIA": "印尼鹰航",
  "GUANGXI BEIBU GULF AIRLINES": "广西北部湾航空",
  "HAINAN AIRLINES": "海南航空",
  "HAWAIIAN AIRLINES": "夏威夷航空",
  "HEBEI AIRLINES": "河北航空",
  "IBERIA AIRLINES": "伊比利亚航空",
  "ICELAND AIR": "冰岛航空",
  INDIGO: "靛蓝航空",
  "INDONESIA AIRASIA": "印度尼西亚亚洲航空",
  "JAPAN AIRLINES": "日本航空",
  "JD AIRLINES": "首都航空",
  "JEJU AIR": "济州航空",
  "JETBLUE AIRWAYS": "捷蓝航空",
  "JETSTAR AIRWAYS INTERNATIONAL": "捷星航空",
  "JUNEYAO AIRLINES": "吉祥航空",
  "KALITTA AIR": "卡利塔航空",
  "KENYA AIRWAYS": "肯尼亚航空",
  "KLM-ROYAL DUTCH AIRLINES": "荷兰皇家航空",
  "LION MENTARI AIRLINES": "狮子航空",
  "LOT POLISH AIRLINES": "波兰航空",
  "LUFTHANSA GERMAN AIRLINES": "汉莎航空",
  "MALAYSIA AIRLINES": "马来西亚航空",
  "MANDARIN AIRLINES": "华信航空",
  "MIAT MONGOLIAN AIRLINES": "蒙古航空",
  "MY JET XPRESS AIRLINES": "我的捷运航空",
  "MYANMAR NATIONAL AIRLINES": "缅甸国家航空",
  "OMAN AIR": "阿曼航空",
  "PACIFIC AIRLINES": "太平洋航空",
  "PHILIPPINE AIRLINES": "菲律宾航空",
  "PHILIPPINES AIRASIA": "菲律宾亚洲航空",
  "QANTAS AIRWAYS": "澳洲航空",
  "QATAR AIRWAYS": "卡塔尔航空",
  "ROYAL AIR MAROC": "摩洛哥皇家航空",
  "ROYAL BRUNEI AIRLINES": "文莱皇家航空",
  "ROYAL JORDANIAN": "约旦皇家航空",
  "RWANDAIR": "卢旺达航空",
  SAUDIA: "沙特阿拉伯航空",
  SCOOT: "酷航",
  "SHANDONG AIRLINES": "山东航空",
  "SHANGHAI AIRLINES": "上海航空",
  "SHENZHEN AIRLINES": "深圳航空",
  "SICHUAN AIRLINES": "四川航空",
  "SINGAPORE AIRLINES": "新加坡航空",
  "SPRING AIRLINES": "春秋航空",
  "SRILANKAN AIRLINES": "斯里兰卡航空",
  "STARLUX AIRLINES": "星宇航空",
  "SWISS INTERNATIONAL AIRLINES": "瑞士国际航空",
  "T'WAY AIR": "德威航空",
  "TAP PORTUGAL": "葡萄牙航空",
  "THAI AIRASIA": "泰国亚洲航空",
  "THAI AIRWAYS": "泰国国际航空",
  "THAI LION AIR": "泰国狮子航空",
  "THAI VIETJET AIR": "泰国越捷航空",
  "TIANJIN AIRLINES": "天津航空",
  TRANSNUSA: "印尼跨洋航空",
  "TURKISH AIRLINES": "土耳其航空",
  "UNITED AIRLINES": "美国联合航空",
  "URUMQI AIR": "乌鲁木齐航空",
  "US-BANGLA AIRLINES": "优速孟加拉航空",
  "VIETJET AIR": "越捷航空",
  "VIETNAM AIRLINES": "越南航空",
  "VIRGIN AUSTRALIA": "维珍澳大利亚航空",
  "WEST AIR": "西部航空",
  WESTJET: "西捷航空",
  "XIAMEN AIRLINES": "厦门航空",
  "YTO CARGO AIRLINES": "圆通货运航空",
  ZIPAIR: "日本捷普航空",
};

const CITY_SEGMENT_ZH_OVERRIDES: Record<string, string> = {
  "ABU DHABI": "阿布扎比",
  ADELAIDE: "阿德莱德",
  AFGHANISTAN: "阿富汗",
  AFRICA: "非洲",
  ALBERTA: "艾伯塔省",
  ALBANIA: "阿尔巴尼亚",
  ALGERIA: "阿尔及利亚",
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
  INDIA: "印度",
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
  "WEST BENGAL": "西孟加拉邦",
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

const GENERIC_SEGMENT_ZH_OVERRIDES: Record<string, string> = {
  CENTRAL: "中部",
  EAST: "东部",
  NORTH: "北部",
  SOUTH: "南部",
  WEST: "西部",
  "NORTH EAST": "东北部",
  "NORTH WEST": "西北部",
  "SOUTH EAST": "东南部",
  "SOUTH WEST": "西南部",
  "SPECIFIED REGION": "指定地区",
  "SPECIFIED CITY/PORT": "指定城市/港口",
  "SPECIFIED CITY / PORT": "指定城市/港口",
  "OTHERS": "其他地区",
};

const PROPER_NAME_WORD_ZH: Record<string, string> = {
  "21": "二十一",
  "338": "三三八",
  "7": "七",
  A: "雅",
  ADONIA: "阿多尼亚",
  ADORA: "爱多拉",
  AEGEAN: "爱琴海",
  AIDAAURA: "爱达奥拉",
  AIDABELLA: "爱达贝拉",
  AIDADIVA: "爱达迪娃",
  AIDALUNA: "爱达露娜",
  AIDAMAR: "爱达玛",
  AIDANOVA: "爱达诺娃",
  AIDAPERLA: "爱达佩拉",
  AIDAPRIMA: "爱达普里玛",
  AIDASOL: "爱达索尔",
  AIDASTELLA: "爱达斯特拉",
  ALBERT: "阿尔伯特",
  AMETRINE: "紫黄晶",
  ANTHEM: "圣歌",
  AQUEEN: "皇后",
  AZAMARA: "精致游轮",
  BALESTIER: "马里士他",
  BAY: "湾",
  BENCOOLEN: "明古连",
  BUGIS: "武吉士",
  CARPENTER: "卡本特",
  CELEBRITY: "精致",
  CHANGI: "樟宜",
  CHINATOWN: "牛车水",
  CLARKE: "克拉码头",
  COLLECTION: "精选",
  CONRAD: "康莱德",
  CRYSTAL: "水晶",
  DESKER: "德斯克",
  DIAMOND: "钻石",
  DICKSON: "迪克森",
  DREAM: "梦号",
  EMERALD: "翡翠",
  FARRER: "花拉",
  FABER: "花柏山",
  FULLERTON: "富丽敦",
  GEMINI: "双子星",
  GENTING: "云顶",
  GOLD: "黄金",
  HOSTEL: "旅舍",
  HOTEL: "酒店",
  IBIS: "宜必思",
  IMPERIAL: "帝国",
  INN: "旅馆",
  JALAN: "惹兰",
  JOO: "如切",
  JOURNEY: "旅程号",
  KATONG: "加东",
  LAVENDER: "劳明达",
  LILY: "百合",
  MARINA: "滨海",
  MARINER: "海洋水手号",
  MEDITERRANEA: "地中海号",
  MILLENNIUM: "千禧号",
  MOUNT: "山",
  NICE: "尼斯",
  NOVENA: "诺维娜",
  ODYSSEY: "奥德赛",
  ON: "在",
  ONE: "一号",
  ORCHARD: "乌节",
  OVATION: "赞礼号",
  PARADISE: "天堂号",
  PARK: "公园",
  PARKROYAL: "宾乐雅",
  PAYA: "巴耶",
  PEARL: "珍珠",
  PRINCESS: "公主号",
  QUEST: "探索号",
  QUAY: "码头",
  QUANTUM: "量子号",
  REGIS: "瑞吉",
  RESORTS: "名胜",
  ROYAL: "皇家",
  RUBY: "红宝石",
  SANDS: "金沙",
  SAPPHIRE: "蓝宝石",
  SEAS: "海洋",
  SELEGIE: "实利基",
  SENTOSA: "圣淘沙",
  SINGAPORE: "新加坡",
  SPECTRUM: "光谱号",
  ST: "圣",
  STYLES: "尚品",
  SUPERSTAR: "丽星",
  THE: "",
  THOMSON: "汤申",
  VALUE: "惠值",
  VENUE: "薇纽",
  VIBE: "维贝",
  VICTORIA: "维多利亚",
  VILLAGE: "悦乐",
  VIRGO: "处女星",
  VOYAGER: "航行者号",
  WEST: "西部",
  WONDERS: "奇迹",
  WORLD: "世界",
};

const LETTER_ZH: Record<string, string> = {
  A: "阿",
  B: "比",
  C: "克",
  D: "德",
  E: "伊",
  F: "夫",
  G: "格",
  H: "赫",
  I: "伊",
  J: "杰",
  K: "克",
  L: "勒",
  M: "姆",
  N: "恩",
  O: "欧",
  P: "普",
  Q: "丘",
  R: "尔",
  S: "斯",
  T: "特",
  U: "优",
  V: "维",
  W: "威",
  X: "克斯",
  Y: "伊",
  Z: "泽",
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
  if (GENERIC_SEGMENT_ZH_OVERRIDES[normalized]) return GENERIC_SEGMENT_ZH_OVERRIDES[normalized];
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
  const transliterated = properNameBareZh(trimmed);
  if (transliterated) return transliterated;
  return partIndex === 1 ? "指定地区" : "指定城市/港口";
}

function splitTranslatedParts(value: string): string[] {
  return value.split(/[，,]/).map((part) => part.trim()).filter(Boolean);
}

function cityOtherRegionLabelZh(segment: string, firstCountryEn: string, firstCountryZh: string | null, cachedPart?: string): string {
  const othersPrefix = "OTHERS IN ";
  const normalized = normalizeKey(segment);
  const placeEn = normalized.startsWith(othersPrefix) ? normalized.slice(othersPrefix.length) : normalized;
  const cached = cachedPart ? sanitizeCachedZh(cachedPart) : "";
  if (cached && /其他地区$/.test(cached)) return cached;

  const placeZh =
    citySegmentZh(placeEn) ??
    (normalizeKey(placeEn) === normalizeKey(firstCountryEn) ? firstCountryZh : null) ??
    firstCountryZh;
  return `${placeZh ?? "该地"}其他地区`;
}

function cityLabelZh(option: SgacOfficialOption): string {
  const cached = TRANSLATION_CACHE.city?.[option.value]?.trim();
  const officialParts = option.value.split(",").map((part) => part.trim()).filter(Boolean);
  if (officialParts.length === 0) return option.labelZh;

  const cachedParts = cached ? splitTranslatedParts(sanitizeCachedZh(cached)) : [];
  const existingParts = option.labelZh.split("，").map((part) => part.trim());
  const firstCountryZh = countryZh(officialParts[0], existingParts[0]);
  return officialParts
    .map((part, index) => {
      if (index === 0) return firstCountryZh ?? cachedParts[0] ?? "指定国家/地区";
      if (normalizeKey(part).startsWith("OTHERS IN ")) {
        return cityOtherRegionLabelZh(part, officialParts[0], firstCountryZh, cachedParts[index]);
      }
      return cachedParts[index] ?? normalizeCitySegment(part, officialParts[0], firstCountryZh, index);
    })
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

function carrierLabelZh(option: SgacOfficialOption): string {
  const officialLabel = option.labelEn || option.value;
  const match = officialLabel.match(/^([A-Z0-9]{2})\s*-\s*(.+)$/);
  const carrierCode = match?.[1] ?? option.value;
  const officialName = normalizeKey(match?.[2] ?? officialLabel);
  const translatedName = AIRLINE_NAME_ZH_OVERRIDES[officialName] ?? properNameBareZh(officialName);
  if (!carrierCode) return translatedName || option.labelZh.replace(/^选项：/, "");
  return `${translatedName || officialName}（${carrierCode}）`;
}

function transliterateToken(token: string): string {
  const normalized = normalizeKey(token.replace(/[^A-Z0-9]/g, ""));
  if (!normalized) return "";
  if (PROPER_NAME_WORD_ZH[normalized] !== undefined) return PROPER_NAME_WORD_ZH[normalized];
  if (/^\d+$/.test(normalized)) return normalized;
  return Array.from(normalized).map((char) => LETTER_ZH[char] ?? "").join("");
}

function properNameZh(value: string, prefix: string): string {
  const cached = prefix === "酒店" ? TRANSLATION_CACHE.hotel?.[value]?.trim() : TRANSLATION_CACHE.cruise?.[value]?.trim();
  if (cached) return sanitizeCachedZh(cached.replace(new RegExp(`^${prefix}[：:\\s]+`), ""));

  const normalized = normalizeKey(value);
  const fullOverrides: Record<string, string> = {
    "IBIS SINGAPORE ON BENCOOLEN": "宜必思新加坡明古连酒店",
    "MARINA BAY SANDS SINGAPORE": "新加坡滨海湾金沙酒店",
    "VIBE HOTEL SINGAPORE ORCHARD": "新加坡乌节维贝酒店",
    "VALUE HOTEL - THOMSON": "汤申惠值酒店",
    "VILLAGE HOTEL BUGIS": "武吉士悦乐酒店",
    "VILLAGE HOTEL CHANGI": "樟宜悦乐酒店",
    "VILLAGE HOTEL KATONG": "加东悦乐酒店",
    "ADONIA": "阿多尼亚",
    "ADORA MEDITERRANEA": "爱多拉地中海号",
    "AEGEAN ODYSSEY": "爱琴海奥德赛号",
    "AEGEAN PARADISE": "爱琴海天堂号",
    "GENTING DREAM": "云顶梦号",
    "MARINER OF THE SEAS": "海洋水手号",
    "OVATION OF THE SEAS": "海洋赞礼号",
    "QUANTUM OF THE SEAS": "海洋量子号",
    "RESORTS WORLD ONE": "名胜世界壹号",
    "SPECTRUM OF THE SEAS": "海洋光谱号",
    "SUPERSTAR GEMINI": "丽星双子星号",
    "SUPERSTAR VIRGO": "丽星处女星号",
    "VOYAGER OF THE SEAS": "海洋航行者号",
  };
  if (fullOverrides[normalized]) return fullOverrides[normalized];

  const translated = normalized
    .split(/[\s,@/()[\].&–-]+/)
    .map(transliterateToken)
    .filter(Boolean)
    .join("");
  return translated || "官方选项";
}

function properNameBareZh(value: string): string {
  const translated = normalizeKey(value)
    .split(/[\s,@/()[\].&–-]+/)
    .map(transliterateToken)
    .filter(Boolean)
    .join("");
  return translated;
}

function sanitizeCachedZh(value: string): string {
  return value
    .replace(/,\s*/g, "，")
    .replace(/境内的其他人/g, "其他地区")
    .replace(/境内的其他地区/g, "其他地区")
    .replace(/的其他人/g, "其他地区")
    .replace(/的其他地区/g, "其他地区")
    .replace(/其他人/g, "其他地区")
    .replace(/[A-Za-z][A-Za-z0-9'.&/-]*(?:\s+[A-Za-z][A-Za-z0-9'.&/-]*)*/g, (match) => {
      const translated = properNameBareZh(match);
      return translated || match;
    });
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
    case "hotel":
      return properNameZh(option.value, "酒店");
    case "cruise":
      return properNameZh(option.value, "邮轮");
    case "carrier":
      return carrierLabelZh(option);
    case "literal":
      return option.labelZh;
  }
}
