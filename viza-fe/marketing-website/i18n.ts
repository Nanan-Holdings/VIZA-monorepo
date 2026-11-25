import { getRequestConfig } from "next-intl/server";
import en from "./messages/en.json";
import {
  DEFAULT_LOCALE,
  ENABLED_LOCALES,
  isEnabledLocale,
  type Locale,
} from "./lib/locales";

/** Routable locales: the ones with a complete messages file (see lib/locales.ts). */
export const locales = ENABLED_LOCALES;
export type { Locale };
export const defaultLocale: Locale = DEFAULT_LOCALE;

type Messages = Record<string, unknown>;

const isBranch = (value: unknown): value is Messages =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * English underneath, the locale's own values on top. A key the locale does not
 * define shows the English text instead of the raw key.
 */
export function mergeWithEnglish(base: Messages, overlay: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const under = out[key];
    out[key] = isBranch(value) && isBranch(under) ? mergeWithEnglish(under, value) : value;
  }
  return out;
}

const merged = new Map<string, Messages>();

async function messagesFor(locale: string): Promise<Messages> {
  const cached = merged.get(locale);
  if (cached) return cached;
  const result =
    locale === DEFAULT_LOCALE
      ? (en as unknown as Messages)
      : mergeWithEnglish(en as unknown as Messages, (await import(`./messages/${locale}.json`)).default as Messages);
  merged.set(locale, result);
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isEnabledLocale(requested) ? requested : DEFAULT_LOCALE;
  return { locale, messages: await messagesFor(locale) };
});
