# Scheduled jobs (PROV-009)

Single source of truth: migration `0079_pg_cron_schedules.sql`. Each entry uses `pg_cron` + `pg_net` to POST a Supabase Edge Function which proxies to the TS implementation in `viza-be/agent-backend`.

## Entries

| jobname                  | Schedule (UTC)   | Edge endpoint            | TS source                                                        | Pause command                                                   |
| ------------------------ | ---------------- | ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `viza_fee_scraper`       | `0 3 * * 0`      | `/jobs/fee-scraper`      | `viza-be/agent-backend/src/jobs/fee-scraper.ts`                  | `SELECT cron.unschedule('viza_fee_scraper');`                   |
| `viza_canary_pager`      | `*/5 * * * *`    | `/jobs/canary-pager`     | `viza-be/agent-backend/src/jobs/canary-pager.ts`                 | `SELECT cron.unschedule('viza_canary_pager');`                  |
| `viza_sla_breach_sweep`  | `15 * * * *`     | `/jobs/sla-breach-sweep` | `viza-be/agent-backend/scripts/sla-breach-sweep.ts`              | `SELECT cron.unschedule('viza_sla_breach_sweep');`              |
| `viza_retention_purge`   | `0 2 * * *`      | `/jobs/retention-purge`  | runner-side; see migration `0049_retention_purge.sql`            | `SELECT cron.unschedule('viza_retention_purge');`               |

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
