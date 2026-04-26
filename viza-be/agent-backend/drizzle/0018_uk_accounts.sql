-- =============================================================================
-- UK Standard Visitor account credentials + resume URL
--
-- Mirrors fv_accounts (0013) for UKVI's apply-uk-visa.service.gov.uk portal.
-- The runner uses these credentials to drive an in-flight application via
-- the forceResume URL the portal issued at registration.
--
-- Lifecycle:
--   1. Frontend creates an in-flight application by walking the pre-auth
--      registration flow (today: src/uk/orchestrator.ts pre-auth scaffold).
--   2. UKVI emails the applicant a forceResume URL bound to the registered
--      email + chosen password. The frontend persists those here.
--   3. submission-service worker reads this row to drive the post-auth
--      page walk via src/uk/resume.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS uk_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** Email used to register on apply-uk-visa.service.gov.uk. */
  email TEXT NOT NULL,
  /**
   * Encrypted password blob. Caller-owned encryption (use the same scheme
   * as src/utils/secret-cipher.ts in agent-backend). Submission-service
   * decrypts at runtime via src/secret-cipher.ts.
   */
  password_encrypted TEXT NOT NULL,
  /**
   * forceResume URL minted by UKVI after the applicant registers. The
   * runner navigates to this URL + supplies the decrypted password to
   * resume the in-flight application.
   */
  resume_url TEXT NOT NULL,
  /**
   * Last captured Playwright storageState (cookies + localStorage). Used
   * by future restoreUkSession() helpers to skip re-login on subsequent
   * runs. Clear when the session expires.
   */
  storage_state_json JSONB,
  /** Timestamp of the most recent successful authentication. */
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (applicant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_uk_accounts_applicant_id ON uk_accounts(applicant_id);

ALTER TABLE uk_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uk_accounts_select_own"
  ON uk_accounts FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "uk_accounts_insert_own"
  ON uk_accounts FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "uk_accounts_update_own"
  ON uk_accounts FOR UPDATE
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
