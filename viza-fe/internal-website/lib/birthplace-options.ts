import countryRegionData from "country-region-data/data.json";
import { countries } from "country-data-list";

export interface BirthplaceOption {
  code: string;
  zh: string;
  en: string;
  aliases?: string[];
}

export interface NormalizedBirthplace {
  countryCode: string;
  country: BirthplaceOption | null;
  provinceCode: string;
  province: { zh: string; en: string };
  cityCode: string;
  city: { zh: string; en: string };
  placeOfBirthZh: string;
  placeOfBirthEn: string;
}

interface CountryRecord {
  alpha2: string;
  alpha3: string;
  emoji?: string;
  ioc: string;
  name: string;
  status: string;
}

type CountryRegion = {
  countryName: string;
  countryShortCode: string;
  regions: Array<{ name: string; shortCode: string }>;
};

export const OTHER_BIRTHPLACE_OPTION: BirthplaceOption = {
  code: "OTHER",
  zh: "其他",
  en: "Other",
};

const CHINA_REGION_ZH: Record<string, string> = {
  AH: "安徽",
  BJ: "北京",
  CQ: "重庆",
  FJ: "福建",
  GS: "甘肃",
  GD: "广东",
  GX: "广西",
  GZ: "贵州",
  HI: "海南",
  HE: "河北",
  HL: "黑龙江",
  HA: "河南",
  HK: "香港",
  HB: "湖北",
  HN: "湖南",
  JS: "江苏",
  JX: "江西",
  JL: "吉林",
  LN: "辽宁",
  MO: "澳门",
  NM: "内蒙古",
  NX: "宁夏",
  QH: "青海",
  SN: "陕西",
  SD: "山东",
  SH: "上海",
  SX: "山西",
  SC: "四川",
  TJ: "天津",
  XJ: "新疆",
  YN: "云南",
  ZJ: "浙江",
  TW: "台湾",
  XZ: "西藏",
};

const CITY_OPTIONS_BY_REGION: Record<string, BirthplaceOption[]> = {
  "CN-AH": [
    { code: "HEFEI", zh: "合肥", en: "Hefei" },
    { code: "WUHU", zh: "芜湖", en: "Wuhu" },
    { code: "BENGBU", zh: "蚌埠", en: "Bengbu" },
  ],
  "CN-BJ": [{ code: "BEIJING", zh: "北京", en: "Beijing" }],
  "CN-CQ": [{ code: "CHONGQING", zh: "重庆", en: "Chongqing" }],
  "CN-FJ": [
    { code: "FUZHOU", zh: "福州", en: "Fuzhou" },
    { code: "XIAMEN", zh: "厦门", en: "Xiamen" },
    { code: "QUANZHOU", zh: "泉州", en: "Quanzhou" },
  ],
  "CN-GD": [
    { code: "GUANGZHOU", zh: "广州", en: "Guangzhou" },
    { code: "SHENZHEN", zh: "深圳", en: "Shenzhen" },
    { code: "ZHUHAI", zh: "珠海", en: "Zhuhai" },
    { code: "FOSHAN", zh: "佛山", en: "Foshan" },
    { code: "DONGGUAN", zh: "东莞", en: "Dongguan" },
  ],
  "CN-HA": [
    { code: "ZHENGZHOU", zh: "郑州", en: "Zhengzhou" },
    { code: "LUOYANG", zh: "洛阳", en: "Luoyang" },
  ],
  "CN-HB": [
    { code: "WUHAN", zh: "武汉", en: "Wuhan" },
    { code: "YICHANG", zh: "宜昌", en: "Yichang" },
  ],
  "CN-HN": [
    { code: "CHANGSHA", zh: "长沙", en: "Changsha" },
    { code: "ZHANGJIAJIE", zh: "张家界", en: "Zhangjiajie" },
    { code: "YUEYANG", zh: "岳阳", en: "Yueyang" },
    { code: "ZHUZHOU", zh: "株洲", en: "Zhuzhou" },
  ],
  "CN-JS": [
    { code: "NANJING", zh: "南京", en: "Nanjing" },
    { code: "SUZHOU", zh: "苏州", en: "Suzhou" },
    { code: "WUXI", zh: "无锡", en: "Wuxi" },
  ],
  "CN-SC": [
    { code: "CHENGDU", zh: "成都", en: "Chengdu" },
    { code: "MIANYANG", zh: "绵阳", en: "Mianyang" },
    { code: "LESHAN", zh: "乐山", en: "Leshan" },
  ],
  "CN-SD": [
    { code: "JINAN", zh: "济南", en: "Jinan" },
    { code: "QINGDAO", zh: "青岛", en: "Qingdao" },
    { code: "YANTAI", zh: "烟台", en: "Yantai" },
  ],
  "CN-SH": [{ code: "SHANGHAI", zh: "上海", en: "Shanghai" }],
  "CN-ZJ": [
    { code: "HANGZHOU", zh: "杭州", en: "Hangzhou" },
    { code: "NINGBO", zh: "宁波", en: "Ningbo" },
    { code: "WENZHOU", zh: "温州", en: "Wenzhou" },
  ],
  "US-CA": [
    { code: "LOS_ANGELES", zh: "洛杉矶", en: "Los Angeles" },
    { code: "SAN_FRANCISCO", zh: "旧金山", en: "San Francisco" },
    { code: "SAN_DIEGO", zh: "圣迭戈", en: "San Diego" },
  ],
  "US-NY": [
    { code: "NEW_YORK", zh: "纽约", en: "New York" },
    { code: "BUFFALO", zh: "布法罗", en: "Buffalo" },
    { code: "ALBANY", zh: "奥尔巴尼", en: "Albany" },
  ],
};

