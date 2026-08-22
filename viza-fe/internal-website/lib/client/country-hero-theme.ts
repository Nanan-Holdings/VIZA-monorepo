/**
 * Country hero theming for the client portal.
 *
 * Every application uses the Indonesia/brand-blue gradient so the dashboard
 * remains visually consistent when the current country changes. Countries can
 * still provide their own landmark graphic. To add one, drop a slug-named
 * image in `public/country-heroes/` and add an entry below.
 *
 * Country slugs are the lowercase snake_case values stored in
 * `applications.country` (see `lib/visa-destinations.ts`), e.g. `united_states`.
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

/** Indonesia's brand-blue treatment, used for every application. */
export const DEFAULT_HERO_THEME: CountryHeroTheme = {
  from: "#03346E",
  to: "#3D6DAD",
  image: GENERIC_HERO_IMAGE,
};

/** Countries with bespoke landmark artwork; all share the brand-blue gradient. */
const CURATED_HERO_IMAGES: Record<string, string> = {
  australia: `${HERO_IMAGE_DIR}/australia.png`,
  canada: `${HERO_IMAGE_DIR}/canada.png`,
  egypt: `${HERO_IMAGE_DIR}/egypt.png`,
  france: `${HERO_IMAGE_DIR}/france.png`,
  germany: `${HERO_IMAGE_DIR}/germany.png`,
  india: `${HERO_IMAGE_DIR}/india.png`,
  indonesia: GENERIC_HERO_IMAGE,
  italy: `${HERO_IMAGE_DIR}/italy.png`,
  japan: `${HERO_IMAGE_DIR}/japan.png`,
  malaysia: `${HERO_IMAGE_DIR}/malaysia.png`,
  saudi_arabia: `${HERO_IMAGE_DIR}/saudi_arabia.png`,
  singapore: `${HERO_IMAGE_DIR}/singapore.png`,
  taiwan: `${HERO_IMAGE_DIR}/taiwan.png`,
  thailand: `${HERO_IMAGE_DIR}/thailand.png`,
  turkey: `${HERO_IMAGE_DIR}/turkey.png`,
  united_arab_emirates: `${HERO_IMAGE_DIR}/united_arab_emirates.png`,
  united_kingdom: `${HERO_IMAGE_DIR}/united_kingdom.png`,
  united_states: `${HERO_IMAGE_DIR}/united_states.png`,
  vietnam: `${HERO_IMAGE_DIR}/vietnam.png`,
};

/** Resolve the shared blue hero theme and any country-specific artwork. */
export function getCountryHeroTheme(country: string | null | undefined): CountryHeroTheme {
  const slug = country?.trim().toLowerCase();
  if (!slug) return DEFAULT_HERO_THEME;

  return {
    ...DEFAULT_HERO_THEME,
    image: CURATED_HERO_IMAGES[slug] ?? null,
  };
}

/** CSS `linear-gradient` string for a theme (top→bottom). */
export function heroGradientCss(theme: CountryHeroTheme): string {
  return `linear-gradient(to bottom, ${theme.from}, ${theme.to})`;
}
