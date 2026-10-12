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

/** The original generic graphic, reserved for the no-country hero. */
const GENERIC_HERO_IMAGE = "/figma-assets/hero-background.png";

/** Indonesia's brand-blue treatment, used for every application. */
export const DEFAULT_HERO_THEME: CountryHeroTheme = {
  from: "#03346E",
  to: "#3D6DAD",
  image: GENERIC_HERO_IMAGE,
};

/** Countries with bespoke landmark artwork; all share the brand-blue gradient. */
const CURATED_HERO_IMAGES: Record<string, string> = {
  argentina: `${HERO_IMAGE_DIR}/argentina.png`,
  australia: `${HERO_IMAGE_DIR}/australia.png`,
  austria: `${HERO_IMAGE_DIR}/austria.png`,
  belgium: `${HERO_IMAGE_DIR}/belgium.png`,
  bulgaria: `${HERO_IMAGE_DIR}/bulgaria.png`,
  cambodia: `${HERO_IMAGE_DIR}/cambodia.png`,
  canada: `${HERO_IMAGE_DIR}/canada.png`,
  chile: `${HERO_IMAGE_DIR}/chile.png`,
  china: `${HERO_IMAGE_DIR}/china.png`,
  colombia: `${HERO_IMAGE_DIR}/colombia.png`,
  croatia: `${HERO_IMAGE_DIR}/croatia.png`,
  cuba: `${HERO_IMAGE_DIR}/cuba.png`,
  czech_republic: `${HERO_IMAGE_DIR}/czech_republic.png`,
  denmark: `${HERO_IMAGE_DIR}/denmark.png`,
  dominican_republic: `${HERO_IMAGE_DIR}/dominican_republic.png`,
  egypt: `${HERO_IMAGE_DIR}/egypt.png`,
  estonia: `${HERO_IMAGE_DIR}/estonia.png`,
  finland: `${HERO_IMAGE_DIR}/finland.png`,
  france: `${HERO_IMAGE_DIR}/france.png`,
  germany: `${HERO_IMAGE_DIR}/germany.png`,
  greece: `${HERO_IMAGE_DIR}/greece.png`,
  hungary: `${HERO_IMAGE_DIR}/hungary.png`,
  iceland: `${HERO_IMAGE_DIR}/iceland.png`,
  india: `${HERO_IMAGE_DIR}/india.png`,
  indonesia: `${HERO_IMAGE_DIR}/indonesia.png`,
  ireland: `${HERO_IMAGE_DIR}/ireland.png`,
  israel: `${HERO_IMAGE_DIR}/israel.png`,
  italy: `${HERO_IMAGE_DIR}/italy.png`,
  japan: `${HERO_IMAGE_DIR}/japan.png`,
  jordan: `${HERO_IMAGE_DIR}/jordan.png`,
  kenya: `${HERO_IMAGE_DIR}/kenya.png`,
  laos: `${HERO_IMAGE_DIR}/laos.png`,
  latvia: `${HERO_IMAGE_DIR}/latvia.png`,
  liechtenstein: `${HERO_IMAGE_DIR}/liechtenstein.png`,
  lithuania: `${HERO_IMAGE_DIR}/lithuania.png`,
  luxembourg: `${HERO_IMAGE_DIR}/luxembourg.png`,
  malaysia: `${HERO_IMAGE_DIR}/malaysia.png`,
  maldives: `${HERO_IMAGE_DIR}/maldives.png`,
  malta: `${HERO_IMAGE_DIR}/malta.png`,
  mexico: `${HERO_IMAGE_DIR}/mexico.png`,
  morocco: `${HERO_IMAGE_DIR}/morocco.png`,
  nepal: `${HERO_IMAGE_DIR}/nepal.png`,
  netherlands: `${HERO_IMAGE_DIR}/netherlands.png`,
  new_zealand: `${HERO_IMAGE_DIR}/new_zealand.png`,
  norway: `${HERO_IMAGE_DIR}/norway.png`,
  oman: `${HERO_IMAGE_DIR}/oman.png`,
  peru: `${HERO_IMAGE_DIR}/peru.png`,
  philippines: `${HERO_IMAGE_DIR}/philippines.png`,
  poland: `${HERO_IMAGE_DIR}/poland.png`,
  portugal: `${HERO_IMAGE_DIR}/portugal.png`,
  qatar: `${HERO_IMAGE_DIR}/qatar.png`,
  romania: `${HERO_IMAGE_DIR}/romania.png`,
  saudi_arabia: `${HERO_IMAGE_DIR}/saudi_arabia.png`,
  singapore: `${HERO_IMAGE_DIR}/singapore.png`,
  slovakia: `${HERO_IMAGE_DIR}/slovakia.png`,
  slovenia: `${HERO_IMAGE_DIR}/slovenia.png`,
  south_africa: `${HERO_IMAGE_DIR}/south_africa.png`,
  south_korea: `${HERO_IMAGE_DIR}/south_korea.png`,
  spain: `${HERO_IMAGE_DIR}/spain.png`,
  sri_lanka: `${HERO_IMAGE_DIR}/sri_lanka.png`,
  sweden: `${HERO_IMAGE_DIR}/sweden.png`,
  switzerland: `${HERO_IMAGE_DIR}/switzerland.png`,
  taiwan: `${HERO_IMAGE_DIR}/taiwan.png`,
  tanzania: `${HERO_IMAGE_DIR}/tanzania.png`,
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
