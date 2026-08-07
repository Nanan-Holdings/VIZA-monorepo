# Form Assistant Shared Policy Guide

Scope: this file applies to `lib/form-assistant/**`.

## Responsibilities

- Keep document extraction policies pure and deterministic. They may classify
  document types and allowlisted field categories, but must not read storage,
  call an AI provider, or persist applicant answers.
- Unknown document types and field names are denied by default.
- Product document requirements must come from reviewed product configuration;
  the assistant must never invent requirements from a model response.
- `SG_ARRIVAL_CARD` intentionally has no document requirements.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npx vitest run lib/form-assistant/document-extraction-policy.test.ts
npm run type-check
```

