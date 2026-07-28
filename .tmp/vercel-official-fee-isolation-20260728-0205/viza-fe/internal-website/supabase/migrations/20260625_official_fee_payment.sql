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
