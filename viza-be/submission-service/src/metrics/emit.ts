import { supabase } from "../supabase.js";

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
export type RunnerEvent = "started" | "succeeded" | "halted" | "failed" | "dead_lettered";

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
