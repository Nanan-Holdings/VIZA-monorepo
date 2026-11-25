/**
 * Content shared by the home and about pages: the four steps, the Guided and Full-service comparison,
 * the FAQ keys and the photos used for each block. Copy lives in the `homePage` messages namespace.
 */
import { COUNTRIES } from "@/lib/countries";

type T = (key: string) => string;

const HERO = (slug: string) => `/assets/heroes/${slug}.jpg`;

/** Visa type carousel photos (VIZA's destination photography, public/assets/heroes). */
export const TYPE_IMAGES = {
  tourist: HERO("italy"),
  business: HERO("china"),
  work: HERO("turkiye"),
  student: HERO("france"),
  long: HERO("schengen"),
} as const;

export const STEP_IMAGES = [HERO("india"), HERO("vietnam"), HERO("australia"), HERO("saudi-arabia")];

export const STEP_KEYS = ["choose", "passport", "confirm", "file"] as const;

export function homeSteps(t: T) {
  return STEP_KEYS.map((k) => ({
    title: t(`steps.items.${k}.title`),
    body: t(`steps.items.${k}.body`),
    chips: t(`steps.items.${k}.chips`).split("|").filter(Boolean),
  }));
}

const TIER_ROWS = ["fee", "form", "documents", "interview", "govFee", "bestFor"] as const;

export function homeTiers(t: T) {
  return {
    columns: [t("tiers.guided"), t("tiers.full")],
    rows: TIER_ROWS.map((k) => ({ label: t(`tiers.rows.${k}.label`), values: [t(`tiers.rows.${k}.guided`), t(`tiers.rows.${k}.full`)] })),
  };
}

export const HOME_FAQ = ["cost", "visas", "approval", "tiers", "language"] as const;

/** Photo for a guide card: the first destination it covers whose photo is not already in `used`. */
export function guideImage(visaSlugs: string[], used: Set<string> = new Set()): string {
  const photos = visaSlugs.map((slug) => COUNTRIES.find((x) => x.slug === slug)?.image).filter((x): x is string => Boolean(x));
  const pick = photos.find((src) => !used.has(src)) ?? photos[0] ?? HERO("schengen");
  used.add(pick);
  return pick;
}
