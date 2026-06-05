-- U.S. B1/B2 appointment assistance framework.
--
-- This schema is human-in-the-loop and dry-run-first. It must not store raw
-- cookies, browser storage state, CAPTCHA answers, CVV/card data, plaintext
-- appointment-portal passwords, passport numbers, or unredacted official-site
-- payloads.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS appointment_assistance_status TEXT DEFAULT 'appointment_not_started',
  ADD COLUMN IF NOT EXISTS appointment_assistance_job_id UUID,
  ADD COLUMN IF NOT EXISTS appointment_confirmation_id UUID;

CREATE INDEX IF NOT EXISTS applications_appointment_status_idx
  ON applications(appointment_assistance_status);
CREATE INDEX IF NOT EXISTS applications_appointment_job_idx
  ON applications(appointment_assistance_job_id);

CREATE TABLE IF NOT EXISTS appointment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  portal TEXT NOT NULL,
  account_email TEXT,
  encrypted_account_password TEXT,
  password_vault_ref TEXT,
  account_status TEXT NOT NULL DEFAULT 'not_created',
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  metadata_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_accounts_user_idx
  ON appointment_accounts(user_id);
CREATE INDEX IF NOT EXISTS appointment_accounts_application_idx
  ON appointment_accounts(application_id);
CREATE INDEX IF NOT EXISTS appointment_accounts_status_idx
  ON appointment_accounts(account_status);

CREATE TABLE IF NOT EXISTS appointment_assistance_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  appointment_account_id UUID REFERENCES appointment_accounts(id) ON DELETE SET NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  visa_type TEXT NOT NULL DEFAULT 'B1/B2',
  ds160_confirmation_code TEXT,
  applying_country_code TEXT,
  applying_post_city TEXT,
  scheduling_provider TEXT,
  status TEXT NOT NULL DEFAULT 'appointment_not_started',
  mode TEXT NOT NULL DEFAULT 'dry_run',
  user_preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_user_action BOOLEAN DEFAULT false,
  current_manual_action TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_assistance_jobs_application_idx
  ON appointment_assistance_jobs(application_id);
CREATE INDEX IF NOT EXISTS appointment_assistance_jobs_user_idx
  ON appointment_assistance_jobs(user_id);
CREATE INDEX IF NOT EXISTS appointment_assistance_jobs_status_idx
  ON appointment_assistance_jobs(status);
CREATE INDEX IF NOT EXISTS appointment_assistance_jobs_provider_idx
  ON appointment_assistance_jobs(scheduling_provider);
CREATE INDEX IF NOT EXISTS appointment_assistance_jobs_idempotency_idx
  ON appointment_assistance_jobs(idempotency_key);

CREATE TABLE IF NOT EXISTS appointment_assistance_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES appointment_assistance_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  mode TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  request_snapshot_redacted_json JSONB,
  result_snapshot_redacted_json JSONB,
  error_code TEXT,
  error_message TEXT,
  screenshot_url TEXT,
  trace_url TEXT,
  video_url TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_attempts_job_number_idx
  ON appointment_assistance_attempts(job_id, attempt_number);
CREATE INDEX IF NOT EXISTS appointment_attempts_application_idx
  ON appointment_assistance_attempts(application_id);
CREATE INDEX IF NOT EXISTS appointment_attempts_status_idx
  ON appointment_assistance_attempts(status);

CREATE TABLE IF NOT EXISTS appointment_manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES appointment_assistance_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  instruction TEXT,
  user_input_schema_json JSONB,
  user_input_redacted_json JSONB,
  screenshot_url TEXT,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata_redacted_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_manual_actions_job_idx
  ON appointment_manual_actions(job_id);
CREATE INDEX IF NOT EXISTS appointment_manual_actions_status_idx
  ON appointment_manual_actions(status);
CREATE INDEX IF NOT EXISTS appointment_manual_actions_application_idx
  ON appointment_manual_actions(application_id);
CREATE INDEX IF NOT EXISTS appointment_manual_actions_type_idx
  ON appointment_manual_actions(action_type);

