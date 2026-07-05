/**
 * Shared country metadata for the marketing site (MKT-002).
 *
 * Single source for country cards (home/explore), the visa page template
 * (MKT-004), routing slugs (MKT-001), the coming-soon gate (MKT-003), and
 * sitemap generation (MKT-012). No fabricated eta/timestamp fields — card
 * data carries only real, displayable attributes.
 *
 * `slug` is the URL segment (`/visa/<slug>`). `visaType` matches the portal
 * pricing key (lib/pricing parity, MKT-006). `launched` gates the full page
 * vs the coming-soon state.
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
}

/**
 * Hero/card image. Local assets under public/assets/heroes/ (downloaded once via
 * scripts/fetch-hero-images.mjs) — no runtime Unsplash hotlinking, which was
 * breaking/rate-limited in production.
 */
const HERO = (slug: string, ext = "jpg") => `/assets/heroes/${slug}.${ext}`;

export const COUNTRIES: CountryMeta[] = [
  { slug: "indonesia", portalCountry: "indonesia", name: "Indonesia", city: "Bali · Jakarta", flagCode: "id", type: "e-Visa", visaType: "B211A", validity: "90 days", image: HERO("indonesia"), tag: "fast", launched: true, featured: true },
  { slug: "egypt", portalCountry: "egypt", name: "Egypt", city: "Cairo · Giza", flagCode: "eg", type: "e-Visa", visaType: "EG_E_VISA", validity: "90 days", image: HERO("egypt", "avif"), tag: "fast", launched: true },
  { slug: "australia", portalCountry: "australia", name: "Australia", city: "Sydney · Melbourne", flagCode: "au", type: "Visitor 600", visaType: "AU_VISITOR_600", validity: "1 year", image: HERO("australia"), tag: "evisa", launched: true },
  { slug: "saudi-arabia", portalCountry: "saudi_arabia", name: "Saudi Arabia", city: "Riyadh · AlUla", flagCode: "sa", type: "e-Visa", visaType: "SA_E_VISA", validity: "365 days", image: HERO("saudi-arabia"), tag: "fast", launched: true },
  { slug: "united-kingdom", portalCountry: "united_kingdom", name: "United Kingdom", city: "London · Edinburgh", flagCode: "gb", type: "Standard Visitor", visaType: "UK_STANDARD_VISITOR", validity: "6 months", image: HERO("united-kingdom"), tag: "evisa", launched: true },
  { slug: "vietnam", portalCountry: "vietnam", name: "Vietnam", city: "Hanoi · Hoi An", flagCode: "vn", type: "e-Visa", visaType: "VN_E_VISA", validity: "90 days", image: HERO("vietnam"), tag: "fast", launched: true },
  { slug: "malaysia", portalCountry: "malaysia", name: "Malaysia", city: "KL · Penang", flagCode: "my", type: "e-Visa", visaType: "MY_TOURIST_E_VISA", validity: "3 months", image: HERO("malaysia"), tag: "fast", launched: true },
  { slug: "japan", portalCountry: "japan", name: "Japan", city: "Tokyo · Kyoto", flagCode: "jp", type: "Tourist", visaType: "JP_TOURIST", validity: "90 days", image: HERO("japan"), tag: "evisa", launched: true },
  { slug: "united-states", portalCountry: "united_states", name: "United States", city: "NYC · LA", flagCode: "us", type: "B1/B2", visaType: "B1_B2", validity: "10 years", image: HERO("united-states"), tag: "evisa", launched: true },
  { slug: "canada", portalCountry: "canada", name: "Canada", city: "Toronto · Vancouver", flagCode: "ca", type: "Visitor visa", visaType: "CA_TRV", validity: "10 years", image: HERO("canada"), tag: "evisa", launched: true },
  { slug: "turkiye", portalCountry: "turkey", name: "Türkiye", city: "Istanbul · Cappadocia", flagCode: "tr", type: "e-Visa", visaType: "TR_E_VISA", validity: "180 days", image: HERO("turkiye"), tag: "fast", launched: true },
  { slug: "thailand", portalCountry: "thailand", name: "Thailand", city: "Bangkok · Phuket", flagCode: "th", type: "eVisa", visaType: "TH_TOURIST_E_VISA", validity: "3 months", image: HERO("thailand"), tag: "fast", launched: true },
  { slug: "united-arab-emirates", portalCountry: "united_arab_emirates", name: "United Arab Emirates", city: "Dubai · Abu Dhabi", flagCode: "ae", type: "Tourist visa", visaType: "AE_TOURIST_VISA", validity: "60 days", image: HERO("united-arab-emirates"), tag: "fast", launched: true },
  { slug: "france", portalCountry: "france", name: "France", city: "Paris · Nice", flagCode: "fr", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("france"), tag: "evisa", launched: true },
  { slug: "italy", portalCountry: "italy", name: "Italy", city: "Rome · Florence", flagCode: "it", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("italy"), tag: "evisa", launched: true },
  { slug: "india", portalCountry: "india", name: "India", city: "Delhi · Mumbai", flagCode: "in", type: "e-Visa", visaType: "IN_E_VISA", validity: "30 days", image: HERO("india"), tag: "fast", launched: true },
];

export const LAUNCHED_COUNTRIES = COUNTRIES.filter((c) => c.launched);

export function countryBySlug(slug: string): CountryMeta | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}

/** Slug for a country card CTA; unlaunched/unknown still route to the (coming-soon) page, never a 404. */
export function visaHref(slug: string): string {
  return `/visa/${slug}`;
}
