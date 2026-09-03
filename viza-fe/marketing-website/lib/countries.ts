/**
 * Shared country metadata for the marketing site (MKT-002).
 *
 * Static presentation fallbacks for known destination routes. Availability and
 * pricing are never sourced here. The portal checkout remains the pricing
 * authority; a published catalogue snapshot only supplies optional public
 * price display data.
 *
 * `slug` is the URL segment (`/visa/<slug>`). `visaType` matches the portal
 * pricing key. Listed destinations are application-ready; a matching
 * published snapshot supplies public price display data when available.
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
  { slug: "viza-test", portalCountry: "viza_test", name: "VIZA Test", city: "Live checkout test", flagCode: "sg", type: "Test checkout", visaType: "TEST_CHECKOUT", validity: "Demo only", image: HERO("japan"), tag: "fast", launched: true, processingDays: 1, purposes: ["tourism"], documentTier: "minimal", validityDays: 1, popularity: 99 },
  { slug: "indonesia", portalCountry: "indonesia", name: "Indonesia", city: "Bali · Jakarta", flagCode: "id", type: "e-Visa", visaType: "ID_C1_TOURIST", validity: "90 days", image: HERO("indonesia"), tag: "fast", launched: true, featured: true, processingDays: 5, purposes: ["tourism", "business"], documentTier: "standard", validityDays: 90, popularity: 6 },
  { slug: "egypt", portalCountry: "egypt", name: "Egypt", city: "Cairo · Giza", flagCode: "eg", type: "e-Visa", visaType: "EG_E_VISA", validity: "90 days", image: HERO("egypt", "avif"), tag: "fast", launched: true, processingDays: 7, purposes: ["tourism"], documentTier: "minimal", validityDays: 90, popularity: 15 },
  { slug: "australia", portalCountry: "australia", name: "Australia", city: "Sydney · Melbourne", flagCode: "au", type: "Visitor 600", visaType: "AU_VISITOR_600", validity: "1 year", image: HERO("australia"), tag: "evisa", launched: true, processingDays: 30, purposes: ["tourism", "business"], documentTier: "full", validityDays: 365, popularity: 9 },
  { slug: "saudi-arabia", portalCountry: "saudi_arabia", name: "Saudi Arabia", city: "Riyadh · AlUla", flagCode: "sa", type: "e-Visa", visaType: "SA_E_VISA", validity: "365 days", image: HERO("saudi-arabia"), tag: "fast", launched: true, processingDays: 3, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 365, popularity: 16 },
  { slug: "united-kingdom", portalCountry: "united_kingdom", name: "United Kingdom", city: "London · Edinburgh", flagCode: "gb", type: "Standard Visitor", visaType: "UK_STANDARD_VISITOR", validity: "6 months", image: HERO("united-kingdom"), tag: "evisa", launched: true, processingDays: 21, purposes: ["tourism", "business"], documentTier: "full", validityDays: 180, popularity: 5 },
  { slug: "vietnam", portalCountry: "vietnam", name: "Vietnam", city: "Hanoi · Hoi An", flagCode: "vn", type: "e-Visa", visaType: "VN_E_VISA", validity: "90 days", image: HERO("vietnam"), tag: "fast", launched: true, processingDays: 5, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 90, popularity: 7 },
  { slug: "malaysia", portalCountry: "malaysia", name: "Malaysia", city: "KL · Penang", flagCode: "my", type: "e-Visa", visaType: "MY_TOURIST_E_VISA", validity: "3 months", image: HERO("malaysia"), tag: "fast", launched: true, processingDays: 3, purposes: ["tourism"], documentTier: "minimal", validityDays: 90, popularity: 8 },
  { slug: "japan", portalCountry: "japan", name: "Japan", city: "Tokyo · Kyoto", flagCode: "jp", type: "Tourist", visaType: "JP_TOURIST", validity: "90 days", image: HERO("japan"), tag: "evisa", launched: true, processingDays: 10, purposes: ["tourism"], documentTier: "standard", validityDays: 90, popularity: 2 },
  { slug: "united-states", portalCountry: "united_states", name: "United States", city: "NYC · LA", flagCode: "us", type: "B1/B2", visaType: "B1_B2", validity: "10 years", image: HERO("united-states"), tag: "evisa", launched: true, processingDays: 60, purposes: ["tourism", "business"], documentTier: "full", validityDays: 3650, popularity: 1 },
  { slug: "canada", portalCountry: "canada", name: "Canada", city: "Toronto · Vancouver", flagCode: "ca", type: "Visitor visa", visaType: "CA_TRV", validity: "10 years", image: HERO("canada"), tag: "evisa", launched: true, processingDays: 45, purposes: ["tourism", "business"], documentTier: "full", validityDays: 3650, popularity: 12 },
  { slug: "turkiye", portalCountry: "turkey", name: "Türkiye", city: "Istanbul · Cappadocia", flagCode: "tr", type: "e-Visa", visaType: "TR_E_VISA", validity: "180 days", image: HERO("turkiye"), tag: "fast", launched: true, processingDays: 1, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 180, popularity: 11 },
  { slug: "thailand", portalCountry: "thailand", name: "Thailand", city: "Bangkok · Phuket", flagCode: "th", type: "eVisa", visaType: "TH_TOURIST_E_VISA", validity: "3 months", image: HERO("thailand"), tag: "fast", launched: true, processingDays: 10, purposes: ["tourism"], documentTier: "standard", validityDays: 90, popularity: 4 },
  { slug: "united-arab-emirates", portalCountry: "united_arab_emirates", name: "United Arab Emirates", city: "Dubai · Abu Dhabi", flagCode: "ae", type: "Tourist visa", visaType: "AE_TOURIST_VISA", validity: "60 days", image: HERO("united-arab-emirates"), tag: "fast", launched: true, processingDays: 3, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 60, popularity: 13 },
  { slug: "france", portalCountry: "france", name: "France", city: "Paris · Nice", flagCode: "fr", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("france"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 3 },
  { slug: "italy", portalCountry: "italy", name: "Italy", city: "Rome · Florence", flagCode: "it", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("italy"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 10 },
  { slug: "india", portalCountry: "india", name: "India", city: "Delhi · Mumbai", flagCode: "in", type: "e-Visa", visaType: "IN_E_VISA", validity: "30 days", image: HERO("india"), tag: "fast", launched: true, processingDays: 5, purposes: ["tourism", "business"], documentTier: "standard", validityDays: 30, popularity: 14 },
  // --- Schengen Area (MKT): the remaining 27 main-destination countries.
  // One shared Type C product with france/italy above -- same form, same fee,
  // same PACKAGE_PRICING shape -- so the explore grid offers all 29 rather than
  // the three that happened to be priced first. Turnaround/validity below are
  // placeholder estimates for the filters; ops revises them with the pricing.
  { slug: "austria", portalCountry: "austria", name: "Austria", city: "Vienna · Salzburg", flagCode: "at", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("austria"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 23 },
  { slug: "belgium", portalCountry: "belgium", name: "Belgium", city: "Brussels · Bruges", flagCode: "be", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("belgium"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 36 },
  { slug: "bulgaria", portalCountry: "bulgaria", name: "Bulgaria", city: "Sofia · Plovdiv", flagCode: "bg", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("bulgaria"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 54 },
  { slug: "croatia", portalCountry: "croatia", name: "Croatia", city: "Zagreb · Dubrovnik", flagCode: "hr", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("croatia"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 45 },
  { slug: "czech-republic", portalCountry: "czech_republic", name: "Czech Republic", city: "Prague · Brno", flagCode: "cz", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("czech-republic"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 43 },
  { slug: "denmark", portalCountry: "denmark", name: "Denmark", city: "Copenhagen · Aarhus", flagCode: "dk", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("denmark"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 39 },
  { slug: "estonia", portalCountry: "estonia", name: "Estonia", city: "Tallinn · Tartu", flagCode: "ee", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("estonia"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 50 },
  { slug: "finland", portalCountry: "finland", name: "Finland", city: "Helsinki · Rovaniemi", flagCode: "fi", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("finland"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 40 },
  { slug: "germany", portalCountry: "germany", name: "Germany", city: "Berlin · Munich", flagCode: "de", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("germany"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 17 },
  { slug: "greece", portalCountry: "greece", name: "Greece", city: "Athens · Santorini", flagCode: "gr", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("greece"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 21 },
  { slug: "hungary", portalCountry: "hungary", name: "Hungary", city: "Budapest · Debrecen", flagCode: "hu", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("hungary"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 44 },
  { slug: "iceland", portalCountry: "iceland", name: "Iceland", city: "Reykjavik · Akureyri", flagCode: "is", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("iceland"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 41 },
  { slug: "latvia", portalCountry: "latvia", name: "Latvia", city: "Riga · Jurmala", flagCode: "lv", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("latvia"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 51 },
  { slug: "liechtenstein", portalCountry: "liechtenstein", name: "Liechtenstein", city: "Vaduz · Malbun", flagCode: "li", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("liechtenstein"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 55 },
  { slug: "lithuania", portalCountry: "lithuania", name: "Lithuania", city: "Vilnius · Kaunas", flagCode: "lt", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("lithuania"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 52 },
  { slug: "luxembourg", portalCountry: "luxembourg", name: "Luxembourg", city: "Luxembourg City · Vianden", flagCode: "lu", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("luxembourg"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 47 },
  { slug: "malta", portalCountry: "malta", name: "Malta", city: "Valletta · Mdina", flagCode: "mt", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("malta"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 46 },
  { slug: "netherlands", portalCountry: "netherlands", name: "Netherlands", city: "Amsterdam · Rotterdam", flagCode: "nl", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("netherlands"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 20 },
  { slug: "norway", portalCountry: "norway", name: "Norway", city: "Oslo · Bergen", flagCode: "no", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("norway"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 38 },
  { slug: "poland", portalCountry: "poland", name: "Poland", city: "Warsaw · Krakow", flagCode: "pl", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("poland"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 42 },
  { slug: "portugal", portalCountry: "portugal", name: "Portugal", city: "Lisbon · Porto", flagCode: "pt", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("portugal"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 22 },
  { slug: "romania", portalCountry: "romania", name: "Romania", city: "Bucharest · Brasov", flagCode: "ro", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("romania"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 53 },
  { slug: "slovakia", portalCountry: "slovakia", name: "Slovakia", city: "Bratislava · Kosice", flagCode: "sk", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("slovakia"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 49 },
  { slug: "slovenia", portalCountry: "slovenia", name: "Slovenia", city: "Ljubljana · Bled", flagCode: "si", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("slovenia"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 48 },
  { slug: "spain", portalCountry: "spain", name: "Spain", city: "Madrid · Barcelona", flagCode: "es", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("spain"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 18 },
  { slug: "sweden", portalCountry: "sweden", name: "Sweden", city: "Stockholm · Gothenburg", flagCode: "se", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("sweden"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 37 },
  { slug: "switzerland", portalCountry: "switzerland", name: "Switzerland", city: "Zurich · Geneva", flagCode: "ch", type: "Schengen", visaType: "EU_SCHENGEN_C_SHORT_STAY", validity: "90 days", image: HERO("switzerland"), tag: "evisa", launched: true, processingDays: 20, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 19 },

  // --- Destinations already priced in the portal but previously absent here.
  // Each has a PACKAGE_PRICING row, so the card CTA reaches a working checkout;
  // rich /visa/<slug> content is not authored yet, so they render the thin
  // VisaCountryTemplate until it is.
  { slug: "south-korea", portalCountry: "south_korea", name: "South Korea", city: "Seoul · Busan", flagCode: "kr", type: "Short-term visit", visaType: "KR_C39_SHORT_TERM_VISIT", validity: "90 days", image: HERO("south-korea"), tag: "evisa", launched: true, processingDays: 14, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 24 },
  { slug: "singapore", portalCountry: "singapore", name: "Singapore", city: "Singapore · Sentosa", flagCode: "sg", type: "Visitor visa", visaType: "SG_VISITOR_VISA", validity: "30 days", image: HERO("singapore"), tag: "evisa", launched: true, processingDays: 7, purposes: ["tourism", "business"], documentTier: "standard", validityDays: 30, popularity: 25 },
  { slug: "new-zealand", portalCountry: "new_zealand", name: "New Zealand", city: "Auckland · Queenstown", flagCode: "nz", type: "Visitor visa", visaType: "NZ_VISITOR_VISA", validity: "6 months", image: HERO("new-zealand"), tag: "evisa", launched: true, processingDays: 30, purposes: ["tourism", "business"], documentTier: "full", validityDays: 180, popularity: 26 },
  { slug: "hong-kong", portalCountry: "hong_kong", name: "Hong Kong", city: "Hong Kong · Kowloon", flagCode: "hk", type: "Visit visa", visaType: "HK_VISIT_VISA", validity: "14 days", image: HERO("hong-kong"), tag: "evisa", launched: true, processingDays: 14, purposes: ["tourism", "business"], documentTier: "standard", validityDays: 14, popularity: 27 },
  { slug: "philippines", portalCountry: "philippines", name: "Philippines", city: "Manila · Cebu", flagCode: "ph", type: "Temporary visitor", visaType: "PH_TEMPORARY_VISITOR_VISA", validity: "59 days", image: HERO("philippines"), tag: "evisa", launched: true, processingDays: 10, purposes: ["tourism"], documentTier: "standard", validityDays: 59, popularity: 28 },
  { slug: "cambodia", portalCountry: "cambodia", name: "Cambodia", city: "Phnom Penh · Siem Reap", flagCode: "kh", type: "e-Visa", visaType: "KH_TOURIST_E_VISA", validity: "30 days", image: HERO("cambodia"), tag: "fast", launched: true, processingDays: 3, purposes: ["tourism"], documentTier: "minimal", validityDays: 30, popularity: 29 },
  { slug: "sri-lanka", portalCountry: "sri_lanka", name: "Sri Lanka", city: "Colombo · Kandy", flagCode: "lk", type: "eTA", visaType: "LK_ETA", validity: "30 days", image: HERO("sri-lanka"), tag: "fast", launched: true, processingDays: 2, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 30, popularity: 30 },
  { slug: "maldives", portalCountry: "maldives", name: "Maldives", city: "Malé · Addu", flagCode: "mv", type: "Traveller declaration", visaType: "MV_IMUGA", validity: "30 days", image: HERO("maldives"), tag: "fast", launched: true, processingDays: 1, purposes: ["tourism"], documentTier: "minimal", validityDays: 30, popularity: 31 },
  { slug: "laos", portalCountry: "laos", name: "Laos", city: "Vientiane · Luang Prabang", flagCode: "la", type: "e-Visa", visaType: "LA_TOURIST_E_VISA", validity: "30 days", image: HERO("laos"), tag: "fast", launched: true, processingDays: 3, purposes: ["tourism"], documentTier: "minimal", validityDays: 30, popularity: 32 },
  { slug: "macau", portalCountry: "macau", name: "Macau", city: "Macau · Taipa", flagCode: "mo", type: "Visit visa", visaType: "MO_VISIT_VISA", validity: "30 days", image: HERO("macau"), tag: "evisa", launched: true, processingDays: 14, purposes: ["tourism"], documentTier: "standard", validityDays: 30, popularity: 33 },
  { slug: "kenya", portalCountry: "kenya", name: "Kenya", city: "Nairobi · Masai Mara", flagCode: "ke", type: "eTA", visaType: "KE_ETA", validity: "90 days", image: HERO("kenya"), tag: "fast", launched: true, processingDays: 3, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 90, popularity: 34 },
  { slug: "south-africa", portalCountry: "south_africa", name: "South Africa", city: "Cape Town · Johannesburg", flagCode: "za", type: "Visitor visa", visaType: "ZA_VISITOR_VISA", validity: "90 days", image: HERO("south-africa"), tag: "evisa", launched: true, processingDays: 21, purposes: ["tourism", "business"], documentTier: "full", validityDays: 90, popularity: 35 },
  { slug: "indonesia-voa", portalCountry: "indonesia", name: "Indonesia e-VoA", city: "Bali · Jakarta", flagCode: "id", type: "e-VoA", visaType: "ID_B1_EVOA", validity: "30 days", image: HERO("indonesia-voa"), tag: "fast", launched: true, processingDays: 3, purposes: ["tourism", "business"], documentTier: "minimal", validityDays: 30, popularity: 56 },
];

/** Slug for a country card CTA; unknown slugs still route to a helpful coming-soon page, never a 404. */
export function visaHref(slug: string): string {
  return `/visa/${slug}`;
}
