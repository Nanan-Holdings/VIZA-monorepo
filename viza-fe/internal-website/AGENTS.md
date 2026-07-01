# Internal Website Agent Guide

Scope: this file applies to `viza-fe/internal-website/**`.

## Purpose

The internal website is the main VIZA portal. It contains the applicant client
portal, admin operations portal, dynamic visa application forms, VIZA AI chat,
Travel AI UI, Supabase auth, and Next.js API proxy routes.

## Key Flows

- Client portal under `app/client/**`.
- Arrival-card preview entries under `app/client/arrival-cards/**`, routed to
  dedicated DB-driven application packages and kept separate from visa packages.
- Admin portal under `app/admin/**`.
- Application lifecycle and dynamic forms under `app/client/application/**`,
  `components/dynamic-step-form.tsx`, `components/dynamic-form-field.tsx`, and
  `components/application-steps/**`.
- Website internal automation client routes under `app/client/status/**`,
  `app/client/documents/**`, `app/client/checkout/**`,
  `app/client/billing/**`, `app/client/consent/**`, and
  `app/client/support/**`.
- Staff monitoring and coverage routes under
  `app/admin/(dashboard)/applications/**`,
  `app/admin/(dashboard)/packages/**`, and
  `app/admin/(dashboard)/billing/**`.
- Website automation server actions under
  `app/actions/internal-automation/**`.
- Payment, uploads, OCR, and external status API boundaries under
  `app/api/stripe/**`, `app/api/payments/**`, `app/api/document-upload/**`,
  `app/api/passport-ocr/**`, `app/api/translations/**`,
  `app/api/translate/**`, and
  `app/api/external-submission/**`.
- Applicant upload storage is the private Supabase Storage bucket
  `application-documents`, created by `supabase/migrations/**` with user-id
  path-prefix policies.
- Commercial and agency payment records are stored in `payment_records`,
  created by `supabase/migrations/*create_payment_records.sql`.
- Customer support ticket storage for `/client/support` and `/admin/support`
  is created by `supabase/migrations/*create_support_ticket_queue.sql`.
- VIZA AI chat under `app/client/chat/**` and
  `components/client/companion/**`.
- Customer service support center under `app/client/support/**`; keep it
  separate from `/client/chat`.
- U.S. B1/B2 appointment assistant under
  `app/client/applications/[applicationId]/us-appointment/**`,
  `components/client/us-appointment/**`, `lib/us-appointment/**`, and
  `types/us-appointment.ts`. The page reads existing VIZA appointment status on
  load, creates and starts work only from explicit user actions, lets applicants
  use China USVisaScheduling gated assisted-live with VIZA-created appointment
  account credentials, select observed official slots, approve payment/final
  booking, and display confirmation/status snapshots from the DB.
- Travel AI under `app/client/travel-chat/**`, `components/client/travel/**`,
  `lib/travel/**`, and `app/api/travel/**`.
- Auth and session protection through `proxy.ts`, `lib/supabase/**`,
  `lib/client-session.ts`, and `lib/impersonation-session.ts`.
- User-facing copy through `messages/en.json` and `messages/zh.json`.
- Local admin test-account bootstrap through
  `scripts/init-admin-account.mjs`, with password-reset decisions covered by
  `scripts/init-admin-account-helpers.mjs` and
  `scripts/__tests__/init-admin-account.test.ts`. Existing auth users must keep
  their password unless the CLI is run with both `--reset-password` and
  `--password`.
- Hosted Supabase auth email template sync through
  `scripts/sync-supabase-auth-email-templates.mjs`.
- Travel card coverage audit through
  `scripts/audit-travel-card-coverage.mjs`.
- Travel card coverage enrichment through
  `scripts/enrich-travel-card-coverage.mjs`.
- Travel local-first dropdown destination audit through
  `scripts/audit-travel-dropdown-destinations.ts`.
- Travel dropdown destination database seeding through
  `scripts/seed-dropdown-destinations.ts`.
- Travel local image relevance verification through
  `scripts/verify-travel-image-relevance.ts`.
