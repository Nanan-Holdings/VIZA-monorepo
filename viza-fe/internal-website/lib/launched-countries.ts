import { LAUNCH_COUNTRIES, normalizeCountry } from "@/lib/queue/countries";

/**
 * Launched-country gate for the portal country picker (POR-010).
 *
 * Consistent with the runner_job launch set (lib/queue/countries.ts) and the
 * marketing site (marketing-website/lib/countries.ts launched=true). A
 * destination not in this set is "coming soon": the picker disables it with a
 * tooltip rather than letting a user start an application we can't yet run.
 */
const LAUNCHED = new Set<string>(LAUNCH_COUNTRIES);

export function isCountryLaunched(country: string | null | undefined): boolean {
  if (!country) return false;
  return LAUNCHED.has(normalizeCountry(country));
}
