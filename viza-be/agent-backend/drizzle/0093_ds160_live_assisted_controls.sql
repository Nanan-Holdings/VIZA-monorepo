-- =============================================================================
-- DS-160 live assisted submission controls
--
-- Dry-run remains the default. Live CEAC runs must be explicitly enabled by
-- environment/config, require user/admin consent outside this migration, and
-- stop at applicant-controlled final Sign/Submit handoff.
-- =============================================================================

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS official_application_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_security_question_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_security_answer_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_location TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS final_user_confirmation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_user_agent_hash TEXT;

COMMENT ON COLUMN submission_queue.mode IS
  'Submission mode. DS-160 defaults to dry_run; live_assisted requires explicit runtime enablement.';
COMMENT ON COLUMN submission_queue.official_application_id_encrypted IS
  'Encrypted CEAC Application ID. Never log plaintext official retrieval identifiers.';
COMMENT ON COLUMN submission_queue.official_security_answer_encrypted IS
  'Encrypted CEAC security answer. Never log plaintext retrieval secrets.';

CREATE TABLE IF NOT EXISTS ds160_submission_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS ds160_submission_jobs_application_idx
  ON ds160_submission_jobs(application_id);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_user_idx
  ON ds160_submission_jobs(user_id);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_status_idx
  ON ds160_submission_jobs(status);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_mode_idx
  ON ds160_submission_jobs(mode);

CREATE TABLE IF NOT EXISTS ds160_official_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT NOT NULL,
  redacted_snapshot_json JSONB NOT NULL DEFAULT '{}',
  snapshot_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds160_review_snapshots_job_idx
  ON ds160_official_review_snapshots(job_id);
CREATE INDEX IF NOT EXISTS ds160_review_snapshots_application_idx
  ON ds160_official_review_snapshots(application_id);
CREATE INDEX IF NOT EXISTS ds160_review_snapshots_source_idx
  ON ds160_official_review_snapshots(source);

CREATE TABLE IF NOT EXISTS ds160_review_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  viza_value_redacted TEXT,
  ceac_value_redacted TEXT,
  diff_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds160_review_diffs_job_idx
  ON ds160_review_diffs(job_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_application_idx
  ON ds160_review_diffs(application_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_field_idx
  ON ds160_review_diffs(field_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_severity_idx
  ON ds160_review_diffs(severity);

CREATE TABLE IF NOT EXISTS ds160_live_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ds160_submission_jobs(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_job_idx
  ON ds160_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_application_idx
  ON ds160_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_status_idx
  ON ds160_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_type_idx
  ON ds160_live_manual_actions(action_type);

COMMENT ON TABLE ds160_live_manual_actions IS
  'Manual checkpoints for compliant DS-160 live assisted runs: CAPTCHA, official review, final applicant Sign/Submit handoff, and recovery.';
