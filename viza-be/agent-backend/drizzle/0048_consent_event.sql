-- =============================================================================
-- Consent capture (LEGAL-002)
--
-- One row per acceptance. Records:
--   - user_id (auth.users.id) when the caller is authenticated
--   - applicant_id when the consent is per-application
--   - email when captured pre-account (waitlist / invite signup)
--   - doc_kind: 'tos' | 'privacy' | 'application_authorisation'
--   - doc_version: SHA-256 hex of the rendered markdown (drift detection)
--   - ip / ua: forensic context
--
-- We DO NOT enforce uniqueness — each acceptance is a separate event so we
-- can evidence repeated consent at version bumps.
-- =============================================================================

CREATE TABLE IF NOT EXISTS consent_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  applicant_id UUID REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  email TEXT,
  doc_kind TEXT NOT NULL,
  doc_version TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consent_event_subject_present CHECK (
    user_id IS NOT NULL
    OR applicant_id IS NOT NULL
    OR email IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_consent_event_user_id_ts
  ON consent_event(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_consent_event_applicant_id_ts
  ON consent_event(applicant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_consent_event_email
  ON consent_event(LOWER(email)) WHERE email IS NOT NULL;

ALTER TABLE consent_event ENABLE ROW LEVEL SECURITY;
-- Owner can read their own consent history. Service role writes via
-- the recordConsentEvent server action.
CREATE POLICY "consent_event_select_own"
  ON consent_event FOR SELECT
  USING (
    user_id = auth.uid()
    OR applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