const COUNTRY_ALIASES: Record<string, string[]> = {
  CN: ["china", "chinese", "prc", "people's republic of china", "people republic of china", "中国", "中华人民共和国"],
  US: ["usa", "u.s.", "u.s.a.", "united states", "united states of america", "america", "美国"],
  GB: ["uk", "u.k.", "britain", "great britain", "united kingdom", "英国"],
};

export function normalizeBirthplaceLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ");
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function withOtherOption(options: BirthplaceOption[]) {
  if (options.some((option) => option.code === OTHER_BIRTHPLACE_OPTION.code)) return options;
  return [...options, OTHER_BIRTHPLACE_OPTION];
}

function getLocalizedRegionName(alpha2: string) {
  try {
    const displayNames = new Intl.DisplayNames(["zh"], { type: "region" });
    return displayNames.of(alpha2.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

const COUNTRY_OPTIONS: BirthplaceOption[] = (countries.all as CountryRecord[])
  .filter((country) => country.emoji && country.status !== "deleted" && country.ioc !== "PRK")
  .map((country) => ({
    code: country.alpha2,
    zh: getLocalizedRegionName(country.alpha2) || country.name,
    en: country.name,
    aliases: [country.alpha3, country.ioc, ...(COUNTRY_ALIASES[country.alpha2] ?? [])].filter(Boolean),
  }));

function findOption(options: BirthplaceOption[], value: string | null | undefined) {
  const lookup = normalizeBirthplaceLookup(clean(value));
  if (!lookup) return undefined;

  return options.find((option) => {
    const candidates = [option.code, option.zh, option.en, ...(option.aliases ?? [])];
    return candidates.some((candidate) => normalizeBirthplaceLookup(candidate) === lookup);
  });
}

export function findBirthCountryOption(value: string | null | undefined) {
  return findOption(COUNTRY_OPTIONS, value);
}

export function normalizeBirthCountryCode(value: string | null | undefined) {
  return findBirthCountryOption(value)?.code ?? "";
}

function getCountryRegion(countryCode: string): CountryRegion | undefined {
  return (countryRegionData as CountryRegion[]).find(
    (entry) => entry.countryShortCode === countryCode,
  );
}

export function getBirthProvinceOptions(countryCodeOrValue: string | null | undefined): BirthplaceOption[] {
  const countryCode = normalizeBirthCountryCode(countryCodeOrValue) || clean(countryCodeOrValue).toUpperCase();
  if (!countryCode) return [];

  const country = getCountryRegion(countryCode);
  if (!country) return [OTHER_BIRTHPLACE_OPTION];

  return withOtherOption(country.regions.map((region) => ({
    code: region.shortCode || region.name,
    zh: countryCode === "CN" ? CHINA_REGION_ZH[region.shortCode] ?? region.name : region.name,
    en: region.name,
    aliases: [region.shortCode],
  })));
}

export function findBirthProvinceOption(countryCodeOrValue: string | null | undefined, value: string | null | undefined) {
  return findOption(getBirthProvinceOptions(countryCodeOrValue), value);
}

export function getBirthCityOptions(
  countryCodeOrValue: string | null | undefined,
  provinceCodeOrValue: string | null | undefined,
): BirthplaceOption[] {
  const countryCode = normalizeBirthCountryCode(countryCodeOrValue) || clean(countryCodeOrValue).toUpperCase();
  const province = findBirthProvinceOption(countryCode, provinceCodeOrValue);
  if (!countryCode || !province || province.code === OTHER_BIRTHPLACE_OPTION.code) {
    return [OTHER_BIRTHPLACE_OPTION];
  }

  const knownCities = CITY_OPTIONS_BY_REGION[`${countryCode}-${province.code}`];
  if (knownCities?.length) return withOtherOption(knownCities);

  return withOtherOption([{ code: province.code, zh: province.zh, en: province.en }]);
}

export function findBirthCityOption(
  countryCodeOrValue: string | null | undefined,
  provinceCodeOrValue: string | null | undefined,
  value: string | null | undefined,
) {
  return findOption(getBirthCityOptions(countryCodeOrValue, provinceCodeOrValue), value);
}

function findCityAcrossCountry(countryCode: string, value: string | null | undefined) {
  const lookup = normalizeBirthplaceLookup(clean(value));
  if (!countryCode || !lookup) return null;

  for (const [key, options] of Object.entries(CITY_OPTIONS_BY_REGION)) {
    const [optionCountryCode, provinceCode] = key.split("-");
    if (optionCountryCode !== countryCode) continue;
    const city = findOption(options, value);
    if (city) return { city, provinceCode };
  }

  return null;
}

function splitBirthplaceText(value: string | null | undefined) {
  return clean(value)
    .split(/\s*(?:\||,|，|;|；|\/|>|->|–)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function valueFromOptionOrText(option: BirthplaceOption | undefined, value: string) {
  if (option && option.code !== OTHER_BIRTHPLACE_OPTION.code) {
    return { zh: option.zh, en: option.en };
  }
  return { zh: value, en: value };
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.map(clean).filter(Boolean).join(" | ");
}

export function normalizeBirthplace(input: {
  placeOfBirth?: string | null;
  country?: string | null;
  province?: string | null;
  provinceZh?: string | null;
  provinceEn?: string | null;
  city?: string | null;
  cityZh?: string | null;
  cityEn?: string | null;
  nationality?: string | null;
}): NormalizedBirthplace {
  const splitFromPlace = splitBirthplaceText(input.placeOfBirth);
  const splitFromCity = splitBirthplaceText(input.city);
  const compositeParts = splitFromCity.length >= 3 ? splitFromCity : splitFromPlace;

  const countryCandidate =
    clean(input.country) ||
    (compositeParts.length >= 3 ? compositeParts[0] : "") ||
    clean(input.nationality);
  const country = findBirthCountryOption(countryCandidate);
  const countryCode = country?.code ?? "";

  const provinceCandidate =
    clean(input.provinceEn) ||
    clean(input.province) ||
    clean(input.provinceZh) ||
    (compositeParts.length >= 3 ? compositeParts[1] : "");
  const rawCityCandidate =
    clean(input.cityEn) ||
    clean(input.city) ||
    clean(input.cityZh) ||
    (compositeParts.length >= 3 ? compositeParts.slice(2).join(" | ") : clean(input.placeOfBirth));
  const cityCandidate = splitBirthplaceText(rawCityCandidate).length >= 3
    ? splitBirthplaceText(rawCityCandidate).slice(2).join(" | ")
    : rawCityCandidate;

  let province = findBirthProvinceOption(countryCode, provinceCandidate);
  let provinceCode = province?.code ?? "";
  let city = findBirthCityOption(countryCode, provinceCode, cityCandidate);
  const inferredCity = !city && !province ? findCityAcrossCountry(countryCode, cityCandidate) : null;

  if (inferredCity) {
    city = inferredCity.city;
    provinceCode = inferredCity.provinceCode;
    province = findBirthProvinceOption(countryCode, provinceCode);
  }

  const normalizedProvince = valueFromOptionOrText(province, provinceCandidate);
  const normalizedCity = valueFromOptionOrText(city, cityCandidate);
  const resolvedProvinceCode = provinceCode || (provinceCandidate ? OTHER_BIRTHPLACE_OPTION.code : "");
  const resolvedCityCode = city?.code ?? (cityCandidate ? OTHER_BIRTHPLACE_OPTION.code : "");

  return {
    countryCode,
    country: country ?? null,
    provinceCode: resolvedProvinceCode,
    province: normalizedProvince,
    cityCode: resolvedCityCode,
    city: normalizedCity,
    placeOfBirthZh: joinParts([country?.zh, normalizedProvince.zh, normalizedCity.zh]),
    placeOfBirthEn: joinParts([country?.en, normalizedProvince.en, normalizedCity.en]),
  };
}
