# Client Billing Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/billing/**`.

## Current State

`/client/billing` is a legacy compatibility route and redirects to
`/client/settings`. The billing implementation, receipt and invoice views,
refund actions, and payment reads/writes have been retired. Historical
financial records, if retained for policy, are handled outside this route.

## Navigation

The client shell exposes Home, Application, and Settings. Billing is not an
active destination; account, privacy, traveler, and Points Center navigation
lives under `/client/settings`.

## Guardrails

- Keep `/client/billing` as a safe compatibility redirect to
  `/client/settings`.
- Do not reintroduce checkout, payment-method, invoice, receipt, refund, or
  subscription actions in this module.
- Do not read or mutate financial tables from this route.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/billing` and verify it redirects to `/client/settings`.
