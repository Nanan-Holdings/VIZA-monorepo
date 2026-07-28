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
