-- =============================================================================
-- Per-package paper-channel template metadata (DOC-004)
--
-- Some flows halt at "print and submit" — JP tourist (consulate),
-- KR C-3-9, certain Schengen embassies. The runner / staff tools
-- assemble a printable PDF from the canonical answer set; this table
-- registers which fields land where.
--
-- A template is identified by `package_id + key`; multiple templates
-- per package are allowed (e.g. main form + cover letter).
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES visa_packages(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  /**
   * Layout JSON. Shape (mirrors paper/renderer.ts in submission-service):
   *   {
   *     "fields": [
   *       { "answerKey": "surname",    "label": "Surname" },
   *       { "answerKey": "given_names","label": "Given names" },
   *       …
   *     ],
   *     "footer": "free text"
   *   }
   */
  layout JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, key)
);

CREATE INDEX IF NOT EXISTS idx_paper_template_package
  ON paper_template(package_id);

ALTER TABLE paper_template ENABLE ROW LEVEL SECURITY;
-- Service role only.
