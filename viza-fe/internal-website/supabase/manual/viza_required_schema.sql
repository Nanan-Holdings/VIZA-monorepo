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


-- 20260625_vn_evisa_official_form_parity.sql

-- Vietnam e-Visa official portal form parity.
--
-- Adds conditional questions/tables and validation metadata observed on the
-- current official Vietnam e-Visa portal so VIZA collects the same required
-- data before the submission-service runner reaches the official checkpoint.

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"allow_year_only":true}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'date_of_birth';

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"min_date":"today"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visa_valid_from';

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb) || '{"not_before_field":"visa_valid_from"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visa_valid_to';

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb)
    || '{"dependent_on":"intended_province_city","dependent_options_key":"vietnam_wards_by_province"}'::jsonb,
    options = '[]'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'intended_ward_commune';

UPDATE visa_form_fields
SET label = 'Do you have multiple nationalities?',
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"label_zh":"是否拥有多个国籍？","helper_zh":"如拥有多个国籍，请选择“是”并逐项补充。","helper_en":"Select Yes if you currently hold more than one nationality."}'::jsonb,
    display_order = 17,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'has_multiple_nationalities';

UPDATE visa_form_fields
SET display_order = 18,
    validation_rules = (COALESCE(validation_rules, '{}'::jsonb) - 'block_group')
      || '{"repeatable":true,"repeat_group":"multiple_nationalities","max_items":5,"label_zh":"其他国籍"}'::jsonb,
    conditional_logic = '{"showIf":"has_multiple_nationalities === yes"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'other_nationality';

UPDATE visa_form_fields
SET display_order = 19,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'has_violated_vietnam_laws';

UPDATE visa_form_fields
SET required = false,
    conditional_logic = '{"showIf":"has_violated_vietnam_laws === legacy_textarea"}'::jsonb,
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"label_zh":"越南违法记录说明（旧字段）"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'violation_of_vietnam_laws_details';

UPDATE visa_form_fields
SET display_order = 5,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'passport_issue_date';

UPDATE visa_form_fields
SET display_order = 6,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'passport_expiry_date';

UPDATE visa_form_fields
SET display_order = 16,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visited_vietnam_in_last_year';

UPDATE visa_form_fields
SET required = false,
    conditional_logic = '{"showIf":"visited_vietnam_in_last_year === legacy_textarea"}'::jsonb,
    validation_rules = COALESCE(validation_rules, '{}'::jsonb)
      || '{"label_zh":"过去一年访问越南说明（旧字段）"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'visited_vietnam_purpose_detail';

UPDATE visa_form_fields
SET display_order = 20,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'has_relatives_in_vietnam';

UPDATE visa_form_fields
SET display_order = CASE field_name
      WHEN 'relative_full_name' THEN 21
      WHEN 'relative_date_of_birth' THEN 22
      WHEN 'relative_nationality' THEN 23
      WHEN 'relative_relationship' THEN 24
      WHEN 'relative_residential_address' THEN 25
      ELSE display_order
    END,
    validation_rules = (COALESCE(validation_rules, '{}'::jsonb) - 'block_group')
      || '{"repeatable":true,"repeat_group":"relatives_in_vietnam","max_items":5}'::jsonb,
    conditional_logic = '{"showIf":"has_relatives_in_vietnam === yes"}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name IN (
    'relative_full_name',
    'relative_date_of_birth',
    'relative_nationality',
    'relative_relationship',
    'relative_residential_address'
  );

UPDATE visa_form_fields
SET display_order = CASE field_name
      WHEN 'bought_travel_insurance' THEN 2
      WHEN 'expense_coverage' THEN 4
      ELSE display_order
    END,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name IN ('bought_travel_insurance', 'expense_coverage');

