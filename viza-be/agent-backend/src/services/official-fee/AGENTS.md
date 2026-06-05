# Official Fee Service Guide

Scope: this file applies to `viza-be/agent-backend/src/services/official-fee/**`.

## Purpose

This module owns the backend framework for official visa/application fee
payments that VIZA may make with a company-controlled instrument after user
consent and funding/approval gates.

## Guardrails

- Dry-run and manual-review flows are safe by default.
- Do not add real official-site payment automation here. Browser runners belong
  in `viza-be/submission-service` only when explicitly reopened.
- Never store or return full card numbers, CVV, PIN, 3DS secrets, cookies,
  access tokens, official-site credentials, or unredacted provider payloads.
- User payment to VIZA remains separate from official-fee payment intents.
- Non-dry-run and company-advance flows must require admin approval.
- Unsupported countries must fail with controlled errors.

## Key Files

- `types.ts`: shared lifecycle, provider, repository, and response types.
- `country.ts`: VIZA country normalization to official-fee country codes.
- `redaction.ts`: recursive payload redaction before logging/storage.
- `providers.ts`: dry-run/manual/experimental provider implementations.
- `repository.ts`: Supabase persistence adapter for official-fee tables.
- `official-fee.service.ts`: quote, consent, payment, instrument, and
  reconciliation services.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run lint
npm run test -- src/services/official-fee/official-fee.test.ts
```
