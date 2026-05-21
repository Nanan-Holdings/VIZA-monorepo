-- =============================================================================
-- face_match_audit (DOCUP-004)
--
-- One row per face-match attempt. Stores the similarity score, the
-- decision (auto-approve / staff-review / reject), and which provider
-- ran it. We keep the raw score for forensic re-thresholding.
-- =============================================================================

CREATE TABLE IF NOT EXISTS face_match_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL,
  application_id UUID,
  /** Provider that produced the score: 'face-api'|'aws-rekognition'|'mock'. */
  provider TEXT NOT NULL,
  /** Similarity 0..1. */
  score NUMERIC NOT NULL,
  threshold NUMERIC NOT NULL,
  decision TEXT NOT NULL,
  passport_storage_path TEXT,
  applicant_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS face_match_audit_applicant_idx ON face_match_audit (applicant_id, created_at DESC);

ALTER TABLE face_match_audit ENABLE ROW LEVEL SECURITY;
-- Read open to authenticated; service-role inserts only.
CREATE POLICY "face_match_audit_select_authenticated"
  ON face_match_audit FOR SELECT
  USING (auth.role() = 'authenticated');
