-- =============================================================================
-- Philippines eTravel official account reuse
--
-- Stores one or more official eTravel/eGovPH account records per applicant.
-- The submission worker reuses an existing row before creating a new
-- applicant inbox-alias account, so repeat PH_ETRAVEL_ARRIVAL_CARD filings do
-- not create duplicate official accounts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ph_etravel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_encrypted TEXT,
  mpin_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'pending_registration',
  storage_state_json JSONB,
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (applicant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ph_etravel_accounts_applicant_id
  ON ph_etravel_accounts(applicant_id);

CREATE INDEX IF NOT EXISTS idx_ph_etravel_accounts_status
  ON ph_etravel_accounts(status);

ALTER TABLE ph_etravel_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ph_etravel_accounts_select_own"
  ON ph_etravel_accounts FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "ph_etravel_accounts_insert_own"
  ON ph_etravel_accounts FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "ph_etravel_accounts_update_own"
  ON ph_etravel_accounts FOR UPDATE
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE ph_etravel_accounts IS
  'Official Philippines eTravel/eGovPH account records reused across PH_ETRAVEL_ARRIVAL_CARD submissions.';
