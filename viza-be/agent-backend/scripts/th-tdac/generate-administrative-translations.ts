import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  TDAC_OFFICIAL_DISTRICTS_BY_PROVINCE,
  TDAC_OFFICIAL_PROVINCE_LABELS,
  TDAC_OFFICIAL_SUBDISTRICTS_BY_PROVINCE_DISTRICT,
} from "./tdac-official-dropdowns.generated";
import {
  TDAC_DISTRICT_TRANSLATION_OPTIONS_BY_PROVINCE,
  TDAC_PROVINCE_TRANSLATION_OPTIONS,
  TDAC_SUBDISTRICT_TRANSLATION_OPTIONS_BY_DISTRICT,
} from "./official-options";

type AdministrativeTranslationCache = {
  _meta: {
    generated_at: string;
    official_option_source: string;
    standardized_translation_source: string;
    fallback_translation_source: string;
    province_count: number;
    district_count: number;
    subdistrict_count: number;
    fallback_policy: string;
    district_fallback_count: number;
    subdistrict_fallback_count: number;
  };
  provinces: Record<string, string>;
  districts: Record<string, string>;
  subdistricts: Record<string, string>;
};

const tokenTranslations: Record<string, string> = {
  AMNAT: "安纳",
  AMPHOE: "县",
  ANG: "昂",
  BANG: "挽",
  BAN: "班",
  BURI: "武里",
  CHAI: "猜",
  CHAN: "占",
  CHAROEN: "乍能",
  CHIANG: "清",
  CHON: "春",
  CHU: "楚",
  DOK: "铎",
  HAT: "合",
  HONG: "洪",
  HUA: "华",
  KAEN: "敬",
  KALASIN: "加拉信",
  KAM: "甘",
  KAMPHAENG: "烹",
  KANCHANABURI: "北碧",
  KHAN: "坎",
  KHON: "孔",
  KHLONG: "空",
  KHRAM: "克兰",
  KHU: "库",
  KHIRI: "吉里",
  KO: "阁",
  KRABI: "甲米",
  LAMUNG: "拉蒙",
  LAMPANG: "南邦",
  LAM: "南",
  LOEI: "黎",
  LOP: "华",
  LUANG: "銮",
  MUEANG: "孟",
  MUK: "穆",
  NAKHON: "那空",
  NAKHONSI: "洛坤",
  NANG: "囊",
  NAYOK: "那育",
  NGA: "牙",
  NON: "农",
  NONG: "廊",
  NOI: "诺伊",
  PATHUM: "巴吞",
  PAK: "巴",
  PHA: "帕",
  PHAN: "帕侬",
  PHET: "碧",
  PHI: "披",
  PHLI: "普里",
  PHON: "蓬",
  PHRA: "帕",
  PHRAE: "帕府",
  PHU: "普",
  PHUKET: "普吉",
  PRACHIN: "巴真",
  PRACHUAP: "巴蜀",
  RATCHA: "叻差",
  RATCHASIMA: "叻差是玛",
  RANONG: "拉廊",
  RAYONG: "罗勇",
  ROI: "黎逸",
  SAI: "赛",
  SAK: "色",
  SAKON: "色军",
  SAM: "三",
  SAMUT: "沙没",
  SARAKHAM: "沙拉堪",
  SARABURI: "北标",
  SONG: "宋",
  SONGKHLA: "宋卡",
  SUKHOTHAI: "素可泰",
  SUPHAN: "素攀",
  SURAT: "素叻",
  SURIN: "素林",
  TAK: "达",
  THANI: "他尼",
  THONG: "通",
  TRANG: "董里",
  TRAT: "达叻",
  UBON: "乌汶",
  UDON: "乌隆",
  UTHAI: "乌泰",
  UTTARADIT: "程逸",
  YALA: "也拉",
  YASOTHON: "益梭通",
  YAI: "艾",
  YANG: "扬",
};

