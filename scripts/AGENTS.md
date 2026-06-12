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
  checks, automatic portal opening, and stop support.
- `start-viza-dev.ps1`: starts the internal website with backend services.
- `start-travel-dev.ps1`: opens local terminals for Travel AI development.
- `start-help-and-internal.ps1`: starts the public help/marketing site and the
  internal portal on separate local ports.
- `audit-bilingual-schema-clarity.ts`: scans visa form schema seed sources and
  fallback form definitions, then writes bilingual schema clarity reports.
- `doctor-env.ps1`: reports env files, BOMs, frontend secret variable names,
  and unsafe `NEXT_PUBLIC_` names without printing values.
- `doctor-env.ts`: cross-platform env doctor used by package scripts and the
  internal website wrapper.
