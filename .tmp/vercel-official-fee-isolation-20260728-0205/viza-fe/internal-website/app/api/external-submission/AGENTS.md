# External Submission API Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/api/external-submission/**`.

## Purpose

This module exposes lightweight status/result ingestion for whichever external
process owns official submission. It must not implement official portal
automation itself.

## Key Responsibilities

- Accept external status updates for existing applications.
- Validate authentication with a server-side shared token or a stronger
  service-to-service mechanism.
- Update `applications.external_status`, `external_reference`,
  `result_status`, and result file references.
- Insert `application_events` and queue `notification_events`.

## Current Route

- `route.ts`: `POST /api/external-submission` service-to-service ingest. It is
  token-gated by `EXTERNAL_SUBMISSION_TOKEN`, validates strict allowlists for
  external/result statuses and update sources, updates application
  external/result fields, and writes audit/notification rows.

## Guardrails

- Do not accept updates for unknown application ids.
- Do not accept arbitrary status strings; use the approved status allowlist.
- Do not expose this API to browser clients.
- Do not import or call `viza-be/submission-service`.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
