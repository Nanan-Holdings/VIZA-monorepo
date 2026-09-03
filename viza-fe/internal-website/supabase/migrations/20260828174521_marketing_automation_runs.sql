CREATE TABLE IF NOT EXISTS public.marketing_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('blog_generation', 'social_reconcile', 'analytics_snapshot', 'stuck_check')),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  output_entity_type TEXT,
  output_entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_automation_runs_status_idx
  ON public.marketing_automation_runs (status, heartbeat_at);
CREATE INDEX IF NOT EXISTS marketing_automation_runs_job_idx
  ON public.marketing_automation_runs (job_type, started_at DESC);

ALTER TABLE public.marketing_automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketing_automation_runs FROM anon, authenticated;
GRANT ALL ON TABLE public.marketing_automation_runs TO service_role;

COMMENT ON TABLE public.marketing_automation_runs IS
  'Durable idempotency, status, and failure evidence for VIZA scheduled marketing jobs.';
