-- =============================================================================
-- pg_cron schedules (PROV-009)
--
-- Drives the four background jobs from a single source of truth.
-- Each cron row calls a Supabase Edge Function HTTP endpoint via pg_net,
-- which lets us keep the implementation in TS (viza-be/agent-backend)
-- while triggers live in Postgres.
--
-- pg_cron + pg_net must be enabled on the Supabase project:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Set app.edge_url + app.edge_secret as Supabase database settings
-- (Project Settings → Database → Custom Postgres Config) so we don't
-- bake the values into the migration.
-- =============================================================================

-- Unschedule any prior copies so this migration is re-runnable.
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN (
      'viza_fee_scraper',
      'viza_canary_pager',
      'viza_sla_breach_sweep',
      'viza_retention_purge'
    );
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not installed yet, e.g. local supabase start without extensions
  NULL;
END $$;

-- 1. Weekly government-fee scraper — Sunday 03:00 UTC
SELECT cron.schedule(
  'viza_fee_scraper',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_url', true) || '/jobs/fee-scraper',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', current_setting('app.edge_secret', true)
    )
  );
  $$
);

-- 2. Canary pager — every 5 minutes
SELECT cron.schedule(
  'viza_canary_pager',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_url', true) || '/jobs/canary-pager',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', current_setting('app.edge_secret', true)
    )
  );
  $$
);

-- 3. SLA breach sweep — hourly at :15
SELECT cron.schedule(
  'viza_sla_breach_sweep',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_url', true) || '/jobs/sla-breach-sweep',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', current_setting('app.edge_secret', true)
    )
  );
  $$
);

-- 4. Retention purge — daily 02:00 UTC
SELECT cron.schedule(
  'viza_retention_purge',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_url', true) || '/jobs/retention-purge',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', current_setting('app.edge_secret', true)
    )
  );
  $$
);
