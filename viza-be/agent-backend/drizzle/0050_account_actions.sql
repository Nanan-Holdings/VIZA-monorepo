-- =============================================================================
-- Account-level data subject actions (LEGAL-004)
--
-- 1. account_action_log records every export / delete request with the
--    actor, IP, and outcome. Used for audit + rate-limit checks.
-- 2. applicant_profiles gets soft-delete columns. Once
--    `deletion_requested_at` is set the user has 7 days to revoke. After
--    `deletion_scheduled_at` passes, the LEGAL-004 finaliser purges the
--    PII and stamps `deleted_at`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS account_action_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  applicant_id UUID REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** export | delete_request | delete_revoke | delete_finalise */
  action TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  outcome TEXT NOT NULL DEFAULT 'ok',
  detail JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_action_log_user_action_ts
  ON account_action_log(user_id, action, ts DESC);
CREATE INDEX IF NOT EXISTS idx_account_action_log_applicant_ts
  ON account_action_log(applicant_id, ts DESC);

ALTER TABLE account_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_action_log_select_own"
  ON account_action_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;
ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