WITH fields(field_name, label, field_type, required, step_number, step_name, display_order, placeholder, validation_rules, options, conditional_logic) AS (
  VALUES
    (
      'has_other_passports_used_for_vietnam',
      'Have you ever used any other passports to enter into Viet Nam?',
      'radio',
      true,
      1,
      'Personal Information',
      11,
      NULL,
      '{"label_zh":"是否曾使用其他护照进入越南？","helper_zh":"如曾使用其他护照入境越南，请选择“是”并补充护照信息。"}'::jsonb,
      '[{"value":"yes","text":"Yes","label_zh":"是","label_en":"Yes"},{"value":"no","text":"No","label_zh":"否","label_en":"No"}]'::jsonb,
      NULL
    ),
    (
      'other_vietnam_passport_number',
      'Passport',
      'text',
      true,
      1,
      'Personal Information',
      12,
      'Enter passport',
      '{"label_zh":"曾用于入境越南的其他护照号码","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"maxLength":9}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'other_vietnam_passport_full_name',
      'Full name',
      'text',
      true,
      1,
      'Personal Information',
      13,
      'Enter full name',
      '{"label_zh":"其他护照上的姓名","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"maxLength":120}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'other_vietnam_passport_date_of_birth',
      'Date of birth',
      'date',
      true,
      1,
      'Personal Information',
      14,
      'DD/MM/YYYY',
      '{"label_zh":"出生日期","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"allow_year_only":true}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'other_vietnam_passport_nationality',
      'Nationality',
      'country',
      true,
      1,
      'Personal Information',
      15,
      'Choose nationality',
      '{"label_zh":"国籍","repeatable":true,"repeat_group":"other_passports_used_for_vietnam","max_items":5,"source":"ISO3166-1"}'::jsonb,
      NULL,
      '{"showIf":"has_other_passports_used_for_vietnam === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_act',
      'Act of violation',
      'text',
      true,
      1,
      'Personal Information',
      20,
      'Enter act of violation',
      '{"label_zh":"违法行为","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_time',
      'Time of violation',
      'date',
      true,
      1,
      'Personal Information',
      21,
      'DD/MM/YYYY',
      '{"label_zh":"违法时间","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_sanction',
      'Form of sanction',
      'text',
      true,
      1,
      'Personal Information',
      22,
      'Enter form of sanction',
      '{"label_zh":"处罚形式","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'vietnam_law_violation_authority',
      'Authority imposed sanction',
      'text',
      true,
      1,
      'Personal Information',
      23,
      'Enter authority imposed sanction',
      '{"label_zh":"作出处罚的机关","repeatable":true,"repeat_group":"vietnam_law_violations","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_violated_vietnam_laws === yes"}'::jsonb
    ),
    (
      'passport_type_other_specify',
      'If “Others”, please specify',
      'text',
      true,
      3,
      'Passport Information',
      4,
      'Enter specify others type',
      '{"label_zh":"如选择“其他”，请说明","maxLength":120}'::jsonb,
      NULL,
      '{"showIf":"passport_type === other"}'::jsonb
    ),
    (
      'has_contact_in_vietnam',
      'Agency/Organization/Individual that the applicant plans to contact when enter into Viet Nam?',
      'radio',
      true,
      6,
      'Trip Information',
      11,
      NULL,
      '{"label_zh":"入境越南后计划联系的机构、组织或个人？"}'::jsonb,
      '[{"value":"yes","text":"Yes","label_zh":"是","label_en":"Yes"},{"value":"no","text":"No","label_zh":"否","label_en":"No"}]'::jsonb,
      NULL
    ),
    (
      'contact_hosting_organization_name',
      'Name of hosting organization',
      'text',
      true,
      6,
      'Trip Information',
      12,
      'Enter name of hosting organization',
      '{"label_zh":"接待机构/组织/个人名称","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'contact_hosting_organization_phone',
      'Telephone number',
      'text',
      true,
      6,
      'Trip Information',
      13,
      'Enter telephone number',
      '{"label_zh":"联系电话","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":40}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'contact_hosting_organization_address',
      'Address',
      'text',
      true,
      6,
      'Trip Information',
      14,
      'Enter address',
      '{"label_zh":"地址","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":300}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'contact_hosting_organization_purpose',
      'Purpose',
      'text',
      true,
      6,
      'Trip Information',
      15,
      'Enter purpose',
      '{"label_zh":"联系目的","repeatable":true,"repeat_group":"vietnam_contacts","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"has_contact_in_vietnam === yes"}'::jsonb
    ),
    (
      'visited_vietnam_from_date',
      'From date',
      'date',
      true,
      6,
      'Trip Information',
      17,
      'DD/MM/YYYY',
      '{"label_zh":"上次赴越开始日期","repeatable":true,"repeat_group":"visited_vietnam_last_year","max_items":5}'::jsonb,
      NULL,
      '{"showIf":"visited_vietnam_in_last_year === yes"}'::jsonb
    ),
    (
      'visited_vietnam_to_date',
      'To date',
      'date',
      true,
      6,
      'Trip Information',
      18,
      'DD/MM/YYYY',
      '{"label_zh":"上次赴越结束日期","repeatable":true,"repeat_group":"visited_vietnam_last_year","max_items":5,"not_before_field":"visited_vietnam_from_date"}'::jsonb,
      NULL,
      '{"showIf":"visited_vietnam_in_last_year === yes"}'::jsonb
    ),
    (
      'visited_vietnam_trip_purpose',
      'Purpose of trip',
      'text',
      true,
      6,
      'Trip Information',
      19,
      'Enter purpose',
      '{"label_zh":"上次赴越目的","repeatable":true,"repeat_group":"visited_vietnam_last_year","max_items":5,"maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"visited_vietnam_in_last_year === yes"}'::jsonb
    ),
    (
      'accompanying_child_portrait_photo',
      'Portrait photography',
      'file',
      true,
      7,
      'Accompanying Children',
      4,
      'Upload portrait photo',
      '{"label_zh":"同行儿童证件照片","repeatable":true,"repeat_group":"accompanying_children","max_items":10,"accept":[".jpg",".jpeg",".png"],"helper_zh":"官方表单要求每名同行儿童上传照片。"}'::jsonb,
      NULL,
      '{"showIf":"has_accompanying_children === yes"}'::jsonb
    ),
    (
      'travel_insurance_specify',
      'Specify',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      3,
      'Enter specify',
      '{"label_zh":"保险说明","maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"bought_travel_insurance === yes"}'::jsonb
    ),
    (
      'expense_payment_method',
      'Payment method',
      'select',
      true,
      8,
      'Travel Expenses and Insurance',
      5,
      'Choose one',
      '{"label_zh":"付款方式","live_dom_id":"basic_kpbhHinhThuc"}'::jsonb,
      '[{"value":"cash","text":"Cash","label_zh":"现金","label_en":"Cash"},{"value":"credit_card","text":"Credit card","label_zh":"信用卡","label_en":"Credit card"},{"value":"travellers_cheques","text":"Traveller''s cheques","label_zh":"旅行支票","label_en":"Traveller''s cheques"}]'::jsonb,
      '{"showIf":"expense_coverage === personal || expense_coverage === company"}'::jsonb
    ),
    (
      'expense_company_name',
      'Name of Company/Agency',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      6,
      'Enter name of Company/Agency',
      '{"label_zh":"承担费用的公司/机构名称","maxLength":200}'::jsonb,
      NULL,
      '{"showIf":"expense_coverage === company"}'::jsonb
    ),
    (
      'expense_company_address',
      'Address',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      7,
      'Enter address',
      '{"label_zh":"公司/机构地址","maxLength":300}'::jsonb,
      NULL,
      '{"showIf":"expense_coverage === company"}'::jsonb
    ),
    (
      'expense_company_telephone',
      'Telephone number',
      'text',
      true,
      8,
      'Travel Expenses and Insurance',
      8,
      'Enter telephone number',
      '{"label_zh":"公司/机构电话","maxLength":40}'::jsonb,
      NULL,
      '{"showIf":"expense_coverage === company"}'::jsonb
    )
)
INSERT INTO visa_form_fields (
  visa_type,
  field_name,
  label,
  field_type,
  required,
  step_number,
  step_name,
  display_order,
  placeholder,
  validation_rules,
  options,
  conditional_logic,
  created_at,
  updated_at
)
SELECT
  'VN_E_VISA',
  field_name,
  label,
  field_type,
  required,
  step_number,
  step_name,
  display_order,
  placeholder,
  validation_rules,
  options,
  conditional_logic,
  now(),
  now()
