import { getFormVisaType } from "@/lib/visa-destinations";
import { buildApplicationLongFormHref } from "@/lib/client/recent-application-form";

export const ACTIVE_APPLICATION_SELECTION_STORAGE_KEY = "viza:active-application";
export const ACTIVE_APPLICATION_SELECTION_EVENT = "viza:active-application";

export interface ActiveApplicationSelection {
  applicationId: string | null;
  packageId: string | null;
  country: string;
  visaType: string;
  href: string;
}

const TERMINAL_APPLICATION_STATES = new Set([
  "approved",
  "rejected",
  "completed",
  "cancelled",
  "canceled",
  "archived",
]);

export function isOngoingApplicationState(state: string | null | undefined): boolean {
  const normalized = state?.trim().toLowerCase() ?? "";
  return !TERMINAL_APPLICATION_STATES.has(normalized);
}

function isSelection(value: unknown): value is ActiveApplicationSelection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ActiveApplicationSelection>;
  return (
    (candidate.applicationId === null || typeof candidate.applicationId === "string") &&
    (candidate.packageId === null || typeof candidate.packageId === "string") &&
    typeof candidate.country === "string" &&
    candidate.country.trim().length > 0 &&
    typeof candidate.visaType === "string" &&
    candidate.visaType.trim().length > 0 &&
    typeof candidate.href === "string" &&
    candidate.href.startsWith("/client/")
  );
}

export function readActiveApplicationSelection(): ActiveApplicationSelection | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(ACTIVE_APPLICATION_SELECTION_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isSelection(parsed)) throw new Error("invalid_active_application_selection");
    return {
      ...parsed,
      country: parsed.country.trim(),
      visaType: getFormVisaType(parsed.visaType.trim()),
    };
  } catch {
    window.localStorage.removeItem(ACTIVE_APPLICATION_SELECTION_STORAGE_KEY);
    return null;
  }
}

export function buildActiveApplicationFormHref(
  selection: ActiveApplicationSelection,
): string {
  return buildApplicationLongFormHref({
    applicationId: selection.applicationId,
    country: selection.country,
    visaType: selection.visaType,
  });
}

export function getActiveApplicationFormHref(): string | null {
  const selection = readActiveApplicationSelection();
  return selection ? buildActiveApplicationFormHref(selection) : null;
}

export function setActiveApplicationSelection(
  selection: ActiveApplicationSelection,
): ActiveApplicationSelection | null {
  if (typeof window === "undefined") return null;

  const normalized: ActiveApplicationSelection = {
    ...selection,
    country: selection.country.trim(),
    visaType: getFormVisaType(selection.visaType.trim()),
  };
  if (!isSelection(normalized)) return null;

  window.localStorage.setItem(
    ACTIVE_APPLICATION_SELECTION_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  window.dispatchEvent(new Event(ACTIVE_APPLICATION_SELECTION_EVENT));
  return normalized;
}
