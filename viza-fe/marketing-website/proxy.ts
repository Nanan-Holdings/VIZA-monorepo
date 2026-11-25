import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./navigation";
import { LOCALE_COOKIE, ENABLED_LOCALES, DEFAULT_LOCALE } from "./lib/locales";

const intlMiddleware = createMiddleware(routing);

const PREFIXED = ENABLED_LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/**
 * Locale routing only. No locale is ever forced: /visa/japan is English and
 * /zh-CN/visa/japan is Chinese for every visitor, Googlebot included.
 *
 * The one redirect here: a returning visitor who explicitly picked a language
 * (viza_locale cookie) lands on that language's home page when they open "/".
 * Deep links are never second-guessed. First-visit country redirects for
 * Chinese-speaking regions live in vercel.json and skip crawlers.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
    const prefixed = PREFIXED.find((l) => l === chosen);
    if (prefixed) {
      const url = request.nextUrl.clone();
      url.pathname = `/${prefixed}`;
      return NextResponse.redirect(url);
    }
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
