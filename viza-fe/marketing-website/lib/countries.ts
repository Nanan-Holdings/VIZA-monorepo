/**
 * Shared country metadata for the marketing site (MKT-002).
 *
 * Static presentation fallbacks for known destination routes. Availability and
 * pricing are never sourced here: CatalogueProvider overlays only snapshots
 * published through the admin portal, and otherwise forces `launched: false`.
 *
 * `slug` is the URL segment (`/visa/<slug>`). `visaType` matches the portal
 * pricing key. `launched` is false in every fallback and becomes true only
 * when a matching published snapshot is received.
 */

export interface CountryMeta {
  slug: string;
  /** Portal country code (viza-fe/internal-website + payment buttons). Differs from slug for e.g. turkiye→turkey. */
  portalCountry: string;
  name: string;
  city: string;
  /** circle-flags ISO-2 code (https://hatscripts.github.io/circle-flags). */
  flagCode: string;
  /** Visa product label shown on the card. */
  type: string;
  /** Portal pricing key (viza-fe/internal-website/lib/pricing.ts visaType). */
  visaType: string;
  validity: string;
  image: string;
  /** Card emphasis tag. */
  tag: "fast" | "evisa";
  launched: boolean;
  featured?: boolean;
  /**
   * Typical worst-case turnaround in calendar days, from a complete submission to
   * the visa landing in the applicant's inbox. Powers the explore "签证送达" and
   * "出行日期" filters and the "办理最快" sort. This is an estimate, never a promise —
   * embassy timing is outside our control (see docs: no delivery guarantees).
   */
  processingDays: number;
  /** Travel purposes this product actually covers — powers the "签证类型" filter. */
  purposes: VisaPurpose[];
  /** How much paperwork the destination asks for — powers the "所需材料" filter. */
  documentTier: DocumentTier;
  /** Visa validity in days, for the "签证时长" sort. */
  validityDays: number;
  /** Relative demand rank (1 = most requested), for the "热门目的地" sort. */
  popularity: number;
}

/** Travel purposes an offered product covers. */
export type VisaPurpose = "tourism" | "business" | "work" | "student" | "nomad";

/** Paperwork weight, cheapest first. `minimal` means passport-only. */
export type DocumentTier = "minimal" | "standard" | "full";

/** Ordered so a chosen tier includes every lighter tier. */
export const DOCUMENT_TIER_ORDER: DocumentTier[] = ["minimal", "standard", "full"];

/**
 * Hero/card image. Local assets under public/assets/heroes/ (downloaded once via
 * scripts/fetch-hero-images.mjs) — no runtime Unsplash hotlinking, which was
 * breaking/rate-limited in production.
 */
const HERO = (slug: string, ext = "jpg") => `/assets/heroes/${slug}.${ext}`;

