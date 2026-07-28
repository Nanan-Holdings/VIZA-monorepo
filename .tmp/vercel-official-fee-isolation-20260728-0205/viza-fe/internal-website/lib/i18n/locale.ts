export const LOCALE_COOKIE = "NEXT_LOCALE";

export type InterfaceLocale = "en" | "zh";
export type AuthEmailLocale = "en" | "zh" | "vi" | "es";

export function normalizeInterfaceLocale(locale?: string | null): InterfaceLocale {
  return locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
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
