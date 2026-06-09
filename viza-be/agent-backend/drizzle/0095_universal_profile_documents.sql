CREATE TABLE IF NOT EXISTS universal_profile_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  source_application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE universal_profile_documents ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS universal_profile_documents_applicant_type_idx
  ON universal_profile_documents(applicant_id, document_type);

CREATE INDEX IF NOT EXISTS universal_profile_documents_auth_user_idx
  ON universal_profile_documents(auth_user_id);

CREATE INDEX IF NOT EXISTS universal_profile_documents_source_app_idx
  ON universal_profile_documents(source_application_id);

ALTER TABLE visa_application_answers
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB;

CREATE TABLE IF NOT EXISTS application_profile_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'universal_profile',
  profile_updated_at TIMESTAMPTZ,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE application_profile_snapshots ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS application_profile_snapshots_application_idx
  ON application_profile_snapshots(application_id);

CREATE INDEX IF NOT EXISTS application_profile_snapshots_applicant_idx
  ON application_profile_snapshots(applicant_id);
