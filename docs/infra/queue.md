# Runner job queue (INFRA-002)

> Last reviewed: 2026-05-07.

## Choice — Postgres FIFO with a Cloudflare Queues swap path

We start on a **Postgres-backed FIFO** keyed off the `runner_job`
table (migration 0054). The reasons:

- Single dependency. Supabase Postgres is already the source of
  truth for orders, applications, vault, and audit logs — the queue
  shares the same backups, RLS, and observability without standing
  up Redis or Cloudflare Queues.
- Visibility. `runner_job` rows mirror queue state 1:1, so admin
  dashboards (`/admin/revenue` and future `/admin/queue`) read from
  the same SELECTs as the worker.
- Throughput. We expect single-digit jobs per minute at MVP. Postgres
  with `SELECT ... FOR UPDATE SKIP LOCKED` handles ~1k jobs/s on
  Supabase tier without breaking a sweat — orders of magnitude
  beyond what we need before INFRA-003 autoscaling.

When throughput or fan-out demands more, we move to **Cloudflare
Queues** (already in our stack from INBOX-002):

1. Producer keeps writing to `runner_job` (source of truth) and
   additionally publishes the row id to the queue.
2. Consumer subscribes to the queue, looks up the row by id, runs
   the same `claim → run → finalise` flow.
3. Cut over by flipping the producer to also publish; remove the
   pure-Postgres `claimNextJob` once the Queues consumer is steady.

BullMQ (Redis) was considered but rejected: adds a Redis dep that
does not yet pay for itself, and our existing scheduling needs
(retries, backoff, dead-letter) are already covered by `runner_job`.

## Schema

`viza-be/agent-backend/drizzle/0054_runner_job.sql`:

| Column | Notes |
|---|---|
| `id` | UUID primary key. |
| `application_id` | FK to `applications` (cascade delete). |
| `country` | Bucket key for per-country concurrency (INFRA-003). |
| `status` | `queued` → `running` → `succeeded` / `failed` / `dead_letter` / `paused`. |
| `attempts`, `max_attempts` | Retry counters. |
| `enqueued_at`, `started_at`, `finished_at` | Lifecycle stamps. |
| `leased_by`, `leased_until` | Worker lease — abandoned leases can be reclaimed by the lease-recovery sweeper. |
| `correlation_id`, `last_error`, `metadata` | Context the producer attaches; runner writes back the failure message. |

RLS is service-role-only.

## Producer

`viza-fe/internal-website/lib/queue/enqueue.ts` →
`enqueueRunnerJob(applicationId, country, opts?)`. Idempotent on
`application_id`: existing `queued` / `running` rows are reused.

Wired into `app/api/stripe/webhook/route.ts` on
`checkout.session.completed`. After flipping the order to `paid`
(see PAY-002) we look up the application's country and call the
producer asynchronously.

## Consumer

`viza-be/submission-service/src/queue/worker.ts`:

- `claimNextJob({ workerId, country?, leaseMs? })` does a compare-and-
  swap on the oldest `queued` row.
- `markSucceeded(jobId)` / `markFailedWithRetry(job, error)` close the
  loop. Failures with retries left flip the row back to `queued`;
  exhausted attempts go to `failed`.
- `pollAndRun(workerId, handler, { country?, pollMs?, signal? })` is
  the convenience driver. Each per-country runner module wires its
  existing entrypoint into the handler.

## Operational notes

- **Lease recovery**: a follow-on cron should sweep
  `runner_job WHERE status='running' AND leased_until < now()` and
  flip them back to `queued` so a crashed worker doesn't leave jobs
  stuck. Implementation deferred to INFRA-003.
- **Concurrency cap**: per-country max concurrency lives in
  `runner_job_concurrency_cap` config (TBD, INFRA-003). Worker checks
  the count of `running` rows for its country before claiming.
- **Pause for dispute**: PAY-004 already flips `submission_queue`
  rows to `paused_dispute` when a chargeback hits. The new
  `runner_job` mirror should adopt the same `status='paused'` flag
  so disputes block both queues uniformly. Open for INFRA-003.
