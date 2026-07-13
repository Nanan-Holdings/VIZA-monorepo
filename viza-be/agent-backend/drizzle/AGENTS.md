# Agent Backend Migrations Guide

Scope: this file applies to `viza-be/agent-backend/drizzle/**`.

## Purpose

This directory owns sequential SQL migrations for the agent backend Supabase
database.

## Key Responsibilities

- Keep migration filenames sequentially numbered.
- Make migrations idempotent where practical with `IF NOT EXISTS` and
  `ADD COLUMN IF NOT EXISTS`.
- Update `src/db/schema.ts` when SQL migrations add tables or columns that
  TypeScript code uses.
- Keep service-role-only tables behind RLS unless a clear authenticated policy
  is required.

## Internal Automation Tables

The website automation loop uses:

- `payment_records`
- `invoice_requests`
- `refund_records`
- `consent_events`
- `application_signatures`
- `document_requirements`
- `application_packets`
- `application_events`
- `notification_events`
- `ocr_extractions`
- `data_privacy_requests`
- `coverage_matrix`
- `government_fee_rules`
- `pii_retention_jobs`

The current internal automation migrations are:

- `0013_internal_automation_loop.sql`: first website automation tables and
  application/application document columns.
- `0014_internal_automation_db_refinements.sql`: coverage matrix,
  government-fee rules, retention jobs, data-rights columns, and lookup
  indexes.
- `0087_application_documents_bucket.sql`: private
  `application-documents` Storage bucket and user-prefix object policies.
- `0088_travel_destination_index.sql`: Travel AI destination index, aliases,
  lazy cards, itinerary session archive, and unresolved destination queue.
- `0089_official_fee_payment.sql`: official visa fee quote, consent-linked
  intent, attempt, receipt, instrument abstraction, reconciliation, and
  application-level official-fee status columns.
- `0090_applicant_profile_bilingual_fields.sql`: applicant profile Chinese and
  English value columns used by bilingual filling UI.
- `0091_us_appointment_assistant.sql`: U.S. appointment assistant tables,
  application-level appointment columns, RLS, service-role policies, and
  lookup indexes.
- `0092_travel_local_first_enrichment.sql`: local-first Travel destination
  localization fields, attraction/assets tables, destination-card source
  metadata, and enrichment job/event history.
- `0093_ds160_live_assisted_controls.sql`: DS-160 live assisted queue/job,
  encrypted official retrieval fields, review snapshot/diff tables, and manual
  checkpoint tables. Dry-run remains the default and final applicant
  Sign/Submit remains outside automation.
- `0094_vn_evisa_documents_and_labels.sql`: Vietnam e-Visa package document
  requirements and bilingual label metadata so the app uses official materials
  instead of generic fallback requirements.
- `0095_france_live_assisted_controls.sql`: France-Visas live assisted queue
  fields and manual checkpoint table. Dry-run remains default and final
  validation, payment, and appointment booking remain applicant-controlled.
- `0096_vietnam_live_assisted_controls.sql`: Vietnam e-Visa live-assisted
  queue stage/heartbeat fields, encrypted registration-code storage, and manual
  checkpoint table. CAPTCHA, payment, and final submit remain manual.
- `0097_ds160_live_queue_compat.sql`: DS-160 queue-level confirmation URL
  fields and a compatibility live-session table for encrypted official
  identifiers. CAPTCHA and final Sign/Submit remain manual.
- `0098_sg_arrival_card_package.sql`: Singapore SG Arrival Card package catalog
  row. It is separate from Singapore Visit Visa / SAVE.
- `0099_vietnam_payment_status_tracking.sql`: Vietnam official-fee queue links
  and redacted official status check history for applicant status refreshes.
- `0100_mdac_tdac_arrival_card_packages.sql`: Malaysia MDAC and Thailand TDAC
  package catalog rows. They are separate from eVisa/tourist visa workflows.
- `0101_vn_evisa_official_form_parity.sql`: Vietnam e-Visa official portal
  form parity fields, conditional tables, ward/commune metadata hooks, and
  official date/expense/insurance validation rules.
- `0102_vn_evisa_photo_face_rules.sql`: Vietnam e-Visa photo/passport upload
  metadata, 2MB official image limits, face-match hints, and passport expiry
  validity relative to the e-Visa start date.
- `0104_ph_etravel_accounts.sql`: Philippines eTravel/eGovPH official account
  records, reused per applicant before creating a new VIZA inbox-alias account.
- `0095_universal_profile_documents.sql`: reusable Universal Profile passport
  document records, creation-time application profile snapshots, and answer
  source metadata for profile autofill provenance.
- `0105_submission_queue_claim_locks.sql`: legacy `submission_queue` claim
  leases and service-role RPC using `FOR UPDATE SKIP LOCKED` for horizontally
  scaled submission-service workers.
- `0107_indonesia_official_evisa_packages.sql`: Indonesia C1 and B1 official
  eVisa package catalog rows and provider metadata.
- `0108_indonesia_b1_evoa_document_requirements.sql`: Indonesia B1 e-VoA
  official document checklist, replacing the generic proof-of-funds fallback
  with passport/photo, return-or-onward ticket, and passport-validity support
  materials.
- `0109_taiwan_overseas_cn_tourism_entry_permit.sql`: Taiwan package catalog
  and official document requirements for mainland Chinese passport holders
  resident in Singapore; keep it separate from Taiwan arrival-card concepts.

## Guardrails

- Do not add final official-site payment/booking/submission automation to this
  automation scope. DS-160 live assisted tables may store audited handoff,
  review-diff, and manual-checkpoint state only.
- U.S. appointment tables may track dry-run/manual checkpoint state only. Keep
  sensitive official-portal credentials, cookies, CAPTCHA answers, MFA codes,
  payment card data, and raw screenshots out of these migrations.
- Do not drop or rewrite existing tables without explicit user approval.
- Do not commit secrets or environment-specific values.

## Validation

Run from `viza-be/agent-backend` when database access is available:

```powershell
npm run db:migrate
npm run type-check
```
