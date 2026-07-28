-- VIZA required DS-160 live-assisted controls.
-- Dry-run remains the default. Live CEAC flows must stop before final Sign/Submit.

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT 'indonesia',
  visa_type TEXT NOT NULL DEFAULT 'tourist_b211a',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.submission_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS official_application_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_security_question_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_security_answer_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_location TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS manual_action_status TEXT,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_user_agent_hash TEXT;

COMMENT ON COLUMN public.submission_queue.mode IS
  'Submission mode. DS-160 defaults to dry_run; live_assisted requires explicit runtime enablement.';
COMMENT ON COLUMN public.submission_queue.official_application_id_encrypted IS
  'Encrypted CEAC Application ID. Never log plaintext official retrieval identifiers.';
COMMENT ON COLUMN public.submission_queue.official_security_answer_encrypted IS
  'Encrypted CEAC security answer. Never log plaintext retrieval secrets.';

CREATE TABLE IF NOT EXISTS public.ds160_submission_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  country_code TEXT NOT NULL DEFAULT 'US',
  visa_type TEXT NOT NULL DEFAULT 'DS160',
  mode TEXT NOT NULL DEFAULT 'dry_run',
  provider TEXT NOT NULL DEFAULT 'ceac_dry_run',
  status TEXT NOT NULL DEFAULT 'pending',
  official_application_id_encrypted TEXT,
  official_confirmation_number_encrypted TEXT,
  official_security_question_encrypted TEXT,
  official_security_answer_encrypted TEXT,
  official_location TEXT,
  official_started_at TIMESTAMPTZ,
  official_submitted_at TIMESTAMPTZ,
  official_confirmation_page_url TEXT,
  confirmation_pdf_url TEXT,
  confirmation_screenshot_url TEXT,
  review_diff_status TEXT NOT NULL DEFAULT 'not_run',
  final_user_confirmation_at TIMESTAMPTZ,
  final_user_confirmation_ip_hash TEXT,
  final_user_confirmation_user_agent_hash TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ds160_submission_jobs
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'ceac_dry_run',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS official_application_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT NOT NULL DEFAULT 'not_run';

CREATE INDEX IF NOT EXISTS ds160_submission_jobs_application_idx
  ON public.ds160_submission_jobs(application_id);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_user_idx
  ON public.ds160_submission_jobs(user_id);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_status_idx
  ON public.ds160_submission_jobs(status);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_mode_idx
  ON public.ds160_submission_jobs(mode);

CREATE TABLE IF NOT EXISTS public.ds160_official_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT NOT NULL,
  redacted_snapshot_json JSONB NOT NULL DEFAULT '{}',
  snapshot_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds160_review_snapshots_job_idx
  ON public.ds160_official_review_snapshots(job_id);
CREATE INDEX IF NOT EXISTS ds160_review_snapshots_application_idx
  ON public.ds160_official_review_snapshots(application_id);
CREATE INDEX IF NOT EXISTS ds160_review_snapshots_source_idx
  ON public.ds160_official_review_snapshots(source);

CREATE TABLE IF NOT EXISTS public.ds160_review_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  viza_value_redacted TEXT,
  ceac_value_redacted TEXT,
  diff_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds160_review_diffs_job_idx
  ON public.ds160_review_diffs(job_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_application_idx
  ON public.ds160_review_diffs(application_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_field_idx
  ON public.ds160_review_diffs(field_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_severity_idx
  ON public.ds160_review_diffs(severity);

CREATE TABLE IF NOT EXISTS public.ds160_live_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  instruction TEXT,
  screenshot_url TEXT,
  redacted_metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_job_idx
  ON public.ds160_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_application_idx
  ON public.ds160_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_status_idx
  ON public.ds160_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_type_idx
  ON public.ds160_live_manual_actions(action_type);

COMMENT ON TABLE public.ds160_live_manual_actions IS
  'Manual checkpoints for compliant DS-160 live assisted runs: CAPTCHA, official review, final applicant Sign/Submit handoff, and recovery.';

ALTER TABLE public.ds160_submission_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds160_official_review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds160_review_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds160_live_manual_actions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'ds160_submission_jobs',
    'ds160_official_review_snapshots',
    'ds160_review_diffs',
    'ds160_live_manual_actions'
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
