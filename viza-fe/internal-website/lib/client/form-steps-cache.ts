import type { WizardStep } from "@/types/visa-form-fields";

/**
 * Browser copy of a visa's form schema (the same for every applicant), so a
 * returning applicant sees the form immediately while the server copy loads
 * in the background. The schema changes only through migrations; the
 * background refresh replaces a stale copy, and MAX_AGE_MS bounds how old a
 * copy we will render first. Storage failures (private mode, quota) simply
 * mean no cache.
 */
const PREFIX = "viza:form-steps:v1:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedSteps {
  savedAt: number;
  steps: WizardStep[];
}

function key(visaType: string, country: string | null | undefined): string {
  return `${PREFIX}${visaType.trim().toUpperCase()}:${(country ?? "").trim().toLowerCase()}`;
}

export function readCachedFormSteps(
  visaType: string,
  country: string | null | undefined,
  now: number = Date.now(),
): WizardStep[] | null {
  try {
    const raw = window.localStorage.getItem(key(visaType, country));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedSteps>;
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > MAX_AGE_MS) return null;
    return Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : null;
  } catch {
    return null;
  }
}

export function writeCachedFormSteps(
  visaType: string,
  country: string | null | undefined,
  steps: WizardStep[],
  now: number = Date.now(),
): void {
  if (steps.length === 0) return;
  try {
    window.localStorage.setItem(key(visaType, country), JSON.stringify({ savedAt: now, steps }));
  } catch {
    // Quota or disabled storage: the form still loads from the server.
  }
}
