# Admin Application Monitoring Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/admin/(dashboard)/applications/**`.

## Purpose

This module owns staff monitoring for website-owned automation. Staff use it to
observe application state and help customers, not to manually run the normal
application workflow.

## Key Responsibilities

- Render `/admin/applications` as a user-card monitoring queue.
- Render `/admin/applications/[id]` as a user overview with related applications.
- Show applicant profile, package, payment, consent, signatures, documents,
  packet status, external status, result delivery, and event timeline.
- Provide customer-service context for chat/support escalation.
- Allow admin-safe state corrections only when explicitly scoped and audited.

## Local Files

- `page.tsx`: user-card monitoring queue with package, expiry, application
  count, lifecycle progress, and lifecycle/payment/consent/document/packet/
  external/result filters.
- `[id]/page.tsx`: user overview with profile/package context, related
  applications, progress, missing support items, events, notifications, result
  file references, and support actions.
- `data.ts`: server-side admin data loader and lifecycle derivation helpers.
- `copy.ts`: English/Chinese admin monitoring copy and formatting helpers
  keyed by the global interface language.
- `actions.ts`: audited support-only server actions for this route.
- `support-actions.tsx`: client-side copy/email helper controls.
- `ui.tsx`: route-local admin display primitives.

## Data Sources

- `applicant_profiles`
- `applications`
- `visa_packages`
- `application_documents`
- `visa_application_answers`
- `payment_records`
- `consent_events`
- `application_signatures`
- `application_packets`
- `application_events`
- `notification_events`

## Guardrails

- The happy path must not require staff approval to continue.
- Do not add official-portal runner controls, Playwright controls, CAPTCHA
  actions, proxy controls, or `submission-service` dependencies.
- Do not expose secrets, raw payment method details, or full external tokens.
- Every admin mutation must be auditable through `application_events`.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/admin/applications`. Without an admin session, verify redirect to
`/admin/login`.
