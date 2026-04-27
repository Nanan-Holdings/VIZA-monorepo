-- =============================================================================
-- ImmiAccount credentials for the Australia Subclass 600 runner
--
-- Mirrors fv_accounts (0013) and uk_accounts (0018). The submission-service
-- worker reads this row to log into ImmiAccount, satisfy TOTP MFA, and resume
-- (or open) the Subclass 600 draft via fillVisitor600Application.
--
-- Lifecycle:
--   1. Applicant registers an ImmiAccount and enables a TOTP authenticator.
--      The TOTP shared secret is the base32 string the authenticator app
--      stored when QR-scanning the ImmiAccount setup screen.
--   2. Frontend captures (email, password, totp_secret) on the AU step-0
--      collector and persists them here, encrypted with the same scheme as
--      uk_accounts (src/secret-cipher.ts in submission-service).
--   3. Worker decrypts at runtime and supplies them to fillVisitor600Application.
--   4. resume_trn (optional) lets the runner pick up an in-flight draft instead
--      of opening a new one.
-- =============================================================================

CREATE TABLE IF NOT EXISTS au_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** ImmiAccount username (typically the applicant's email). */
  username TEXT NOT NULL,
  /** Encrypted ImmiAccount password (scrypt + AES-GCM via secret-cipher.ts). */
  password_encrypted TEXT NOT NULL,
  /** Encrypted base32 TOTP shared secret. NULL if MFA is disabled. */
  totp_secret_encrypted TEXT,
  /** Optional draft Transaction Reference Number to resume. */
  resume_trn TEXT,
  /** Last captured Playwright storageState (cookies + localStorage). */
  storage_state_json JSONB,
  /** Timestamp of the most recent successful authentication. */
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (applicant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_au_accounts_applicant_id ON au_accounts(applicant_id);

ALTER TABLE au_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "au_accounts_select_own"
  ON au_accounts FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "au_accounts_insert_own"
  ON au_accounts FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "au_accounts_update_own"
  ON au_accounts FOR UPDATE
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
