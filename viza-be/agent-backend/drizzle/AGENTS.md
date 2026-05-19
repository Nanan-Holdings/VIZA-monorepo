# Agent Backend Migrations Guide

Scope: this file applies to `viza-be/agent-backend/drizzle/**`.

## Purpose

This directory owns sequential SQL migrations for the agent backend Supabase
database.

## Key Responsibilities

- Keep migration filenames sequentially numbered.
- Make migrations idempotent where practical with `IF NOT EXISTS` and
  `ADD COLUMN IF NOT EXISTS`.
- Update `src/db/schema.ts` when SQL migrations add tables or columns that
  TypeScript code uses.
- Keep service-role-only tables behind RLS unless a clear authenticated policy
  is required.

## Internal Automation Tables

The website automation loop uses:

- `payment_records`
- `invoice_requests`
- `refund_records`
- `consent_events`
- `application_signatures`
- `document_requirements`
- `application_packets`
- `application_events`
- `notification_events`
- `ocr_extractions`
- `data_privacy_requests`
- `coverage_matrix`
- `government_fee_rules`
- `pii_retention_jobs`

The current internal automation migrations are:

- `0013_internal_automation_loop.sql`: first website automation tables and
  application/application document columns.
- `0014_internal_automation_db_refinements.sql`: coverage matrix,
  government-fee rules, retention jobs, data-rights columns, and lookup
  indexes.

## Guardrails

- Do not add runner/Playwright/submission-service tables to this automation
  scope.
- Do not drop or rewrite existing tables without explicit user approval.
- Do not commit secrets or environment-specific values.

## Validation

Run from `viza-be/agent-backend` when database access is available:

```powershell
npm run db:migrate
npm run type-check
```
