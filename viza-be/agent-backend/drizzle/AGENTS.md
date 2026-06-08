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

## Guardrails

- Do not add runner/Playwright/submission-service tables or real official-site
  payment/booking automation to this automation scope.
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
