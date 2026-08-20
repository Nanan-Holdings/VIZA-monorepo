import { supabase } from "../supabase.js";

export type ConcurrencyMetricEventType = "claim" | "machine_start";

export interface ConcurrencyMetricInput {
  eventType: ConcurrencyMetricEventType;
  outcome: string;
  durationMs: number;
  country?: string | null;
  machineKind?: string | null;
  count?: number;
}

export interface ConcurrencyMetricClient {
  from(table: string): {
    insert(values: Record<string, unknown>): PromiseLike<{
      error: { message: string } | null;
    }>;
  };
}

const defaultConcurrencyMetricClient = supabase as unknown as ConcurrencyMetricClient;

function boundedDurationMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(7_200_000, Math.round(value)));
}

function boundedCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(10, Math.round(value)));
}

function boundedDimension(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized.slice(0, 64) : null;
}

/**
 * Best-effort operational telemetry for the concurrency dashboard. It is
 * deliberately separate from runner_metric: it contains no application,
 * applicant, job, or portal identifiers. A metrics outage must never change
 * queue or capacity behavior, so both client throws and insert errors are
 * swallowed after emitting a redacted local diagnostic.
 */
export async function emitConcurrencyMetric(
  input: ConcurrencyMetricInput,
  client: ConcurrencyMetricClient = defaultConcurrencyMetricClient,
): Promise<void> {
  try {
    const { error } = await client.from("runner_concurrency_metric").insert({
      event_type: input.eventType,
      outcome: input.outcome.trim().slice(0, 64),
      duration_ms: boundedDurationMs(input.durationMs),
      country: boundedDimension(input.country),
      machine_kind: boundedDimension(input.machineKind),
      count: boundedCount(input.count),
    });
    if (error) {
      console.error(`[metrics] concurrency emit failed: ${error.message}`);
    }
  } catch (error) {
    console.error(
      `[metrics] concurrency emit unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Per-runner-job KPI emission (OPS-005).
 *
 * Call once at job teardown — one row per finished runner_job. The
 * `/admin/metrics` page aggregates weekly per-country at read time.
 *
 * Cost fields are caller-supplied — the country runner knows whether
 * it spent a captcha solve or how many MB the proxy egressed. We
 * intentionally do not infer.
 */

export interface MetricInput {
  jobId: string | null;
  applicationId: string;
  country: string;
  success: boolean;
  /** Wall-clock seconds from runner_job.started_at to finished_at. */
  timeToSubmitSeconds: number | null;
  captchaCostCents?: number;
  proxyCostCents?: number;
}

function isoWeekStart(d: Date = new Date()): string {
  // Monday-of-the-week in UTC, formatted as YYYY-MM-DD (matches the
  // SQL helper iso_week_start).
  const day = d.getUTCDay();
  const offsetToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetToMon),
  );
  return monday.toISOString().slice(0, 10);
}

/**
 * OBSV-001: per-country lifecycle event counter. Emitted as a structured log
 * line (one per transition) so a log-based metrics pipeline derives
 * `runner_job_events_total{country,event}` without a schema change. Dimensions
 * + dashboard config: docs/observability/metrics.md + dashboard.json.
 */
export type RunnerEvent = "started" | "succeeded" | "halted" | "failed" | "dead_lettered" | "ownership_lost";

export function emitRunnerEvent(country: string, event: RunnerEvent, jobId?: string): void {
  console.log(
    JSON.stringify({
      metric: "runner_job_event",
      event,
      country,
      jobId: jobId ?? null,
      at: new Date().toISOString(),
    }),
  );
}

export async function emitRunnerMetric(input: MetricInput): Promise<void> {
  const { error } = await supabase.from("runner_metric").insert({
    job_id: input.jobId,
    application_id: input.applicationId,
    country: input.country,
    week_start: isoWeekStart(),
    success: input.success,
    time_to_submit_s: input.timeToSubmitSeconds ?? null,
    captcha_cost_cents: input.captchaCostCents ?? 0,
    proxy_cost_cents: input.proxyCostCents ?? 0,
  });
  if (error) {
    console.error(`[metrics] emit failed: ${error.message}`);
  }
}