const districtPhraseTranslations: Record<string, string> = {
  "nakhon_nayok::ban_na": "班纳县",
  "nakhon_nayok::mueang_nakhon_nayok": "那空那育府直辖县",
  "nakhon_nayok::ongkharak": "翁卡叻县",
  "nakhon_nayok::pak_phli": "北披县",
};

const letterTranslations: Record<string, string> = {
  A: "阿",
  B: "布",
  C: "克",
  D: "德",
  E: "埃",
  F: "弗",
  G: "格",
  H: "哈",
  I: "伊",
  J: "杰",
  K: "克",
  L: "勒",
  M: "姆",
  N: "恩",
  O: "奥",
  P: "普",
  Q: "克",
  R: "尔",
  S: "斯",
  T: "特",
  U: "乌",
  V: "维",
  W: "沃",
  X: "克斯",
  Y: "伊",
  Z: "扎",
  "0": "零",
  "1": "一",
  "2": "二",
  "3": "三",
  "4": "四",
  "5": "五",
  "6": "六",
  "7": "七",
  "8": "八",
  "9": "九",
};

const tdacOptionKey = (value: string): string => value
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const provinceKey = (province: string): string => tdacOptionKey(province);

const districtKey = (province: string, district: string, postcode?: string): string => [
  provinceKey(province),
  tdacOptionKey(district),
  ...(postcode ? [tdacOptionKey(postcode)] : []),
].join("::");

const subdistrictKey = (
  province: string,
  district: string,
  subdistrict: string,
  postcode?: string,
  occurrence = 1,
): string => `${districtKey(province, district, postcode)}::${tdacOptionKey(subdistrict)}${occurrence > 1 ? `::${occurrence}` : ""}`;

const translateToken = (token: string): string => {
  const normalized = token.toUpperCase();
  if (tokenTranslations[normalized]) return tokenTranslations[normalized];
  return [...normalized].map((character) => letterTranslations[character] ?? "地").join("");
};

export const translateThaiRomanizedName = (name: string): string => {
  const tokens = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const translated = tokens.map(translateToken).join("");
  return translated || "未命名";
};

const provinceStem = (label: string): string => label.replace(/[府省市]$/, "");

const translateDistrictName = (
  province: string,
  provinceZh: string,
  district: string,
): string => {
  const provinceSlug = provinceKey(province);
  const districtSlug = tdacOptionKey(district);
  const provinceSlugWithoutPostfix = tdacOptionKey(province.replace(/\s+PROVINCE$/i, ""));
  const mueangPrefix = /^MUEANG\s+/i.test(district);
  const mueangName = district.replace(/^MUEANG\s+/i, "");

  const explicitTranslation = districtPhraseTranslations[`${provinceSlug}::${districtSlug}`];
  if (explicitTranslation) return explicitTranslation;

  if (mueangPrefix && tdacOptionKey(mueangName) === provinceSlugWithoutPostfix) {
    return `${provinceStem(provinceZh)}直辖县`;
  }

  const suffix = provinceSlug === "bangkok" || districtSlug.endsWith("khet") ? "区" : "县";
  return `${translateThaiRomanizedName(district)}${suffix}`;
};

const translateSubdistrictName = (subdistrict: string): string =>
  `${translateThaiRomanizedName(subdistrict)}分区`;

const manualDistrictTranslations = new Map<string, string>();
for (const [province, options] of Object.entries(TDAC_DISTRICT_TRANSLATION_OPTIONS_BY_PROVINCE)) {
  for (const item of options) {
    manualDistrictTranslations.set(
      `${provinceKey(province)}::${tdacOptionKey(item.official_label)}`,
      item.label_zh,
    );
  }
}

const manualSubdistrictTranslations = new Map<string, string>();
for (const [district, options] of Object.entries(TDAC_SUBDISTRICT_TRANSLATION_OPTIONS_BY_DISTRICT)) {
  for (const item of options) {
    manualSubdistrictTranslations.set(
      `${tdacOptionKey(district)}::${tdacOptionKey(item.official_label)}`,
      item.label_zh,
    );
  }
}

