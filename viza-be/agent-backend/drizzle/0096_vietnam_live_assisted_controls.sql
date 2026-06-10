-- =============================================================================
-- Vietnam e-Visa live-assisted controls
--
-- Dry-run remains explicit. Live assisted opens the official Vietnam e-Visa
-- website, stops at NOTE/CAPTCHA/payment/final-submit checkpoints, and never
-- uses CAPTCHA solving, stealth, proxy rotation, or automatic payment.
-- =============================================================================

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS current_stage TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vn_result_payload JSONB,
  ADD COLUMN IF NOT EXISTS vn_registration_code_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS official_trace_url TEXT;

COMMENT ON COLUMN submission_queue.current_stage IS
  'Current worker-visible stage such as queued, official_landing_reached, note_modal_required, captcha_required, official_form_reached, payment_required, failed, or stalled.';
COMMENT ON COLUMN submission_queue.heartbeat_at IS
  'Last heartbeat written by the submission worker while a queue job is pending or processing.';
COMMENT ON COLUMN submission_queue.vn_result_payload IS
  'Vietnam e-Visa run result and diagnostics payload for operator troubleshooting.';
COMMENT ON COLUMN submission_queue.vn_registration_code_encrypted IS
  'Encrypted Vietnam e-Visa registration code captured from the official portal. Never log plaintext official identifiers.';
COMMENT ON COLUMN submission_queue.official_portal_url IS
  'Official portal URL or base URL reached by the live-assisted worker.';
COMMENT ON COLUMN submission_queue.official_trace_url IS
  'Local or storage pointer to a trace artifact when diagnostics capture is enabled.';

CREATE TABLE IF NOT EXISTS vietnam_live_manual_actions (
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

CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_job_idx
  ON vietnam_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_application_idx
  ON vietnam_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_status_idx
  ON vietnam_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS vietnam_live_manual_actions_type_idx
  ON vietnam_live_manual_actions(action_type);

ALTER TABLE vietnam_live_manual_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vietnam_live_manual_actions'
      AND policyname = 'vietnam_live_manual_actions_service'
  ) THEN
    CREATE POLICY vietnam_live_manual_actions_service ON vietnam_live_manual_actions
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE vietnam_live_manual_actions IS
  'Manual checkpoints for compliant Vietnam e-Visa live assisted runs: NOTE modal, CAPTCHA, payment, final submit, layout changes, and official portal errors.';
