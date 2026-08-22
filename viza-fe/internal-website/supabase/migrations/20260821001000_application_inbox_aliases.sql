-- Application-scoped managed inbox aliases for unattended official portals.
-- Existing applicant_profiles.inbox_alias remains the compatibility path for
-- older country runners; new automated products must use one alias per
-- application so OTPs, application numbers, and approval mail cannot cross
-- application boundaries.

CREATE TABLE IF NOT EXISTS public.application_inbox_aliases (
  application_id UUID PRIMARY KEY
    REFERENCES public.applications(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL
    REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  alias TEXT NOT NULL UNIQUE,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT application_inbox_aliases_alias_lowercase
    CHECK (alias = LOWER(alias)),
  CONSTRAINT application_inbox_aliases_alias_shape
    CHECK (alias ~ '^appl-[0-9a-z]{26}@[0-9a-z.-]+$')
);

CREATE INDEX IF NOT EXISTS application_inbox_aliases_applicant_idx
  ON public.application_inbox_aliases(applicant_id, created_at DESC);

ALTER TABLE public.application_inbox_aliases ENABLE ROW LEVEL SECURITY;

-- No authenticated/user policy is intentional. The submission service and
-- email worker use the service-role key; browser clients must never enumerate
-- application aliases or infer another applicant's official email traffic.
REVOKE ALL ON TABLE public.application_inbox_aliases FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.application_inbox_aliases TO service_role;
