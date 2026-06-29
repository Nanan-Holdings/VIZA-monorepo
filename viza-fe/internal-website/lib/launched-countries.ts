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
const SELF_SERVE_ARRIVAL_CARD_COUNTRIES = new Set<string>([
  "ph",
  "philippines",
]);

export function isCountryLaunched(country: string | null | undefined): boolean {
  if (!country) return false;
  const normalizedCountry = normalizeCountry(country);
  return LAUNCHED.has(normalizedCountry) || SELF_SERVE_ARRIVAL_CARD_COUNTRIES.has(normalizedCountry);
}
