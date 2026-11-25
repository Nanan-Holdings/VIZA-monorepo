import type { GuideContent, GuideMeta } from "./types";
import { applyOverlay } from "@/lib/i18n-overlay";
import { guideOverlay, metaOverlay, pickLocal, usesOverlay } from "@/lib/i18n-content";

/**
 * Registry of evergreen guides. Facts checked on 25 November 2026 against the official pages listed in each
 * guide's sources; anything unconfirmed is hedged in the guide text and noted in that file's header comment.
 */
export const GUIDES: readonly GuideMeta[] = [
  {
    slug: "visa-free-countries-singapore-passport",
    name: { en: "Visa-free countries for Singapore passport holders", zh: "新加坡护照免签国家" },
    tag: { en: "Singapore passport", zh: "新加坡护照" },
    summary: {
      en: "Where a Singapore passport gets you in without a visa, which places still need an e-visa or an arrival card, and how to check.",
      zh: "新加坡护照可以免签入境的地方、仍需电子签或入境卡的地方，以及怎么查最新规定。",
    },
    visa: ["china", "japan", "south-korea", "thailand", "vietnam", "united-arab-emirates", "united-kingdom"],
    arrival: ["malaysia-mdac", "japan-visit-japan-web", "thailand-tdac", "korea-e-arrival-card", "indonesia-all-indonesia"],
    topics: ["visa-free", "visa free", "visa exemption"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "visas-chinese-passport-holders-singapore",
    name: { en: "Visas for Chinese passport holders in Singapore", zh: "新加坡的中国护照持有人办签证" },
    tag: { en: "Chinese passport", zh: "中国护照" },
    summary: {
      en: "What a Chinese passport holder on an EP, S Pass, Dependant Pass or PR needs for popular destinations, and where to apply.",
      zh: "持中国护照、在新加坡以 EP、S Pass、家属准证或永久居民身份居住的人，去热门目的地要办什么、在哪里办。",
    },
    visa: ["japan", "south-korea", "thailand", "vietnam", "malaysia", "indonesia", "schengen", "united-kingdom", "united-states", "australia", "canada"],
    arrival: ["malaysia-mdac", "thailand-tdac", "korea-e-arrival-card", "indonesia-all-indonesia"],
    topics: ["chinese passport", "chinese citizens", "prc", "employment pass", "s pass", "dependant", "permanent resident"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "visas-filipino-indian-residents-singapore",
    name: { en: "Visas for Filipino and Indian residents of Singapore", zh: "新加坡的菲律宾和印度居民办签证" },
    tag: { en: "Filipino and Indian passports", zh: "菲律宾和印度护照" },
    summary: {
      en: "Japan, Thailand, Schengen, the UK and more for Filipino and Indian passport holders living in Singapore, and where each application goes.",
      zh: "住在新加坡的菲律宾和印度护照持有人，办理日本、泰国、申根、英国等签证的要求，以及各自的递交地点。",
    },
    visa: ["japan", "thailand", "schengen", "united-kingdom", "south-korea", "vietnam", "indonesia", "australia", "turkiye", "china"],
    arrival: ["japan-visit-japan-web", "thailand-tdac", "indonesia-all-indonesia"],
    topics: ["filipino", "philippine", "indian passport", "indians"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "schengen-visa-checklist-singapore",
    name: { en: "Schengen visa document checklist from Singapore", zh: "新加坡申根签证材料清单" },
    tag: { en: "Schengen", zh: "申根" },
    summary: {
      en: "Every document a Schengen visa application from Singapore needs, including travel insurance, plus where to apply and what to avoid.",
      zh: "在新加坡申请申根签证需要的全部材料，包括旅行保险，以及在哪里递交、要避免哪些问题。",
    },
    visa: ["schengen", "france", "italy"],
    arrival: [],
    topics: ["schengen", "etias", "ees", "europe"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "us-visa-interview-singapore",
    name: { en: "US visa interview in Singapore", zh: "新加坡美国签证面谈" },
    tag: { en: "United States", zh: "美国" },
    summary: {
      en: "How to book the US visa interview in Singapore, what to bring on the day, and the questions officers commonly ask.",
      zh: "怎样预约新加坡的美国签证面谈、当天带什么，以及签证官常问的问题。",
    },
    visa: ["united-states"],
    arrival: [],
    topics: ["ds-160", "ds160", "us visa", "interview", "b1/b2", "f-1"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "eta-vs-visa",
    name: { en: "ETA vs visa: UK, Australia, Korea and Canada", zh: "电子旅行授权和签证的区别" },
    tag: { en: "ETA", zh: "电子旅行授权" },
    summary: {
      en: "What an ETA is, how it differs from a visa, and how the UK ETA, Australia ETA, Korea K-ETA and Canada eTA work.",
      zh: "电子旅行授权是什么、和签证有什么区别，以及英国 ETA、澳大利亚 ETA、韩国 K-ETA 和加拿大 eTA 怎么运作。",
    },
    visa: ["united-kingdom", "australia", "south-korea", "canada"],
    arrival: ["korea-e-arrival-card"],
    topics: ["eta", "k-eta", "electronic travel authorisation", "electronic travel authorization", "etias"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "e-visa-vs-visa-on-arrival-vs-embassy-visa",
    name: { en: "e-Visa vs visa on arrival vs embassy visa", zh: "电子签、落地签和使馆签证的区别" },
    tag: { en: "Visa types", zh: "签证类型" },
    summary: {
      en: "Three ways to get a visa, how they differ in time and risk, and how to choose for Vietnam, Indonesia, India, Thailand and others.",
      zh: "办签证的三种方式在时间和风险上的区别，以及怎样为越南、印尼、印度、泰国等目的地选择。",
    },
    visa: ["vietnam", "indonesia", "india", "thailand", "turkiye", "egypt", "united-arab-emirates", "saudi-arabia"],
    arrival: ["indonesia-all-indonesia", "thailand-tdac"],
    topics: ["e-visa", "evisa", "visa on arrival", "voa"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "visa-refused-reapply",
    name: { en: "Visa refused: why it happens and how to reapply", zh: "签证被拒：原因和重新申请" },
    tag: { en: "Refusals", zh: "拒签" },
    summary: {
      en: "Why visas are refused, how to read a refusal letter, and how to reapply with a stronger application.",
      zh: "签证被拒的常见原因、怎样读懂拒签信，以及怎样准备一份更扎实的再次申请。",
    },
    visa: ["schengen", "united-states", "united-kingdom", "japan", "australia", "canada"],
    arrival: [],
    topics: ["refus", "reject", "denied", "overstay"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
  {
    slug: "visa-photo-requirements",
    name: { en: "Visa photo requirements by country", zh: "各国签证照片要求" },
    tag: { en: "Photos", zh: "照片" },
    summary: {
      en: "Photo size, background and rules for the most requested visas from Singapore, and the mistakes that get a photo rejected.",
      zh: "新加坡办理热门签证的照片尺寸、底色和规则，以及最容易导致照片被退回的错误。",
    },
    visa: ["united-states", "schengen", "united-kingdom", "japan", "china", "india", "vietnam", "australia", "canada", "south-korea"],
    arrival: [],
    topics: ["photo"],
    published: "2026-11-25",
    modified: "2026-11-25",
  },
] as const;

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);

export function guideBySlug(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Guides that link to a /visa destination, for "Related guides" on destination pages. */
export function guidesForVisa(visaSlug: string): GuideMeta[] {
  return GUIDES.filter((g) => g.visa.includes(visaSlug));
}

/**
 * Guides that match a news post: any guide that lists the post's destination, then any whose topic words
 * appear in the post's title or slug. At most three. No CMS fields are needed.
 */
export function guidesForPost(post: { title: string; slug: string }, destinationSlug: string | null): GuideMeta[] {
  const text = `${post.title} ${post.slug.replace(/-/g, " ")}`.toLowerCase();
  const direct = destinationSlug ? GUIDES.filter((g) => g.visa.includes(destinationSlug)) : [];
  const byTopic = GUIDES.filter((g) => !direct.includes(g) && g.topics.some((w) => text.includes(w)));
  // Topic matches rank first: they are the more specific link.
  return [...byTopic, ...direct].slice(0, 3);
}

type Loader = () => Promise<{ default: GuideContent }>;
const EN: Record<string, Loader> = Object.fromEntries(
  GUIDES.map((g) => [g.slug, () => import(`./en/${g.slug}`) as Promise<{ default: GuideContent }>]),
);
const ZH: Record<string, Loader> = Object.fromEntries(
  GUIDES.map((g) => [g.slug, () => import(`./zh-CN/${g.slug}`) as Promise<{ default: GuideContent }>]),
);

/** English, the hand-written zh-CN twin, or English with translations/<locale>/guides/<slug>.json laid over it. */
export async function loadGuide(slug: string, locale: string): Promise<GuideContent | null> {
  const loader = (locale === "zh-CN" ? ZH : EN)[slug];
  if (!loader) return null;
  const guide = (await loader()).default;
  return usesOverlay(locale) ? applyOverlay(guide, await guideOverlay(locale, slug)) : guide;
}

/** A guide's card fields resolved to plain strings for one locale. */
export type LocalGuideMeta = Omit<GuideMeta, "name" | "tag" | "summary"> & { name: string; tag: string; summary: string };

export async function localizedGuides(locale: string): Promise<LocalGuideMeta[]> {
  const ov = usesOverlay(locale) ? await metaOverlay(locale) : null;
  return GUIDES.map((g) => ({
    ...g,
    name: pickLocal(g.name, locale, ov?.[`guides/${g.slug}/name`]),
    tag: pickLocal(g.tag, locale, ov?.[`guides/${g.slug}/tag`]),
    summary: pickLocal(g.summary, locale, ov?.[`guides/${g.slug}/summary`]),
  }));
}
