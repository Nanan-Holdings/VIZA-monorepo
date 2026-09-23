CREATE INDEX IF NOT EXISTS marketing_automation_runs_actor_idx
  ON public.marketing_automation_runs (actor_user_id)
  WHERE actor_user_id IS NOT NULL;
