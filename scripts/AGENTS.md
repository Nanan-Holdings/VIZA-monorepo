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
  helper invoked only from the protected GitHub Environment. Its initial
  preflight mode uses Supabase's read-only Management API endpoint and emits
  aggregate queue/lease, cap, cron, migration-ledger, and strict-object
  metadata without row payloads or credential values.
