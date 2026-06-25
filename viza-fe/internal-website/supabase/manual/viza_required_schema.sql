-- VIZA required remote Supabase schema bundle.
-- Generated from selected VIZA-only migrations in supabase/migrations.
-- Paste this whole file into the Supabase SQL Editor only when db push/direct migration is blocked.
-- Safe/idempotent: no drops, no unrelated medical/lab/prescription/vector schema.


-- ============================================================================
-- 20260610_applicant_profile_bilingual_fields.sql
-- ============================================================================
-- VIZA required Universal Profile bilingual fields.
-- Safe to run against the remote VIZA Supabase project more than once.

CREATE TABLE IF NOT EXISTS public.applicant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  full_name TEXT,
  date_of_birth DATE,
  place_of_birth TEXT,
  gender TEXT,
  nationality TEXT,
  occupation TEXT,
  address TEXT,
  passport_number TEXT,
  passport_issue_date DATE,
  passport_expiry_date DATE,
  passport_issuing_country TEXT,
  passport_issuing_authority TEXT,
  email TEXT,
  phone TEXT,
  wechat TEXT,
  language_pref TEXT NOT NULL DEFAULT 'en',
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.applicant_profiles
  ADD COLUMN IF NOT EXISTS full_name_zh TEXT,
  ADD COLUMN IF NOT EXISTS full_name_en TEXT,
  ADD COLUMN IF NOT EXISTS surname TEXT,
  ADD COLUMN IF NOT EXISTS surname_zh TEXT,
  ADD COLUMN IF NOT EXISTS surname_en TEXT,
  ADD COLUMN IF NOT EXISTS given_names TEXT,
  ADD COLUMN IF NOT EXISTS given_names_zh TEXT,
  ADD COLUMN IF NOT EXISTS given_names_en TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth_zh TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth_en TEXT,
  ADD COLUMN IF NOT EXISTS birth_country TEXT,
  ADD COLUMN IF NOT EXISTS birth_province_or_state TEXT,
  ADD COLUMN IF NOT EXISTS birth_province_or_state_zh TEXT,
  ADD COLUMN IF NOT EXISTS birth_province_or_state_en TEXT,
  ADD COLUMN IF NOT EXISTS birth_city TEXT,
  ADD COLUMN IF NOT EXISTS birth_city_zh TEXT,
  ADD COLUMN IF NOT EXISTS birth_city_en TEXT,
  ADD COLUMN IF NOT EXISTS occupation_zh TEXT,
  ADD COLUMN IF NOT EXISTS occupation_en TEXT,
  ADD COLUMN IF NOT EXISTS address_zh TEXT,
  ADD COLUMN IF NOT EXISTS address_en TEXT;

ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 20260610_ds160_live_assisted_controls.sql
-- ============================================================================
-- VIZA required DS-160 live-assisted controls.
-- Dry-run remains the default. Live CEAC flows must stop before final Sign/Submit.

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT 'indonesia',
  visa_type TEXT NOT NULL DEFAULT 'tourist_b211a',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.submission_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS official_application_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_security_question_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_security_answer_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_location TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS manual_action_status TEXT,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS final_user_confirmation_user_agent_hash TEXT;

COMMENT ON COLUMN public.submission_queue.mode IS
  'Submission mode. DS-160 defaults to dry_run; live_assisted requires explicit runtime enablement.';
COMMENT ON COLUMN public.submission_queue.official_application_id_encrypted IS
  'Encrypted CEAC Application ID. Never log plaintext official retrieval identifiers.';
COMMENT ON COLUMN public.submission_queue.official_security_answer_encrypted IS
  'Encrypted CEAC security answer. Never log plaintext retrieval secrets.';

