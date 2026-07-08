/**
 * Per-country hero theming for the client portal.
 *
 * The dashboard hero (and any application-scoped hero) should reflect the
 * country of the *current* application, not a single hardcoded blue/Indonesia
 * treatment. This module is the one place that maps a country slug to its
 * gradient + landmark graphic. To add a new country, drop a slug-named image
 * in `public/country-heroes/` and add (or adjust) an entry below.
 *
 * Country slugs are the lowercase snake_case values stored in
 * `applications.country` (see `lib/visa-destinations.ts`), e.g. `united_states`.
 *
 * Colors are hand-tuned so white hero text stays legible: the gradient runs
 * top→bottom, and every `from` (top) color is dark/saturated enough for
 * WCAG-safe white text. Values live here as data, never pasted into component
 * classNames — the hero renders them via inline `linear-gradient(...)` because
 * the colors are dynamic and can't be static Tailwind arbitrary classes.
 */

export interface CountryHeroTheme {
  /** Top gradient stop (dark — sits behind white hero text). */
  from: string;
  /** Bottom gradient stop. */
  to: string;
  /** Landmark graphic in `public/`, or `null` for a color-only hero. */
  image: string | null;
}

const HERO_IMAGE_DIR = "/country-heroes";

/** The original generic graphic, reused for Indonesia and the no-country hero. */
const GENERIC_HERO_IMAGE = "/figma-assets/hero-background.png";

/** Brand-blue default — used when there is no current application. */
export const DEFAULT_HERO_THEME: CountryHeroTheme = {
  from: "#03346E",
  to: "#3D6DAD",
  image: GENERIC_HERO_IMAGE,
};

/**
 * Curated themes. Countries with a bespoke graphic in `public/country-heroes/`
 * set `image`; others are color-only until artwork is supplied.
 */
const CURATED_HERO_THEMES: Record<string, CountryHeroTheme> = {
  // ── Countries with a bespoke landmark graphic ──────────────────────────
  australia: { from: "#0E4C6B", to: "#2E8FB0", image: `${HERO_IMAGE_DIR}/australia.png` },
  canada: { from: "#6E0F1C", to: "#B22234", image: `${HERO_IMAGE_DIR}/canada.png` },
  egypt: { from: "#7C4A1E", to: "#C08A4A", image: `${HERO_IMAGE_DIR}/egypt.png` },
  france: { from: "#1B2A6B", to: "#3D5AAE", image: `${HERO_IMAGE_DIR}/france.png` },
  india: { from: "#A64B00", to: "#E08A2C", image: `${HERO_IMAGE_DIR}/india.png` },
  italy: { from: "#14532D", to: "#2E8B57", image: `${HERO_IMAGE_DIR}/italy.png` },
  japan: { from: "#9B1B30", to: "#E24A5B", image: `${HERO_IMAGE_DIR}/japan.png` },
  malaysia: { from: "#0B5563", to: "#1D8AA0", image: `${HERO_IMAGE_DIR}/malaysia.png` },
  saudi_arabia: { from: "#0B3D2E", to: "#17795A", image: `${HERO_IMAGE_DIR}/saudi_arabia.png` },
  thailand: { from: "#6A1B4D", to: "#B23A82", image: `${HERO_IMAGE_DIR}/thailand.png` },
  turkey: { from: "#8E1B2E", to: "#D23B4A", image: `${HERO_IMAGE_DIR}/turkey.png` },
  united_arab_emirates: { from: "#5C3A1E", to: "#A8763C", image: `${HERO_IMAGE_DIR}/united_arab_emirates.png` },
  united_kingdom: { from: "#12224F", to: "#33509C", image: `${HERO_IMAGE_DIR}/united_kingdom.png` },
  united_states: { from: "#1A2A57", to: "#3C5A99", image: `${HERO_IMAGE_DIR}/united_states.png` },
  vietnam: { from: "#7A1220", to: "#C22A2A", image: `${HERO_IMAGE_DIR}/vietnam.png` },

  // ── Indonesia keeps the original graphic + brand blue ──────────────────
  indonesia: { from: "#03346E", to: "#3D6DAD", image: GENERIC_HERO_IMAGE },
};

/**
 * Tasteful dark→mid gradients for countries without a curated entry. Each is
 * legible under white text; a stable hash of the slug keeps a given country on
 * the same color across renders.
 */
const FALLBACK_PALETTE: ReadonlyArray<Pick<CountryHeroTheme, "from" | "to">> = [
  { from: "#1B2A6B", to: "#3D5AAE" }, // indigo
  { from: "#14532D", to: "#2E8B57" }, // forest
  { from: "#6A1B4D", to: "#B23A82" }, // plum
  { from: "#0B3D2E", to: "#17795A" }, // emerald
  { from: "#7C3A12", to: "#C0722E" }, // rust
  { from: "#3A1F5C", to: "#6B4BA3" }, // violet
  { from: "#0E4C6B", to: "#2E8FB0" }, // teal-blue
  { from: "#7A1220", to: "#C0392B" }, // crimson
  { from: "#274060", to: "#4A6FA5" }, // slate
  { from: "#4A2C12", to: "#9C6B34" }, // bronze
];

/** Deterministic non-negative hash so the same slug always maps to one color. */
function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash << 5) - hash + slug.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash);
}

/**
 * Resolve the hero theme for a country slug. Returns the brand-blue default for
 * an empty/nullish country, a curated theme when one exists, otherwise a
 * stable color-only fallback.
 */
export function getCountryHeroTheme(country: string | null | undefined): CountryHeroTheme {
  const slug = country?.trim().toLowerCase();
  if (!slug) return DEFAULT_HERO_THEME;

  const curated = CURATED_HERO_THEMES[slug];
  if (curated) return curated;

  const fallback = FALLBACK_PALETTE[hashSlug(slug) % FALLBACK_PALETTE.length];
  return { ...fallback, image: null };
}

/** CSS `linear-gradient` string for a theme (top→bottom). */
export function heroGradientCss(theme: CountryHeroTheme): string {
  return `linear-gradient(to bottom, ${theme.from}, ${theme.to})`;
}
