import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "./i18n";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
  // localeDetection stays true (default) so the NEXT_LOCALE cookie persists an
  // explicit language choice across the site's plain-anchor navigation.
  //
  // hreflang lives in each page's <head> (lib/seo.ts), not in a Link header:
  // the header version cannot know that a blog article exists in one locale
  // only, so it advertised Chinese twins of English articles that do not exist.
  alternateLinks: false,
});

/**
 * True when the request states a real language preference. Browsers always
 * send Accept-Language; Googlebot, Bingbot and most AI crawlers send none
 * (Node's fetch sends "*").
 */
function statesLanguagePreference(request: NextRequest): boolean {
  const header = request.headers.get("accept-language")?.trim();
  return Boolean(header && header !== "*");
}

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // The unprefixed article and category URLs are English canonical URLs.
  // Keep them reachable even when a visitor's site preference is Chinese.
  if (pathname === "/en" || pathname.startsWith("/en/") || pathname.startsWith("/blog/")) {
    request.cookies.set("NEXT_LOCALE", "en");
    return intlMiddleware(request);
  }
  // First-time human visitors (no stored preference) get Chinese, overriding
  // the accept-language header. That redirect stays a temporary 307 because it
  // depends on the visitor. A request with no language preference at all (a
  // crawler) gets the page at the URL it asked for, so every unprefixed English
  // URL is a real 200 page for search engines and matches the hreflang
  // alternates; /zh-CN/* is served to everyone as is. Once the user has a
  // cookie (incl. an explicit switch to English), it is honored normally.
  if (!request.cookies.has("NEXT_LOCALE")) {
    request.cookies.set("NEXT_LOCALE", statesLanguagePreference(request) ? "zh-CN" : defaultLocale);
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
