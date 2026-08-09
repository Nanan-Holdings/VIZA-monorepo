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
- Vietnam/Indonesia official-fee payment enqueue must call the service-role
  `enqueue_official_fee_submission` RPC. It serializes by application, reuses
  claimed work, supersedes only same-application stale work, and prevents
  duplicate active browser jobs.
- Generic retry enqueue must call the service-role `enqueue_submission_retry`
  RPC so supersede-and-insert is atomic. Never reintroduce separate update and
  insert calls; concurrent retries for one application must reuse one job.
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
  authorizes both legacy application-id paths and exact artifact paths recorded
  in the owned application's trusted submission result, including shared-runner
  `jobs/<job-id>/**` QR paths.
- `viza-fe/internal-website/app/api/applications/[id]/submission-artifact/route.test.ts`
  guards shared-runner artifact access without allowing unrelated job paths or
  strings found only in runner logs.
- `viza-fe/internal-website/app/api/applications/[id]/arrival-card-new-application/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/new-application/route.ts`
  creates a new blank U.S. DS-160 VIZA draft from a submitted application and
  returns the explicit form URL; it must not copy answers or enqueue official
  submission work.
- `viza-fe/internal-website/app/api/applications/[id]/sgac-new-application/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route.ts`
  returns a retryable `503` response when its database dependency times out so
  the client can keep polling without losing the durable submission state.
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/payment-country.ts`
  keeps Vietnam and Indonesia payment checkpoints country-scoped before a
  temporary customer-facing result is synthesized.
- `viza-fe/internal-website/app/api/applications/[id]/kr-annex17-pdf/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-official-eform/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-appointment/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-evidence/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/korea-appointment-proof-pdf/route.ts`
- `viza-fe/internal-website/app/api/applications/[id]/submission-status/route.test.ts`
- `viza-fe/internal-website/app/api/applications/[id]/form-assistant/transcribe/route.ts`
  accepts a short-lived, ownership-checked multipart recording, forwards it to
  the configured OpenAI transcription model, and returns editable text. It
  must not persist raw audio or expose provider error payloads.
- `viza-fe/internal-website/app/api/applications/[id]/form-assistant/route.ts`
  and its `turn`, `undo`, `validate`, `acknowledge-warnings`, and owned `documents/*/extract`
  children provide the application-level assistant for DB-driven forms. Keep
  schema-scoped extraction, exact country/product RAG binding, user-wins conflict checks, and
  no-official-submission boundary intact. Undo must compare the current
  assistant-owned value before restoring or deleting it so later manual edits
  always win.
- `viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx`
- `viza-fe/internal-website/components/application-steps/translation-panel.tsx`
- `viza-fe/internal-website/lib/submission-queue.ts`
- `viza-be/agent-backend/src/routes/translation.routes.ts`
