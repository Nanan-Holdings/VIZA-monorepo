# Runner Metrics (OBSV-001)

Two emission paths from the submission-service runner (`src/metrics/emit.ts`):

| Metric | Source | Dimensions | Notes |
| --- | --- | --- | --- |
| `runner_metric` (row per finished job) | `emitRunnerMetric` → `runner_metric` table | country, week_start, success, time_to_submit_s, captcha_cost_cents, proxy_cost_cents | aggregated weekly per-country by `/admin/metrics` |
| `runner_job_event` (structured log) | `emitRunnerEvent` → stdout JSON | country, event (started/succeeded/halted/failed/dead_lettered), jobId | log-based counter `runner_job_events_total{country,event}` |

The handler (`src/queue/handler.ts`) emits `started` then `succeeded`/`halted`/`failed`
per job. Dashboard config: `docs/observability/dashboard.json` (panels: jobs by
event/country, success rate, halted-awaiting-pay, dead-letter count, time-to-submit p50/p95).
