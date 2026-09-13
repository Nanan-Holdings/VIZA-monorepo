export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_CHANGE_EVENT = "viza:locale-change";

export type InterfaceLocale = "en" | "zh";
export type AuthEmailLocale = "en" | "zh" | "vi" | "es";

export function normalizeInterfaceLocale(locale?: string | null): InterfaceLocale {
  return locale?.trim().toLowerCase().startsWith("zh") ? "zh" : "en";
}

/** All language controls persist the same preference used by next-intl. */
export function setInterfaceLocalePreference(locale: string): InterfaceLocale {
  const selected = normalizeInterfaceLocale(locale);
  document.cookie = `${LOCALE_COOKIE}=${selected}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  // Storage is only a cross-tab notification/mirror. A blocked storage API must
  // never prevent the cookie update or the caller's router.refresh().
  try {
    window.localStorage.setItem(LOCALE_COOKIE, selected);
  } catch {
    // Private browsing and storage policies can disable localStorage.
  }
  window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: selected }));
  return selected;
}

export function isChineseLocale(locale?: string | null): boolean {
  return normalizeInterfaceLocale(locale) === "zh";
}

export function toTravelAgentLocale(locale?: string | null): "en" | "zh-CN" {
  return isChineseLocale(locale) ? "zh-CN" : "en";
}

export function normalizeAuthEmailLocale(locale?: string | null): AuthEmailLocale {
  const normalized = locale?.toLowerCase() ?? "";
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("vi")) return "vi";
  if (normalized.startsWith("es")) return "es";
  return "en";
}
