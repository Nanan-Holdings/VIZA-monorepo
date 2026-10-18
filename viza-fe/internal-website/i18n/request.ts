import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const defaultLocale = "zh";
export const locales = ["en", "zh", "vi", "es"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  /* Only English and Chinese are translated. vi and es catalogs are mostly
     "[VI]"/"[ES]" placeholders and the language selector never offers them,
     so an old cookie for either falls back to the default. */
  const locale =
    cookieLocale === "en" || cookieLocale === "zh"
      ? (cookieLocale as Locale)
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
