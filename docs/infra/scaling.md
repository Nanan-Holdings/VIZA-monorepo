# Worker pool autoscaling + concurrency caps (INFRA-003)

> Last reviewed: 2026-05-07.

## Concurrency caps

`runner_concurrency_cap(country, max_concurrent, paused, notes)` is
the source of truth for "no more than N concurrent runner jobs
against country C". Worker enforces it inside `claimNextJob()` —
when `count(running)` for the candidate's country is already at the
cap, the worker declines the claim and goes back to polling, freeing
the slot for the country that owns it.

Defaults seeded by migration 0055 are conservative (1–2 per country).
Bump by editing the row directly:

```sql
UPDATE runner_concurrency_cap
SET max_concurrent = 4, notes = 'bumped after observing throughput'
WHERE country = 'vietnam';
```

Pause a country in an emergency:

```sql
UPDATE runner_concurrency_cap SET paused = TRUE WHERE country = 'india';
```

## Queue-depth view

`runner_queue_depth` is a SQL view that joins the cap with
`runner_job` and surfaces, per country: `cap.max_concurrent`,
`paused`, `queued`, `running`, `failed_24h`. Both the autoscaler and
the future `/admin/queue` page read from it.

## Autoscaler

`viza-be/agent-backend/scripts/autoscale-runners.ts`:

- Reads `runner_queue_depth`.
- Counts claimable `submission_queue` rows for the legacy worker.
- For each country: `desired = paused ? 0 : clamp(ceil(queued / cap), 0, cap)`.
- Emits a JSON array of decisions to stdout (`--json`) suitable for
  piping into the actual driver.
- On any `running > cap` violation, emails OPS via Resend
  (`RESEND_OPS_ALERT_TO`) and exits 1.

## Fly Machines driver

Production uses one Fly app per country (`viza-runner-<country>`). The
committed driver is `viza-be/submission-service/scripts/fly/scale-workers.sh`.
It retains the Machine definition, stops all Machines when queue depth and
running job count are both zero, and starts enough stopped Machines when work
appears. This is intentionally queue-driven rather than Fly Proxy autostop:
workers poll Supabase and cannot be awakened by an inbound HTTP request alone.
The deployment and scheduled driver run from the protected GitHub `production`
environment, so an idle worker normally starts within the five-minute schedule
interval after a job is queued.

South Korea and the legacy worker use a stricter stop gate. The driver requires
two consecutive HTTP 200 responses from `/deploy-ready` before stopping either
Machine. Korea reports its five-minute SMS/cancellation browser sessions
through that gate; legacy reports active queue work and unconsumed Vietnam or
Indonesia card sessions. Inbound Korea actions, card handoffs, and explicit
queue wake requests use Fly Proxy autostart. An hourly legacy maintenance pulse
runs periodic status/email work that is not represented by queue depth, then
stops the Machine again only when the same readiness gate is safe.

## Schedule

GitHub Actions runs the autoscaler every five minutes via
`.github/workflows/scale-submission-service-fly.yml`; it is also manually
dispatchable for incident response. The same workflow runs the isolated legacy
maintenance pulse at minute 17 of each hour.

`runner_concurrency_cap` writes are infrequent — when ops bumps a
cap, the autoscaler picks it up at the next tick.

## Lease recovery

A separate sweeper (TBD; can live in the same script) flips
`runner_job` rows whose `leased_until < now()` from `running` back
to `queued` and bumps `attempts` so a crashed worker doesn't leave
slots stuck.