CREATE TABLE IF NOT EXISTS public.ds160_submission_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  country_code TEXT NOT NULL DEFAULT 'US',
  visa_type TEXT NOT NULL DEFAULT 'DS160',
  mode TEXT NOT NULL DEFAULT 'dry_run',
  provider TEXT NOT NULL DEFAULT 'ceac_dry_run',
  status TEXT NOT NULL DEFAULT 'pending',
  official_application_id_encrypted TEXT,
  official_confirmation_number_encrypted TEXT,
  official_security_question_encrypted TEXT,
  official_security_answer_encrypted TEXT,
  official_location TEXT,
  official_started_at TIMESTAMPTZ,
  official_submitted_at TIMESTAMPTZ,
  official_confirmation_page_url TEXT,
  confirmation_pdf_url TEXT,
  confirmation_screenshot_url TEXT,
  review_diff_status TEXT NOT NULL DEFAULT 'not_run',
  final_user_confirmation_at TIMESTAMPTZ,
  final_user_confirmation_ip_hash TEXT,
  final_user_confirmation_user_agent_hash TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ds160_submission_jobs
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'ceac_dry_run',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS official_application_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT NOT NULL DEFAULT 'not_run';

CREATE INDEX IF NOT EXISTS ds160_submission_jobs_application_idx
  ON public.ds160_submission_jobs(application_id);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_user_idx
  ON public.ds160_submission_jobs(user_id);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_status_idx
  ON public.ds160_submission_jobs(status);
CREATE INDEX IF NOT EXISTS ds160_submission_jobs_mode_idx
  ON public.ds160_submission_jobs(mode);

CREATE TABLE IF NOT EXISTS public.ds160_official_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT NOT NULL,
  redacted_snapshot_json JSONB NOT NULL DEFAULT '{}',
  snapshot_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds160_review_snapshots_job_idx
  ON public.ds160_official_review_snapshots(job_id);
CREATE INDEX IF NOT EXISTS ds160_review_snapshots_application_idx
  ON public.ds160_official_review_snapshots(application_id);
CREATE INDEX IF NOT EXISTS ds160_review_snapshots_source_idx
  ON public.ds160_official_review_snapshots(source);

