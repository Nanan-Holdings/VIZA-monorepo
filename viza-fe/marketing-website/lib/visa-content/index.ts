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
import { vizaTest } from "./viza-test";

const CONTENT: Record<string, VisaContent> = {
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
  "viza-test": vizaTest,
};

/**
 * Resolve rich content for a slug, localized by `locale`. zh locales get the
 * Simplified-Chinese twin when available, else fall back to English.
 */
export function contentBySlug(slug: string, locale?: string): VisaContent | undefined {
  if (locale && locale.toLowerCase().startsWith("zh")) {
    const zh = contentZhBySlug(slug);
    if (zh) return zh;
  }
  return CONTENT[slug];
}

export type { VisaContent } from "./types";
