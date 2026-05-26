export const LOCALE_COOKIE = "NEXT_LOCALE";

export type InterfaceLocale = "en" | "zh";

export function normalizeInterfaceLocale(locale?: string | null): InterfaceLocale {
  return locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function isChineseLocale(locale?: string | null): boolean {
  return normalizeInterfaceLocale(locale) === "zh";
}

export function toTravelAgentLocale(locale?: string | null): "en" | "zh-CN" {
  return isChineseLocale(locale) ? "zh-CN" : "en";
}
