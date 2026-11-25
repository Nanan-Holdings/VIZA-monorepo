import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./i18n";

/**
 * English is unprefixed (/visa/japan), every other locale is prefixed
 * (/zh-CN/visa/japan). Locale detection is off on purpose: every URL serves its
 * own language to every visitor, crawlers included. The only automatic redirects
 * are the country rule in vercel.json and the explicit-choice cookie in proxy.ts.
 * next-intl's own cookie and Link header are off too, so public pages carry no
 * per-visitor Set-Cookie.
 */
export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
  alternateLinks: false,
});

export const { Link, usePathname, useRouter, redirect } = createNavigation(routing);
