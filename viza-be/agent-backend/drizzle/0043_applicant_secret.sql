-- =============================================================================
-- Per-applicant credential vault (SECRETS-001)
--
-- Generic encrypted key/value store keyed on (applicant_id, key). Replaces
-- ad-hoc per-portal account tables for new credential types and centralises
-- the read path so submission-service never reads plaintext from env or any
-- other source.
--
-- Encryption is application-layer AES-256-GCM (see
-- viza-be/agent-backend/src/utils/secret-cipher.ts and the byte-equivalent
-- mirror in viza-be/submission-service/src/secret-cipher.ts). The DB stores
-- only ciphertext; the key is derived from SUBMISSION_RESULT_SECRET_KEY,
-- which lives in env / KMS and is NEVER committed.
--
-- RLS: only the owning applicant (via auth.uid() → applicant_profiles) can
-- SELECT a row's metadata. Decryption requires the encryption key and the
-- ciphertext together — service-role + key holder is the only path that
-- yields plaintext.
-- =============================================================================

CREATE TABLE IF NOT EXISTS applicant_secret (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  /**
   * Stable identifier for the secret within an applicant scope, e.g.
   * `uk.password`, `in.portal.password`, `2captcha.api_key`,
   * `email.imap.password`. Treat as namespaced; collisions per-applicant
   * are rejected by the UNIQUE constraint below.
   */
  key TEXT NOT NULL,
  /**
   * AES-256-GCM ciphertext blob in `salt:iv:ct:tag` hex format produced by
   * encryptSecret() in the cipher module. Never plaintext.
   */
  ciphertext TEXT NOT NULL,
  /**
   * Optional human note (rotation reason, source). Never the value itself.
   */
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (applicant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_applicant_secret_applicant_id
  ON applicant_secret(applicant_id);

ALTER TABLE applicant_secret ENABLE ROW LEVEL SECURITY;

-- Owning applicant can see their own rows (metadata only — ciphertext is
-- useless without the env-side encryption key).
CREATE POLICY "applicant_secret_select_own"
  ON applicant_secret FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- Writes go through the service-role client only (vault helper). Block all
-- non-service-role writes by omitting INSERT/UPDATE/DELETE policies; RLS
-- defaults to deny.
