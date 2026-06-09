# Agent Backend Database Guide

Scope: this file applies to `viza-be/agent-backend/src/db/**` and should be
read with `viza-be/agent-backend/drizzle/**`.

## Purpose

This module owns database connectivity, Drizzle schema types, migrations, and
Supabase service-role client setup for the agent backend.

## Key Files

- `schema.ts`: Drizzle table definitions and inferred TypeScript types.
- `index.ts`: direct Postgres/Drizzle connection using `DATABASE_URL`.
- `migrate.ts`: migration runner.
- `supabase-client.ts`: service-role Supabase client and connection check.
- `supabase-adapter.ts`: Supabase helper adapter for selected operations.
- `../../drizzle/*.sql`: sequential SQL migrations.
- `../../drizzle/0013_internal_automation_loop.sql`: website automation
  payment, consent, packet, notification, refund, and data-rights schema.
- `../../drizzle/0091_us_appointment_assistant.sql`: U.S. appointment
  assistant job, account, attempt, checkpoint, slot, confirmation, status-check,
  and audit-event schema.
- `../../drizzle/0093_ds160_live_assisted_controls.sql`: DS-160 live assisted
  queue/job controls, encrypted official retrieval fields, review
  snapshot/diff records, and manual action checkpoints.
- `../../drizzle/0094_vn_evisa_documents_and_labels.sql`: Vietnam e-Visa
  package document requirements and bilingual label metadata.

## Ownership Boundaries

- Keep SQL migrations sequentially numbered.
- Prefer idempotent migrations where possible.
- Update `schema.ts` when adding tables/columns used by TypeScript code.
- Use service-role clients only after authorization checks in route/action code.
- Do not put business logic in DB connection files.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run db:migrate
```

For schema changes, also run any affected route/eval tests.

## Related Tables

- `applicant_profiles`
- `applications`
- `application_documents`
- `submission_queue`
- `visa_chat_sessions`
- `visa_chat_messages`
- `visa_documents`
- `visa_chunks`
- `visa_form_fields`
- `visa_packages`
- `user_packages`
- `visa_application_answers`
- `application_translations`
- `payment_records`
- `official_fee_quotes`
- `official_fee_payment_intents`
- `official_fee_payment_attempts`
- `official_fee_receipts`
- `payment_instruments`
- `official_fee_reconciliation_entries`
- `appointment_accounts`
- `appointment_assistance_jobs`
- `appointment_assistance_attempts`
- `appointment_manual_actions`
- `appointment_slots`
- `appointment_confirmations`
- `appointment_status_checks`
- `appointment_audit_events`
- `ds160_submission_jobs`
- `ds160_official_review_snapshots`
- `ds160_review_diffs`
- `ds160_live_manual_actions`
- `consent_events`
- `application_signatures`
- `application_packets`
- `application_events`
- `notification_events`
- `refund_requests`
- `invoice_requests`
- `government_fee_rules`
- `coverage_matrix`
- `data_rights_requests`
- `pii_retention_jobs`