CREATE TABLE IF NOT EXISTS public.ds160_review_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  viza_value_redacted TEXT,
  ceac_value_redacted TEXT,
  diff_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds160_review_diffs_job_idx
  ON public.ds160_review_diffs(job_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_application_idx
  ON public.ds160_review_diffs(application_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_field_idx
  ON public.ds160_review_diffs(field_id);
CREATE INDEX IF NOT EXISTS ds160_review_diffs_severity_idx
  ON public.ds160_review_diffs(severity);

CREATE TABLE IF NOT EXISTS public.ds160_live_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.ds160_submission_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  instruction TEXT,
  screenshot_url TEXT,
  redacted_metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_job_idx
  ON public.ds160_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_application_idx
  ON public.ds160_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_status_idx
  ON public.ds160_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS ds160_live_manual_actions_type_idx
  ON public.ds160_live_manual_actions(action_type);

COMMENT ON TABLE public.ds160_live_manual_actions IS
  'Manual checkpoints for compliant DS-160 live assisted runs: CAPTCHA, official review, final applicant Sign/Submit handoff, and recovery.';

ALTER TABLE public.ds160_submission_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds160_official_review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds160_review_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds160_live_manual_actions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'ds160_submission_jobs',
    'ds160_official_review_snapshots',
    'ds160_review_diffs',
    'ds160_live_manual_actions'
  ]
  LOOP
    policy_name := target_table || '_service';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        policy_name,
        target_table
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- 20260610_fv_accounts.sql
-- ============================================================================
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


-- ============================================================================
-- 20260610_france_live_assisted_controls.sql
-- ============================================================================
-- VIZA required France-Visas live-assisted controls.
-- Live France-Visas flows must stop before final validation, payment, or appointment booking.

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'dry_run',
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS review_diff_status TEXT DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS official_application_reference_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_account_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS official_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS official_cerfa_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS official_review_snapshot_id UUID,
  ADD COLUMN IF NOT EXISTS manual_action_status TEXT,
  ADD COLUMN IF NOT EXISTS filing_location TEXT,
  ADD COLUMN IF NOT EXISTS external_service_provider TEXT,
  ADD COLUMN IF NOT EXISTS appointment_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS official_status TEXT,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN public.submission_queue.official_application_reference_encrypted IS
  'Encrypted official France-Visas reference or draft reference. Never log plaintext official identifiers.';
COMMENT ON COLUMN public.submission_queue.official_account_email_encrypted IS
  'Encrypted France-Visas account email when required for support/retry context.';
COMMENT ON COLUMN public.submission_queue.official_review_snapshot_id IS
  'Latest redacted official review snapshot used for VIZA-vs-official diff checks.';
COMMENT ON COLUMN public.submission_queue.manual_action_status IS
  'Current manual checkpoint state for live assisted official portal runs.';
COMMENT ON COLUMN public.submission_queue.external_service_provider IS
  'Detected France filing provider: VFS, TLS, CAPAGO, CONSULATE, or UNKNOWN.';
COMMENT ON COLUMN public.submission_queue.official_status IS
  'Official lifecycle label such as draft_prefilled, official_record_created, payment_required, appointment_required, or lodged_at_visa_centre.';

CREATE TABLE IF NOT EXISTS public.france_live_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  instruction TEXT,
  screenshot_url TEXT,
  redacted_metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS france_live_manual_actions_job_idx
  ON public.france_live_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_application_idx
  ON public.france_live_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_status_idx
  ON public.france_live_manual_actions(status);
CREATE INDEX IF NOT EXISTS france_live_manual_actions_type_idx
  ON public.france_live_manual_actions(action_type);

CREATE TABLE IF NOT EXISTS public.france_official_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT NOT NULL DEFAULT 'france_visas',
  redacted_snapshot_json JSONB NOT NULL DEFAULT '{}',
  snapshot_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS france_review_snapshots_job_idx
  ON public.france_official_review_snapshots(job_id);
CREATE INDEX IF NOT EXISTS france_review_snapshots_application_idx
  ON public.france_official_review_snapshots(application_id);
CREATE INDEX IF NOT EXISTS france_review_snapshots_source_idx
  ON public.france_official_review_snapshots(source);

CREATE TABLE IF NOT EXISTS public.france_review_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.submission_queue(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  viza_value_redacted TEXT,
  official_value_redacted TEXT,
  diff_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS france_review_diffs_job_idx
  ON public.france_review_diffs(job_id);
CREATE INDEX IF NOT EXISTS france_review_diffs_application_idx
  ON public.france_review_diffs(application_id);
CREATE INDEX IF NOT EXISTS france_review_diffs_field_idx
  ON public.france_review_diffs(field_id);
CREATE INDEX IF NOT EXISTS france_review_diffs_severity_idx
  ON public.france_review_diffs(severity);

COMMENT ON TABLE public.france_live_manual_actions IS
  'Manual checkpoints for compliant France-Visas live assisted runs: CAPTCHA, login/account/email verification, final review, payment, appointment, layout changes, and official portal errors.';

ALTER TABLE public.france_live_manual_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.france_official_review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.france_review_diffs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'france_live_manual_actions',
    'france_official_review_snapshots',
    'france_review_diffs'
  ]
  LOOP
    policy_name := target_table || '_service';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        policy_name,
        target_table
      );
    END IF;
  END LOOP;
END $$;


-- 20260625_official_fee_payment.sql
-- Official visa fee payment framework.
--
-- This schema separates user payments to VIZA from VIZA-controlled payments
-- to official visa/application portals. It is dry-run/manual-first: no raw
-- card numbers, CVV, 3DS secrets, official-site credentials, or sensitive
-- payment authentication data belong in these tables.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS official_fee_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS official_fee_quote_id UUID,
  ADD COLUMN IF NOT EXISTS official_fee_payment_intent_id UUID,
  ADD COLUMN IF NOT EXISTS official_fee_receipt_id UUID,
  ADD COLUMN IF NOT EXISTS official_fee_reconciliation_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS applications_official_fee_status_idx
  ON applications(official_fee_status);
CREATE INDEX IF NOT EXISTS applications_official_fee_intent_idx
  ON applications(official_fee_payment_intent_id);

CREATE TABLE IF NOT EXISTS official_fee_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  country_code TEXT NOT NULL,
  visa_type TEXT,
  official_fee_amount NUMERIC NOT NULL,
  official_fee_currency TEXT NOT NULL,
  service_fee_amount NUMERIC,
  service_fee_currency TEXT,
  total_charge_amount NUMERIC,
  total_charge_currency TEXT,
  exchange_rate NUMERIC,
  fee_source TEXT,
  fee_source_url TEXT,
  fee_breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  quote_status TEXT NOT NULL DEFAULT 'created',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_fee_quotes_application_idx
  ON official_fee_quotes(application_id);
