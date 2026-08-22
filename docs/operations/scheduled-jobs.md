# Scheduled jobs (PROV-009)

Database-owned jobs use migration `0079_pg_cron_schedules.sql`, `pg_cron`, and
`pg_net`. External watchdog jobs that must still run during a database control
plane issue use bounded GitHub Actions schedules and are listed separately.

## Entries

| jobname                  | Schedule (UTC)   | Edge endpoint            | TS source                                                        | Pause command                                                   |
| ------------------------ | ---------------- | ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `viza_fee_scraper`       | `0 3 * * 0`      | `/jobs/fee-scraper`      | `viza-be/agent-backend/src/jobs/fee-scraper.ts`                  | `SELECT cron.unschedule('viza_fee_scraper');`                   |
| `viza_canary_pager`      | `*/5 * * * *`    | `/jobs/canary-pager`     | `viza-be/agent-backend/src/jobs/canary-pager.ts`                 | `SELECT cron.unschedule('viza_canary_pager');`                  |
| `viza_sla_breach_sweep`  | `15 * * * *`     | `/jobs/sla-breach-sweep` | `viza-be/agent-backend/scripts/sla-breach-sweep.ts`              | `SELECT cron.unschedule('viza_sla_breach_sweep');`              |
| `viza_retention_purge`   | `0 2 * * *`      | `/jobs/retention-purge`  | runner-side; see migration `0049_retention_purge.sql`            | `SELECT cron.unschedule('viza_retention_purge');`               |

## External schedules

| Workflow | Schedule (UTC) | Endpoint | Purpose | Pause |
| --- | --- | --- | --- | --- |
| `portal-health-canary.yml` | `*/5 * * * *` | `POST /api/internal/status/probe` | Record public VIZA/government endpoint observations and incident transitions | Disable the GitHub Actions workflow |

The portal-health workflow uses an ephemeral hosted runner, a four-minute job
timeout, and no checkout or dependency installation. The backend performs at
most five probes concurrently and caps every request timeout. It requires
GitHub secrets `STATUS_PROBE_URL` and `STATUS_CRON_SECRET`; the latter must
match the backend `STATUS_CRON_SECRET` environment value.

## Required extensions

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Both must be enabled on the Supabase project (Project Settings → Database → Extensions).

## Required Postgres settings

Set once per environment (Project Settings → Database → Custom Postgres Config):

```
app.edge_url    = https://<project-ref>.functions.supabase.co
app.edge_secret = <random 32-byte hex>
```

Each Edge Function verifies the `x-cron-secret` header before invoking the underlying job. Rotate `app.edge_secret` quarterly via `docs/security/secret-rotation.md`.

## Verifying

```sql
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'viza_%';
SELECT runid, jobname, return_message, status, start_time
  FROM cron.job_run_details
  WHERE jobname LIKE 'viza_%'
  ORDER BY start_time DESC
  LIMIT 20;
```

A pass criterion is each entry showing at least one `succeeded` run within 24h of migration apply.

## Adding a new job

1. Implement the handler under `viza-be/agent-backend/src/jobs/<name>.ts`.
2. Register an Edge Function that calls the handler.
3. Add a `cron.schedule(...)` entry to a new migration (don't edit `0079` after it ships).
4. Update this table.
