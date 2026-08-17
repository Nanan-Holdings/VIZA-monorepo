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
  migrations plus ledger rows in one transaction.
