# Scripts Agent Guide

Scope: this file applies to `scripts/**`.

## Purpose

This directory contains local development runners, repository automation, and
smoke-test helpers for the VIZA monorepo.

## Conventions

- Prefer PowerShell for Windows-first local development scripts.
- Keep scripts runnable from the repository root unless the script name or
  inline usage text clearly says otherwise.
- Write process logs under `.dev-logs/` and keep generated logs out of git.
- If a script starts background processes, provide a matching stop or reset
  path.
- Do not store secrets, service-role keys, or plaintext test passwords in
  scripts.

## Current Runners

- `start-all.ps1`: starts the full local VIZA development stack from the repo
  root, including the internal website, marketing website, agent backend,
  submission worker, travel service, optional database services, logs, health
  checks, targeted VIZA Supabase migrations, automatic portal opening, and
  stop support. It starts the submission worker with the local-only Vietnam
  and Indonesia one-time card-session endpoints enabled and points the frontend
  at the same submission-service port; card numbers and CVV must still never be written to
  scripts, env files, logs, or committed files. Use `-SkipVizaMigrations` to
  skip migration apply during local startup or `-RequireVizaMigrations` when
  stale DB metadata must fail fast.
- `start-vn-autopay-dev.ps1`: repo-root wrapper for
  `npm run vn:autopay:dev`. It starts `viza-be/submission-service` with the
  Vietnam one-time card-session endpoint enabled, defaulting to port 18080 so it
  matches the global dev stack and frontend local payment route.
- `restart-all.ps1`: one-shot emergency restart wrapper that forwards flags to
  `start-all.ps1` with `-Reset` (stop all matching started processes and start
  fresh).
- `start-viza-dev.ps1`: starts the internal website with backend services.
- `start-indonesia-submission-worker.cmd`: Windows double-click helper that
  starts `viza-be/submission-service` for intentional local Indonesia B1/C1
  assisted-live retries only when `VIZA_ALLOW_LOCAL_INDONESIA_WORKER=1`.
  Production payment jobs belong to the single Fly worker because their
  one-time card session is process-local; the default guard prevents a local
  worker from racing Fly for those jobs.
- `start-travel-dev.ps1`: opens local terminals for Travel AI development.
- `start-help-and-internal.ps1`: starts the public help/marketing site and the
  internal portal on separate local ports.
- `audit-bilingual-schema-clarity.ts`: scans visa form schema seed sources and
  fallback form definitions, then writes bilingual schema clarity reports.
- `generate-vn-prearrival-administrative-zh.mjs`: joins the official Vietnam
  34-province/3321-unit code snapshot to the Chinese 2025 administrative lists
  province by province and refuses to write a partial Chinese-name snapshot.
- `doctor-env.ps1`: reports env files, BOMs, frontend secret variable names,
  and unsafe `NEXT_PUBLIC_` names without printing values.
- `doctor-env.ts`: cross-platform env doctor used by package scripts and the
  internal website wrapper.
- `audit-travel-cards.mjs`: validates the complete Travel city/attraction
  catalog, localized names, specific descriptions, source links and image
  paths; `--check-remote` also verifies the deployed image rewrite.
- `__tests__/start-all-vn-autopay.test.mjs`: static regression coverage for
  the global `dev:all:with-db` startup chain, especially the Vietnam
  one-time card-session submission-service handoff and matching frontend env.
- `supabase-self-heal.mjs`: fail-closed, read-only Supabase Auth/REST canary
  for an external GitHub Actions runner. It requires a project-ref-matching
  `SUPABASE_URL`, runs three dual-endpoint probe rounds per schedule, requires
  three independently scheduled failures before recovery, and persists
  incident/lease state in the configured GitHub
  Issue (`GITHUB_TOKEN`, `GITHUB_REPOSITORY`,
  `SUPABASE_SELF_HEAL_ISSUE_NUMBER`) rather than local/cache storage. It never
  prints key/token values.
  The scheduled entry point is `.github/workflows/supabase-self-heal.yml`;
  keep all credential values in GitHub Actions secrets and use
  `SUPABASE_SELF_HEAL_DRY_RUN=true` to exercise the decision path without
  calling the Management API restart endpoint.
