# Submission Service Agent Guide

Scope: this file applies to `viza-be/submission-service/**`.

## Purpose

The submission service is a long-running Node/TypeScript worker that polls
`submission_queue` and drives official portal automation with Playwright.

## Key Flows

- `src/index.ts`: polling loop, Supabase data loading, document download,
  Indonesian e-visa automation, DS-160 job dispatch, retry/failure handling.
- `src/form-mappings.ts`: Indonesian e-visa portal selectors.
- `src/ds160-form-mappings.ts`: DS-160 field selector mappings.
- `src/ds160-coverage-audit.ts` and `src/ds160-completeness-verify.ts`:
  coverage/verification utilities.
- `src/ceac/**`: CEAC runtime pipeline for DS-160 prefill.
- `src/alert.ts`: Resend failure alerts.
- `src/supabase.ts`: Supabase service client.

## Ownership Boundaries

- Do not click final DS-160 sign/submit or solve the final submission gate.
  CEAC automation stops at operator handoff.
- Keep Playwright selectors isolated in mapping files where possible.
- Keep retries and queue status transitions explicit.
- Do not move AI/RAG logic here; use `agent-backend`.
- Do not move frontend submission UI here; use `viza-fe/internal-website`.

## Validation

Run from this directory:

```powershell
npm run type-check
npm run build
```

For CEAC changes, follow `docs/ceac-smoke-test.md` and preserve diagnostics
artifacts for failures.

## Related Files

- `viza-be/submission-service/README.md`
- `viza-be/submission-service/.env.example`
- `viza-be/submission-service/src/index.ts`
- `viza-be/submission-service/src/types.ts`
- `viza-be/submission-service/src/ceac/AGENTS.md`
- `viza-be/agent-backend/src/db/schema.ts`
- `docs/prd-ds160-ceac-runtime-validation.md`
