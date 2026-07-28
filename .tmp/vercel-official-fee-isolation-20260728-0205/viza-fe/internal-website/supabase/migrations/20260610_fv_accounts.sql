-- VIZA required France-Visas account support.
-- Stores encrypted credentials/session state for applicant-owned France-Visas accounts.

CREATE TABLE IF NOT EXISTS public.fv_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  storage_state_json JSONB,
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fv_accounts
  ADD COLUMN IF NOT EXISTS applicant_id UUID REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS storage_state_json JSONB,
  ADD COLUMN IF NOT EXISTS last_authenticated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fv_accounts_applicant_email_key'
      AND conrelid = 'public.fv_accounts'::regclass
  ) THEN
    ALTER TABLE public.fv_accounts
      ADD CONSTRAINT fv_accounts_applicant_email_key UNIQUE (applicant_id, email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fv_accounts_applicant_id
  ON public.fv_accounts(applicant_id);

ALTER TABLE public.fv_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fv_accounts_select_own ON public.fv_accounts;
CREATE POLICY fv_accounts_select_own
  ON public.fv_accounts
  FOR SELECT
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS fv_accounts_insert_own ON public.fv_accounts;
CREATE POLICY fv_accounts_insert_own
  ON public.fv_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS fv_accounts_update_own ON public.fv_accounts;
CREATE POLICY fv_accounts_update_own
  ON public.fv_accounts
  FOR UPDATE
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
    )
  );

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS fv_result_payload JSONB,
  ADD COLUMN IF NOT EXISTS fv_application_reference TEXT;

COMMENT ON COLUMN public.submission_queue.fv_result_payload IS
  'FillFranceVisasResult JSON payload for prefilled or failed outcomes.';
COMMENT ON COLUMN public.submission_queue.fv_application_reference IS
  'France-Visas-assigned application reference parsed from the official dashboard.';