- `production-db-maintenance.mjs`: fail-closed production database maintenance
  helper invoked only from the protected GitHub Environment. Preflight uses
  Supabase's read-only Management API endpoint and emits aggregate queue/lease,
  cap, cron, migration-ledger, and strict-object metadata without row payloads
  or credential values. Pause is a separate exact-confirmation action that
  atomically requires the approved cap/cron snapshot and zero live work before
  pausing pool caps and unscheduling the Vietnam status cron. Apply accepts only
  the reviewed strict source commit and exact hashes for migration versions
  `20260816160000` and `20260816161000`, rechecks the drained pause state, and
  records both migrations atomically with the schema changes. Resume requires
  those ledger versions and strict objects, zero live work, six exact paused
  caps, and no status cron before atomically restoring the caps and cron. The
  separate `apply-stable-speed` path is pinned to the reviewed additive
  concurrency migration, verifies the active six-country cap topology before
  and after, and installs the renewal/health/metric objects without pausing or
  mutating jobs, caps, slots, or cron.
- `database-migration-governance.mjs`: pull-request gate for the two VIZA SQL
  migration roots. It preserves the exact 17 historical duplicate Drizzle
  prefixes, rejects edits/renames/deletes of existing migrations, requires each
  new migration to be classified as one byte-identical mirror pair or an
  explicitly justified no-mirror file, and statically enforces public-table
  RLS/ACL, empty SECURITY DEFINER search paths, and invoker views. It also
  preserves the exact historical Supabase duplicate-version allowlist and
  requires new Supabase files to use unique 14-digit timestamps.
- `database-architecture/migration-governance.json`: immutable duplicate-prefix
  allowlist plus hash-pinned mirror/no-mirror decisions for new migrations.
  A one-time unapplied rename must be 100% byte-identical, hash-pinned, backed
  by an exact production-ledger absence check, and still paired to its mirror.
  An applied Supabase filename reconciliation is separately allowlisted only
  when it is a 100% byte-preserving rename to the exact production ledger
  version/name, the superseded local version is confirmed absent, and the
  project ref plus durable read-only evidence run are pinned. Never replay the
  migration merely to manufacture the repository's former version number.
- `database-architecture/approved-migration-batches.json`: reviewed batch ids,
  exact migration paths/versions/SHA-256 values, execution modes, and migration
  ledger pre/postconditions used by `apply-approved-batch`.
  `notification-signature-rls-initplan-v1` pins the two public SELECT-policy
  contracts for `notification_event_log` and `signature_event` before and
  after the scalar init-plan rewrite.
  `inbound-email-rls-initplan-v1` pins the applicant inbox policy hash, RLS
  state, policy count, and the existing relation ACL before and after its
  scalar init-plan rewrite. The batch deliberately does not change the broad
  legacy table ACL or service-role quarantine behavior; harden those only in
  separately reviewed changes.
  `inbound-email-acl-v1` follows the deployed legacy-session server ownership
  boundary and removes anonymous access plus authenticated mutations. It pins
  the unchanged inbox policy/RLS/purge-function contracts, exact direct
  grantees, absence of non-owner grant options, authenticated SELECT-only
  access, and the existing seven service-role table privileges.
  `audit-log-rls-initplan-v1` pins the two single-path applicant-owned SELECT
  policies on `secret_access_log` and `pii_access_log`, including exact policy
  identities, counts, RLS state, and normalized pre/post expression hashes.
  `account_action_log` requires a separately reviewed two-path batch, while
  `consent_event` remains excluded until its historical schema ownership is
  reconciled.
  `account-action-log-rls-initplan-v1` independently pins the direct user-id OR
  applicant-profile ownership policy, including exact RLS state, policy count,
  public SELECT role, exact direct relation ACL roles, normalized pre/post
  expression hashes, and the migration's same-transaction policy-OID/ACL
  preservation checks. It must not include `consent_event`.
  `consent-event-rls-initplan-v1` resolves the historical Drizzle/website-only
  policy split using the metadata-only production catalog as authority. It
  independently pins production's direct user-id OR applicant-profile policy,
  exact RLS/ACL/role/count contracts, immutable source/hash, and the
  migration's same-transaction policy-OID/raw-ACL preservation checks.
  `applicant-single-path-rls-initplan-v1` pins the four single-path applicant
  ownership policies on `applicant_secret`, `notification_preferences`, and
  `staff_chat_thread`, including unchanged PUBLIC roles, exact direct ACLs,
  RLS/policy counts, OIDs, and pre/post expression hashes.
  `supporting-doc-submission-rls-initplan-v1` pins the sole two-hop applicant
  ownership SELECT policy on `supporting_doc_submission`, including its
  unchanged PUBLIC role, exact direct ACL, RLS/policy count, policy/relation
  OIDs, and production-confirmed pre/post expression hashes.
  `notification-preferences-policy-dedupe-v1` proves the notification
  preference SELECT and ALL policies share the same ownership predicate, then
  removes only the redundant SELECT policy while pinning the surviving policy,
  exact ACL, RLS state, policy count, immutable source, and migration hash.

