-- Internal website automation database refinements.
-- This follow-up keeps 0013 intact while adding durable package coverage,
-- government-fee rules, data-rights retention jobs, and lookup indexes for
-- website-owned automation flows. It deliberately stores no official runner
-- artifacts, raw provider credentials, or full card data.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS automation_stage TEXT DEFAULT 'intake',
  ADD COLUMN IF NOT EXISTS automation_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS automation_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS consent_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS documents_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS notification_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS coverage_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS staff_review_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS staff_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_reviewed_by UUID;

ALTER TABLE application_documents
  ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS automation_notes TEXT,
  ADD COLUMN IF NOT EXISTS required_by_visa_package_id UUID REFERENCES visa_packages(id),
  ADD COLUMN IF NOT EXISTS latest_ocr_extraction_id UUID,
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_payload_digest TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE invoice_requests
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS request_reference TEXT,
  ADD COLUMN IF NOT EXISTS requested_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE refund_records
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS request_reference TEXT,
  ADD COLUMN IF NOT EXISTS provider_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS requested_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE consent_events
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS consent_scope JSONB,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE application_signatures
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS signature_scope JSONB,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE application_packets
  ADD COLUMN IF NOT EXISTS manifest_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS handoff_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS handoff_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_by UUID,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

ALTER TABLE application_events
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website_automation',
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE data_privacy_requests
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id),
  ADD COLUMN IF NOT EXISTS request_reference TEXT,
  ADD COLUMN IF NOT EXISTS requested_payload JSONB,
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS decision TEXT,
  ADD COLUMN IF NOT EXISTS decision_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS export_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_notes TEXT;

CREATE TABLE IF NOT EXISTS coverage_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_package_id UUID REFERENCES visa_packages(id) ON DELETE SET NULL,
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  schema_status TEXT NOT NULL DEFAULT 'unsupported',
  document_checklist_status TEXT NOT NULL DEFAULT 'unsupported',
  payment_status TEXT NOT NULL DEFAULT 'unsupported',
  packet_status TEXT NOT NULL DEFAULT 'unsupported',
  external_handoff_status TEXT NOT NULL DEFAULT 'unsupported',
  result_ingest_status TEXT NOT NULL DEFAULT 'unsupported',
  status_ui_status TEXT NOT NULL DEFAULT 'unsupported',
  customer_visible BOOLEAN NOT NULL DEFAULT false,
  promise_label TEXT,
  notes TEXT,
  metadata JSONB,
  last_verified_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coverage_matrix_package_uidx
  ON coverage_matrix(visa_package_id)
  WHERE visa_package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS coverage_matrix_country_visa_idx
  ON coverage_matrix(country, visa_type);
CREATE INDEX IF NOT EXISTS coverage_matrix_customer_visible_idx
  ON coverage_matrix(customer_visible);
CREATE INDEX IF NOT EXISTS coverage_matrix_status_lookup_idx
  ON coverage_matrix(schema_status, document_checklist_status, payment_status, packet_status);

CREATE TABLE IF NOT EXISTS government_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_package_id UUID REFERENCES visa_packages(id) ON DELETE SET NULL,
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  fee_type TEXT NOT NULL DEFAULT 'government_fee',
  mode TEXT NOT NULL DEFAULT 'display_only',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  label TEXT,
  payer TEXT NOT NULL DEFAULT 'applicant',
  collection_method TEXT NOT NULL DEFAULT 'official_portal',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  source_url TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS government_fee_rules_package_idx
  ON government_fee_rules(visa_package_id);
CREATE INDEX IF NOT EXISTS government_fee_rules_country_visa_idx
  ON government_fee_rules(country, visa_type);
CREATE INDEX IF NOT EXISTS government_fee_rules_mode_idx
  ON government_fee_rules(mode);
