# Submission API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/submissions/**`.

## Purpose

These routes expose customer-facing submission queue helpers such as manual
checkpoint listing and completion. They read and update queue metadata only;
the official portal browser runner remains in `viza-be/submission-service`.

## Guardrails

- Verify the signed-in applicant owns the queue row's application before
  returning or mutating manual actions.
- Use `createAdminClient()` only after route-level authorization checks.
- Never accept, persist, or return CAPTCHA answers, payment data, passwords,
  cookies, tokens, or raw applicant identifiers.
- Completing a manual action may requeue a live-assisted job, but must not
  trigger official portal payment, final submit, or CAPTCHA solving.

## Related Files

- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
- `viza-be/submission-service/src/index.ts`
- `viza-be/agent-backend/drizzle/0096_vietnam_live_assisted_controls.sql`
