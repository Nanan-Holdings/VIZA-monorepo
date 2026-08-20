# Runner Metrics (OBSV-001)

Two emission paths from the submission-service runner (`src/metrics/emit.ts`):

| Metric | Source | Dimensions | Notes |
| --- | --- | --- | --- |
| `runner_metric` (row per finished job) | `emitRunnerMetric` → `runner_metric` table | country, week_start, success, time_to_submit_s, captcha_cost_cents, proxy_cost_cents | aggregated weekly per-country by `/admin/metrics` |
| `runner_job_event` (structured log) | `emitRunnerEvent` → stdout JSON | country, event (started/succeeded/halted/failed/dead_lettered), jobId | log-based counter `runner_job_events_total{country,event}` |

The handler (`src/queue/handler.ts`) emits `started` then `succeeded`/`halted`/`failed`
per job. Dashboard config: `docs/observability/dashboard.json` (panels: jobs by
event/country, success rate, halted-awaiting-pay, dead-letter count, time-to-submit p50/p95).

## Stable-speed concurrency signals

The production shared-pool and sticky-runner capacity health views are
service-role-only and are consumed by `/admin/metrics`:

| Object | Key fields | Meaning |
| --- | --- | --- |
| `runner_pool_concurrency_health` | country, max_concurrent, paused, claimable, scheduled, running, expired_running, capacity_headroom, oldest_claimable_at, oldest_claimable_age_seconds | Per-country queue and claim pressure, including age of the oldest immediately claimable job. |
| `runner_slot_capacity_health` | max_slots, live_slots, free_slots, pool_live_slots, sticky_live_slots, expired_owned_slots, stale_renewal_slots, utilization_percent | Global slot utilization and lease hygiene. `stale_renewal_slots` identifies live slots whose renewal timestamp is older than roughly three 60-second renew intervals. |
| `runner_concurrency_metric` | event_type (`claim` or `machine_start`), outcome, duration_ms, country, machine_kind, count, recorded_at | Short-lived operational samples used for claim and retained-Machine **start-request** p95s. The latter measures the Fly API request, not HTTP readiness. It contains no applicant or application identifiers. |

Capacity reconciliation starts retained Fly Machines in batches of at most
three. Each candidate reserves its database slot before the start request; a
failed start releases only that candidate's slot. Fly `409` responses are
idempotent success. Metric insertion is best-effort and never changes the
start result. The scaler workflow is single-flight with
`cancel-in-progress: false`, so a recovery run is queued behind an existing
production scale decision.

The admin page reads at most 5,000 newest metric samples from the last 24 hours
to keep the PostgREST response bounded; the displayed p95 is explicitly a
recent sample, not a complete historical percentile. It fails closed when any
required health view or metric table is missing or returns an error. Alerts are raised for claim p95 ≥ 500 ms, a
claimable queue older than 120 seconds while a slot is free, cap overshoot,
expired owned slots, or stale lease renewals.
