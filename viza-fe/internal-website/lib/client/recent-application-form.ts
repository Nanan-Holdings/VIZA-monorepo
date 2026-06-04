export const RECENT_APPLICATION_FORM_STORAGE_KEY = "viza:recent-application-form-href";
export const RECENT_APPLICATION_FORM_EVENT = "viza:recent-application-form";

const APPLICATION_FORM_PATHS = ["/client/application/long-form", "/client/simplified-form"] as const;
const TRANSIENT_QUERY_PARAMS = ["applicationId", "returnTo", "teamNotice", "skipFormCheck"];

export type ApplicationFormPath = (typeof APPLICATION_FORM_PATHS)[number];

export interface ApplicationFormTarget {
  href: string;
  path: ApplicationFormPath;
  applicationId: string | null;
  country: string | null;
  visaType: string | null;
}

function getBaseOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function parseHref(href: string): URL | null {
  try {
    return new URL(href, getBaseOrigin());
  } catch {
    return null;
  }
}

export function isApplicationFormPath(pathname: string): pathname is ApplicationFormPath {
  return APPLICATION_FORM_PATHS.includes(pathname as ApplicationFormPath);
}

export function normalizeApplicationFormHref(href: string): string | null {
  const url = parseHref(href);
  if (!url || !isApplicationFormPath(url.pathname)) return null;

  for (const param of TRANSIENT_QUERY_PARAMS) {
    url.searchParams.delete(param);
  }

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export function buildApplicationFormHref(
  pathname: string,
  search: string,
  fallback?: {
    applicationId?: string | null;
    country?: string | null;
    visaType?: string | null;
  },
): string | null {
  if (!isApplicationFormPath(pathname)) return null;

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!params.get("applicationId") && fallback?.applicationId) {
    params.set("applicationId", fallback.applicationId);
  }
  if (!params.get("country") && fallback?.country) {
    params.set("country", fallback.country);
  }
  if (!params.get("visaType") && fallback?.visaType) {
    params.set("visaType", fallback.visaType);
  }

  const query = params.toString();
  return normalizeApplicationFormHref(`${pathname}${query ? `?${query}` : ""}`);
}

export function readApplicationFormTarget(href: string | null | undefined): ApplicationFormTarget | null {
  if (!href) return null;

  const normalized = normalizeApplicationFormHref(href);
  if (!normalized) return null;

  const url = parseHref(normalized);
  if (!url || !isApplicationFormPath(url.pathname)) return null;

  return {
    href: normalized,
    path: url.pathname,
    applicationId: url.searchParams.get("applicationId"),
    country: url.searchParams.get("country"),
    visaType: url.searchParams.get("visaType") ?? url.searchParams.get("visa_type"),
  };
}

export function getRecentApplicationFormHref(): string | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(RECENT_APPLICATION_FORM_STORAGE_KEY);
  const normalized = stored ? normalizeApplicationFormHref(stored) : null;

  if (stored && !normalized) {
    window.localStorage.removeItem(RECENT_APPLICATION_FORM_STORAGE_KEY);
  }

  return normalized;
}

export function setRecentApplicationFormHref(href: string): string | null {
  if (typeof window === "undefined") return null;

  const normalized = normalizeApplicationFormHref(href);
  if (!normalized) return null;

  window.localStorage.setItem(RECENT_APPLICATION_FORM_STORAGE_KEY, normalized);
  window.dispatchEvent(new Event(RECENT_APPLICATION_FORM_EVENT));
  return normalized;
}
