-- =============================================================================
-- Question set + question field (PROD-001)
--
-- Drives the answer-collection UI per (country, visa_type). Rows are
-- derived from each country's CanonicalAnswers TS interface and the
-- form-recon walker output via `scripts/derive-question-sets.ts`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS question_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  /** Display-friendly version label, e.g. 'v1' or '2026-05'. */
  version TEXT NOT NULL DEFAULT 'v1',
  derived_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country, visa_type, version)
);

CREATE TABLE IF NOT EXISTS question_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES question_set(id) ON DELETE CASCADE,
  /** Canonical answer key (e.g. 'surname', 'passport_number'). */
  field_name TEXT NOT NULL,
  label TEXT NOT NULL,
  /** Widget hint for the UI: text|email|tel|date|select|radio|checkbox|textarea|file. */
  widget_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  /** Optional select/radio/checkbox option list. */
  options JSONB,
  /** Optional branch rule: { when: { field: 'visa_purpose', equals: 'medical' } }. */
  branch JSONB,
  ordinal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_set_id, field_name)
);

CREATE INDEX IF NOT EXISTS question_field_set_idx ON question_field (question_set_id, ordinal);

ALTER TABLE question_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_field ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_set_select_all" ON question_set FOR SELECT USING (TRUE);
CREATE POLICY "question_field_select_all" ON question_field FOR SELECT USING (TRUE);
