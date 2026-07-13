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
- For each country: `desired = paused ? 0 : clamp(ceil(queued / cap), 0, cap)`.
- Emits a JSON array of decisions to stdout (`--json`) suitable for
  piping into the actual driver.
- On any `running > cap` violation, emails OPS via Resend
  (`RESEND_OPS_ALERT_TO`) and exits 1.

## Fly Machines driver

Production uses one Fly app per country (`viza-runner-<country>`). The
committed driver is `viza-be/submission-service/scripts/fly/scale-workers.sh`;
it consumes the autoscaler's JSON and calls `fly scale count`. Non-paused
countries retain one warm machine so polling never depends on a local computer;
paused countries scale to zero. The deployment and scheduled driver run from
the protected GitHub `production` environment.

## Schedule

GitHub Actions runs the autoscaler every five minutes via
`.github/workflows/scale-submission-service-fly.yml`; it is also manually
dispatchable for incident response.

`runner_concurrency_cap` writes are infrequent — when ops bumps a
cap, the autoscaler picks it up at the next tick.

## Lease recovery

A separate sweeper (TBD; can live in the same script) flips
`runner_job` rows whose `leased_until < now()` from `running` back
to `queued` and bumps `attempts` so a crashed worker doesn't leave
slots stuck.
