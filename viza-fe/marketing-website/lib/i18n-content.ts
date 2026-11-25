/**
 * Server-side loaders for translated long-form content (see lib/i18n-overlay.ts).
 *
 * `en` is the English object in code, `zh-CN` keeps its hand-written twin files, and every other locale is the
 * English object with translations/<locale>/<unit>.json laid over it. A missing overlay file (a locale that is
 * not translated yet, or a unit it lacks) returns null, which means English. Only import this from server code:
 * the overlays are not meant to ship to the browser.
 */
import { isNativeZh, type Overlay } from "@/lib/i18n-overlay";

/** True when `locale` is translated through an overlay rather than English or the native zh-CN twin. */
export const usesOverlay = (locale: string): boolean => locale !== "en" && !isNativeZh(locale);

async function load(importer: () => Promise<{ default: Overlay }>): Promise<Overlay | null> {
  try {
    return (await importer()).default;
  } catch {
    return null;
  }
}

/* translations/_empty holds empty overlays so each import pattern below always matches a file (Turbopack requires it). */
/* One literal-prefixed dynamic import per kind, so the bundler can build a context for each folder. */
export const visaOverlay = (locale: string, slug: string) =>
  usesOverlay(locale) ? load(() => import(`@/translations/${locale}/visa/${slug}.json`)) : Promise.resolve(null);
export const guideOverlay = (locale: string, slug: string) =>
  usesOverlay(locale) ? load(() => import(`@/translations/${locale}/guides/${slug}.json`)) : Promise.resolve(null);
export const arrivalOverlay = (locale: string, slug: string) =>
  usesOverlay(locale) ? load(() => import(`@/translations/${locale}/arrival/${slug}.json`)) : Promise.resolve(null);
export const legalOverlay = (locale: string) =>
  usesOverlay(locale) ? load(() => import(`@/translations/${locale}/legal.json`)) : Promise.resolve(null);
export const metaOverlay = (locale: string) =>
  usesOverlay(locale) ? load(() => import(`@/translations/${locale}/meta.json`)) : Promise.resolve(null);
export const seoOverlay = (locale: string) =>
  usesOverlay(locale) ? load(() => import(`@/translations/${locale}/seo.json`)) : Promise.resolve(null);

/** A `{ en, zh }` pair from code, resolved for `locale` (overlay value wins for other languages). */
export function pickLocal(field: { en: string; zh: string }, locale: string, overlayValue?: string): string {
  if (isNativeZh(locale)) return field.zh;
  if (locale === "en") return field.en;
  return overlayValue ?? field.en;
}
