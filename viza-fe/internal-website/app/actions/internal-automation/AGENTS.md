# Internal Automation Actions Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/actions/internal-automation/**`.

## Purpose

This module owns trusted server actions for the VIZA website automation loop.
Actions here coordinate payment state, consent, document uploads, packet
generation, lifecycle advancement, notifications, and external status display.

## Key Responsibilities

- Verify the authenticated applicant before user-scoped reads or writes.
- Use `createAdminClient()` only after authorization is established.
- Keep state advancement idempotent. Calling the same action twice must not
  create duplicate terminal records.
- Use `application_events` for significant mutations.
- Return typed result objects; do not throw raw provider errors into client UI.

## Module Map

- `types.ts`: shared typed action results and customer/admin summary contracts.
- `db.ts`: server-only authenticated user, applicant ownership, admin role, and
  internal Supabase helpers.
- `read-model.ts`: server-only row-to-summary builders for lifecycle, payment,
  consent, document readiness, packets, notifications, coverage, and data
  rights.
- `lifecycle.ts`: customer lifecycle summaries and customer status summaries.
- `documents.ts`: customer document checklist/readiness reads.
- `payments.ts`: customer payment state, invoice requests, and refund requests.
- `consent.ts`: customer consent acceptance and signature persistence.
- `packets.ts`: customer packet/external/result state reads.
- `notifications.ts`: customer notification reads and admin notification event
  recording.
- `coverage.ts`: customer coverage reads for assigned applications/packages.
- `data-rights.ts`: customer and admin data-rights request actions.
- `admin-summaries.ts`: admin application, billing, package coverage, and
  customer status summary reads.

## Data Sources

- `applications`
- `application_documents`
- `payment_records`
- `consent_events`
- `application_signatures`
- `application_packets`
- `application_events`
- `notification_events`
- `ocr_extractions`
- `data_privacy_requests`

## Guardrails

- Do not import browser-only code.
- Do not move official portal runner logic into actions.
- Do not require staff approval for the normal happy path.
- Do not log PII, passports, signatures, payment payloads, or documents.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

For lifecycle changes, smoke `/client/status`, `/client/documents`, and
`/admin/applications`.