`production-db-maintenance.mjs` also exposes `architecture-audit`, which joins
sanitized Security/Performance Advisor metadata with a read-only catalog/stat
snapshot. Each architecture-audit read may retry once, after 500 ms, only for
rate limits, 5xx responses, connection resets, or timeouts; authorization,
identity, payload-shape, and project-marker failures never retry, and the error
names the failed read phase. The retry path must remain read-only and must not
be shared by pause/apply/resume actions. `apply-approved-batch` accepts only a
full commit SHA and an exact manifest entry. Architecture audit must never emit
statement text, SQL parameters, table rows, applicant data, or advisor
detail/remediation text.
The metadata-only v2 audit may include a one-way SHA-256 of an explicitly
allowlisted product-configuration row set plus migration-ledger version/name,
statement count, and statement hash. It must never emit the source rows or SQL
statement text; this evidence exists only to reconcile an already-applied
migration filename without replaying the migration.
Approved batches use structured catalog assertions only; concurrent-index
batches pin exact index definitions and may retry only an invalid/not-ready
index. Temporary Management API login roles must not exceed ten minutes and
must be revoked after successful, failed, or ambiguous creation attempts.
The same script's `capacity-observe` action is strictly read-only and is the
implementation behind `.github/workflows/passive-production-capacity.yml`.
It verifies the exact production project, takes three aggregate catalog samples
five seconds apart, and reports only connection/lock/transaction/queue counts,
large-table maintenance candidates, sanitized Performance Advisor objects, and
`pg_stat_statements` query IDs with numeric counters. A single transient sample
is a warning; only persistent saturation, waiting locks, long or idle
transactions, or an increasing deadlock counter is a blocker. Never add SQL
text, parameter values, application/session identifiers, or automatic index
DDL to this action. Missing `pg_stat_statements` is an explicit warning and
invalid statement/sample metadata fails closed.
The Management API project identity is authoritative; a missing database GUC
marker is a warning, while any non-null marker mismatch is rejected.
Function-hardening batches use the structured `function_search_path` assertion
to pin an exact `pg_catalog`-first namespace path and SECURITY
DEFINER/INVOKER mode; they must pair it with explicit execution-ACL assertions
instead of accepting raw catalog SQL.
When a transactional migration committed but a later metadata postflight was
stricter than the target PostgreSQL catalog representation, use the read-only
`verify-approved-batch` action after correcting and reviewing the exact
structured assertion. Never replay an already-recorded migration to repair a
postflight-only failure.
