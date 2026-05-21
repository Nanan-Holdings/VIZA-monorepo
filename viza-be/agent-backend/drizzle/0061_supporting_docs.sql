-- =============================================================================
-- Supporting-document checklist (DOC-003)
--
-- supporting_doc_slot — per-package list of required + optional uploads
-- (bank statement, itinerary, employment letter, invitation, photo, …).
-- supporting_doc_submission — applicant-side uploads + staff review state.
-- =============================================================================

CREATE TABLE IF NOT EXISTS supporting_doc_slot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES visa_packages(id) ON DELETE CASCADE,
  slot_key TEXT NOT NULL,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  /** Comma-separated MIME hint shown to the applicant; validation list lives in code. */
  accepted_mime_hint TEXT,
  /** Soft cap in bytes; the helper rejects above this. */
  max_bytes INTEGER NOT NULL DEFAULT 10485760, -- 10 MB
  /** Free-form note shown to the applicant. */
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_supporting_doc_slot_package
  ON supporting_doc_slot(package_id, position);

CREATE TABLE IF NOT EXISTS supporting_doc_submission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES supporting_doc_slot(id) ON DELETE CASCADE,
  /** Storage path under submission-artifacts. */
  storage_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  /** missing | uploaded | accepted | rejected */
  status TEXT NOT NULL DEFAULT 'uploaded',
  staff_comment TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_supporting_doc_submission_application
  ON supporting_doc_submission(application_id, slot_id);

ALTER TABLE supporting_doc_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE supporting_doc_submission ENABLE ROW LEVEL SECURITY;

-- Slots are readable to any authenticated session — applicants need
-- to see the checklist for the package they bought.
CREATE POLICY "supporting_doc_slot_select_all"
  ON supporting_doc_slot FOR SELECT
  USING (auth.role() IS NOT NULL);

-- Submissions: owning applicant can see their own rows.
CREATE POLICY "supporting_doc_submission_select_own"
  ON supporting_doc_submission FOR SELECT
  USING (
    application_id IN (
      SELECT a.id FROM applications a
       JOIN applicant_profiles p ON p.id = a.applicant_id
       WHERE p.auth_user_id = auth.uid()
    )
  );
