# Client Checkout Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/checkout/**`.

## Current State

`/client/checkout` is a legacy compatibility route and redirects to
`/client/application`. Stripe checkout, package payment selection, and the
associated server actions/data/tests have been removed. This module performs
no payment or other financial reads/writes.

## Navigation

The application route is the current entry point for applicant form and
submission preparation. Settings owns account, privacy, traveler, and Points
Center navigation. Stale checkout links must continue to resolve through the
compatibility redirect.

## Guardrails

- Keep `/client/checkout` as a deterministic redirect to
  `/client/application`.
- Do not add card collection, checkout sessions, payment records, invoices,
  receipts, refunds, subscriptions, or provider calls here.
- Do not restore the retired agency-fee or official-fee payment flow.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/checkout` and verify it redirects to `/client/application`.