FROM fields
ON CONFLICT (visa_type, field_name)
DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  required = EXCLUDED.required,
  step_number = EXCLUDED.step_number,
  step_name = EXCLUDED.step_name,
  display_order = EXCLUDED.display_order,
  placeholder = EXCLUDED.placeholder,
  validation_rules = EXCLUDED.validation_rules,
  options = EXCLUDED.options,
  conditional_logic = EXCLUDED.conditional_logic,
  updated_at = now();

-- 20260625_vn_evisa_photo_face_rules.sql
-- Vietnam e-Visa photo, face-match, and passport-validity guardrails.

UPDATE visa_form_fields
SET validation_rules = COALESCE(validation_rules, '{}'::jsonb)
    || '{"min_days_after_field":"visa_valid_from","min_days_after_field_days":30}'::jsonb,
    updated_at = now()
WHERE visa_type = 'VN_E_VISA'
  AND field_name = 'passport_expiry_date';

WITH vn_requirements(requirement_key, metadata_patch, description_patch) AS (
  VALUES
    (
      'passport_copy',
      '{"document_type":"passport_copy","accept":[".jpg",".jpeg",".png",".webp"],"max_bytes":2097152,"requires_face":true,"face_match_role":"passport","source":"official_vietnam_evisa_portal"}'::jsonb,
      'Clear image of the passport bio-data page. The file must be JPG/JPEG/PNG/WEBP, under 2MB, and contain a detectable face for comparison with the portrait photo.'
    ),
    (
      'photo',
      '{"document_type":"photo","accept":[".jpg",".jpeg",".png",".webp"],"max_bytes":2097152,"requires_face":true,"face_match_role":"portrait","face_match_pair":"passport_copy","source":"official_vietnam_evisa_portal"}'::jsonb,
      'Recent front-facing portrait photo for the Vietnam e-Visa portal. The file must be under 2MB and match the face on the passport data page.'
    )
)
UPDATE document_requirements AS requirement
SET metadata = COALESCE(requirement.metadata, '{}'::jsonb) || vn_requirements.metadata_patch,
    description = vn_requirements.description_patch,
    required = true,
    updated_at = now()
