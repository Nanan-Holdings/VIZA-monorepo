-- =============================================================================
-- US-018: VISA APPLICATION ANSWERS
-- Generic key-value answer storage for dynamic visa forms
-- =============================================================================

CREATE TABLE IF NOT EXISTS visa_application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (application_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_visa_application_answers_app_id
  ON visa_application_answers (application_id);

ALTER TABLE visa_application_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visa_application_answers_select" ON visa_application_answers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "visa_application_answers_service" ON visa_application_answers
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- US-019: SHARED PROFILE FIELDS
-- Tracks reusable cross-visa profile group completeness
-- =============================================================================

CREATE TABLE IF NOT EXISTS shared_profile_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  field_group TEXT NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  last_verified TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (applicant_id, field_group)
);

ALTER TABLE shared_profile_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_profile_fields_select" ON shared_profile_fields
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shared_profile_fields_service" ON shared_profile_fields
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- US-020: ADD PACKAGE AND DS-160 METADATA COLUMNS TO APPLICATIONS
-- =============================================================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS visa_package_id UUID REFERENCES visa_packages(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ds160_application_id TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ds160_retrieval_url TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ds160_dat_storage_path TEXT;
