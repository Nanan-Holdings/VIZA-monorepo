# Internal Website Agent Guide

Scope: this file applies to `viza-fe/internal-website/**`.

## Purpose

The internal website is the main VIZA portal. It contains the applicant client
portal, admin operations portal, dynamic visa application forms, VIZA AI chat,
Travel AI UI, Supabase auth, and Next.js API proxy routes.

## Key Flows

- Client portal under `app/client/**`.
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
  `app/api/passport-ocr/**`, `app/api/translations/**`, and
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
  `types/us-appointment.ts`. Dry-run/manual-checkpoint only.
- Travel AI under `app/client/travel-chat/**`, `components/client/travel/**`,
  `lib/travel/**`, and `app/api/travel/**`.
- Auth and session protection through `proxy.ts`, `lib/supabase/**`,
  `lib/client-session.ts`, and `lib/impersonation-session.ts`.
- User-facing copy through `messages/en.json` and `messages/zh.json`.
- Local admin test-account bootstrap through
  `scripts/init-admin-account.mjs`.
- Hosted Supabase auth email template sync through
  `scripts/sync-supabase-auth-email-templates.mjs`.
- Travel card coverage audit through
  `scripts/audit-travel-card-coverage.mjs`.
- Travel card coverage enrichment through
  `scripts/enrich-travel-card-coverage.mjs`.

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
  fingerprint code, background slot polling, real official-site payment, or
  calls into `viza-be/submission-service` from website internal automation
  modules. The U.S. appointment assistant must keep login, CAPTCHA, MFA/email,
  payment, slot choice, and final booking approval as human checkpoints.

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
- `app/client/layout.tsx`
- `app/admin/admin-layout-content.tsx`
- `app/actions/*`
- `app/actions/internal-automation/*`
- `app/api/document-upload/*`
- `app/api/external-submission/*`
- `app/api/passport-ocr/*`
- `app/api/translations/*`
- `app/api/stripe/*`
- `app/api/travel/*`
- `components/ui/*`
- `components/client/*`
- `components/client/passport-ocr-upload.tsx`
- `components/client/us-appointment/*`
- `components/application-steps/*`
- `components/dynamic-step-form.tsx`
- `components/dynamic-form-field.tsx`
- `components/field-guidance-panel.tsx`
- `lib/supabase/*`
- `lib/document-upload-client.ts`
- `lib/us-appointment/*`
- `lib/client/recent-application-form.ts`
- `supabase/migrations/*`
- `supabase/templates/*`
- `lib/i18n/locale.ts`
- `lib/universal-profile-prefill.ts`
- `lib/translation/*`
- `lib/travel/*`
- `messages/en.json`
- `messages/zh.json`
- `types/us-appointment.ts`
- `scripts/sync-supabase-auth-email-templates.mjs`
- `scripts/audit-travel-card-coverage.mjs`
- `scripts/enrich-travel-card-coverage.mjs`
- `types/*`
