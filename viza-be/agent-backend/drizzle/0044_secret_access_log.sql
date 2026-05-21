-- =============================================================================
-- Per-applicant credential vault audit log (SECRETS-003)
--
-- Every read / write / delete on `applicant_secret` appends a row here so
-- we can reconstruct which job touched which credential after an incident.
-- The log NEVER stores plaintext or ciphertext — only metadata.
--
-- Writes happen inside the vault helpers (atomic with the operation they
-- describe). The admin portal exposes a read-only per-applicant view.
-- =============================================================================

CREATE TABLE IF NOT EXISTS secret_access_log (
  id BIGSERIAL PRIMARY KEY,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /** Stable key namespace under applicant scope, e.g. uk.portal.password. */
  key TEXT NOT NULL,
  /** One of: read, read_miss, write, delete. */
  action TEXT NOT NULL,
  /**
   * Identifier of the calling service, e.g. submission-service@uk-runner,
   * agent-backend@vault-helper, or scripts/rotate-applicant-secret.ts.
   * Free-form so callers can include enough breadcrumb to identify the
   * job; never an end-user identifier.
   */
  actor TEXT NOT NULL,
  /** Optional run / request correlation id. */
  correlation_id TEXT,
  /** Optional decoded error class on failure (e.g. VaultMissError). */
  error_class TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secret_access_log_applicant_ts
  ON secret_access_log(applicant_id, ts DESC);

ALTER TABLE secret_access_log ENABLE ROW LEVEL SECURITY;

-- Owning applicant can SELECT their own audit rows. Writes are
-- service-role only (no INSERT/UPDATE/DELETE policies → RLS deny).
CREATE POLICY "secret_access_log_select_own"
  ON secret_access_log FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