const duplicateDistrictLabels = (districts: Array<{ label: string; postcode?: string }>): Set<string> => {
  const counts = new Map<string, number>();
  for (const district of districts) {
    const label = district.label.toUpperCase();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label));
};

export const buildAdministrativeTranslationCache = (): AdministrativeTranslationCache => {
  const provinceTranslations = Object.fromEntries(
    TDAC_PROVINCE_TRANSLATION_OPTIONS.map((item) => [provinceKey(item.official_label), item.label_zh]),
  );
  const districts: Record<string, string> = {};
  const subdistricts: Record<string, string> = {};
  let districtFallbackCount = 0;
  let subdistrictFallbackCount = 0;

  for (const province of TDAC_OFFICIAL_PROVINCE_LABELS) {
    const provinceZh = provinceTranslations[provinceKey(province)] ?? translateThaiRomanizedName(province);
    const officialDistricts = TDAC_OFFICIAL_DISTRICTS_BY_PROVINCE[province] ?? [];
    const duplicateLabels = duplicateDistrictLabels(officialDistricts);
    for (const district of officialDistricts) {
      const includePostcode = duplicateLabels.has(district.label.toUpperCase());
      const key = districtKey(province, district.label, includePostcode ? district.postcode ?? "no_postcode" : undefined);
      const manual = manualDistrictTranslations.get(`${provinceKey(province)}::${tdacOptionKey(district.label)}`);
      districts[key] = manual ?? translateDistrictName(province, provinceZh, district.label);
      if (!manual) districtFallbackCount += 1;
    }
  }

  for (const [provinceDistrict, officialSubdistricts] of Object.entries(
    TDAC_OFFICIAL_SUBDISTRICTS_BY_PROVINCE_DISTRICT,
  )) {
    const [province = "", district = "", postcode] = provinceDistrict.split("::");
    const subdistrictOccurrences = new Map<string, number>();
    for (const subdistrict of officialSubdistricts) {
      const normalizedSubdistrict = tdacOptionKey(subdistrict);
      const occurrence = (subdistrictOccurrences.get(normalizedSubdistrict) ?? 0) + 1;
      subdistrictOccurrences.set(normalizedSubdistrict, occurrence);
      const key = subdistrictKey(province, district, subdistrict, postcode, occurrence);
      const manual = manualSubdistrictTranslations.get(
        `${tdacOptionKey(district)}::${tdacOptionKey(subdistrict)}`,
      );
      subdistricts[key] = manual ?? translateSubdistrictName(subdistrict);
      if (!manual) subdistrictFallbackCount += 1;
    }
  }

  return {
    _meta: {
      generated_at: new Date().toISOString(),
      official_option_source: "Thailand Immigration Bureau TDAC API audit",
      standardized_translation_source: "Official TDAC English list plus verified common Chinese geographic names",
      fallback_translation_source: "Repository-local tokenized Chinese phonetic transliteration (no runtime network)",
      province_count: Object.keys(provinceTranslations).length,
      district_count: Object.keys(districts).length,
      subdistrict_count: Object.keys(subdistricts).length,
      fallback_policy: "Use a parent-context key; retain curated names where available and transliterate every remaining official romanized name into Chinese with an administrative-level suffix.",
      district_fallback_count: districtFallbackCount,
      subdistrict_fallback_count: subdistrictFallbackCount,
    },
    provinces: provinceTranslations,
    districts,
    subdistricts,
  };
};

const main = (): void => {
  const outputUrl = new URL("./administrative-translations.zh.json", import.meta.url);
  const cache = buildAdministrativeTranslationCache();
  writeFileSync(outputUrl, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  console.log(
    `Generated TDAC administrative translations: ${cache._meta.province_count} provinces, ` +
      `${cache._meta.district_count} districts, ${cache._meta.subdistrict_count} subdistricts`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