CREATE INDEX IF NOT EXISTS official_fee_quotes_user_idx
  ON official_fee_quotes(user_id);
CREATE INDEX IF NOT EXISTS official_fee_quotes_country_idx
  ON official_fee_quotes(country_code);
CREATE INDEX IF NOT EXISTS official_fee_quotes_status_idx
  ON official_fee_quotes(quote_status);
CREATE INDEX IF NOT EXISTS official_fee_quotes_created_idx
  ON official_fee_quotes(created_at DESC);

CREATE TABLE IF NOT EXISTS payment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_instrument_id TEXT,
  instrument_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  currency TEXT,
  spending_limit_amount NUMERIC,
  spending_limit_currency TEXT,
  allowed_country_codes TEXT[],
  allowed_merchant_categories TEXT[],
  last4 TEXT,
  expires_month INT,
  expires_year INT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_instruments_provider_idx
  ON payment_instruments(provider);
CREATE INDEX IF NOT EXISTS payment_instruments_status_idx
  ON payment_instruments(status);
CREATE INDEX IF NOT EXISTS payment_instruments_type_idx
  ON payment_instruments(instrument_type);
CREATE INDEX IF NOT EXISTS payment_instruments_created_idx
  ON payment_instruments(created_at DESC);

CREATE TABLE IF NOT EXISTS official_fee_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  fee_quote_id UUID REFERENCES official_fee_quotes(id),
  country_code TEXT NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'dry_run',
  official_fee_amount NUMERIC NOT NULL,
  official_fee_currency TEXT NOT NULL,
  target_payee TEXT,
  target_site TEXT,
  payment_method_type TEXT,
  payment_instrument_id UUID REFERENCES payment_instruments(id),
  status TEXT NOT NULL DEFAULT 'created',
  idempotency_key TEXT UNIQUE NOT NULL,
  requires_admin_approval BOOLEAN DEFAULT true,
  admin_approved_by UUID,
  admin_approved_at TIMESTAMPTZ,
  user_consented_at TIMESTAMPTZ,
  user_consent_snapshot_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_fee_intents_application_idx
  ON official_fee_payment_intents(application_id);
CREATE INDEX IF NOT EXISTS official_fee_intents_user_idx
  ON official_fee_payment_intents(user_id);
CREATE INDEX IF NOT EXISTS official_fee_intents_country_idx
  ON official_fee_payment_intents(country_code);
CREATE INDEX IF NOT EXISTS official_fee_intents_status_idx
  ON official_fee_payment_intents(status);
CREATE INDEX IF NOT EXISTS official_fee_intents_idempotency_idx
  ON official_fee_payment_intents(idempotency_key);
CREATE INDEX IF NOT EXISTS official_fee_intents_provider_idx
  ON official_fee_payment_intents(provider);
CREATE INDEX IF NOT EXISTS official_fee_intents_created_idx
  ON official_fee_payment_intents(created_at DESC);

