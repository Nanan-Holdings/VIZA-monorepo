/**
 * generateMetadata helper. Every page returns pageMetadata(...) so each URL has
 * its own title, description, canonical, hreflang set (enabled locales plus
 * x-default), Open Graph and Twitter summary_large_image card.
 *
 *   export async function generateMetadata({ params }) {
 *     const { locale } = await params;
 *     return pageMetadata({ title, description, path: "/contact", locale, ogKey: "contact" });
 *   }
 *
 * `path` is the unprefixed English path of the page ("/visa/japan"). Titles are
 * passed finished (they already end in " | VIZA"), so the root layout has no
 * title template.
 */
import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  ENABLED_LOCALES,
  LOCALE_HTML_LANG,
  OG_LOCALES,
  buildLocalePath,
  isEnabledLocale,
  type Locale,
} from "@/lib/locales";
import ogManifest from "@/lib/seo/og-manifest.json";
import { SITE_NAME } from "@/lib/seo/site";

export const OG_SIZE = { width: 1200, height: 630 } as const;

function asLocale(locale: string): Locale {
  return isEnabledLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** Canonical plus one hreflang per enabled locale plus x-default (English). Paths only; metadataBase makes them absolute. */
export function alternatesFor(path: string, locale: string): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = { "x-default": buildLocalePath(DEFAULT_LOCALE, path) };
  for (const l of ENABLED_LOCALES) languages[LOCALE_HTML_LANG[l]] = buildLocalePath(l, path);
  return { canonical: buildLocalePath(asLocale(locale), path), languages };
}

const trimEnd = (text: string) => text.replace(/[\s,;:.-]+$/, "");

/** Cut `text` to at most `max` characters at a word boundary, without an ellipsis. */
export function clip(text: string, max: number): string {
  const chars = [...text.trim().replace(/\s+/g, " ")];
  if (chars.length <= max) return chars.join("");
  const cut = chars.slice(0, max).join("");
  const space = cut.lastIndexOf(" ");
  return trimEnd(space > max * 0.6 ? cut.slice(0, space) : cut);
}

/** Title of 60 characters or fewer, ending in " | VIZA". */
export function clipTitle(title: string): string {
  const suffix = " | VIZA";
  return `${clip(title, 60 - suffix.length)}${suffix}`;
}

/** Static 1200x630 JPEG for a page key in a locale, falling back to English when that locale has no card yet. */
export function ogImagePath(key: string, locale: string): string {
  const keys = (ogManifest as Record<string, string[]>)[locale];
  const useLocale = keys?.includes(key) ? locale : DEFAULT_LOCALE;
  return `/og/${useLocale}/${key}.jpg`;
}

export interface PageMetadataInput {
  /** Finished title, brand included (for example "Contact Us | VIZA"). */
  title: string;
  description: string;
  /** Unprefixed English path of this page, for example "/visa/japan". */
  path: string;
  locale: string;
  /** Key of the card in public/og/<locale>/<key>.jpg. */
  ogKey?: string;
  /** Explicit image (blog covers). Overrides ogKey. */
  image?: { url: string; alt?: string; width?: number; height?: number };
  imageAlt?: string;
  noindex?: boolean;
  /** "none" for a page that exists in one locale only: canonical, no hreflang cluster. */
  hreflang?: "all" | "none";
  ogType?: "website" | "article";
  /** Extra article fields for ogType "article". */
  article?: { publishedTime?: string; modifiedTime?: string; authors?: string[] };
}

export function pageMetadata({
  title,
  description,
  path,
  locale,
  ogKey = "home",
  image,
  imageAlt,
  noindex = false,
  hreflang = "all",
  ogType = "website",
  article,
}: PageMetadataInput): Metadata {
  const l = asLocale(locale);
  const full = alternatesFor(path, locale);
  const alternates = hreflang === "none" ? { canonical: full.canonical } : full;
  const alt = image?.alt ?? imageAlt ?? title;
  const images = image
    ? [{ url: image.url, alt, width: image.width ?? OG_SIZE.width, height: image.height ?? OG_SIZE.height }]
    : [{ url: ogImagePath(ogKey, locale), alt, ...OG_SIZE }];
  const ogLocale = OG_LOCALES[l];
  return {
    title: { absolute: title },
    description,
    alternates,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      title,
      description,
      url: alternates.canonical as string,
      locale: ogLocale,
      alternateLocale: ENABLED_LOCALES.map((x) => OG_LOCALES[x]).filter((x) => x !== ogLocale),
      images,
      ...(ogType === "article" && article ? article : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}
