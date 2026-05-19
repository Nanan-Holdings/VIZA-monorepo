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
  `app/client/billing/**`, and `app/client/consent/**`.
- Staff monitoring and coverage routes under
  `app/admin/(dashboard)/applications/**`,
  `app/admin/(dashboard)/packages/**`, and
  `app/admin/(dashboard)/billing/**`.
- Website automation server actions under
  `app/actions/internal-automation/**`.
- Payment, OCR, and external status API boundaries under `app/api/stripe/**`,
  `app/api/passport-ocr/**`, and `app/api/external-submission/**`.
- VIZA AI chat under `app/client/chat/**` and
  `components/client/companion/**`.
- Travel AI under `app/client/travel-chat/**`, `components/client/travel/**`,
  `lib/travel/**`, and `app/api/travel/**`.
- Auth and session protection through `proxy.ts`, `lib/supabase/**`,
  `lib/client-session.ts`, and `lib/impersonation-session.ts`.
- User-facing copy through `messages/en.json` and `messages/zh.json`.

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
- Keep `components/ui/**` as shadcn-style primitives; do not hide feature logic
  there.
- Do not expose service-role Supabase keys in client components.
- Do not implement official portal submission runners, CAPTCHA/proxy/browser
  fingerprint code, or calls into `viza-be/submission-service` from website
  internal automation modules.

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
- `/client/travel-chat`
- `/admin`
- `/admin/applications`
- `/admin/packages`
- `/admin/billing`

## Important Files

- `package.json`
- `proxy.ts`
- `app/layout.tsx`
- `app/client/layout.tsx`
- `app/admin/admin-layout-content.tsx`
- `app/actions/*`
- `app/actions/internal-automation/*`
- `app/api/external-submission/*`
- `app/api/passport-ocr/*`
- `app/api/stripe/*`
- `app/api/travel/*`
- `components/ui/*`
- `components/client/*`
- `components/application-steps/*`
- `components/dynamic-step-form.tsx`
- `components/dynamic-form-field.tsx`
- `components/field-guidance-panel.tsx`
- `lib/supabase/*`
- `lib/travel/*`
- `messages/en.json`
- `messages/zh.json`
- `types/*`