CREATE TABLE IF NOT EXISTS official_fee_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  official_fee_payment_intent_id UUID REFERENCES official_fee_payment_intents(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  request_payload_redacted_json JSONB,
  response_payload_redacted_json JSONB,
  error_code TEXT,
  error_message TEXT,
  official_receipt_number TEXT,
  official_receipt_url TEXT,
  screenshot_url TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS official_fee_attempts_intent_number_idx
  ON official_fee_payment_attempts(official_fee_payment_intent_id, attempt_number);
CREATE INDEX IF NOT EXISTS official_fee_attempts_application_idx
  ON official_fee_payment_attempts(application_id);
CREATE INDEX IF NOT EXISTS official_fee_attempts_status_idx
  ON official_fee_payment_attempts(status);
CREATE INDEX IF NOT EXISTS official_fee_attempts_provider_idx
  ON official_fee_payment_attempts(provider);
CREATE INDEX IF NOT EXISTS official_fee_attempts_started_idx
  ON official_fee_payment_attempts(started_at DESC);

CREATE TABLE IF NOT EXISTS official_fee_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  official_fee_payment_intent_id UUID REFERENCES official_fee_payment_intents(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  receipt_number TEXT,
  receipt_url TEXT,
  receipt_file_url TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  source TEXT,
  raw_receipt_redacted_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_fee_receipts_application_idx
  ON official_fee_receipts(application_id);
CREATE INDEX IF NOT EXISTS official_fee_receipts_user_idx
  ON official_fee_receipts(user_id);
CREATE INDEX IF NOT EXISTS official_fee_receipts_country_idx
  ON official_fee_receipts(country_code);
CREATE INDEX IF NOT EXISTS official_fee_receipts_intent_idx
  ON official_fee_receipts(official_fee_payment_intent_id);
CREATE INDEX IF NOT EXISTS official_fee_receipts_created_idx
  ON official_fee_receipts(created_at DESC);

CREATE TABLE IF NOT EXISTS official_fee_reconciliation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  official_fee_payment_intent_id UUID REFERENCES official_fee_payment_intents(id) ON DELETE SET NULL,
  user_payment_id UUID REFERENCES payment_records(id) ON DELETE SET NULL,
  official_fee_amount NUMERIC NOT NULL,
  official_fee_currency TEXT NOT NULL,
  user_collected_amount NUMERIC,
  user_collected_currency TEXT,
  fx_rate NUMERIC,
  balance_delta NUMERIC,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_fee_reconciliation_application_idx
  ON official_fee_reconciliation_entries(application_id);
CREATE INDEX IF NOT EXISTS official_fee_reconciliation_user_idx
  ON official_fee_reconciliation_entries(user_id);
CREATE INDEX IF NOT EXISTS official_fee_reconciliation_status_idx
  ON official_fee_reconciliation_entries(reconciliation_status);
CREATE INDEX IF NOT EXISTS official_fee_reconciliation_intent_idx
  ON official_fee_reconciliation_entries(official_fee_payment_intent_id);
CREATE INDEX IF NOT EXISTS official_fee_reconciliation_created_idx
  ON official_fee_reconciliation_entries(created_at DESC);

ALTER TABLE official_fee_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_fee_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_fee_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_fee_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_fee_reconciliation_entries ENABLE ROW LEVEL SECURITY;

-- No authenticated policies are added here. The agent backend service role is
-- the default access path until product/legal approve a frontend read surface.


-- 20260625_vietnam_payment_status_tracking.sql
-- Vietnam official-fee payment and official-status tracking.
--
-- Complements 0089_official_fee_payment.sql and 0096_vietnam_live_assisted_controls.sql.
-- No raw card data, CVV, OTP, 3DS secrets, CAPTCHA answers, or official-site
-- credentials belong in these tables.

ALTER TABLE submission_queue
  ADD COLUMN IF NOT EXISTS official_fee_payment_intent_id UUID REFERENCES official_fee_payment_intents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS official_fee_payment_attempt_id UUID REFERENCES official_fee_payment_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS official_fee_receipt_id UUID REFERENCES official_fee_receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS submission_queue_official_fee_intent_idx
  ON submission_queue(official_fee_payment_intent_id);
CREATE INDEX IF NOT EXISTS submission_queue_official_fee_attempt_idx
  ON submission_queue(official_fee_payment_attempt_id);
CREATE INDEX IF NOT EXISTS submission_queue_official_fee_receipt_idx
  ON submission_queue(official_fee_receipt_id);

CREATE TABLE IF NOT EXISTS official_status_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID,
  country_code TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  official_reference TEXT,
  official_status TEXT,
  result_status TEXT,
  requested_by TEXT NOT NULL DEFAULT 'system',
  checked_at TIMESTAMPTZ DEFAULT now(),
  raw_status_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_status_checks_application_idx
  ON official_status_checks(application_id);
CREATE INDEX IF NOT EXISTS official_status_checks_user_idx
  ON official_status_checks(user_id);
CREATE INDEX IF NOT EXISTS official_status_checks_country_idx
  ON official_status_checks(country_code);
CREATE INDEX IF NOT EXISTS official_status_checks_status_idx
  ON official_status_checks(status);
CREATE INDEX IF NOT EXISTS official_status_checks_checked_idx
  ON official_status_checks(checked_at DESC);

ALTER TABLE official_status_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'official_status_checks'
      AND policyname = 'official_status_checks_service'
  ) THEN
    CREATE POLICY official_status_checks_service ON official_status_checks
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE official_status_checks IS
  'Audited official portal status checks. Stores redacted status summaries only.';