CREATE INDEX IF NOT EXISTS government_fee_rules_effective_lookup_idx
  ON government_fee_rules(country, visa_type, fee_type, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS pii_retention_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_privacy_request_id UUID REFERENCES data_privacy_requests(id) ON DELETE SET NULL,
  applicant_id UUID,
  auth_user_id UUID,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retention_reason TEXT,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pii_retention_jobs_request_idx
  ON pii_retention_jobs(data_privacy_request_id);
CREATE INDEX IF NOT EXISTS pii_retention_jobs_applicant_idx
  ON pii_retention_jobs(applicant_id);
CREATE INDEX IF NOT EXISTS pii_retention_jobs_auth_user_idx
  ON pii_retention_jobs(auth_user_id);
CREATE INDEX IF NOT EXISTS pii_retention_jobs_application_idx
  ON pii_retention_jobs(application_id);
CREATE INDEX IF NOT EXISTS pii_retention_jobs_status_idx
  ON pii_retention_jobs(status);
CREATE INDEX IF NOT EXISTS pii_retention_jobs_schedule_idx
  ON pii_retention_jobs(status, scheduled_for);

ALTER TABLE coverage_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii_retention_jobs ENABLE ROW LEVEL SECURITY;

-- Service-role-only by default. Customer/admin access should go through
-- authenticated server actions that enforce VIZA authorization rules.

CREATE INDEX IF NOT EXISTS applications_applicant_status_idx
  ON applications(applicant_id, status);
CREATE INDEX IF NOT EXISTS applications_visa_package_idx
  ON applications(visa_package_id);
CREATE INDEX IF NOT EXISTS applications_automation_status_idx
  ON applications(automation_status);
CREATE INDEX IF NOT EXISTS applications_automation_stage_idx
  ON applications(automation_stage);
CREATE INDEX IF NOT EXISTS applications_payment_status_idx
  ON applications(payment_status);
CREATE INDEX IF NOT EXISTS applications_packet_status_idx
  ON applications(packet_status);
CREATE INDEX IF NOT EXISTS applications_external_status_idx
  ON applications(external_status);
CREATE INDEX IF NOT EXISTS applications_staff_review_status_idx
  ON applications(staff_review_status);

CREATE INDEX IF NOT EXISTS application_documents_application_status_idx
  ON application_documents(application_id, status);
CREATE INDEX IF NOT EXISTS application_documents_requirement_idx
  ON application_documents(application_id, requirement_key);
CREATE INDEX IF NOT EXISTS application_documents_automation_status_idx
  ON application_documents(automation_status);
CREATE INDEX IF NOT EXISTS application_documents_required_package_idx
  ON application_documents(required_by_visa_package_id);
CREATE INDEX IF NOT EXISTS application_documents_hash_idx
  ON application_documents(document_hash);

CREATE INDEX IF NOT EXISTS payment_records_status_idx
  ON payment_records(status);
CREATE INDEX IF NOT EXISTS payment_records_provider_payment_idx
  ON payment_records(provider_payment_id);
CREATE INDEX IF NOT EXISTS payment_records_provider_event_idx
  ON payment_records(provider_event_id);
CREATE INDEX IF NOT EXISTS payment_records_app_status_idx
  ON payment_records(application_id, status);
CREATE INDEX IF NOT EXISTS payment_records_auth_user_idx
  ON payment_records(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_records_idempotency_key_idx
  ON payment_records(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_requests_application_idx
  ON invoice_requests(application_id);
CREATE INDEX IF NOT EXISTS invoice_requests_applicant_idx
  ON invoice_requests(applicant_id);
CREATE INDEX IF NOT EXISTS invoice_requests_auth_user_idx
  ON invoice_requests(auth_user_id);
CREATE INDEX IF NOT EXISTS invoice_requests_payment_record_idx
  ON invoice_requests(payment_record_id);
CREATE INDEX IF NOT EXISTS invoice_requests_status_idx
  ON invoice_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_requests_reference_idx
  ON invoice_requests(request_reference)
  WHERE request_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS refund_records_application_idx
  ON refund_records(application_id);
CREATE INDEX IF NOT EXISTS refund_records_applicant_idx
  ON refund_records(applicant_id);
CREATE INDEX IF NOT EXISTS refund_records_auth_user_idx
  ON refund_records(auth_user_id);
CREATE INDEX IF NOT EXISTS refund_records_payment_record_idx
  ON refund_records(payment_record_id);
CREATE INDEX IF NOT EXISTS refund_records_status_idx
  ON refund_records(status);
CREATE INDEX IF NOT EXISTS refund_records_provider_refund_idx
  ON refund_records(provider_refund_id);
CREATE UNIQUE INDEX IF NOT EXISTS refund_records_reference_idx
  ON refund_records(request_reference)
  WHERE request_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS refund_records_idempotency_key_idx
  ON refund_records(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS consent_events_applicant_idx
  ON consent_events(applicant_id);
CREATE INDEX IF NOT EXISTS consent_events_auth_user_idx
  ON consent_events(auth_user_id);
CREATE INDEX IF NOT EXISTS consent_events_lookup_idx
  ON consent_events(application_id, consent_type, version);
CREATE UNIQUE INDEX IF NOT EXISTS consent_events_idempotency_key_idx
  ON consent_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS application_signatures_applicant_idx
  ON application_signatures(applicant_id);
CREATE INDEX IF NOT EXISTS application_signatures_auth_user_idx
  ON application_signatures(auth_user_id);
CREATE INDEX IF NOT EXISTS application_signatures_lookup_idx
  ON application_signatures(application_id, signature_type);
CREATE UNIQUE INDEX IF NOT EXISTS application_signatures_idempotency_key_idx
  ON application_signatures(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_requirements_country_visa_idx
  ON document_requirements(country, visa_type, sort_order);

CREATE INDEX IF NOT EXISTS application_packets_applicant_idx
  ON application_packets(applicant_id);
CREATE INDEX IF NOT EXISTS application_packets_status_idx
  ON application_packets(status);
CREATE INDEX IF NOT EXISTS application_packets_app_status_idx
  ON application_packets(application_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS application_packets_handoff_hash_idx
  ON application_packets(handoff_token_hash)
  WHERE handoff_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS application_events_applicant_idx
  ON application_events(applicant_id);
CREATE INDEX IF NOT EXISTS application_events_auth_user_idx
  ON application_events(auth_user_id);
CREATE INDEX IF NOT EXISTS application_events_type_idx
  ON application_events(event_type);
CREATE INDEX IF NOT EXISTS application_events_lookup_idx
  ON application_events(application_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS application_events_visibility_idx
  ON application_events(visibility);
CREATE UNIQUE INDEX IF NOT EXISTS application_events_idempotency_key_idx
  ON application_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_events_applicant_idx
  ON notification_events(applicant_id);
CREATE INDEX IF NOT EXISTS notification_events_auth_user_idx
  ON notification_events(auth_user_id);
CREATE INDEX IF NOT EXISTS notification_events_status_idx
  ON notification_events(status);
CREATE INDEX IF NOT EXISTS notification_events_app_status_idx
  ON notification_events(application_id, status);
CREATE INDEX IF NOT EXISTS notification_events_template_status_idx
  ON notification_events(template_key, status);
CREATE INDEX IF NOT EXISTS notification_events_provider_message_idx
  ON notification_events(provider_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS notification_events_idempotency_key_idx
  ON notification_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ocr_extractions_applicant_idx
  ON ocr_extractions(applicant_id);
CREATE INDEX IF NOT EXISTS ocr_extractions_document_idx
  ON ocr_extractions(document_id);
CREATE INDEX IF NOT EXISTS ocr_extractions_status_idx
  ON ocr_extractions(status);
CREATE INDEX IF NOT EXISTS ocr_extractions_app_status_idx
  ON ocr_extractions(application_id, status);

CREATE INDEX IF NOT EXISTS data_privacy_requests_application_idx
  ON data_privacy_requests(application_id);
CREATE INDEX IF NOT EXISTS data_privacy_requests_applicant_idx
  ON data_privacy_requests(applicant_id);
CREATE INDEX IF NOT EXISTS data_privacy_requests_auth_user_idx
  ON data_privacy_requests(auth_user_id);
CREATE INDEX IF NOT EXISTS data_privacy_requests_status_idx
  ON data_privacy_requests(status);
CREATE INDEX IF NOT EXISTS data_privacy_requests_type_status_idx
  ON data_privacy_requests(request_type, status);
CREATE UNIQUE INDEX IF NOT EXISTS data_privacy_requests_reference_idx
  ON data_privacy_requests(request_reference)
  WHERE request_reference IS NOT NULL;

INSERT INTO coverage_matrix (
  visa_package_id,
  country,
  visa_type,
  schema_status,
  document_checklist_status,
  payment_status,
  packet_status,
  external_handoff_status,
  result_ingest_status,
  status_ui_status,
  metadata
)
SELECT
  vp.id,
  vp.country,
  vp.visa_type,
  CASE WHEN jsonb_typeof(vp.metadata #> '{coverage,schema}') = 'boolean'
    THEN CASE WHEN (vp.metadata #>> '{coverage,schema}')::boolean THEN 'supported' ELSE 'unsupported' END
    ELSE 'unsupported'
  END,
  CASE WHEN jsonb_typeof(vp.metadata #> '{coverage,documents}') = 'boolean'
    THEN CASE WHEN (vp.metadata #>> '{coverage,documents}')::boolean THEN 'supported' ELSE 'unsupported' END
    ELSE 'unsupported'
  END,
  CASE WHEN jsonb_typeof(vp.metadata #> '{coverage,payment}') = 'boolean'
    THEN CASE WHEN (vp.metadata #>> '{coverage,payment}')::boolean THEN 'supported' ELSE 'unsupported' END
    ELSE 'unsupported'
  END,
  CASE WHEN jsonb_typeof(vp.metadata #> '{coverage,packet}') = 'boolean'
    THEN CASE WHEN (vp.metadata #>> '{coverage,packet}')::boolean THEN 'supported' ELSE 'unsupported' END
    ELSE 'unsupported'
  END,
  CASE WHEN jsonb_typeof(vp.metadata #> '{coverage,external_submission}') = 'boolean'
    THEN CASE WHEN (vp.metadata #>> '{coverage,external_submission}')::boolean THEN 'supported' ELSE 'unsupported' END
    ELSE 'unsupported'
  END,
  CASE WHEN jsonb_typeof(vp.metadata #> '{coverage,result_delivery}') = 'boolean'
    THEN CASE WHEN (vp.metadata #>> '{coverage,result_delivery}')::boolean THEN 'supported' ELSE 'unsupported' END
    ELSE 'unsupported'
  END,
  CASE WHEN jsonb_typeof(vp.metadata #> '{coverage,status_ui}') = 'boolean'
    THEN CASE WHEN (vp.metadata #>> '{coverage,status_ui}')::boolean THEN 'supported' ELSE 'unsupported' END
    ELSE 'unsupported'
  END,
  COALESCE(vp.metadata -> 'coverage', '{}'::jsonb)
FROM visa_packages vp
WHERE NOT EXISTS (
  SELECT 1
  FROM coverage_matrix cm
  WHERE cm.visa_package_id = vp.id
);

INSERT INTO government_fee_rules (
  visa_package_id,
  country,
  visa_type,
  fee_type,
  mode,
  amount_cents,
  currency,
  label,
  payer,
  collection_method,
  source_url,
  notes,
  metadata
)
SELECT
  vp.id,
  vp.country,
  vp.visa_type,
  'government_fee',
  COALESCE(vp.metadata #>> '{government_fee,mode}', 'display_only'),
  CASE
    WHEN jsonb_typeof(vp.metadata #> '{government_fee,amount_cents}') = 'number'
      THEN (vp.metadata #>> '{government_fee,amount_cents}')::integer
    ELSE 0
  END,
  COALESCE(vp.metadata #>> '{government_fee,currency}', vp.currency, 'USD'),
  COALESCE(vp.metadata #>> '{government_fee,label}', 'Government fee handled outside VIZA Checkout'),
  COALESCE(vp.metadata #>> '{government_fee,payer}', 'applicant'),
  COALESCE(vp.metadata #>> '{government_fee,collection_method}', 'official_portal'),
  vp.metadata #>> '{government_fee,source_url}',
  'Backfilled from visa_packages.metadata.government_fee; verify before customer-facing fee promises.',
  COALESCE(vp.metadata -> 'government_fee', '{}'::jsonb)
FROM visa_packages vp
WHERE NOT EXISTS (
  SELECT 1
  FROM government_fee_rules gfr
  WHERE gfr.visa_package_id = vp.id
    AND gfr.fee_type = 'government_fee'
);
