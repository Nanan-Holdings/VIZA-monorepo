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
  one-time card-session endpoint enabled and points the frontend at the same
  submission-service port; card numbers and CVV must still never be written to
  scripts, env files, logs, or committed files. Use `-SkipVizaMigrations` to
  skip migration apply during local startup or `-RequireVizaMigrations` when
  stale DB metadata must fail fast.
- `restart-all.ps1`: one-shot emergency restart wrapper that forwards flags to
  `start-all.ps1` with `-Reset` (stop all matching started processes and start
  fresh).
- `start-viza-dev.ps1`: starts the internal website with backend services.
- `start-indonesia-submission-worker.cmd`: Windows double-click helper that
  starts `viza-be/submission-service` for local Indonesia B1/C1 assisted-live
  retries; keep the window open while submitting from the VIZA portal.
- `start-travel-dev.ps1`: opens local terminals for Travel AI development.
- `start-help-and-internal.ps1`: starts the public help/marketing site and the
  internal portal on separate local ports.
- `audit-bilingual-schema-clarity.ts`: scans visa form schema seed sources and
  fallback form definitions, then writes bilingual schema clarity reports.
- `doctor-env.ps1`: reports env files, BOMs, frontend secret variable names,
  and unsafe `NEXT_PUBLIC_` names without printing values.
- `doctor-env.ts`: cross-platform env doctor used by package scripts and the
  internal website wrapper.
- `__tests__/start-all-vn-autopay.test.mjs`: static regression coverage for
  the global `dev:all:with-db` startup chain, especially the Vietnam
  one-time card-session submission-service handoff and matching frontend env.
