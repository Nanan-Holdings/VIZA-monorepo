-- VIZA's own social scheduler (lib/marketing/automation.ts
-- dispatchDueSocialCompositions) records each dispatch that sent something
-- as a marketing automation run. Supabase pg_cron calls the dispatch route
-- every five minutes; the cron job itself is created outside migrations
-- because its Authorization header comes from Supabase Vault.

ALTER TABLE public.marketing_automation_runs
  DROP CONSTRAINT IF EXISTS marketing_automation_runs_job_type_check;

ALTER TABLE public.marketing_automation_runs
  ADD CONSTRAINT marketing_automation_runs_job_type_check
  CHECK (job_type IN ('blog_generation', 'social_reconcile', 'social_dispatch', 'analytics_snapshot', 'stuck_check'));
