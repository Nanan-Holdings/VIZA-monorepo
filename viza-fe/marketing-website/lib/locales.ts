/**
 * Locale registry for the marketing site, modelled on GrooveSheet's
 * i18n/routing.ts and lib/locales.ts.
 *
 * ALL_LOCALES is the full list (same codes, same order as GrooveSheet).
 * ENABLED_LOCALES is the subset that has a complete messages file. Only enabled
 * locales are routable, in the sitemap, in hreflang and in the language
 * switcher. To launch a language: add messages/<code>.json (and, where the
 * page needs it, the lib/visa-content/<code> files), then add the code to
 * ENABLED_LOCALES below. Nothing else needs to change. Keys missing from a
 * locale's messages fall back to English (see i18n.ts).
 */
export const ALL_LOCALES = ['en', 'zh-CN', 'zh-TW', 'ru', 'ja', 'pt', 'es', 'ko', 'de', 'fr', 'uk', 'id', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'ms', 'hi', 'sv', 'ro', 'cs', 'ar', 'fa', 'he', 'ur',
  'el', 'hu', 'da', 'fi', 'nb', 'bg', 'hr', 'sr', 'sk', 'sl', 'lt', 'lv', 'et', 'ca', 'sq', 'fil', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ne', 'kk', 'uz', 'az', 'ka', 'hy', 'sw', 'am', 'ps',
] as const;
export type Locale = (typeof ALL_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Locales that ship today. Keep in ALL_LOCALES order. */
export const ENABLED_LOCALES: readonly Locale[] = ["en", "zh-CN"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (ALL_LOCALES as readonly string[]).includes(value);
}

export function isEnabledLocale(value: unknown): value is Locale {
  return typeof value === "string" && (ENABLED_LOCALES as readonly string[]).includes(value);
}

/** Native names for the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '中文 (简体)',
  'zh-TW': '中文 (繁體)',
  ru: 'Русский',
  ja: '日本語',
  pt: 'Português',
  es: 'Español',
  ko: '한국어',
  de: 'Deutsch',
  fr: 'Français',
  uk: 'Українська',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  ms: 'Bahasa Melayu',
  hi: 'हिन्दी',
  sv: 'Svenska',
  ro: 'Română',
  cs: 'Čeština',
  ar: 'العربية',
  fa: 'فارسی',
  he: 'עברית',
  ur: 'اردو',
  el: 'Ελληνικά',
  hu: 'Magyar',
  da: 'Dansk',
  fi: 'Suomi',
  nb: 'Norsk bokmål',
  bg: 'Български',
  hr: 'Hrvatski',
  sr: 'Српски',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  et: 'Eesti',
  ca: 'Català',
  sq: 'Shqip',
  fil: 'Filipino',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  mr: 'मराठी',
  gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
  pa: 'ਪੰਜਾਬੀ',
  ne: 'नेपाली',
  kk: 'Қазақша',
  uz: 'Oʻzbekcha',
  az: 'Azərbaycanca',
  ka: 'ქართული',
  hy: 'Հայերեն',
  sw: 'Kiswahili',
  am: 'አማርኛ',
  ps: 'پښتو',
};

/** BCP 47 tags for <html lang> and hreflang. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: 'en',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  ru: 'ru',
  ja: 'ja',
  // /pt is written in Brazilian Portuguese; /es in neutral Latin American Spanish.
  pt: 'pt-BR',
  es: 'es',
  ko: 'ko',
  de: 'de',
  fr: 'fr',
  uk: 'uk',
  id: 'id',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  tr: 'tr',
  vi: 'vi',
  th: 'th',
  ms: 'ms',
  hi: 'hi',
  sv: 'sv',
  ro: 'ro',
  cs: 'cs',
  ar: 'ar',
  fa: 'fa',
  he: 'he',
  ur: 'ur',
  el: 'el',
  hu: 'hu',
  da: 'da',
  fi: 'fi',
  nb: 'nb',
  bg: 'bg',
  hr: 'hr',
  sr: 'sr',
  sk: 'sk',
  sl: 'sl',
  lt: 'lt',
  lv: 'lv',
  et: 'et',
  ca: 'ca',
  sq: 'sq',
  fil: 'fil',
  bn: 'bn',
  ta: 'ta',
  te: 'te',
  mr: 'mr',
  gu: 'gu',
  kn: 'kn',
  ml: 'ml',
  pa: 'pa',
  ne: 'ne',
  kk: 'kk',
  uz: 'uz',
  az: 'az',
  ka: 'ka',
  hy: 'hy',
  sw: 'sw',
  am: 'am',
  ps: 'ps',
};

/** og:locale per locale (Open Graph wants territory-qualified tags). */
export const OG_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  ru: 'ru_RU',
  ja: 'ja_JP',
  pt: 'pt_BR',
  es: 'es_LA',
  ko: 'ko_KR',
  de: 'de_DE',
  fr: 'fr_FR',
  uk: 'uk_UA',
  id: 'id_ID',
  it: 'it_IT',
  nl: 'nl_NL',
  pl: 'pl_PL',
  tr: 'tr_TR',
  vi: 'vi_VN',
  th: 'th_TH',
  ms: 'ms_MY',
  hi: 'hi_IN',
  sv: 'sv_SE',
  ro: 'ro_RO',
  cs: 'cs_CZ',
  ar: 'ar_AR',
  fa: 'fa_IR',
  he: 'he_IL',
  ur: 'ur_PK',
  el: 'el_GR',
  hu: 'hu_HU',
  da: 'da_DK',
  fi: 'fi_FI',
  nb: 'nb_NO',
  bg: 'bg_BG',
  hr: 'hr_HR',
  sr: 'sr_RS',
  sk: 'sk_SK',
  sl: 'sl_SI',
  lt: 'lt_LT',
  lv: 'lv_LV',
  et: 'et_EE',
  ca: 'ca_ES',
  sq: 'sq_AL',
  fil: 'fil_PH',
  bn: 'bn_BD',
  ta: 'ta_IN',
  te: 'te_IN',
  mr: 'mr_IN',
  gu: 'gu_IN',
  kn: 'kn_IN',
  ml: 'ml_IN',
  pa: 'pa_IN',
  ne: 'ne_NP',
  kk: 'kk_KZ',
  uz: 'uz_UZ',
  az: 'az_AZ',
  ka: 'ka_GE',
  hy: 'hy_AM',
  sw: 'sw_KE',
  am: 'am_ET',
  ps: 'ps_AF',
};

/** Right-to-left locales: <html dir="rtl">. */
export const RTL_LOCALES = ["ar", "fa", "he", "ur", "ps"] as const;

export function isRtlLocale(locale: string | null | undefined): boolean {
  if (!locale) return false;
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return (RTL_LOCALES as readonly string[]).includes(base);
}

export function localeDir(locale: string): "rtl" | "ltr" {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}

/** Set when a visitor picks a language themselves. Read by proxy.ts and by vercel.json's country redirect. */
export const LOCALE_COOKIE = "viza_locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function rememberLocaleChoice(locale: string): void {
  if (typeof document === "undefined" || !isLocale(locale)) return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = [
    `${LOCALE_COOKIE}=${encodeURIComponent(locale)}`,
    "path=/",
    `max-age=${LOCALE_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** English is unprefixed, every other locale is prefixed: "/visa/japan" or "/zh-CN/visa/japan". */
export function buildLocalePath(locale: string, path: string): string {
  const target = path.startsWith("/") ? path : `/${path}`;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return target;
  if (target === `/${locale}` || target.startsWith(`/${locale}/`)) return target;
  return target === "/" ? `/${locale}` : `/${locale}${target}`;
}
