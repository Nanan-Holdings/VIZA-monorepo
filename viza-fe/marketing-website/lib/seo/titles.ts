/**
 * Destination page titles and descriptions. Pure functions with no alias
 * imports, so scripts/og.mjs and scripts/check-copy.mjs can load this file.
 *
 * Title patterns (SEO plan, Phase B):
 *   embassy visa:  "{Country} Visa from Singapore: Fees and How to Apply | VIZA"
 *   e-visa:        "{Country} e-Visa: Requirements and How to Apply | VIZA"
 *   Chinese:       "新加坡办理{国家}签证：材料、费用与流程 | VIZA"
 * Titles stay at 60 characters or fewer: a long country name steps down to a
 * shorter wording rather than being cut mid-word.
 */
import type { CountryMeta } from "../countries";

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Countries whose visa is applied for online as an e-visa (card tag "fast" in lib/countries.ts). */
export function isEvisa(country: Pick<CountryMeta, "tag">): boolean {
  return country.tag === "fast";
}

const len = (s: string) => [...s].length;

/**
 * Hand-written wording for destinations whose keyword research calls for it (Phase B pages). Keyed by slug,
 * then "en" or "zh". Anything missing falls back to the patterns below.
 */
const OVERRIDES: Record<string, Partial<Record<"en" | "zh", { title?: string; description?: string }>>> = {
  japan: {
    en: { description: "Japan visa from Singapore: who needs one, the government fee, documents by pass type and how to apply. VIZA is free and an advisor checks every form." },
    zh: { description: "新加坡办理日本签证：谁需要签证、政府费用、各类居留证件所需材料和办理流程。VIZA 的服务免费，每份申请提交前都由顾问核对。" },
  },
  china: {
    en: { description: "Apply for a China visa in Singapore: who needs one, Singapore passport visa-free rules, the visa centre, fees and documents. VIZA is free." },
    zh: { description: "在新加坡申请中国签证：谁需要签证、新加坡护照免签规则、签证中心、费用和材料。VIZA 的服务免费，欢迎咨询顾问。" },
  },
  "south-korea": {
    en: {
      title: "Korea K-ETA: Requirements and How to Apply | VIZA",
      description: "Korea K-ETA and visa guide for people in Singapore: who needs a K-ETA, the KRW 10,000 fee, the visa route, documents and the e-Arrival Card.",
    },
    zh: { description: "新加坡办理韩国签证与 K-ETA：谁需要 K-ETA、费用、签证办理途径、材料和入境电子卡。VIZA 的服务免费，每份申请提交前都由顾问核对。" },
  },
  schengen: {
    en: { description: "Schengen visa from Singapore: which country to apply to, the EUR 90 fee, VFS and BLS centres, insurance and documents. VIZA is free." },
    zh: { description: "新加坡办理申根签证：向哪个国家申请、90 欧元签证费、VFS 与 BLS 受理中心、旅行保险和材料。VIZA 的服务免费，欢迎咨询顾问。" },
  },
  indonesia: { en: { title: "Indonesia Visa on Arrival (e-VOA): How to Apply | VIZA" }, zh: { title: "印尼落地签（e-VOA）：材料、费用与申请 | VIZA" } },
  thailand: { en: { title: "Thailand Visa from Singapore: Rules and e-Visa | VIZA" } },
  malaysia: { en: { title: "Malaysia Visa Application: Do You Need One? | VIZA" } },
  india: { en: { title: "India e-Visa: Requirements and How to Apply | VIZA" } },
  vietnam: { en: { title: "Vietnam e-Visa: Requirements and How to Apply | VIZA" } },
  turkiye: { en: { title: "Turkey e-Visa: Requirements and How to Apply | VIZA" }, zh: { title: "土耳其电子签证：材料、费用与申请流程 | VIZA" } },
  "united-arab-emirates": { en: { title: "UAE Visa: Dubai Entry Rules and How to Apply | VIZA" }, zh: { title: "阿联酋签证（迪拜）：入境规则与申请流程 | VIZA" } },
  "saudi-arabia": { en: { title: "Saudi Visa: e-Visa Requirements and How to Apply | VIZA" } },
  "united-states": { en: { title: "US Visa Application in Singapore: Fees and Steps | VIZA" } },
  "united-kingdom": { en: { title: "UK Visa Application in Singapore: Fees and Steps | VIZA" } },
  australia: { en: { title: "Australia Visa from Singapore: ETA and Visitor Visa | VIZA" } },
};
const isZh = (locale: string) => locale === "zh-CN";
const lang = (locale: string): "en" | "zh" => (isZh(locale) ? "zh" : "en");

