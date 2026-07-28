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
