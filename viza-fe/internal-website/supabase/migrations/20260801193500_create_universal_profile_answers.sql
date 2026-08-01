CREATE TABLE IF NOT EXISTS public.universal_profile_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  canonical_key TEXT NOT NULL,
  value_text TEXT NOT NULL,
  value_zh TEXT,
  value_en TEXT,
  label_zh TEXT,
  label_en TEXT,
  field_type TEXT NOT NULL DEFAULT 'text',
  category TEXT NOT NULL DEFAULT 'identity',
  source_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  source_visa_type TEXT,
  source_field_name TEXT,
  field_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.universal_profile_answers ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS universal_profile_answers_user_key_idx
  ON public.universal_profile_answers(auth_user_id, canonical_key);

CREATE INDEX IF NOT EXISTS universal_profile_answers_applicant_idx
  ON public.universal_profile_answers(applicant_id);

CREATE INDEX IF NOT EXISTS universal_profile_answers_source_app_idx
  ON public.universal_profile_answers(source_application_id);

REVOKE ALL ON TABLE public.universal_profile_answers FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.universal_profile_answers TO service_role;

COMMENT ON TABLE public.universal_profile_answers IS
  'Reusable, field-keyed applicant facts collected from country application schemas. Access is server-authorized through VIZA actions.';
