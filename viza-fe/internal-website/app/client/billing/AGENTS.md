# Client Billing Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/billing/**`.

## Purpose

This module owns applicant billing history: payments, receipts, invoice
requests, refund eligibility, and government-fee display notes.

## Key Responsibilities

- Show `payment_records` grouped by application and visa package.
- Link Stripe-hosted receipts when available.
- Provide invoice request flow backed by `invoice_requests`.
- Display refund eligibility from application/payment state without promising
  automatic refunds before the refund rule engine supports them.
- Link users back to `/client/checkout` when payment is missing.

## Data Sources

- `payment_records`
- `invoice_requests`
- `refund_records`
- `applications`
- `visa_packages`

## Key Files

- `page.tsx`: authenticated applicant billing route with agency-fee history,
  receipts, invoice/refund visibility, and government-fee disclosure.
- `data.ts`: billing-only server reads through authenticated applicant context.
- `actions.ts`: billing-local server mutations such as invoice requests.
- `invoice-request-form.tsx`: client dialog for request-based invoice intake.

## Guardrails

- Do not show raw Stripe event payloads or provider IDs unless useful as a
  short support reference.
- Do not process government portal payments here.
- Do not expose other applicants' billing records.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/billing`; without a session, verify redirect to `/client/login`.
