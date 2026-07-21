CREATE TABLE IF NOT EXISTS public.universal_profile_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  source_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.universal_profile_documents ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS universal_profile_documents_applicant_type_idx
  ON public.universal_profile_documents(applicant_id, document_type);

CREATE INDEX IF NOT EXISTS universal_profile_documents_auth_user_idx
  ON public.universal_profile_documents(auth_user_id);

CREATE INDEX IF NOT EXISTS universal_profile_documents_source_app_idx
  ON public.universal_profile_documents(source_application_id);

REVOKE ALL ON TABLE public.universal_profile_documents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.universal_profile_documents TO service_role;

COMMENT ON TABLE public.universal_profile_documents IS
  'Private reusable passport, portrait, and signature files. Access is server-authorized through VIZA actions.';
