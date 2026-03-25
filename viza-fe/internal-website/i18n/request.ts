import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const defaultLocale = "zh";
export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale =
    cookieLocale && locales.includes(cookieLocale as Locale)
      ? (cookieLocale as Locale)
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
