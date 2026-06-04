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

const UNSPLASH = (id: string) => `https://images.unsplash.com/${id}?w=600&auto=format&fit=crop&q=70`;

export const COUNTRIES: CountryMeta[] = [
  { slug: "indonesia", portalCountry: "indonesia", name: "Indonesia", city: "Bali · Jakarta", flagCode: "id", type: "e-Visa", visaType: "B211A", validity: "90 days", image: UNSPLASH("photo-1537996194471-e657df975ab4"), tag: "fast", launched: true, featured: true },
  { slug: "egypt", portalCountry: "egypt", name: "Egypt", city: "Cairo · Giza", flagCode: "eg", type: "e-Visa", visaType: "EG_E_VISA", validity: "90 days", image: "/assets/egypt-giza.avif", tag: "fast", launched: true },
  { slug: "australia", portalCountry: "australia", name: "Australia", city: "Sydney · Melbourne", flagCode: "au", type: "Visitor 600", visaType: "AU_VISITOR_600", validity: "1 year", image: UNSPLASH("photo-1506973035872-a4ec16b8e8d9"), tag: "evisa", launched: true },
  { slug: "saudi-arabia", portalCountry: "saudi_arabia", name: "Saudi Arabia", city: "Riyadh · AlUla", flagCode: "sa", type: "e-Visa", visaType: "SA_E_VISA", validity: "365 days", image: UNSPLASH("photo-1586724237569-f3d0c1dee8c6"), tag: "fast", launched: true },
  { slug: "united-kingdom", portalCountry: "united_kingdom", name: "United Kingdom", city: "London · Edinburgh", flagCode: "gb", type: "Standard Visitor", visaType: "UK_STANDARD_VISITOR", validity: "6 months", image: UNSPLASH("photo-1486299267070-83823f5448dd"), tag: "evisa", launched: true },
  { slug: "vietnam", portalCountry: "vietnam", name: "Vietnam", city: "Hanoi · Hoi An", flagCode: "vn", type: "e-Visa", visaType: "VN_E_VISA", validity: "90 days", image: UNSPLASH("photo-1528127269322-539801943592"), tag: "fast", launched: true },
  { slug: "malaysia", portalCountry: "malaysia", name: "Malaysia", city: "KL · Penang", flagCode: "my", type: "e-Visa", visaType: "MY_TOURIST_E_VISA", validity: "30 days", image: UNSPLASH("photo-1596422846543-75c6fc197f07"), tag: "fast", launched: true },
  { slug: "japan", portalCountry: "japan", name: "Japan", city: "Tokyo · Kyoto", flagCode: "jp", type: "Tourist", visaType: "JP_TOURIST", validity: "90 days", image: UNSPLASH("photo-1492571350019-22de08371fd3"), tag: "evisa", launched: true },
  { slug: "united-states", portalCountry: "united_states", name: "United States", city: "NYC · LA", flagCode: "us", type: "B1/B2", visaType: "B1_B2", validity: "10 years", image: UNSPLASH("photo-1485871981521-5b1fd3805eee"), tag: "evisa", launched: true },
  { slug: "canada", portalCountry: "canada", name: "Canada", city: "Toronto · Vancouver", flagCode: "ca", type: "eTA", visaType: "CA_TRV", validity: "5 years", image: UNSPLASH("photo-1503614472-8c93d56e92ce"), tag: "evisa", launched: true },
  { slug: "turkiye", portalCountry: "turkey", name: "Türkiye", city: "Istanbul · Cappadocia", flagCode: "tr", type: "e-Visa", visaType: "TR_E_VISA", validity: "180 days", image: UNSPLASH("photo-1527838832700-5059252407fa"), tag: "fast", launched: true },
  { slug: "thailand", portalCountry: "thailand", name: "Thailand", city: "Bangkok · Phuket", flagCode: "th", type: "eVisa", visaType: "TH_TOURIST_E_VISA", validity: "60 days", image: UNSPLASH("photo-1528181304800-259b08848526"), tag: "fast", launched: true },
  { slug: "united-arab-emirates", portalCountry: "united_arab_emirates", name: "United Arab Emirates", city: "Dubai · Abu Dhabi", flagCode: "ae", type: "e-Visa", visaType: "AE_TOURIST_VISA", validity: "60 days", image: UNSPLASH("photo-1512453979798-5ea266f8880c"), tag: "fast", launched: true },
  { slug: "france", portalCountry: "france", name: "France", city: "Paris · Nice", flagCode: "fr", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: UNSPLASH("photo-1431274172761-fca41d930114"), tag: "evisa", launched: true },
  { slug: "italy", portalCountry: "italy", name: "Italy", city: "Rome · Florence", flagCode: "it", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: UNSPLASH("photo-1531572753322-ad063cecc140"), tag: "evisa", launched: true },
  { slug: "india", portalCountry: "india", name: "India", city: "Delhi · Mumbai", flagCode: "in", type: "e-Visa", visaType: "IN_E_VISA", validity: "60 days", image: UNSPLASH("photo-1524492412937-b28074a5d7da"), tag: "fast", launched: true },
];

export const LAUNCHED_COUNTRIES = COUNTRIES.filter((c) => c.launched);

export function countryBySlug(slug: string): CountryMeta | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}

/** Slug for a country card CTA; unlaunched/unknown still route to the (coming-soon) page, never a 404. */
export function visaHref(slug: string): string {
  return `/visa/${slug}`;
}
