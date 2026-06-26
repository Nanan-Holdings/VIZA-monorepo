import { readFileSync } from "node:fs";
import type { MdacOption } from "./official-options";

type MdacOptionKind = "city" | "state" | "accommodation";

type MdacZhTranslationCache = {
  city?: Record<string, string>;
};

function loadTranslationCache(): MdacZhTranslationCache {
  try {
    return JSON.parse(readFileSync(new URL("./option-translations.zh.json", import.meta.url), "utf8")) as MdacZhTranslationCache;
  } catch {
    return {};
  }
}

const TRANSLATION_CACHE = loadTranslationCache();

const STATE_ZH_OVERRIDES: Record<string, string> = {
  JOHOR: "柔佛",
  KEDAH: "吉打",
  KELANTAN: "吉兰丹",
  MELAKA: "马六甲",
  "N SEMBILAN": "森美兰",
  "NEGERI SEMBILAN": "森美兰",
  PAHANG: "彭亨",
  "P PINANG": "槟城",
  "PULAU PINANG": "槟城",
  PERAK: "霹雳",
  PERLIS: "玻璃市",
  SELANGOR: "雪兰莪",
  TERENGGANU: "登嘉楼",
  SABAH: "沙巴",
  SARAWAK: "砂拉越",
  "W.PERSEKUTUAN": "吉隆坡联邦直辖区",
  "WP KUALA LUMPUR": "吉隆坡联邦直辖区",
  "W.P LABUAN": "纳闽联邦直辖区",
  "WP LABUAN": "纳闽联邦直辖区",
  PUTRAJAYA: "布城联邦直辖区",
  "WP PUTRAJAYA": "布城联邦直辖区",
};

const CITY_ZH_OVERRIDES: Record<string, string> = {
  JOHOR: "柔佛",
  KEDAH: "吉打",
  KELANTAN: "吉兰丹",
  MELAKA: "马六甲",
  "N SEMBILAN": "森美兰",
  PAHANG: "彭亨",
  "P PINANG": "槟城",
  PERAK: "霹雳",
  PERLIS: "玻璃市",
  SELANGOR: "雪兰莪",
  TERENGGANU: "登嘉楼",
  SABAH: "沙巴",
  SARAWAK: "砂拉越",
  "W.PERSEKUTUAN": "吉隆坡联邦直辖区",
  "W.P LABUAN": "纳闽联邦直辖区",
  PUTRAJAYA: "布城",
  "JOHOR BAHRU": "新山",
  "KUALA LUMPUR": "吉隆坡",
  "KOTA KINABALU": "哥打京那巴鲁",
  KUCHING: "古晋",
  IPOH: "怡保",
  "ALOR SETAR": "亚罗士打",
  "KOTA BHARU": "哥打巴鲁",
  "KUALA TERENGGANU": "瓜拉登嘉楼",
  "PULAU PINANG": "槟城",
  GEORGETOWN: "乔治市",
  MELAKA: "马六甲",
  SEREMBAN: "芙蓉",
  KUANTAN: "关丹",
  SHAH_ALAM: "莎阿南",
  "SHAH ALAM": "莎阿南",
  PETALING_JAYA: "八打灵再也",
  "PETALING JAYA": "八打灵再也",
  KLANG: "巴生",
  SUBANG_JAYA: "梳邦再也",
  "SUBANG JAYA": "梳邦再也",
  PUTRAJAYA: "布城",
  LABUAN: "纳闽",
  MIRI: "美里",
  SIBU: "诗巫",
  BINTULU: "民都鲁",
  SANDAKAN: "山打根",
  TAWAU: "斗湖",
  LAHAD_DATU: "拿笃",
  "LAHAD DATU": "拿笃",
  LANGKAWI: "兰卡威",
  "BATU PAHAT": "峇株巴辖",
  MUAR: "麻坡",
  KLUANG: "居銮",
  SEGAMAT: "昔加末",
  KULAI: "古来",
  MERSING: "丰盛港",
};

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function cleanZh(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/，/g, " / ")
    .replace(/^马来西亚/, "")
    .replace(/邮政编码/g, "")
    .replace(/区$/g, "");
}

function mdacOptionLabelZh(kind: MdacOptionKind, option: MdacOption): string {
  if (kind === "state") {
    return STATE_ZH_OVERRIDES[normalizeKey(option.official_label ?? option.label_en)] ?? option.label_zh;
  }
  if (kind === "city") {
    const cached = TRANSLATION_CACHE.city?.[option.value];
    const override = CITY_ZH_OVERRIDES[normalizeKey(option.label_en)];
    const zh = override ?? (cached ? cleanZh(cached) : null);
    return zh || option.label_zh;
  }
  return option.label_zh;
}

export function localizeMdacOptions(kind: MdacOptionKind, options: MdacOption[]): MdacOption[] {
  return options.map((option) => ({
    ...option,
    label_zh: mdacOptionLabelZh(kind, option),
  }));
}

export function localizeMdacCityOptionsByState(optionsByState: Record<string, MdacOption[]>): Record<string, MdacOption[]> {
  return Object.fromEntries(
    Object.entries(optionsByState).map(([state, options]) => [state, localizeMdacOptions("city", options)]),
  );
}