- Travel natural-language prompt QA through
  `scripts/qa-travel-agent-prompts.ts`.
- Supabase remote schema verification through
  `scripts/verify-supabase-schema.ts`.
- Targeted VIZA-only Supabase migration through
  `scripts/migrate-viza-required.ts`.
- Live-assisted official submission status summaries are loaded through
  `lib/submission-live-status.ts`; keep service-role access server-only and
  expose customer/staff actions through route handlers or server actions.
- Chinese and English legal article copy for `/terms`, `/privacy`, and
  `/disclaimer` lives in `lib/legal/*-legal-content.ts`; auth footers and
  signup consent link to these routes.
- Internal wrapper for the repo env doctor through `scripts/doctor-env.ts`.
- VIZA-required Supabase migrations under `supabase/migrations/20260610_*`,
  including the generic `submission_manual_actions` bridge for official-site
  checkpoints, and the SQL Editor bundle under
  `supabase/manual/viza_required_schema.sql`.
- Vietnam official-fee payment migrations under
  `supabase/migrations/20260625_official_fee_payment.sql` and
  `supabase/migrations/20260625_vietnam_payment_status_tracking.sql`; these
  create the quote/intent/attempt/receipt tables and queue/status columns used
  by the Vietnam e-Visa payment checkpoint UI and submission-service runner.
- Vietnam official e-Visa form parity migration under
  `supabase/migrations/20260625_vn_evisa_official_form_parity.sql`; it keeps
  the DB-driven VIZA form aligned with official conditional questions, tables,
  date constraints, expense/insurance details, and ward/commune dependencies.
  `lib/vietnam-evisa-form-parity.ts` mirrors the same official parity metadata
  as a runtime safety net when the local database has not applied the migration
  yet; keep it in sync with the migration and avoid duplicating fields.
- Vietnam e-Visa photo and face-match rules live in
  `supabase/migrations/20260625_vn_evisa_photo_face_rules.sql`,
  `app/client/documents/actions.ts`, `app/actions/face-match.ts`,
  `app/api/applications/[id]/retry-submission/route.ts`, and
  `lib/face/match.ts`. The official upload gate requires portrait and passport
  data-page images under 2MB with detectable matching faces; use
  `FACE_MATCH_PROVIDER=openai_vision` plus `OPENAI_API_KEY` or
  `FACE_MATCH_OPENAI_API_KEY` for OpenAI vision matching, and tune
  `VN_FACE_MATCH_MIN_SCORE` only with evidence.
- France-Visas generated official account lookup for the applicant result UI
  is exposed server-side through
  `app/api/applications/[id]/france-visas-account/route.ts`; keep credential
  decryption service-role only and never put official account passwords in
  generic polling payloads or logs.

## Source Of Truth

Before client UI changes, read:

1. `viza-fe/internal-website/frontend.md`
2. The nearest route/component `AGENTS.md`
3. Neighboring components in the same feature directory

For product behavior, prefer docs under `docs/` and the current code over stale
comments.

## Ownership Boundaries

- Route orchestration belongs in `app/**/page.tsx` or route handlers.
- Reusable UI belongs in `components/**`.
- Server mutations belong in `app/actions/**` unless a real HTTP boundary is
  needed.
- Shared browser/server helpers belong in `lib/**`.
- User-facing filling/editing UI must align with the application form controls:
  reuse `components/application-steps/bilingual-form-shared.tsx`,
  `components/dynamic-form-field.tsx`, or canonical client form primitives for
  dates, countries, options, and text fields instead of adding one-off inputs.
- Keep `components/ui/**` as shadcn-style primitives; do not hide feature logic
  there.
- Do not expose service-role Supabase keys in client components.
- Do not implement official portal submission runners, CAPTCHA/proxy/browser
  fingerprint code, background slot polling, or real official-site payment
  inside website internal automation modules. The U.S. appointment assistant may
  call the gated submission-service China USVisaScheduling runner only from
  explicit user actions and must keep slot choice plus payment/final booking
  approval explicit in VIZA. Supported login/CAPTCHA/MFA/email/policy
  checkpoints belong in the gated runner with redacted official evidence and
  manual-required fallback.
