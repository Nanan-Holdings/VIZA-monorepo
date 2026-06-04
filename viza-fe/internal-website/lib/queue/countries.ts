/**
 * Canonical country codes for the runner_job contract (QUE-004).
 *
 * This is the producer-side mirror of the dispatch keys in
 * viza-be/submission-service/src/queue/dispatch.ts. Both sides MUST agree
 * on these strings — the consumer looks up `runner_job.country` in its
 * DISPATCH table, so an unrecognized value dead-letters the job.
 *
 * Keep this list and COUNTRY_ALIASES in sync with the service-side
 * dispatch.ts. The contract is documented in docs/infra/queue.md.
 */
export const LAUNCH_COUNTRIES = [
  "indonesia",
  "egypt",
  "australia",
  "saudi_arabia",
  "united_kingdom",
  "vietnam",
  "malaysia",
  "japan",
  "united_states",
  "canada",
  "turkey",
  "thailand",
  "united_arab_emirates",
  "france",
  "italy",
  "india",
] as const;

export type LaunchCountry = (typeof LAUNCH_COUNTRIES)[number];

/** Additional prefill-capable countries with runners (non-launch). */
export const EXTRA_COUNTRIES = [
  "sri_lanka",
  "cambodia",
  "laos",
  "south_africa",
] as const;

const ALL_COUNTRIES = new Set<string>([...LAUNCH_COUNTRIES, ...EXTRA_COUNTRIES]);

/** ISO-ish / alias → canonical code. Mirror of dispatch.ts COUNTRY_ALIASES. */
export const COUNTRY_ALIASES: Record<string, string> = {
  gb: "united_kingdom",
  uk: "united_kingdom",
  us: "united_states",
  usa: "united_states",
  ae: "united_arab_emirates",
  uae: "united_arab_emirates",
  id: "indonesia",
  eg: "egypt",
  au: "australia",
  sa: "saudi_arabia",
  vn: "vietnam",
  my: "malaysia",
  jp: "japan",
  ca: "canada",
  tr: "turkey",
  th: "thailand",
  fr: "france",
  it: "italy",
  in: "india",
  lk: "sri_lanka",
  kh: "cambodia",
  la: "laos",
  za: "south_africa",
};

export function normalizeCountry(country: string): string {
  const key = country.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return COUNTRY_ALIASES[key] ?? key;
}

/** Normalize + validate a country for the runner_job contract. Throws on unknown. */
export function assertKnownCountry(country: string): string {
  const key = normalizeCountry(country);
  if (!ALL_COUNTRIES.has(key)) {
    throw new Error(
      `runner_job: unknown country '${country}' (normalized '${key}'). ` +
        `Add it to lib/queue/countries.ts and submission-service dispatch.ts.`,
    );
  }
  return key;
}
