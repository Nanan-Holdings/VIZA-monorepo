CREATE TABLE IF NOT EXISTS public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NULL REFERENCES public.applications(id) ON DELETE SET NULL,
  applicant_id uuid NULL REFERENCES public.applicant_profiles(id) ON DELETE SET NULL,
  visa_package_id uuid NULL REFERENCES public.visa_packages(id) ON DELETE SET NULL,
  auth_user_id uuid NULL,
  provider text NOT NULL,
  provider_session_id text NULL,
  provider_payment_id text NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  fee_type text NOT NULL DEFAULT 'agency_fee',
  receipt_url text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz NULL,
  failed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_records_auth_user_id_idx
  ON public.payment_records (auth_user_id);

CREATE INDEX IF NOT EXISTS payment_records_applicant_id_idx
  ON public.payment_records (applicant_id);

CREATE INDEX IF NOT EXISTS payment_records_application_id_idx
  ON public.payment_records (application_id);

CREATE INDEX IF NOT EXISTS payment_records_provider_session_idx
  ON public.payment_records (provider, provider_session_id);

CREATE INDEX IF NOT EXISTS payment_records_provider_payment_idx
  ON public.payment_records (provider, provider_payment_id);

CREATE INDEX IF NOT EXISTS payment_records_status_idx
  ON public.payment_records (status);
