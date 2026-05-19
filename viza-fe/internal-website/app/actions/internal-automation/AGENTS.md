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
