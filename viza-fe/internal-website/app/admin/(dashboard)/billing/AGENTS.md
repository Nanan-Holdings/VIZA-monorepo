# Admin Billing Monitor Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/admin/(dashboard)/billing/**`.

## Current State

`/admin/billing` is a legacy compatibility route and redirects to
`/admin/applications`. The billing support UI, financial data loader, receipt
and invoice views, refund actions, and payment reads/writes have been retired.

## Navigation

The admin sidebar has no active Billing destination. Use Applications, Work,
Support, Privacy, or the relevant operational area for current case handling;
the billing URL exists only to preserve a safe redirect for stale links.

## Guardrails

- Keep `/admin/billing` as a deterministic redirect to
  `/admin/applications`.
- Do not reintroduce payment, receipt, invoice, refund, subscription, or
  provider actions in this module.
- Do not read or mutate financial tables from this route.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/admin/billing` and verify it redirects to `/admin/applications`.
