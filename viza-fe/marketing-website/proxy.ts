import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "./i18n";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
  // localeDetection stays true (default) so the NEXT_LOCALE cookie persists an
  // explicit language choice across the site's plain-anchor navigation.
});

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // The unprefixed article and category URLs are English canonical URLs.
  // Keep them reachable even when a visitor's site preference is Chinese.
  if (pathname === "/en" || pathname.startsWith("/en/") || pathname.startsWith("/blog/")) {
    request.cookies.set("NEXT_LOCALE", "en");
    return intlMiddleware(request);
  }
  // Force Chinese for first-time visitors (no stored preference), overriding the
  // accept-language header. Once the user has a cookie (incl. an explicit switch
  // to English), it is honored normally.
  if (!request.cookies.has("NEXT_LOCALE")) {
    request.cookies.set("NEXT_LOCALE", "zh-CN");
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