/**
 * The English title and description wording, as data. scripts/i18n/translate.mjs translates it into
 * translations/<locale>/seo.json; lib/seo/seo-copy.ts loads that and the caller passes it as `copy`.
 * "{name}" is the destination name. Title options run from longest to shortest, and the first one that fits
 * 60 characters is used.
 */
export interface SeoCopy {
  patterns: {
    evisaTitles: string[];
    visaTitles: string[];
    evisaDescription: string;
    visaDescription: string;
  };
  /** Finished titles and descriptions for destinations whose keyword research calls for specific wording. */
  overrides: Record<string, { title?: string; description?: string }>;
}

export const SEO_SOURCE: SeoCopy = {
  patterns: {
    evisaTitles: [
      "{name} e-Visa: Requirements and How to Apply | VIZA",
      "{name} e-Visa: Requirements and Steps | VIZA",
      "{name} e-Visa from Singapore | VIZA",
      "{name} e-Visa | VIZA",
    ],
    visaTitles: [
      "{name} Visa from Singapore: Fees and How to Apply | VIZA",
      "{name} Visa from Singapore: Fees and Steps | VIZA",
      "{name} Visa from Singapore | VIZA",
      "{name} Visa | VIZA",
    ],
    evisaDescription: "{name} e-visa requirements, government fee and processing time for people living in Singapore. VIZA is free and an advisor checks every form.",
    visaDescription: "{name} visa for people living in Singapore: documents, government fee and processing time. VIZA is free and an advisor checks every form.",
  },
  overrides: Object.fromEntries(
    Object.entries(OVERRIDES).flatMap(([slug, v]) => (v.en ? [[slug, v.en]] : [])),
  ),
};

const isEnglish = (locale: string) => locale === "en";
const fill = (text: string, name: string) => text.replaceAll("{name}", name);

function firstThatFits(options: string[]): string {
  return options.find((o) => len(o) <= TITLE_MAX) ?? options[options.length - 1];
}

export function destinationTitle(
  country: Pick<CountryMeta, "tag" | "slug">,
  name: string,
  locale: string,
  /** Translated wording for locales other than en and zh (from lib/seo/seo-copy.ts). Null or absent means English. */
  copy?: SeoCopy | null,
): string {
  if (copy && !isEnglish(locale) && lang(locale) === "en") {
    const own = copy.overrides[country.slug]?.title;
    if (own) return own;
    const list = isEvisa(country) ? copy.patterns.evisaTitles : copy.patterns.visaTitles;
    return firstThatFits(list.map((o) => fill(o, name)));
  }
  const custom = OVERRIDES[country.slug]?.[lang(locale)]?.title;
  if (custom) return custom;
  if (isZh(locale) && isEvisa(country)) {
    return firstThatFits([
      `${name}电子签证：材料、费用与申请流程 | VIZA`,
      `${name}电子签证：材料与申请流程 | VIZA`,
      `${name}电子签证 | VIZA`,
    ]);
  }
  if (isZh(locale)) {
    return firstThatFits([
      `新加坡办理${name}签证：材料、费用与流程 | VIZA`,
      `新加坡办理${name}签证：材料与流程 | VIZA`,
      `新加坡办理${name}签证 | VIZA`,
    ]);
  }
  const list = isEvisa(country) ? SEO_SOURCE.patterns.evisaTitles : SEO_SOURCE.patterns.visaTitles;
  return firstThatFits(list.map((o) => fill(o, name)));
}

export function destinationDescription(
  country: Pick<CountryMeta, "tag" | "validity" | "slug">,
  name: string,
  locale: string,
  copy?: SeoCopy | null,
): string {
  if (copy && !isEnglish(locale) && lang(locale) === "en") {
    const own = copy.overrides[country.slug]?.description;
    if (own) return own;
    return fill(isEvisa(country) ? copy.patterns.evisaDescription : copy.patterns.visaDescription, name);
  }
  const custom = OVERRIDES[country.slug]?.[lang(locale)]?.description;
  if (custom) return custom;
  if (isZh(locale)) {
    return isEvisa(country)
      ? `在新加坡办理${name}电子签证：所需材料、政府费用和办理时间。VIZA 的服务免费，每份申请提交前都由顾问核对。`
      : `在新加坡办理${name}签证：所需材料、政府费用和办理时间。VIZA 的服务免费，每份申请提交前都由顾问核对。`;
  }
  return fill(isEvisa(country) ? SEO_SOURCE.patterns.evisaDescription : SEO_SOURCE.patterns.visaDescription, name);
}
