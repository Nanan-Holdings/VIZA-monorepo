-- =============================================================================
-- E-signature audit log (DOC-005)
--
-- Every agency-form / consulate-form e-signature event lands a row.
-- Captures the SHA-256 of the rendered document the applicant saw at
-- the moment of signing so we can later prove they signed *that*
-- version. Pairs with consent_event (LEGAL-002) but is scoped to
-- per-application authorisation artefacts rather than global policies.
-- =============================================================================

CREATE TABLE IF NOT EXISTS signature_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  /** agency_authorisation | poa | au_subclass_600_signature | … */
  doc_kind TEXT NOT NULL,
  /** SHA-256 hex of the rendered doc body the applicant saw. */
  doc_hash TEXT NOT NULL,
  /** Storage path of the rendered signed PDF (or PNG signature blob). */
  signed_storage_path TEXT,
  ip TEXT,
  ua TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_event_applicant_ts
  ON signature_event(applicant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_signature_event_application_ts
  ON signature_event(application_id, ts DESC);

ALTER TABLE signature_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signature_event_select_own"
  ON signature_event FOR SELECT
  USING (
    applicant_id IN (
      SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );
