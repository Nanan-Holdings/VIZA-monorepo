-- Targeted Vietnam live-assisted schema patch.
-- Apply only this file when the Supabase CLI migration history contains
-- unrelated legacy migrations. It is idempotent and intentionally limited to
-- submission_queue live metadata plus Vietnam/manual-action checkpoints.

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS current_stage TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS manual_action_status TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS live_checkpoint TEXT,
  ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_trace_url TEXT,
  ADD COLUMN IF NOT EXISTS live_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS official_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS official_trace_url TEXT,
  ADD COLUMN IF NOT EXISTS official_application_reference_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_error_code TEXT,
  ADD COLUMN IF NOT EXISTS official_error_message TEXT,
  ADD COLUMN IF NOT EXISTS official_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS vn_result_payload JSONB,
  ADD COLUMN IF NOT EXISTS vn_registration_code_encrypted TEXT;

CREATE INDEX IF NOT EXISTS submission_queue_vn_live_status_idx
  ON public.submission_queue(status)
  WHERE status IN ('vn_live_assisted_pending', 'vn_live_assisted_processing', 'vn_blocked');

CREATE TABLE IF NOT EXISTS public.vietnam_live_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  submission_queue_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  action_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  instruction TEXT,
  screenshot_url TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  redacted_metadata_json JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.vietnam_live_manual_actions
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS submission_queue_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS instruction TEXT,
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS redacted_metadata_json JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_job_idx
  ON public.vietnam_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_queue_idx
  ON public.vietnam_live_manual_actions(submission_queue_id);
CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_application_idx
  ON public.vietnam_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_status_idx
  ON public.vietnam_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_type_idx
  ON public.vietnam_live_manual_actions(action_type);

CREATE TABLE IF NOT EXISTS public.submission_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_queue_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  country TEXT,
  action_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  instruction TEXT,
  screenshot_url TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.submission_manual_actions
  ADD COLUMN IF NOT EXISTS submission_queue_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS instruction TEXT,
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS submission_manual_actions_queue_idx
  ON public.submission_manual_actions(submission_queue_id);
CREATE INDEX IF NOT EXISTS submission_manual_actions_application_idx
  ON public.submission_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS submission_manual_actions_status_idx
  ON public.submission_manual_actions(status);
CREATE INDEX IF NOT EXISTS submission_manual_actions_type_idx
  ON public.submission_manual_actions(action_type);

ALTER TABLE public.vietnam_live_manual_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_manual_actions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'vietnam_live_manual_actions',
    'submission_manual_actions'
  ]
  LOOP
    policy_name := target_table || '_service';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        policy_name,
        target_table
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.vietnam_live_manual_actions IS
  'Manual checkpoints for compliant Vietnam e-Visa live assisted runs. Do not store CAPTCHA answers, cookies, tokens, payment data, or raw passport images here.';
COMMENT ON TABLE public.submission_manual_actions IS
  'Generic official-portal manual checkpoints shared by live assisted flows. Sensitive answers, CAPTCHA data, passwords, cookies, and payment details must not be stored here.';
