import type { Metadata } from "next";
import { defaultLocale, type Locale } from "@/i18n";

/**
 * One place for canonical URLs, hreflang alternates and social-preview tags.
 *
 * URL scheme (next-intl, localePrefix "as-needed"): English is unprefixed
 * (`/visa/vietnam`), Simplified Chinese sits under `/zh-CN` (`/zh-CN/visa/vietnam`).
 * Every page is self-canonical in its own locale and lists both locales plus
 * x-default as alternates. See docs/seo/README.md for why the unprefixed URLs
 * are crawlable (proxy.ts) even though first-time human visitors are sent to
 * Chinese.
 *
 * Note for page authors: a page that sets its own `openGraph` object replaces
 * the root layout's, so always build page metadata through `pageMetadata()`;
 * it carries the image, url, locale and Twitter card every time.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.it.com").replace(/\/$/, "");

/** Brand suffix appended to every page title, per locale. */
const BRAND: Record<Locale, string> = { en: "VIZA", "zh-CN": "VIZA 新加坡" };

/** Default 1200x630 social card per locale (public/og/). */
export const DEFAULT_OG_IMAGE: Record<Locale, string> = {
  en: "/og/viza-en.png",
  "zh-CN": "/og/viza-zh-CN.png",
};

const OG_LOCALE: Record<Locale, string> = { en: "en_SG", "zh-CN": "zh_CN" };

function asLocale(locale: string): Locale {
  return locale === "zh-CN" ? "zh-CN" : "en";
}

/** Locale-prefixed path. `path` is "" for home or starts with "/". */
export function localePath(locale: string, path: string): string {
  const prefix = asLocale(locale) === defaultLocale ? "" : `/${locale}`;
  return `${prefix}${path}` || "/";
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * hreflang map for a route that exists in both locales. "zh" covers Chinese
 * readers in Singapore and Malaysia as well as China; "zh-CN" is kept because
 * it matches the URL and the page's html lang.
 */
export function languageAlternates(path: string): Record<string, string> {
  const en = absoluteUrl(localePath("en", path));
  const zh = absoluteUrl(localePath("zh-CN", path));
  return { en, zh, "zh-CN": zh, "x-default": en };
}

export interface PageMetadataInput {
  locale: string;
  /** Route path without the locale prefix: "" for home, "/apply", "/visa/vietnam". */
  path: string;
  title: string;
  description: string;
  /** Absolute or site-relative image. Defaults to the locale's social card. */
  image?: { url: string; width?: number; height?: number; alt?: string };
  /** Skip the " | VIZA" suffix when the title already names the brand or is long. */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  /** False for routes that exist in one locale only (blog posts). */
  bilingual?: boolean;
  noindex?: boolean;
  /** Extra Open Graph fields for articles. */
  article?: { publishedTime?: string; modifiedTime?: string; authors?: string[] };
}

export function fullTitle(locale: string, title: string): string {
  return `${title} | ${BRAND[asLocale(locale)]}`;
}

export function pageMetadata(input: PageMetadataInput): Metadata {
  const locale = asLocale(input.locale);
  const canonical = absoluteUrl(localePath(locale, input.path));
  const title = input.absoluteTitle ? input.title : fullTitle(locale, input.title);
  const image = input.image ?? {
    url: DEFAULT_OG_IMAGE[locale],
    width: 1200,
    height: 630,
    alt: locale === "zh-CN" ? "VIZA 新加坡签证申请" : "VIZA visa applications from Singapore",
  };
  const images = [{ ...image, url: absoluteUrl(image.url) }];

  return {
    title: { absolute: title },
    description: input.description,
    alternates: {
      canonical,
      ...(input.bilingual === false ? {} : { languages: languageAlternates(input.path) }),
    },
    openGraph: {
      type: input.type ?? "website",
      siteName: "VIZA",
      url: canonical,
      locale: OG_LOCALE[locale],
      alternateLocale: input.bilingual === false ? undefined : [OG_LOCALE[locale === "en" ? "zh-CN" : "en"]],
      title,
      description: input.description,
      images,
      ...(input.article ?? {}),
    },
    twitter: {
      card: "summary_large_image",
      site: "@viza_it_com",
      title,
      description: input.description,
      images: images.map((item) => item.url),
    },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
