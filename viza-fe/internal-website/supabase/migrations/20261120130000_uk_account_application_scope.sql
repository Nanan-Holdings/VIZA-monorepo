-- =============================================================================
-- Scope UKVI credentials to an application.
--
-- Existing rows intentionally remain legacy rows (application_id IS NULL).
-- There is no safe historical application mapping, so this migration does not
-- backfill them. New runner/API writes must provide the exact application id.
-- =============================================================================

ALTER TABLE public.uk_accounts
  ADD COLUMN IF NOT EXISTS application_id UUID
  REFERENCES public.applications(id) ON DELETE CASCADE;

ALTER TABLE public.uk_accounts
  DROP CONSTRAINT IF EXISTS uk_accounts_applicant_id_email_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.uk_accounts'::regclass
      AND conname = 'uk_accounts_application_id_key'
  ) THEN
    ALTER TABLE public.uk_accounts
      ADD CONSTRAINT uk_accounts_application_id_key UNIQUE (application_id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_accounts_legacy_applicant_email_key
  ON public.uk_accounts (applicant_id, email)
  WHERE application_id IS NULL;

CREATE INDEX IF NOT EXISTS uk_accounts_application_id_idx
  ON public.uk_accounts (application_id);

-- Credentials are service-role-only. Keep the RLS fence enabled and remove
-- the legacy applicant-facing policies; the server routes authenticate the
-- owner first, then read through the service-role client.
DROP POLICY IF EXISTS "uk_accounts_select_own" ON public.uk_accounts;
DROP POLICY IF EXISTS "uk_accounts_insert_own" ON public.uk_accounts;
DROP POLICY IF EXISTS "uk_accounts_update_own" ON public.uk_accounts;
ALTER TABLE public.uk_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.uk_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.uk_accounts TO service_role;