FROM vn_requirements
WHERE lower(requirement.country) = 'vietnam'
  AND upper(requirement.visa_type) IN ('VN_E_VISA', 'EVISA_TOURISM')
  AND requirement.requirement_key = vn_requirements.requirement_key;

-- 20260718025937_vietnam_evisa_status_tracking_delivery.sql
-- Only explicitly activated, newly submitted Vietnam applications are tracked.

CREATE TABLE IF NOT EXISTS official_application_tracking (
  application_id UUID PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'VN' CHECK (country_code = 'VN'),
  provider TEXT NOT NULL DEFAULT 'vietnam_evisa',
  official_lookup_email TEXT NOT NULL,
  tracking_status TEXT NOT NULL DEFAULT 'active'
    CHECK (tracking_status IN ('active', 'completed', 'disabled')),
  daily_check_hour SMALLINT NOT NULL CHECK (daily_check_hour BETWEEN 0 AND 23),
  daily_check_minute SMALLINT NOT NULL CHECK (daily_check_minute BETWEEN 0 AND 59),
  next_daily_check_at TIMESTAMPTZ NOT NULL,
  last_daily_check_at TIMESTAMPTZ,
  last_successful_check_at TIMESTAMPTZ,
  last_email_message_id UUID REFERENCES inbound_email(id) ON DELETE SET NULL,
  last_known_status TEXT,
  last_artifact_hash TEXT,
  last_artifact_storage_path TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS official_application_tracking_due_idx
  ON official_application_tracking(tracking_status, next_daily_check_at);
CREATE INDEX IF NOT EXISTS official_application_tracking_applicant_idx
  ON official_application_tracking(applicant_id);
CREATE INDEX IF NOT EXISTS official_application_tracking_email_idx
  ON official_application_tracking(lower(official_lookup_email));

ALTER TABLE official_application_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE official_application_tracking FROM anon, authenticated;
GRANT ALL ON TABLE official_application_tracking TO service_role;

ALTER TABLE official_status_checks
  ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS inbound_email_id UUID REFERENCES inbound_email(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artifact_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS artifact_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS official_status_checks_idempotency_idx
  ON official_status_checks(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS official_status_checks_claim_idx
  ON official_status_checks(status, scheduled_for, created_at);

REVOKE ALL ON TABLE official_status_checks FROM anon, authenticated;
GRANT ALL ON TABLE official_status_checks TO service_role;

ALTER TABLE notification_event_log
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notification_event_log_idempotency_idx
  ON notification_event_log(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION enqueue_due_vn_official_status_checks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO official_status_checks (
    application_id, user_id, country_code, provider, status, requested_by,
    trigger_source, idempotency_key, scheduled_for, raw_status_json,
    created_at, updated_at
  )
  SELECT
    tracking.application_id,
    tracking.auth_user_id,
    tracking.country_code,
    tracking.provider,
    'queued',
    'system',
    'daily',
    'vn:daily:' || tracking.application_id::text || ':' ||
      to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'),
    now(),
    jsonb_build_object(
      'source', 'scheduled_daily',
      'vietnam_date', to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
    ),
    now(),
    now()
  FROM official_application_tracking tracking
  WHERE tracking.tracking_status = 'active'
    AND tracking.next_daily_check_at <= now()
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE official_application_tracking tracking
  SET
    last_daily_check_at = now(),
    next_daily_check_at = (
      date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
      + interval '1 day'
      + make_interval(
          hours => tracking.daily_check_hour,
          mins => tracking.daily_check_minute
        )
    ) AT TIME ZONE 'Asia/Ho_Chi_Minh',
    updated_at = now()
  WHERE tracking.tracking_status = 'active'
    AND tracking.next_daily_check_at <= now();

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_due_vn_official_status_checks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_due_vn_official_status_checks() TO service_role;

CREATE OR REPLACE FUNCTION claim_vn_official_status_checks(p_limit INTEGER DEFAULT 5)
RETURNS SETOF official_status_checks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE official_status_checks checks
  SET
    status = 'running',
    started_at = now(),
    attempt_count = checks.attempt_count + 1,
    updated_at = now()
  WHERE checks.id IN (
    SELECT candidate.id
    FROM official_status_checks candidate
    WHERE candidate.country_code = 'VN'
      AND candidate.status = 'queued'
      AND candidate.scheduled_for <= now()
    ORDER BY candidate.scheduled_for ASC, candidate.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 5), 20))
  )
  RETURNING checks.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_vn_official_status_checks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_vn_official_status_checks(INTEGER) TO service_role;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid
    INTO existing_job_id
    FROM cron.job
    WHERE jobname = 'viza-vn-evisa-status-every-15m'
    LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'viza-vn-evisa-status-every-15m',
      '*/15 * * * *',
      'SELECT enqueue_due_vn_official_status_checks();'
    );
  END IF;
END
$$;
