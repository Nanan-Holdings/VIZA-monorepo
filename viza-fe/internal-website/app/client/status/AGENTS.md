# Client Status Center Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/status/**`.

## Purpose

This module owns the applicant-facing status center for VIZA-owned automation.
It shows the progress of payment, consent, form completion, documents,
application packet generation, external submission handoff, and final result
delivery.

This module does not run official-portal automation. It only displays VIZA
website state and externally ingested submission/result state.

## Key Responsibilities

- Render `/client/status` as the canonical application status route.
- Reuse `components/client/application/application-status-hub.tsx` where
  possible instead of building a second lifecycle UI.
- Keep `/client/documents` focused on document upload/checklist work; do not
  put document-management UI here unless it is a status summary.
- Surface customer-safe statuses only. Technical backend or external process
  errors must be translated into plain user-facing next steps.
- Show result-delivery links when `applications.result_storage_path`,
  `applications.receipt_url`, or official reference fields are available.

## Data Sources

- `applications`
- `application_documents`
- `visa_application_answers`
- `payment_records`
- `consent_events`
- `application_signatures`
- `application_packets`
- `application_events`
- `notification_events`

## Guardrails

- Do not import service-role clients into client components.
- Do not expose internal stack traces, provider errors, secrets, or external
  system tokens.
- Do not add dependencies on `viza-be/submission-service`.
- Keep DS-160 wording clear: VIZA prepares the package; any official signature
  or submission boundary belongs outside this module.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/status`. Without an authenticated session, verify redirect to
`/client/login`.
