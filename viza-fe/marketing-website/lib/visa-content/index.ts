/**
 * Visa content registry (MKT-004).
 *
 * Maps a country slug (lib/countries.ts `CountryMeta.slug`) to its rich
 * `VisaContent`. `app/[locale]/visa/[country]/page.tsx` renders
 * `VisaCountryRich` for any launched country found here; launched countries not
 * yet authored fall back to the thin `VisaCountryTemplate`.
 *
 * To add a destination: create `lib/visa-content/<slug>.ts` exporting a
 * `VisaContent`, then register it in `CONTENT` below.
 */
import type { VisaContent } from "./types";
import { contentZhBySlug } from "./zh-CN";
import { applyOverlay, isNativeZh } from "@/lib/i18n-overlay";
import { visaOverlay } from "@/lib/i18n-content";
import { indonesia } from "./indonesia";
import { egypt } from "./egypt";
import { australia } from "./australia";
import { saudiArabia } from "./saudi-arabia";
import { unitedKingdom } from "./united-kingdom";
import { vietnam } from "./vietnam";
import { malaysia } from "./malaysia";
import { japan } from "./japan";
import { unitedStates } from "./united-states";
import { canada } from "./canada";
import { turkiye } from "./turkiye";
import { thailand } from "./thailand";
import { unitedArabEmirates } from "./united-arab-emirates";
import { france } from "./france";
import { italy } from "./italy";
import { india } from "./india";
import { china } from "./china";
import { southKorea } from "./south-korea";
import { schengen } from "./schengen";

export const CONTENT: Record<string, VisaContent> = {
  indonesia,
  egypt,
  australia,
  "saudi-arabia": saudiArabia,
  "united-kingdom": unitedKingdom,
  vietnam,
  malaysia,
  japan,
  "united-states": unitedStates,
  canada,
  turkiye,
  thailand,
  "united-arab-emirates": unitedArabEmirates,
  france,
  italy,
  india,
  china,
  "south-korea": southKorea,
  schengen,
};

/**
 * Resolve rich content for a slug in `locale`. Server only: the result is passed to the client page as props.
 *   en      the English object in code
 *   zh-*    the hand-written zh-CN twin, else English
 *   others  English with translations/<locale>/visa/<slug>.json laid over it (English where a string is missing)
 */
export async function loadVisaContent(slug: string, locale?: string): Promise<VisaContent | undefined> {
  if (locale && isNativeZh(locale)) {
    const zh = contentZhBySlug(slug);
    if (zh) return zh;
  }
  const en = CONTENT[slug];
  if (!en || !locale) return en;
  return applyOverlay(en, await visaOverlay(locale, slug));
}

export type { VisaContent } from "./types";
