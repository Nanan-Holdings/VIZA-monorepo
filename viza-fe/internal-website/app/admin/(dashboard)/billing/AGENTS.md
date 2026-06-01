# Admin Billing Monitor Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/admin/(dashboard)/billing/**`.

## Purpose

This module owns staff visibility into agency-fee payments, invoice requests,
refund records, and payment-related customer support context.

## Key Responsibilities

- Render payment records with applicant, application, package, amount, status,
  and receipt links.
- Surface invoice requests and refund records for support follow-up.
- Show government-fee mode from package/application metadata, but do not process
  official government payments here.
- Link from payment rows to `/admin/applications/[id]`.
- Keep `page.tsx` as the server data loader and
  `billing-support-workspace.tsx` as the interactive staff support surface.
- Keep billing support UI copy bound to the global interface language
  (`NEXT_LOCALE`) for English/Chinese switching.

## Data Sources

- `payment_records`
- `invoice_requests`
- `refund_records`
- `applications`
- `applicant_profiles`
- `visa_packages`

## Guardrails

- Do not store or display raw card data.
- Do not implement government portal payment relay.
- Do not mutate Stripe records directly from this UI unless a dedicated,
  audited action exists.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
