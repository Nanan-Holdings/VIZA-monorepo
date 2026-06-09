-- =============================================================================
-- France-Visas live assisted submission controls
--
-- Dry-run remains the default. Live France-Visas runs must be explicitly
-- enabled by environment/config, must be live-assisted only, and must stop at
-- applicant-controlled checkpoints before final validation, payment, or
-- appointment booking.
-- =============================================================================

ALTER TABLE submission_queue
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

COMMENT ON COLUMN submission_queue.official_application_reference_encrypted IS
  'Encrypted official France-Visas reference or draft reference. Never log plaintext official identifiers.';
COMMENT ON COLUMN submission_queue.official_account_email_encrypted IS
  'Encrypted France-Visas account email when storing it is required for support/retry context.';
COMMENT ON COLUMN submission_queue.official_review_snapshot_id IS
  'Latest redacted official review snapshot used for VIZA-vs-official diff checks.';
COMMENT ON COLUMN submission_queue.manual_action_status IS
  'Current manual checkpoint state for live assisted official portal runs.';
COMMENT ON COLUMN submission_queue.external_service_provider IS
  'Detected France filing provider: VFS, TLS, CAPAGO, CONSULATE, or UNKNOWN.';
COMMENT ON COLUMN submission_queue.official_status IS
  'Official lifecycle label such as draft_prefilled, official_record_created, payment_required, appointment_required, or lodged_at_visa_centre.';

CREATE TABLE IF NOT EXISTS france_live_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES submission_queue(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
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
  ON france_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_application_idx
  ON france_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_status_idx
  ON france_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_type_idx
  ON france_live_manual_actions(action_type);

ALTER TABLE france_live_manual_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'france_live_manual_actions'
      AND policyname = 'france_live_manual_actions_service'
  ) THEN
    CREATE POLICY france_live_manual_actions_service ON france_live_manual_actions
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE france_live_manual_actions IS
  'Manual checkpoints for compliant France-Visas live assisted runs: CAPTCHA, login/account/email verification, final review, payment, appointment, layout changes, and official portal errors.';