export const COUNTRIES: CountryMeta[] = [
  { slug: "viza-test", portalCountry: "viza_test", name: "VIZA Test", city: "Live checkout test", flagCode: "sg", type: "Test checkout", visaType: "TEST_CHECKOUT", validity: "Demo only", image: HERO("japan"), tag: "fast", launched: false, processingDays: 1, purposes: ["tourism"], documentTier: "minimal", validityDays: 1, popularity: 99 },
  { slug: "indonesia", portalCountry: "indonesia", name: "Indonesia", city: "Bali · Jakarta", flagCode: "id", type: "e-Visa", visaType: "B211A", validity: "90 days", image: HERO("indonesia"), tag: "fast", launched: false, featured: true, processingDays: 5, purposes: ["tourism", "business"], documentTier: "standard", validityDays: 90, popularity: 6 },
  { slug: "egypt", portalCountry: "egypt", name: "Egypt", city: "Cairo · Giza", flagCode: "eg", type: "e-Visa", visaType: "EG_E_VISA", validity: "90 days", image: HERO("egypt", "avif"), tag: "fast", launched: false, processingDays: 7, purposes: ["tourism"], documentTier: "minimal", validityDays: 90, popularity: 15 },
  { slug: "australia", portalCountry: "australia", name: "Australia", city: "Sydney · Melbourne", flagCode: "au", type: "Visitor 600", visaType: "AU_VISITOR_600", validity: "1 year", image: HERO("australia"), tag: "evisa", launched: false, processingDays: 30, purposes: ["tourism", "business"], documentTier: "full", validityDays: 365, popularity: 9 },
  { slug: "saudi-arabia", portalCountry: "saudi_arabia", name: "Saudi Arabia", city: "Riyadh · AlUla", flagCode: "sa", type: "e-Visa", visaType: "SA_E_VISA", validity: "365 days", image: HERO("saudi-arabia"), tag: "fast", launched: false, processingDays: 3, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 365, popularity: 16 },
  { slug: "united-kingdom", portalCountry: "united_kingdom", name: "United Kingdom", city: "London · Edinburgh", flagCode: "gb", type: "Standard Visitor", visaType: "UK_STANDARD_VISITOR", validity: "6 months", image: HERO("united-kingdom"), tag: "evisa", launched: false, processingDays: 21, purposes: ["tourism", "business"], documentTier: "full", validityDays: 180, popularity: 5 },
  { slug: "vietnam", portalCountry: "vietnam", name: "Vietnam", city: "Hanoi · Hoi An", flagCode: "vn", type: "e-Visa", visaType: "VN_E_VISA", validity: "90 days", image: HERO("vietnam"), tag: "fast", launched: false, processingDays: 5, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 90, popularity: 7 },
  { slug: "malaysia", portalCountry: "malaysia", name: "Malaysia", city: "KL · Penang", flagCode: "my", type: "e-Visa", visaType: "MY_TOURIST_E_VISA", validity: "3 months", image: HERO("malaysia"), tag: "fast", launched: false, processingDays: 3, purposes: ["tourism"], documentTier: "minimal", validityDays: 90, popularity: 8 },
  { slug: "japan", portalCountry: "japan", name: "Japan", city: "Tokyo · Kyoto", flagCode: "jp", type: "Tourist", visaType: "JP_TOURIST", validity: "90 days", image: HERO("japan"), tag: "evisa", launched: false, processingDays: 10, purposes: ["tourism"], documentTier: "standard", validityDays: 90, popularity: 2 },
  { slug: "united-states", portalCountry: "united_states", name: "United States", city: "NYC · LA", flagCode: "us", type: "B1/B2", visaType: "B1_B2", validity: "10 years", image: HERO("united-states"), tag: "evisa", launched: false, processingDays: 60, purposes: ["tourism", "business"], documentTier: "full", validityDays: 3650, popularity: 1 },
  { slug: "canada", portalCountry: "canada", name: "Canada", city: "Toronto · Vancouver", flagCode: "ca", type: "Visitor visa", visaType: "CA_TRV", validity: "10 years", image: HERO("canada"), tag: "evisa", launched: false, processingDays: 45, purposes: ["tourism", "business"], documentTier: "full", validityDays: 3650, popularity: 12 },
  { slug: "turkiye", portalCountry: "turkey", name: "Türkiye", city: "Istanbul · Cappadocia", flagCode: "tr", type: "e-Visa", visaType: "TR_E_VISA", validity: "180 days", image: HERO("turkiye"), tag: "fast", launched: false, processingDays: 1, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 180, popularity: 11 },
  { slug: "thailand", portalCountry: "thailand", name: "Thailand", city: "Bangkok · Phuket", flagCode: "th", type: "eVisa", visaType: "TH_TOURIST_E_VISA", validity: "3 months", image: HERO("thailand"), tag: "fast", launched: false, processingDays: 10, purposes: ["tourism"], documentTier: "standard", validityDays: 90, popularity: 4 },
  { slug: "united-arab-emirates", portalCountry: "united_arab_emirates", name: "United Arab Emirates", city: "Dubai · Abu Dhabi", flagCode: "ae", type: "Tourist visa", visaType: "AE_TOURIST_VISA", validity: "60 days", image: HERO("united-arab-emirates"), tag: "fast", launched: false, processingDays: 3, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 60, popularity: 13 },
  { slug: "france", portalCountry: "france", name: "France", city: "Paris · Nice", flagCode: "fr", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("france"), tag: "evisa", launched: false, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 3 },
  { slug: "italy", portalCountry: "italy", name: "Italy", city: "Rome · Florence", flagCode: "it", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("italy"), tag: "evisa", launched: false, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 10 },
  { slug: "india", portalCountry: "india", name: "India", city: "Delhi · Mumbai", flagCode: "in", type: "e-Visa", visaType: "IN_E_VISA", validity: "30 days", image: HERO("india"), tag: "fast", launched: false, processingDays: 5, purposes: ["tourism", "business"], documentTier: "standard", validityDays: 30, popularity: 14 },
];

/** Slug for a country card CTA; unlaunched/unknown still route to the (coming-soon) page, never a 404. */
export function visaHref(slug: string): string {
  return `/visa/${slug}`;
}
