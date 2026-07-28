-- VIZA generic live-assisted manual action and review bridge.
-- This is intentionally scoped to official-submission handoffs only.
-- It must not be used for CAPTCHA bypass, silent final validation, payment,
-- or appointment booking.

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS manual_action_status TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS official_application_reference_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_url TEXT,
  ADD COLUMN IF NOT EXISTS official_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS official_cerfa_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS official_error_code TEXT,
  ADD COLUMN IF NOT EXISTS official_error_message TEXT,
  ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_checkpoint TEXT,
  ADD COLUMN IF NOT EXISTS live_trace_url TEXT,
  ADD COLUMN IF NOT EXISTS live_screenshot_url TEXT;

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

CREATE INDEX IF NOT EXISTS submission_manual_actions_queue_idx
  ON public.submission_manual_actions(submission_queue_id);
CREATE INDEX IF NOT EXISTS submission_manual_actions_application_idx
  ON public.submission_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS submission_manual_actions_status_idx
  ON public.submission_manual_actions(status);
CREATE INDEX IF NOT EXISTS submission_manual_actions_type_idx
  ON public.submission_manual_actions(action_type);

CREATE TABLE IF NOT EXISTS public.submission_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_queue_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT NOT NULL,
  redacted_snapshot_json JSONB DEFAULT '{}'::JSONB,
  snapshot_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS submission_review_snapshots_queue_idx
  ON public.submission_review_snapshots(submission_queue_id);
CREATE INDEX IF NOT EXISTS submission_review_snapshots_application_idx
  ON public.submission_review_snapshots(application_id);
CREATE INDEX IF NOT EXISTS submission_review_snapshots_source_idx
  ON public.submission_review_snapshots(source);

CREATE TABLE IF NOT EXISTS public.submission_review_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_queue_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  field_id TEXT,
  field_label TEXT,
  viza_value_redacted TEXT,
  official_value_redacted TEXT,
  diff_type TEXT,
  severity TEXT DEFAULT 'warning',
  suggested_fix TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS submission_review_diffs_queue_idx
  ON public.submission_review_diffs(submission_queue_id);
CREATE INDEX IF NOT EXISTS submission_review_diffs_application_idx
  ON public.submission_review_diffs(application_id);
CREATE INDEX IF NOT EXISTS submission_review_diffs_field_idx
  ON public.submission_review_diffs(field_id);
CREATE INDEX IF NOT EXISTS submission_review_diffs_severity_idx
  ON public.submission_review_diffs(severity);

ALTER TABLE public.submission_manual_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_review_diffs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'submission_manual_actions',
    'submission_review_snapshots',
    'submission_review_diffs'
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

COMMENT ON TABLE public.submission_manual_actions IS
  'Generic official-portal manual checkpoints. CAPTCHA answers, passwords, cookies, tokens, payment data, and raw official identifiers must not be stored here.';
