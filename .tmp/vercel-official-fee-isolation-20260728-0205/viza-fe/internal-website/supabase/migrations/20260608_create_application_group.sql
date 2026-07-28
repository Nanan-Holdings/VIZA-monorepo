CREATE TABLE IF NOT EXISTS public.application_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_user_id uuid NOT NULL,
  visa_package_id uuid REFERENCES public.visa_packages(id) ON DELETE RESTRICT,
  label text,
  stripe_checkout_session_id text,
  total_amount_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_group_payer
  ON public.application_group(payer_user_id, created_at DESC);

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.application_group(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_group
  ON public.applications(group_id);

ALTER TABLE public.applicant_profiles
  ADD COLUMN IF NOT EXISTS dependant_of_user_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_applicant_profiles_dependant
  ON public.applicant_profiles(dependant_of_user_id);

ALTER TABLE public.application_group ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_group'
      AND policyname = 'application_group_select_own'
  ) THEN
    CREATE POLICY "application_group_select_own"
      ON public.application_group FOR SELECT
      USING (payer_user_id = auth.uid());
  END IF;
END $$;