CREATE TABLE IF NOT EXISTS appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES appointment_assistance_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  appointment_date DATE,
  appointment_time TEXT,
  appointment_location TEXT,
  appointment_type TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'observed',
  observed_at TIMESTAMPTZ DEFAULT now(),
  metadata_redacted_json JSONB
);

CREATE INDEX IF NOT EXISTS appointment_slots_job_idx
  ON appointment_slots(job_id);
CREATE INDEX IF NOT EXISTS appointment_slots_observed_at_idx
  ON appointment_slots(observed_at DESC);
CREATE INDEX IF NOT EXISTS appointment_slots_application_idx
  ON appointment_slots(application_id);
CREATE INDEX IF NOT EXISTS appointment_slots_status_idx
  ON appointment_slots(status);

CREATE TABLE IF NOT EXISTS appointment_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES appointment_assistance_jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  visa_type TEXT NOT NULL DEFAULT 'B1/B2',
  appointment_date DATE,
  appointment_time TEXT,
  appointment_location TEXT,
  appointment_type TEXT,
  confirmation_number TEXT,
  confirmation_pdf_url TEXT,
  confirmation_screenshot_url TEXT,
  raw_confirmation_redacted_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_confirmations_application_idx
  ON appointment_confirmations(application_id);
CREATE INDEX IF NOT EXISTS appointment_confirmations_job_idx
  ON appointment_confirmations(job_id);
CREATE INDEX IF NOT EXISTS appointment_confirmations_user_idx
  ON appointment_confirmations(user_id);

CREATE TABLE IF NOT EXISTS appointment_status_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES appointment_assistance_jobs(id) ON DELETE SET NULL,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL,
  checked_at TIMESTAMPTZ DEFAULT now(),
  result_redacted_json JSONB,
  screenshot_url TEXT,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS appointment_status_checks_job_idx
  ON appointment_status_checks(job_id);
CREATE INDEX IF NOT EXISTS appointment_status_checks_application_idx
  ON appointment_status_checks(application_id);
CREATE INDEX IF NOT EXISTS appointment_status_checks_user_checked_idx
  ON appointment_status_checks(user_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS appointment_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  application_id UUID,
  user_id UUID,
  event_type TEXT NOT NULL,
  event_message TEXT,
  metadata_redacted_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_audit_events_job_idx
  ON appointment_audit_events(job_id);
CREATE INDEX IF NOT EXISTS appointment_audit_events_application_idx
  ON appointment_audit_events(application_id);
CREATE INDEX IF NOT EXISTS appointment_audit_events_user_idx
  ON appointment_audit_events(user_id);
CREATE INDEX IF NOT EXISTS appointment_audit_events_type_idx
  ON appointment_audit_events(event_type);
CREATE INDEX IF NOT EXISTS appointment_audit_events_created_idx
  ON appointment_audit_events(created_at DESC);

ALTER TABLE appointment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_assistance_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_assistance_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_manual_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_accounts'
      AND policyname = 'appointment_accounts_service'
  ) THEN
    CREATE POLICY appointment_accounts_service ON appointment_accounts
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_assistance_jobs'
      AND policyname = 'appointment_assistance_jobs_service'
  ) THEN
    CREATE POLICY appointment_assistance_jobs_service ON appointment_assistance_jobs
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_assistance_attempts'
      AND policyname = 'appointment_assistance_attempts_service'
  ) THEN
    CREATE POLICY appointment_assistance_attempts_service ON appointment_assistance_attempts
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_manual_actions'
      AND policyname = 'appointment_manual_actions_service'
  ) THEN
    CREATE POLICY appointment_manual_actions_service ON appointment_manual_actions
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_slots'
      AND policyname = 'appointment_slots_service'
  ) THEN
    CREATE POLICY appointment_slots_service ON appointment_slots
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_confirmations'
      AND policyname = 'appointment_confirmations_service'
  ) THEN
    CREATE POLICY appointment_confirmations_service ON appointment_confirmations
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_status_checks'
      AND policyname = 'appointment_status_checks_service'
  ) THEN
    CREATE POLICY appointment_status_checks_service ON appointment_status_checks
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointment_audit_events'
      AND policyname = 'appointment_audit_events_service'
  ) THEN
    CREATE POLICY appointment_audit_events_service ON appointment_audit_events
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
