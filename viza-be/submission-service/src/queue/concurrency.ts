/**
 * Per-country concurrency + pause config for the runner_job claimer (QUE-006).
 *
 * Source of truth is env, so ops can retune without a deploy:
 *   - RUNNER_CONCURRENCY_JSON: JSON object of canonical country code →
 *     max in-flight. Example: {"indonesia":2,"united_states":1}. A
 *     "default" key sets the fallback for unlisted countries.
 *   - RUNNER_PAUSED_COUNTRIES: comma-separated canonical country codes to
 *     pause (claimer declines them). Example: "france,italy".
 *
 * Defaults: concurrency 1 per country, none paused. Parsed once at module
 * load; the worker reads via getMaxConcurrent() / isPaused().
 */

const DEFAULT_MAX_CONCURRENT = 1;

function parseConcurrency(): Record<string, number> {
  const raw = process.env.RUNNER_CONCURRENCY_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
    }
    return out;
  } catch (err) {
    console.error("[concurrency] invalid RUNNER_CONCURRENCY_JSON, using defaults", err);
    return {};
  }
}

function parsePaused(): Set<string> {
  const raw = process.env.RUNNER_PAUSED_COUNTRIES;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

const CONCURRENCY = parseConcurrency();
const PAUSED = parsePaused();

/** Max in-flight runner_job rows allowed for a country. */
export function getMaxConcurrent(country: string): number {
  return CONCURRENCY[country] ?? CONCURRENCY["default"] ?? DEFAULT_MAX_CONCURRENT;
}

/** Whether the claimer should decline jobs for a country. */
export function isPaused(country: string): boolean {
  return PAUSED.has(country.toLowerCase());
}