- Korea C-3-9 official e-Form/KVAC flow lives under
  `app/api/applications/[id]/korea-official-eform/**`,
  `app/api/applications/[id]/kr-annex17-pdf/**`,
  `app/api/applications/[id]/korea-appointment/**`,
  `app/client/applications/[applicationId]/korea-appointment/**`,
  `components/client/korea-appointment/**`, and `lib/korea-c39/**`.
  It prioritizes Korea Visa Portal barcode e-Form generation/download, keeps
  the printable Annex-17 packet as a fallback, resolves the recommended China
  KVAC center, and records dry-run appointment slot selection/confirmation in
  the existing `appointment_*` tables. Real KVAC portal booking must remain
  gated behind the submission-service runner and explicit user-selected slot.

## Validation

Run from this directory:

```powershell
npm run type-check
npm run lint
npm run test
```

For focused tests, use `npx vitest run <path> --testTimeout=15000`.

Smoke URLs:

- `/client/home`
- `/client/application`
- `/client/application?country=indonesia&visaType=B211A`
- `/client/status`
- `/client/documents`
- `/client/checkout`
- `/client/billing`
- `/client/consent`
- `/client/chat`
- `/client/support`
- `/client/travel-chat`
- `/admin`
- `/admin/applications`
- `/admin/packages`
- `/admin/billing`

## Important Files

- `package.json`
- `proxy.ts`
- `vitest.config.mts`
- `vitest.server-only.ts`
- `app/layout.tsx`
- `app/error.tsx`
- `app/client/layout.tsx`
- `app/admin/admin-layout-content.tsx`
- `app/actions/*`
- `app/actions/internal-automation/*`
- `app/api/document-upload/*`
- `app/api/external-submission/*`
- `app/api/passport-ocr/*`
- `app/api/translations/*`
- `app/api/translate/*`
- `app/api/stripe/*`
- `app/api/travel/*`
- `components/ui/*`
- `components/smooth-progress.tsx`
- `components/runtime-abort-error-guard.tsx`
- `components/runtime-abort-error-script.tsx`
- `components/client/*`
- `components/client/passport-ocr-upload.tsx`
- `components/client/us-appointment/*`
- `components/client/korea-appointment/*`
- `components/application-steps/*`
- `components/dynamic-step-form.tsx`
- `components/dynamic-form-field.tsx`
- `components/field-guidance-panel.tsx`
- `hooks/use-smooth-progress.ts`
- `lib/supabase/*`
- `lib/document-upload-client.ts`
- `lib/document-image-validation.ts`
- `lib/application-tab-completion.ts`
- `lib/application-step-sections.ts`
- `lib/birthplace-options.ts`
- `lib/vietnam-administrative-units.ts`
- `lib/visa-form-schema-aliases.ts`
- `lib/__tests__/universal-profile-prefill.test.ts`
- `lib/us-appointment/*`
- `lib/korea-c39/*`
- `lib/client/recent-application-form.ts`
- `lib/runtime-abort-errors.ts`
- `lib/runtime-abort-retry.ts`
- `supabase/migrations/*`
- `supabase/manual/*`
- `supabase/templates/*`
- `lib/i18n/locale.ts`
- `lib/frequent-traveler-profile.ts`
- `lib/universal-profile-prefill.ts`
- `lib/translation/*`
- `lib/passport/*`
- `lib/submission-queue.ts`
- `lib/applicant-profile-identity.ts`
- `lib/ds160-proof.ts`
- `lib/__tests__/ds160-proof.spec.ts`
- `lib/legal/*`
- `lib/travel/*`
- `messages/en.json`
- `messages/zh.json`
- `types/us-appointment.ts`
- `scripts/sync-supabase-auth-email-templates.mjs`
- `scripts/audit-travel-card-coverage.mjs`
- `scripts/enrich-travel-card-coverage.mjs`
- `scripts/audit-travel-dropdown-destinations.ts`
- `scripts/seed-dropdown-destinations.ts`
- `scripts/verify-travel-image-relevance.ts`
- `types/*`
