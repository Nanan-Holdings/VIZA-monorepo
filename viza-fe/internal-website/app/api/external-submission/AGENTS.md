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
- Insert `application_events` and email the applicant through
  `lib/notify/dispatch.ts` on real transitions (mapping in
  `lib/notify/external-submission-email.ts`: submitted, approved/issued,
  rejected, action_required/additional_documents_requested). A repeated POST
  with the same statuses does not email again.

## Current Route

- `route.ts`: `POST /api/external-submission` service-to-service ingest. It is
  token-gated by `EXTERNAL_SUBMISSION_TOKEN`, validates strict allowlists for
  external/result statuses and update sources, updates application
  external/result fields, and writes audit/notification rows.

## Callers and credentials

- `EXTERNAL_SUBMISSION_TOKEN` is set on Vercel project `viza-internal`
  (production, sensitive) since 19 Oct 2026. The local copy is in
  `viza-fe/internal-website/.env.local`. Rotate both together.
- As of 19 Oct 2026 nothing in this repo calls the route. It is the
  service-to-service hook for whichever process owns official submission
  outside the portal: a partner agency, the submission service once it
  reports results, or an operator script. Staff in the admin app use the
  "Record outcome" panel instead, which writes the same fields.
- Example:

  ```bash
  curl -X POST https://app.viza.it.com/api/external-submission \
    -H "Authorization: Bearer $EXTERNAL_SUBMISSION_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"applicationId":"<uuid>","externalStatus":"submitted","reference":"ABC123","updateSource":"external_submission_partner"}'
  ```

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
