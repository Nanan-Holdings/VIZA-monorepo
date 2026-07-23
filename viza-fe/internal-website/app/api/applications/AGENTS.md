# Application API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/applications/**`.

## Purpose

Application API routes expose same-origin helpers for application-specific
downloads, translation review, and customer-facing artifacts. They sit between
browser components and backend services so client pages do not call service
ports directly.

## Guardrails

- Verify the signed-in applicant owns the application before proxying or
  returning application data.
- Use `createAdminClient()` only after route-level authorization.
- Prefer graceful JSON fallbacks for optional services such as translation so
  review pages remain usable when the agent backend is offline.
- Keep official submission automation out of these routes. Status routes may
  read queue/application state, but runner execution remains in
  `viza-be/submission-service`.
- Korea C-3-9 routes may render the filled Annex-17 fallback PDF, proxy official
  e-Form/KVAC actions to gated `viza-be/submission-service` runners, expose
  redacted evidence artifacts, and record appointment state in existing
  `appointment_*` tables. They must not fake official e-Form PDF or booking
  success without runner-captured official evidence.

## Related Files

- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/official-fee/authorize/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/official-fee/pay/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/official-fee/status/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/official-fee/status/route.test.ts`
- `viza-fe/internal-website/app/api/applications/[id]/official-status/refresh/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/artifact-url/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/ds160-proof/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-artifact/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/arrival-card-new-application/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/sgac-new-application/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route.ts`
  returns a retryable `503` response when its database dependency times out so
  the client can keep polling without losing the durable submission state.
- `viza-fe/internal-website/app/api/applications/[id]/kr-annex17-pdf/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-official-eform/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-appointment/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-evidence/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-appointment-proof-pdf/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route.test.ts`
- `viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx`
- `viza-fe/internal-website/components/application-steps/translation-panel.tsx`
- `viza-fe/internal-website/lib/submission-queue.ts`
- `viza-be/agent-backend/src/routes/translation.routes.ts`
