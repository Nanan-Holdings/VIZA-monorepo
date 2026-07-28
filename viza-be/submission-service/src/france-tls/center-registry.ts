export type FranceTlsChinaCenterCode =
  | "beijing"
  | "guangzhou"
  | "chengdu"
  | "shanghai"
  | "shenyang"
  | "wuhan"
  | "chongqing"
  | "changsha"
  | "fuzhou"
  | "hangzhou"
  | "kunming"
  | "nanjing"
  | "shenzhen"
  | "jinan"
  | "xian";

export interface FranceTlsChinaCenter {
  code: FranceTlsChinaCenterCode;
  cityEn: string;
  cityZh: string;
  provider: "TLSCONTACT_CN_FR";
  countryCode: "CN";
  destinationCountryCode: "FR";
  bookingUrl: string;
  addressEn: string;
  aliases: string[];
  sourceUrls: string[];
  sourceCheckedAt: string;
}

const SOURCE_CHECKED_AT = "2026-07-02";
const FRANCE_VISAS_CHINA_URL = "https://france-visas.gouv.fr/chine";
const TLS_CHINA_URL = "https://visas-fr.tlscontact.com/en-us/country/cn";

function tlsVacUrl(vacCode: string): string {
  return `https://visas-fr.tlscontact.com/en-us/country/cn/vac/${vacCode}`;
}

export const FRANCE_TLS_CHINA_CENTERS: FranceTlsChinaCenter[] = [
  {
    code: "beijing",
    cityEn: "Beijing",
    cityZh: "北京",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnBJS2fr"),
    addressEn: "11th Floor, Block A, Gateway Plaza, No. 18 East Third Ring North Road, Chaoyang District, Beijing.",
    aliases: ["beijing", "北京", "peking", "pek"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "guangzhou",
    cityEn: "Guangzhou",
    cityZh: "广州",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnCAN2fr"),
    addressEn: "Room 02-03, 14F, Pacific Finance Center, No. 32 Huaxia Road, Tianhe District, Guangzhou.",
    aliases: ["guangzhou", "广州", "canton", "广州（canton）", "can"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "chengdu",
    cityEn: "Chengdu",
    cityZh: "成都",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnCTU2fr"),
    addressEn: "Room 2505-2509, Western Cultural Industry Center, No.16, Huaxing East Street, Jinjiang District, Chengdu.",
    aliases: ["chengdu", "成都", "ctu"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "shanghai",
    cityEn: "Shanghai",
    cityZh: "上海",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnSHA2fr"),
    addressEn: "2F, SUN CITY, No. 299 Hengfeng Rd., Jing'an District, Shanghai.",
    aliases: ["shanghai", "上海", "sha"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL, tlsVacUrl("cnSHA2fr")],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "shenyang",
    cityEn: "Shenyang",
    cityZh: "沈阳",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnSHE2fr"),
    addressEn: "Fortune Plaza E, Room 1401, No.59 Beizhan Road, Shenhe District, Shenyang.",
    aliases: ["shenyang", "沈阳", "she"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "wuhan",
    cityEn: "Wuhan",
    cityZh: "武汉",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnWUH2fr"),
    addressEn: "Room 906-910, International Intelligence Center, 1398 Jinghan Avenue, Jiang'an District, Wuhan.",
    aliases: ["wuhan", "武汉", "wuh"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "chongqing",
    cityEn: "Chongqing",
    cityZh: "重庆",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnCKG2fr"),
    addressEn: "Room 4306, 4307-2, Ying Li International Financial Center, No.28 Minquan Road, Yuzhong District, Chongqing.",
    aliases: ["chongqing", "重庆", "ckg"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "changsha",
    cityEn: "Changsha",
    cityZh: "长沙",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnCSX2fr"),
    addressEn: "Room 1506-1507, Dolton Hotel, 159 Shaoshan North Road, Furong District, Changsha.",
    aliases: ["changsha", "长沙", "csx"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "fuzhou",
    cityEn: "Fuzhou",
    cityZh: "福州",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnFOC2fr"),
    addressEn: "Room 03&05, 6F, YuYang Central Building, No.118 Shuguang Road, Taijiang District, Fuzhou.",
    aliases: ["fuzhou", "福州", "foc"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "hangzhou",
    cityEn: "Hangzhou",
    cityZh: "杭州",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnHGH2fr"),
    addressEn: "Room 705-707, Building A, Mingteng Mansion, Jinlong Center, No. 859 Huanzhan East Road, Hangzhou.",
    aliases: ["hangzhou", "杭州", "hgh"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "kunming",
    cityEn: "Kunming",
    cityZh: "昆明",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnKMG2fr"),
    addressEn: "Room 804A, CES Investment Office Building, No. 219 Chuncheng Road, Guandu District, Kunming.",
    aliases: ["kunming", "昆明", "kmg"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "nanjing",
    cityEn: "Nanjing",
    cityZh: "南京",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnNKG2fr"),
    addressEn: "Room 502-503, Zhonghai Building, No. 39 Qingliangmen Street, Gulou District, Nanjing.",
    aliases: ["nanjing", "南京", "nkg"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "shenzhen",
    cityEn: "Shenzhen",
    cityZh: "深圳",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnSZX2fr"),
    addressEn: "Room 801A, CITIC International Tower, 2001 Shennan Zhong Road, Futian District, Shenzhen.",
    aliases: ["shenzhen", "深圳", "szx"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "jinan",
    cityEn: "Jinan",
    cityZh: "济南",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnTNA2fr"),
    addressEn: "503-504 5th Floor, Oversea Plaza, 6636 2nd Ring Road, Shizhong District, Jinan.",
    aliases: ["jinan", "济南", "tna"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
  {
    code: "xian",
    cityEn: "Xi'an",
    cityZh: "西安",
    provider: "TLSCONTACT_CN_FR",
    countryCode: "CN",
    destinationCountryCode: "FR",
    bookingUrl: tlsVacUrl("cnSIA2fr"),
    addressEn: "Room 19-03-01, Chanba Foreign Affairs Building, No.1 Chanba Avenue, Baqiao District, Xi'an.",
    aliases: ["xian", "xi'an", "西安", "sia"],
    sourceUrls: [FRANCE_VISAS_CHINA_URL, TLS_CHINA_URL],
    sourceCheckedAt: SOURCE_CHECKED_AT,
  },
];

export function resolveFranceTlsCenter(value: string | null | undefined): FranceTlsChinaCenter | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return FRANCE_TLS_CHINA_CENTERS.find((center) =>
    center.code === normalized ||
    center.cityEn.toLowerCase() === normalized ||
    center.cityZh === value?.trim() ||
    center.aliases.some((alias) => alias.toLowerCase() === normalized),
  ) ?? null;
}
