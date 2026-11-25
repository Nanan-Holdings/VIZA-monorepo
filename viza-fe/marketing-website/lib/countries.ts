/**
 * Shared country metadata for the marketing site (MKT-002).
 *
 * Static presentation and checkout-availability metadata for known destination
 * routes. Public display pricing is never sourced here: CatalogueProvider
 * overlays only snapshots published through the admin portal.
 *
 * `slug` is the URL segment (`/visa/<slug>`). `visaType` matches the portal
 * pricing key. A `launched` entry must be backed by the portal's canonical
 * checkout pricing matrix; the portal remains the final purchase gate.
 */

export interface CountryMeta {
  slug: string;
  /** Portal country code (viza-fe/internal-website application route). Differs from slug for e.g. turkiye→turkey. */
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
  /** Checkout is available. A launched entry must be backed by the portal pricing matrix. */
  launched: boolean;
  /**
   * Published and indexed, but the portal cannot check it out (no pricing row). The page shows a
   * "Talk to a consultant" CTA linking to /contact instead of /apply. Never set together with `launched`.
   */
  consultOnly?: boolean;
  featured?: boolean;
}

/** A destination whose /visa/<slug> page is public: it has checkout or it is consult-only. */
export const isPublished = (c: Pick<CountryMeta, "launched" | "consultOnly">): boolean =>
  c.launched || Boolean(c.consultOnly);

/**
 * Hero/card image. Local assets under public/assets/heroes/ (downloaded once via
 * scripts/fetch-hero-images.mjs), no runtime Unsplash hotlinking, which was
 * breaking/rate-limited in production.
 */
const HERO = (slug: string, ext = "jpg") => `/assets/heroes/${slug}.${ext}`;

export const COUNTRIES: CountryMeta[] = [
  { slug: "indonesia", portalCountry: "indonesia", name: "Indonesia", city: "Bali · Jakarta", flagCode: "id", type: "e-Visa", visaType: "ID_C1_TOURIST", validity: "90 days", image: HERO("indonesia"), tag: "fast", launched: true, featured: true },
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
  // Destination pages with no portal checkout row. Keep launched false.
  { slug: "china", portalCountry: "china", name: "China", city: "Beijing · Shanghai", flagCode: "cn", type: "Visitor visa (L)", visaType: "CN_L_TOURIST", validity: "30 days visa-free for Singapore passports", image: HERO("china"), tag: "evisa", launched: false, consultOnly: true },
  { slug: "schengen", portalCountry: "european_union", name: "Schengen", city: "Paris · Rome · Berlin", flagCode: "eu", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days in any 180", image: HERO("schengen"), tag: "evisa", launched: false, consultOnly: true },
  // The portal prices south_korea KR_C39_SHORT_TERM_VISIT (lib/pricing.ts), so the visa route has checkout.
  // K-ETA itself is a free application on k-eta.go.kr and is not a portal product.
  { slug: "south-korea", portalCountry: "south_korea", name: "South Korea", city: "Seoul · Busan", flagCode: "kr", type: "K-ETA and visa", visaType: "KR_C39_SHORT_TERM_VISIT", validity: "90 days", image: HERO("south-korea"), tag: "fast", launched: true },
];

/** Slug for a country card CTA; unlaunched/unknown still route to the (coming-soon) page, never a 404. */
export function visaHref(slug: string): string {
  return `/visa/${slug}`;
}

/**
 * Real geographic neighbours, nearest first, for the "Nearby countries" block.
 * A destination missing here falls back to the first launched destinations.
 */
export const NEIGHBOURS: Record<string, string[]> = {
  indonesia: ["malaysia", "vietnam", "thailand", "australia"],
  malaysia: ["thailand", "indonesia", "vietnam", "india"],
  vietnam: ["thailand", "malaysia", "indonesia", "japan"],
  thailand: ["vietnam", "malaysia", "india", "indonesia"],
  japan: ["south-korea", "china", "vietnam", "thailand"],
  india: ["thailand", "malaysia", "united-arab-emirates", "saudi-arabia"],
  china: ["japan", "south-korea", "vietnam", "thailand"],
  "south-korea": ["japan", "china", "vietnam", "thailand"],
  schengen: ["france", "italy", "united-kingdom", "turkiye"],
  australia: ["indonesia", "malaysia", "vietnam", "thailand"],
  "united-arab-emirates": ["saudi-arabia", "egypt", "india", "turkiye"],
  "saudi-arabia": ["united-arab-emirates", "egypt", "turkiye", "india"],
  egypt: ["saudi-arabia", "turkiye", "united-arab-emirates", "italy"],
  turkiye: ["egypt", "italy", "saudi-arabia", "united-arab-emirates"],
  france: ["schengen", "italy", "united-kingdom", "turkiye"],
  italy: ["schengen", "france", "united-kingdom", "turkiye"],
  "united-kingdom": ["france", "italy", "united-states", "canada"],
  "united-states": ["canada", "united-kingdom", "japan", "australia"],
  canada: ["united-states", "united-kingdom", "france", "japan"],
};

/** Up to `limit` launched neighbours of `slug`, in NEIGHBOURS order. */
export function nearbyCountries<T extends { slug: string }>(slug: string, launched: T[], limit = 4): T[] {
  const bySlug = new Map(launched.map((c) => [c.slug, c]));
  const picked = (NEIGHBOURS[slug] ?? []).map((s) => bySlug.get(s)).filter((c): c is T => Boolean(c));
  if (picked.length) return picked.slice(0, limit);
  return launched.filter((c) => c.slug !== slug).slice(0, limit);
}
