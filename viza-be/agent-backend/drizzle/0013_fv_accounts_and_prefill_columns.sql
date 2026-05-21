-- =============================================================================
-- France-Visas automation support
--
-- Adds:
--   1. fv_accounts — stores Keycloak credentials + session state for each
--      applicant's France-Visas account (used by the submission-service's
--      signInWithPassword / restoreFvSession flows).
--   2. submission_queue.fv_result_payload — FillFranceVisasResult blob for
--      operator diagnostics, parallel to ceac_result_payload.
--   3. submission_queue.fv_application_reference — the 13-digit FV-assigned
--      reference (e.g. 2026705103880) parsed from the accueil dashboard
--      after step 6 saves the draft.
--
-- submission_queue.status is a TEXT column with no CHECK constraint, so the
-- new fv_prefill_pending / fv_prefill_processing / fv_prefilled /
-- fv_prefill_failed / fv_blocked values do not require a DDL change — the
-- application layer owns the enum.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fv_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** Email used to register on connect.france-visas.gouv.fr. */
  email TEXT NOT NULL,
  /**
   * Encrypted password blob. Encryption scheme is caller-owned — the
   * submission-service expects a decrypted string at runtime and does not
   * perform the decrypt itself. Store encrypted-at-rest.
   */
  password_encrypted TEXT NOT NULL,
  /**
   * Last captured Playwright storageState (cookies + localStorage). Used
   * by restoreFvSession() to skip the Keycloak login round-trip on
   * subsequent runs. Clear this column when the session expires.
   */
  storage_state_json JSONB,
  /** Timestamp of the most recent successful authentication. */
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (applicant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_fv_accounts_applicant_id ON fv_accounts(applicant_id);

ALTER TABLE fv_accounts ENABLE ROW LEVEL SECURITY;

-- Owner-only access; service-role clients bypass RLS.
CREATE POLICY "fv_accounts_select_own"
  ON fv_accounts FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "fv_accounts_insert_own"
  ON fv_accounts FOR INSERT
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "fv_accounts_update_own"
  ON fv_accounts FOR UPDATE
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- ─── submission_queue extensions ────────────────────────────────────────────

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS fv_result_payload JSONB,
  ADD COLUMN IF NOT EXISTS fv_application_reference TEXT;

COMMENT ON COLUMN submission_queue.fv_result_payload IS
  'FillFranceVisasResult JSON payload (prefilled or failed outcome).';
COMMENT ON COLUMN submission_queue.fv_application_reference IS
  'France-Visas-assigned 13-digit application reference, e.g. 2026705103880.';
