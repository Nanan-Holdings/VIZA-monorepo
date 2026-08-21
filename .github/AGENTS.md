# GitHub Automation Agent Guide

Scope: this file applies to `.github/**`.

## Purpose

This directory contains repository CI, deployment, operational monitoring, and
scheduled recovery workflows.

## Conventions

- Keep production-mutating workflows single-flight with an explicit
  `concurrency` group.
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
