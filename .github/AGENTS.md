# GitHub Automation Agent Guide

Scope: this file applies to `.github/**`.

## Purpose

This directory contains repository CI, deployment, operational monitoring, and
scheduled recovery workflows.

## Conventions

- Keep production-mutating workflows single-flight with an explicit
  `concurrency` group.
- `ci-agent-backend.yml` provisions a disposable loopback Redis service only
  for the Socket.IO scaling integration test. It must prove cross-node room
  delivery over WebSocket without using production credentials or persistent
  data.
- Store credentials only in GitHub Actions secrets and non-sensitive deployment
  identifiers in repository variables. Never commit token values.
- Scheduled recovery must fail closed on missing configuration, authentication
  failures, rate limits, or ambiguous health signals.
- `supabase-self-heal.yml` runs outside Supabase, stores incident and restart
  lease state in one dedicated GitHub Issue, and delegates all probe and
  restart decisions to `scripts/supabase-self-heal.mjs`.
- The Supabase credentials belong to the `supabase-production-recovery`
  Environment, whose deployment branch policy permits only `main`.
- Scheduled workflows execute only from the default branch. Keep the auto
  restart kill switch disabled until a healthy scheduled run is verified.
- `production-db-maintenance.yml` is a manual, single-flight production
  maintenance entry point. Keep its actions explicit and fail closed against
  the exact production project ref. `preflight` is aggregate-only and uses the
  read-only Management API endpoint; `pause` requires the approved live cap and
  cron snapshot, drained queues, and one atomic transaction. `apply` checks out
  but never executes code from one exact reviewed source commit, verifies both
  migration SHA-256 hashes, re-runs the drain preflight, and applies both SQL
  migrations plus ledger rows in one transaction. `resume` requires both ledger
  versions, all strict objects, zero live work, six exact paused caps, and no
  status cron before restoring the caps and canonical cron atomically.
- `automated-product-source-drift.yml` checks the committed Japan VJW and Kenya
  eTA official-source baselines every Monday. Drift only opens or updates a
  GitHub review issue; it must never rewrite the manifest, rules, seeds, or
  runner selectors automatically.
- `production-db-maintenance.yml`'s `apply-stable-speed` action is a separate
  online expand-only action pinned to one
  reviewed migration commit and SHA-256; it preserves the active six-country
  cap snapshot and installs only the exact-owner renew RPC, health views, and
  service-role-only metric table.
- `database-migration-governance.yml` runs on migration/governance pull-request
  changes with full history so the governance script can reject any existing
  migration edit, rename, copy, or deletion relative to the target branch.
- `production-db-maintenance.yml` also exposes the read-only
  `architecture-audit` action and the manifest/hash-gated
  `apply-approved-batch` action. The latter requires `batch_id` plus a full
  40-character reviewed commit SHA and checks out that SHA only as migration
  input; the current default-branch script and manifest remain the trust root.
- `online-capacity-gate.yml` is a manual, single-flight, read-only staging gate.
  It checks out one full reviewed SHA, requires exact project confirmation, and
  may run only through the `staging-online-capacity` Environment. The deployed
  frontend and agent must both expose the default-off target marker bound to
  the same non-production Supabase ref before any 100-user request wave starts.
  Its authenticated scope accepts only a dedicated `@viza.test` account and an
  ephemeral session Cookie from the protected Environment secret, ramps for 30
  seconds, and sustains read-only home/status/readiness requests for 5 minutes.
  The session preflight must match the configured synthetic user UUID exactly.
  Only the authenticated execution step receives the ephemeral session Cookie
  and status telemetry bearer secret. During ramp and steady load, the gate
  samples aggregate DB pool/query telemetry and fails on a wait peak above one,
  any wait persisting into a one-second sample, >=80% utilization,
  query-error/slow-query increase, metric reset, or incomplete
  sampling; neither secret may reach setup, checkout, logs, or artifacts.
- `passive-production-capacity.yml` is the no-load production observer. It runs
  every six hours (and on explicit dispatch) through the main-only
  `supabase-production-recovery` Environment, shares the database-maintenance
  concurrency group, and performs exactly three metadata-only read samples over
  ten seconds. It may query the sanitized Performance Advisor and
  `pg_stat_statements` aggregates, but must never emit statement text,
  parameters, session identities, or table rows. Reports are retained for only
  seven days; persistent connection saturation, locks, long/idle transactions,
  or a new deadlock fail the job, while redacted query IDs are evidence for a
  later reviewed optimization rather than permission to create an index. An
  unavailable `pg_stat_statements` extension must make the report incomplete
  and warning-level; it must never be presented as green capacity evidence.
  The optional database project marker follows the same warning behavior when
  absent, while any non-null mismatch remains a hard failure after the exact
  Management API project check. Each run also downloads only exact-name,
  non-expired `main` artifacts from prior observer runs and builds a
  metadata-only 24-hour trend. This is a sparse trend of the existing
  10-second samples, not continuous transaction accounting. The trend is
  incomplete until at least five distinct observations span 22 hours; manual
  bursts cannot satisfy it. Each report must also be contemporaneous with its
  exact GitHub workflow run and Artifact timestamp; replayed or future-dated
  sample times fail closed. Failed historical runs whose artifact does not
  contain a valid sanitized report are excluded as missing evidence and leave
  the trend incomplete; they must not poison every later observer run. Any red
  constituent observation makes the trend red. Only query IDs that recur
  in at least half the complete window (and at least three observations) are
  retained as review candidates; the trend never authorizes DDL automatically.
  Report v2 also records only cumulative `pg_stat_user_tables` counters as
  decimal strings, keyed by public table name. The trend compares monotonic
  snapshots with the same database statistics-reset marker and may surface a
  table for review only after a complete 24-hour window. It must not collect
  statement text, parameters, row values, relation contents, or automatically
  turn sequential-scan/write deltas into DDL. A review candidate requires the
  exact same table to have monotonic counters in every segment of the complete
  window and either at least 100 sequential scans touching 10,000 tuples or at
  least 1,000 writes; these are review thresholds, not index criteria.
  Report v3 additionally groups current-database client backends into only
  three fixed, privacy-safe connection-source buckets: the exact
  `viza-agent-backend` application name, the exact protected-maintenance
  application name, and `other`. Empty and unknown names always remain
  `other`; raw application names, usernames, addresses, PIDs, SQL, parameters,
  and session identities must never enter reports or logs. The attribution is
  a best-effort instantaneous diagnostic under Supavisor transaction pooling,
  not a user/request count, authorization signal, or capacity denominator, and
  a high `other` count is never an automatic blocker.
