/**
 * The Travel AI currently supports the same two interface locales as the
 * portal. Keep transport tags such as `zh-CN` and `en-US` at the boundary and
 * use a small, stable language value throughout the planner and service.
 */
export type TravelLocale = "zh" | "en";

export const TRAVEL_LOCALE_COOKIE = "NEXT_LOCALE";

/** Return null for an unsupported value so callers can apply their own fallback. */
export function parseTravelLocale(value: unknown): TravelLocale | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/_/gu, "-");
  if (!normalized) return null;
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh";
  return null;
}

export function normalizeTravelLocale(
  value: unknown,
  fallback: TravelLocale = "zh"
): TravelLocale {
  return parseTravelLocale(value) ?? fallback;
}

function readCookieLocale(cookieHeader: string | null): TravelLocale | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== TRAVEL_LOCALE_COOKIE) continue;
    const value = rawValue.join("=").trim();
    try {
      return parseTravelLocale(decodeURIComponent(value));
    } catch {
      return parseTravelLocale(value);
    }
  }
  return null;
}

/** Resolve the selected portal locale when a request omitted its body locale. */
export function localeFromRequest(request: Request): TravelLocale {
  const cookieLocale = readCookieLocale(request.headers.get("cookie"));
  if (cookieLocale) return cookieLocale;

  // Match i18n/request.ts: without a preference the portal renders Chinese.
  // The browser's Accept-Language must not override that displayed setting.
  return "zh";
}

export function resolveRequestLocale(
  request: Request,
  value: unknown
): TravelLocale {
  return parseTravelLocale(value) ?? localeFromRequest(request);
}
