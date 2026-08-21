# Agent Backend Database Guide

Scope: this file applies to `viza-be/agent-backend/src/db/**` and should be
read with `viza-be/agent-backend/drizzle/**`.

## Purpose

This module owns database connectivity, Drizzle schema types, migrations, and
Supabase service-role client setup for the agent backend.

## Key Files

- `schema.ts`: Drizzle table definitions and inferred TypeScript types. Entries
  marked `TYPE-ONLY SCHEMA COMPATIBILITY` intentionally omit identity/per-column
  DESC details unsupported by Drizzle 0.30; their named SQL migrations remain
  authoritative and those entries must not drive `db:generate`/`db:push`.
- `schema-ownership.manifest.json`: reconciled ownership inventory separating
  Drizzle-managed, REST/service-only, and compatibility relations. Its
  production claim is valid only while its run/job identity and SHA-256 match
  the bound metadata-only architecture-audit artifact.
- `production-catalog.*.json`: compact, sorted
  table/view catalog captured by the successful read-only production audit.
  It contains only schema/name/kind/owner/RLS metadata plus provenance and
  integrity hashes; never add grants, SQL text, row values, or applicant data.
- `index.ts`: bounded Postgres/Drizzle runtime pool, redacted pool/query
  telemetry, health metrics, and idempotent graceful close.
- `connection-config.ts`: validates the production VIZA Supabase transaction
  pooler, configures bounded client connection/idle handling, verifies database
  role timeout defaults, and loads the pinned public Supabase CA with SHA-256
  integrity verification.
- `supabase-production-ca.ts`: public Supabase production root CA embedded for
  dist-only runtime images; keep its normalized SHA-256 synchronized with the
  production maintenance workflow and never replace it without validating the
  official download.
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
- `../../drizzle/0095_france_live_assisted_controls.sql`: France-Visas live
  assisted queue fields and manual checkpoint table.
- `../../drizzle/0096_vietnam_live_assisted_controls.sql`: Vietnam e-Visa
  queue stage/heartbeat fields, encrypted registration-code storage, and
  manual checkpoint table.
- `../../drizzle/0111_vietnam_evisa_status_tracking_delivery.sql`: new-only
  Vietnam status tracking, daily scheduling, atomic claims, and artifact audit.
- `../../drizzle/0124_travel_agent_conversation_state.sql`: durable Travel
  Agent state versions, idempotent messages, model continuity, and preferences.
- `../../drizzle/0134_form_assistant_sessions.sql`: durable application-scoped
  Form Filling Assistant state/messages with idempotency and ownership RLS.
- `../../drizzle/0137_queue_worker_leases_and_runtime_claims.sql`: leased
  notification and Vietnam status-check claims, conditional settlement RPCs,
  and the extended atomic submission-queue claim contract.
- `../../drizzle/0139_dedupe_ongoing_applications.sql`: application
  deduplication cleanup and the partial unique gate for ongoing country/visa
  identities.
- `../../drizzle/0150_public_status_tracking.sql`: current service-health
  projection metadata, append-only checks, derived incidents, and redacted
  aggregation/recording RPCs.
- `../../drizzle/0158_database_access_baseline.sql`: future default-privilege
  deny baseline, targeted RLS/ACL/view/RPC hardening, and the missing
  `application_translations` production contract.
- `../../drizzle/0140_prevent_qa_placeholder_submission.sql`: database-level
  rejection of synthetic QA data in customer applications and live queues.
- `../../drizzle/0141_block_known_qa_account_sentinel.sql`: follow-up protection
  for the historical dedicated-QA account sentinel.
- `../../drizzle/0144_exclude_qa_drafts_from_ongoing_uniqueness.sql`: keeps
  synthetic schema-QA drafts outside the customer ongoing-application gate.

## Ownership Boundaries

- Keep SQL migrations sequentially numbered.
- Prefer idempotent migrations where possible.
- Update `schema.ts` when adding tables/columns used by TypeScript code.
- Use service-role clients only after authorization checks in route/action code.
- Do not put business logic in DB connection files.
- Production runtime `DATABASE_URL` must identify project
  `oyjxdzsoejraedqghndi` through the approved Mumbai shared pooler
  `aws-1-ap-south-1.pooler.supabase.com:6543` or its project-scoped dedicated
  pooler, use the `/postgres` database, and contain no URL options. Local
  non-production PostgreSQL remains supported without TLS; remote Supabase
  connections must verify the pinned CA and hostname.
- Supabase transaction pooling cannot rely on startup/session parameters.
  Before a production deploy, the database `postgres` role must have positive
  `statement_timeout` and `idle_in_transaction_session_timeout` defaults no
  greater than 30 seconds. Startup opens three fresh clients concurrently,
  verifies both values with `SHOW` inside an explicit read-only transaction on
  every client, closes all three, and refuses to become ready when any sample
  is absent or too lax. Do not substitute node-postgres `query_timeout`: it
  does not cancel the server-side query.
- The pool sends `application_name=viza-agent-backend` as best-effort
  observability metadata only. Transaction-pooler behavior means it must not be
  used as a security, timeout, or readiness guarantee.
- Database telemetry may contain only query fingerprints, parameter counts and
  types, durations, result status, and aggregate pool counts. Never emit SQL
  text, parameter values, connection strings, or applicant data.
- Shutdown must actively disconnect Socket.IO upgraded transports, close its
  HTTP server, and then await `closeDatabase()` through the shared bounded
  shutdown coordinator so deploys cannot hang indefinitely.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run db:migrate
npm test -- --run src/db/connection-config.test.ts
```

For schema changes, also run any affected route/eval tests.

## Related Tables

- `applicant_profiles`
- `applications`
- `application_documents`
- `submission_queue`
- `visa_chat_sessions`
- `visa_chat_messages`
- `travel_agent_sessions`
- `travel_agent_messages`
- `travel_user_preferences`
- `form_assistant_sessions`
- `form_assistant_messages`
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
- `official_status_checks`
- `portal_health`
- `portal_health_checks`
- `status_incidents`
- `official_application_tracking`
- `appointment_audit_events`
- `ds160_submission_jobs`
- `ds160_official_review_snapshots`
- `ds160_review_diffs`
- `ds160_live_manual_actions`
- `france_live_manual_actions`
- `vietnam_live_manual_actions`
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
