-- =============================================================================
-- Egypt e-Visa account credentials + per-application VISTK token
--
-- Mirrors uk_accounts (0018) and au_accounts (0020) for visa2egypt.gov.eg.
-- The runner uses these credentials to log into the portal and resume an
-- in-flight application via the VISTK-bearing URL the portal issued at
-- registration.
--
-- Future direction (post-domain provisioning):
--   When VIZA owns a customer domain, every applicant gets an auto-generated
--   alias (e.g. <applicant-uuid>@viza.<tld>) and a system-generated password.
--   submission-service registers the visa2egypt.gov.eg account on their
--   behalf at intake and writes the row here. Today we seed test rows and
--   assume the applicant already holds an account.
--
-- Lifecycle (current):
--   1. Frontend collects (email, password, optional VISTK URL) at the EG
--      step-0 collector and persists them here, encrypted.
--   2. Worker decrypts at runtime and supplies them to fillEgyptApplication.
--   3. resume_url + vistk_token let the runner pick up an in-flight draft
--      instead of opening a new one.
-- =============================================================================

CREATE TABLE IF NOT EXISTS eg_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** Email used to register on visa2egypt.gov.eg. */
  email TEXT NOT NULL,
  /** Encrypted password (scrypt + AES-GCM via secret-cipher.ts). */
  password_encrypted TEXT NOT NULL,
  /** Per-application VISTK token issued by the portal (e.g. QVY3-DQ6E-...-G9SA-JSBF). NULL before first save. */
  vistk_token TEXT,
  /** Full resume URL (visa2egypt.gov.eg/eVisa/Applications?VISTK=...). NULL before first save. */
  resume_url TEXT,
  /** Last captured Playwright storageState (cookies + localStorage). */
  storage_state_json JSONB,
  /** Timestamp of the most recent successful authentication. */
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (applicant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_eg_accounts_applicant_id ON eg_accounts(applicant_id);

ALTER TABLE eg_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eg_accounts_select_own"
  ON eg_accounts FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "eg_accounts_insert_own"
  ON eg_accounts FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "eg_accounts_update_own"
  ON eg_accounts FOR UPDATE
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
