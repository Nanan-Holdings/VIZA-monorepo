-- VIZA required France-Visas live-assisted controls.
-- Live France-Visas flows must stop before final validation, payment, or appointment booking.

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS official_application_reference_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_account_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS official_cerfa_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS official_review_snapshot_id UUID,
  ADD COLUMN IF NOT EXISTS manual_action_status TEXT,
  ADD COLUMN IF NOT EXISTS filing_location TEXT,
  ADD COLUMN IF NOT EXISTS external_service_provider TEXT,
  ADD COLUMN IF NOT EXISTS appointment_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS official_status TEXT,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN public.submission_queue.official_application_reference_encrypted IS
  'Encrypted official France-Visas reference or draft reference. Never log plaintext official identifiers.';
COMMENT ON COLUMN public.submission_queue.official_account_email_encrypted IS
  'Encrypted France-Visas account email when required for support/retry context.';
COMMENT ON COLUMN public.submission_queue.official_review_snapshot_id IS
  'Latest redacted official review snapshot used for VIZA-vs-official diff checks.';
COMMENT ON COLUMN public.submission_queue.manual_action_status IS
  'Current manual checkpoint state for live assisted official portal runs.';
COMMENT ON COLUMN public.submission_queue.external_service_provider IS
  'Detected France filing provider: VFS, TLS, CAPAGO, CONSULATE, or UNKNOWN.';
COMMENT ON COLUMN public.submission_queue.official_status IS
  'Official lifecycle label such as draft_prefilled, official_record_created, payment_required, appointment_required, or lodged_at_visa_centre.';

CREATE TABLE IF NOT EXISTS public.france_live_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS france_live_manual_actions_job_idx
  ON public.france_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_application_idx
  ON public.france_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_status_idx
  ON public.france_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_type_idx
  ON public.france_live_manual_actions(action_type);

CREATE TABLE IF NOT EXISTS public.france_official_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT NOT NULL DEFAULT 'france_visas',
  redacted_snapshot_json JSONB NOT NULL DEFAULT '{}',
  snapshot_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS france_review_snapshots_job_idx
  ON public.france_official_review_snapshots(job_id);
CREATE INDEX IF NOT EXISTS france_review_snapshots_application_idx
  ON public.france_official_review_snapshots(application_id);
CREATE INDEX IF NOT EXISTS france_review_snapshots_source_idx
  ON public.france_official_review_snapshots(source);

CREATE TABLE IF NOT EXISTS public.france_review_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  viza_value_redacted TEXT,
  official_value_redacted TEXT,
  diff_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS france_review_diffs_job_idx
  ON public.france_review_diffs(job_id);
CREATE INDEX IF NOT EXISTS france_review_diffs_application_idx
  ON public.france_review_diffs(application_id);
CREATE INDEX IF NOT EXISTS france_review_diffs_field_idx
  ON public.france_review_diffs(field_id);
CREATE INDEX IF NOT EXISTS france_review_diffs_severity_idx
  ON public.france_review_diffs(severity);

COMMENT ON TABLE public.france_live_manual_actions IS
  'Manual checkpoints for compliant France-Visas live assisted runs: CAPTCHA, login/account/email verification, final review, payment, appointment, layout changes, and official portal errors.';

ALTER TABLE public.france_live_manual_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.france_official_review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.france_review_diffs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'france_live_manual_actions',
    'france_official_review_snapshots',
    'france_review_diffs'
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
