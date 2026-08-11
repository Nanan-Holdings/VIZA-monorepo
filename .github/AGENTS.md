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
