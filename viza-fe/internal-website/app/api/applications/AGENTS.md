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

## Related Files

- `viza-fe/internal-website/app/api/applications/[id]/retry-submission/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route.ts`
- `viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx`
- `viza-fe/internal-website/components/application-steps/translation-panel.tsx`
- `viza-fe/internal-website/lib/submission-queue.ts`
- `viza-be/agent-backend/src/routes/translation.routes.ts`
