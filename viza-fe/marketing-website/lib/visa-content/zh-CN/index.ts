/**
 * Simplified-Chinese (zh-CN) visa content registry.
 *
 * Twins of the English `lib/visa-content/<slug>.ts` files. `contentBySlug(slug,
 * locale)` in the parent index delegates here for zh locales; visa specifics
 * mirror the English source (ops/legal review before publish).
 */
import type { VisaContent } from "../types";
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

const CONTENT_ZH: Record<string, VisaContent> = {
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

export function contentZhBySlug(slug: string): VisaContent | undefined {
  return CONTENT_ZH[slug];
}
