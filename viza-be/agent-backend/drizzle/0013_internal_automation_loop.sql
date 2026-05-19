-- Internal website automation loop.
-- This migration deliberately does not add browser-runner or official portal
-- automation. It supports VIZA-owned payment, consent, document, packet,
-- external status ingest, and customer/staff visibility.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS packet_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS packet_manifest JSONB,
  ADD COLUMN IF NOT EXISTS packet_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS packet_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_status TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS external_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS result_status TEXT,
  ADD COLUMN IF NOT EXISTS result_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS result_notes TEXT,
  ADD COLUMN IF NOT EXISTS government_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS government_fee_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS government_fee_mode TEXT DEFAULT 'display_only';

ALTER TABLE application_documents
  ADD COLUMN IF NOT EXISTS requirement_key TEXT,
  ADD COLUMN IF NOT EXISTS required BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

CREATE UNIQUE INDEX IF NOT EXISTS application_documents_app_type_idx
  ON application_documents(application_id, document_type);

CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  applicant_id UUID,
  visa_package_id UUID REFERENCES visa_packages(id),
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_session_id TEXT,
  provider_payment_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  fee_type TEXT NOT NULL DEFAULT 'agency_fee',
  receipt_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_records_application_idx
  ON payment_records(application_id);
CREATE INDEX IF NOT EXISTS payment_records_applicant_idx
  ON payment_records(applicant_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_records_provider_session_idx
  ON payment_records(provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_record_id UUID REFERENCES payment_records(id),
  application_id UUID REFERENCES applications(id),
  applicant_id UUID,
  invoice_name TEXT,
  tax_identifier TEXT,
  billing_email TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_record_id UUID REFERENCES payment_records(id),
  application_id UUID REFERENCES applications(id),
  applicant_id UUID,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'requested',
  reason TEXT,
  policy_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  applicant_id UUID,
  consent_type TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  user_agent TEXT,
  document_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_events_application_idx
  ON consent_events(application_id);

CREATE TABLE IF NOT EXISTS application_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  applicant_id UUID,
  signature_type TEXT NOT NULL DEFAULT 'agency_authorisation',
  signer_name TEXT NOT NULL,
  signature_text TEXT,
  signed_document_path TEXT,
  document_hash TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_signatures_application_idx
  ON application_signatures(application_id);

CREATE TABLE IF NOT EXISTS document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_package_id UUID REFERENCES visa_packages(id),
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  requirement_key TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_zh TEXT NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_requirements_package_key_idx
  ON document_requirements(visa_package_id, requirement_key)
  WHERE visa_package_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS application_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  applicant_id UUID,
  status TEXT NOT NULL DEFAULT 'ready',
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_path TEXT,
  handoff_token TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_packets_application_idx
  ON application_packets(application_id);

CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  applicant_id UUID,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id UUID,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_events_application_idx
  ON application_events(application_id);

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  applicant_id UUID,
  channel TEXT NOT NULL DEFAULT 'email',
  template_key TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_events_application_idx
  ON notification_events(application_id);

CREATE TABLE IF NOT EXISTS ocr_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  applicant_id UUID,
  document_id UUID REFERENCES application_documents(id),
  provider TEXT NOT NULL DEFAULT 'openai_vision',
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ocr_extractions_application_idx
  ON ocr_extractions(application_id);

CREATE TABLE IF NOT EXISTS data_privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  notes TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_requirements_select" ON document_requirements
  FOR SELECT TO authenticated USING (true);

-- Keep all private automation tables service-role only by default. Frontend
-- access goes through server actions or admin-authenticated pages.

UPDATE visa_packages
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'coverage', jsonb_build_object(
    'schema', true,
    'documents', true,
    'payment', true,
    'packet', true,
    'external_submission', true,
    'result_delivery', true
  ),
  'government_fee', jsonb_build_object(
    'mode', 'display_only',
    'currency', COALESCE(currency, 'USD'),
    'amount_cents', 0,
    'label', 'Government fee handled outside VIZA Checkout'
  )
)
WHERE country IN ('united_states', 'france')
   OR visa_type IN ('B1_B2', 'schengen_short_stay_tourism', 'EU_SCHENGEN_C_SHORT_STAY');
