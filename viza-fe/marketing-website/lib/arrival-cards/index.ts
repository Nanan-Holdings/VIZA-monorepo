import type { GuideContent, GuideMeta } from "./types";
import { isLocale } from "@/lib/locales";

/**
 * Registry of arrival card guides. Facts checked on 25 November 2026 against the official pages listed in
 * each guide's sources. Things we could not confirm are hedged in the guide text:
 *  - MDAC: the exact submission window and the field list come from news and travel guides, because the
 *    Immigration Department's eligibility and how-to pages are infographics we could not read.
 *  - TDAC: the official portal did not load for us; rules come from Thai embassy notices.
 *  - Visit Japan Web: the Digital Agency pages did not load; rules come from Japan Customs and travel guides.
 *  - All Indonesia: the timing and scope come from the Indonesia tourism site and press, not the portal itself.
 *  - SG Arrival Card: the MyICA app and auto-fill details come from a press summary of 16 Sep 2026.
 */
export const GUIDES: readonly GuideMeta[] = [
  {
    slug: "malaysia-mdac",
    name: { en: "Malaysia MDAC", zh: "马来西亚 MDAC" },
    country: { en: "Malaysia", zh: "马来西亚" },
    visaSlug: "malaysia",
    officialUrl: "https://imigresen-online.imi.gov.my/mdac/main",
    officialHost: "imigresen-online.imi.gov.my",
    portal: { country: "malaysia", visaType: "MY_MDAC_ARRIVAL_CARD", pricedRow: false },
  },
  {
    slug: "singapore-sg-arrival-card",
    name: { en: "SG Arrival Card", zh: "新加坡入境卡 SGAC" },
    country: { en: "Singapore", zh: "新加坡" },
    visaSlug: null,
    officialUrl: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card",
    officialHost: "ica.gov.sg",
    portal: { country: "singapore", visaType: "SG_ARRIVAL_CARD", pricedRow: false },
  },
  {
    slug: "japan-visit-japan-web",
    name: { en: "Japan Visit Japan Web", zh: "日本 Visit Japan Web" },
    country: { en: "Japan", zh: "日本" },
    visaSlug: "japan",
    officialUrl: "https://vjw-lp.digital.go.jp/en/",
    officialHost: "vjw-lp.digital.go.jp",
    portal: { country: "japan", visaType: "JP_VISIT_JAPAN_WEB", pricedRow: false },
  },
  {
    slug: "thailand-tdac",
    name: { en: "Thailand TDAC", zh: "泰国 TDAC" },
    country: { en: "Thailand", zh: "泰国" },
    visaSlug: "thailand",
    officialUrl: "https://tdac.immigration.go.th",
    officialHost: "tdac.immigration.go.th",
    portal: { country: "thailand", visaType: "TH_TDAC_ARRIVAL_CARD", pricedRow: false },
  },
  {
    slug: "korea-e-arrival-card",
    name: { en: "Korea e-Arrival Card", zh: "韩国电子入境卡" },
    country: { en: "South Korea", zh: "韩国" },
    visaSlug: "south-korea",
    officialUrl: "https://www.e-arrivalcard.go.kr",
    officialHost: "e-arrivalcard.go.kr",
    portal: { country: "south_korea", visaType: "KR_E_ARRIVAL_CARD", pricedRow: true },
  },
  {
    slug: "indonesia-all-indonesia",
    name: { en: "Indonesia All Indonesia", zh: "印尼 All Indonesia" },
    country: { en: "Indonesia", zh: "印度尼西亚" },
    visaSlug: "indonesia",
    officialUrl: "https://allindonesia.imigrasi.go.id",
    officialHost: "allindonesia.imigrasi.go.id",
    portal: null,
  },
] as const;

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);

export function guideBySlug(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Guide for a /visa slug, used by the destination pages. */
export function guideForVisa(visaSlug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.visaSlug === visaSlug);
}

type Loader = () => Promise<{ default: GuideContent }>;
const EN: Record<string, Loader> = Object.fromEntries(
  GUIDES.map((g) => [g.slug, () => import(`./en/${g.slug}`) as Promise<{ default: GuideContent }>]),
);
const ZH: Record<string, Loader> = Object.fromEntries(
  GUIDES.map((g) => [g.slug, () => import(`./zh-CN/${g.slug}`) as Promise<{ default: GuideContent }>]),
);

export async function loadGuide(slug: string, locale: string): Promise<GuideContent | null> {
  const loader = (isLocale(locale) && locale === "zh-CN" ? ZH : EN)[slug];
  return loader ? (await loader()).default : null;
}
