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
