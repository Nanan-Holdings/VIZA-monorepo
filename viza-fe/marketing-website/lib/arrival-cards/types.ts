/**
 * Arrival card guides (SEO plan, Phase C). One GuideContent per guide per language, written natively.
 * Chrome (headings, button labels, VIZA option wording) lives in the `arrival` messages namespace.
 */
export interface GuideSection {
  id: string;
  heading: string;
  body: string[];
  list?: string[];
}

export interface GuideContent {
  /** Finished title, 60 characters or fewer, ends in " | VIZA". */
  title: string;
  /** 160 characters or fewer. */
  description: string;
  h1: string;
  lead: string;
  glance: Array<{ k: string; v: string }>;
  sections: GuideSection[];
  /** HowTo steps, in order. */
  steps: Array<{ name: string; text: string }>;
  mistakes: Array<{ title: string; body: string }>;
  fees: string[];
  faq: Array<{ q: string; a: string }>;
  sources: Array<{ label: string; url: string }>;
  /** "Checked on 25 November 2026 against ..." line. */
  reviewed: string;
}

export interface GuideMeta {
  slug: string;
  /** Short name used on cards and breadcrumbs, per language. */
  name: { en: string; zh: string };
  country: { en: string; zh: string };
  /** Destination page slug under /visa, or null when there is none (Singapore). */
  visaSlug: string | null;
  /** The official site or the official page that links to it. */
  officialUrl: string;
  officialHost: string;
  /**
   * Portal product for the "VIZA does it for you" option, or null when the portal has none.
   * Checked in viza-fe/internal-website/lib/visa-destinations.ts on 25 Nov 2026. A priced row exists in
   * lib/pricing.ts only for KR_E_ARRIVAL_CARD (agencyFeeCents 0, govtFeeCents 0). The others have a portal
   * product with no pricing row yet; the site states VIZA's service as free, as everywhere else on the site.
   */
  portal: { country: string; visaType: string; pricedRow: boolean } | null;
}
