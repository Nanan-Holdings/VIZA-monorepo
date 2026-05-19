# Client Portal Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/**`.

## Purpose

The client portal is the authenticated applicant experience: home dashboard,
destination selection, payment, consent, document checklist, application status
and form filling, VIZA AI, Travel AI, settings, subscription, universal
applicant info, and help pages.

## Key Flows

- `layout.tsx`: client shell, nav, session validation, impersonation mismatch
  handling, first-login form request redirect.
- `home/page.tsx`: dashboard, destination cards, subscription entry, universal
  information summary.
- `application/page.tsx`: status hub by default; direct `country`/`visaType`
  links open the application form workflow.
- `status/**`: canonical customer-facing status center for website automation
  progress, external handoff state, and result delivery.
- `documents/**`: document checklist center, upload state, OCR confirmation,
  and missing-material recovery.
- `checkout/**`: Stripe Checkout entry for VIZA agency fee only.
- `billing/**`: receipts, invoice requests, refund visibility, and payment
  history.
- `consent/**`: ToS/privacy/agency authorisation acceptance and e-signature
  workflow.
- `settings/**`: account settings plus privacy export/deletion request surface.
- `chat/page.tsx` and `chat/chat-client.tsx`: VIZA AI and Travel AI tabbed chat.
- `travel-chat/page.tsx` and `travel-chat/travel-chat-client.tsx`: dedicated
  Travel AI route.
- `universal-info/page.tsx`: reusable applicant profile editor.
- `(auth)/*`: client login/register/signup pages.

## Ownership Boundaries

- Shared client UI belongs in `components/client/**`, not directly in route
  files, once it is reused or grows beyond route orchestration.
- Application form internals are governed by
  `app/client/application/AGENTS.md`.
- Chat internals are governed by `app/client/chat/AGENTS.md`.
- Status, documents, checkout, billing, consent, and settings routes have their
  own child `AGENTS.md`; read those before changing the relevant route.
- Travel component internals are governed by
  `components/client/travel/AGENTS.md`.
- Do not bypass `proxy.ts` or the client shell session checks when adding new
  authenticated routes.
- Use `getAuthenticatedUserId()` for user identity when impersonation support
  matters.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke the changed route at desktop and mobile widths. For authenticated routes
without a session, verify redirect to `/client/login` and test the closest
accessible component state.

## Related Files

- `viza-fe/internal-website/frontend.md`
- `viza-fe/internal-website/proxy.ts`
- `viza-fe/internal-website/app/client/layout.tsx`
- `viza-fe/internal-website/app/client/home/page.tsx`
- `viza-fe/internal-website/app/client/application/page.tsx`
- `viza-fe/internal-website/app/client/status/AGENTS.md`
- `viza-fe/internal-website/app/client/documents/AGENTS.md`
- `viza-fe/internal-website/app/client/checkout/AGENTS.md`
- `viza-fe/internal-website/app/client/billing/AGENTS.md`
- `viza-fe/internal-website/app/client/consent/AGENTS.md`
- `viza-fe/internal-website/app/client/settings/AGENTS.md`
- `viza-fe/internal-website/app/client/chat/chat-client.tsx`
- `viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx`
- `viza-fe/internal-website/app/actions/client-auth.ts`
- `viza-fe/internal-website/app/actions/form-requests.ts`
- `viza-fe/internal-website/lib/auth/get-authenticated-user.ts`
- `viza-fe/internal-website/messages/en.json`
- `viza-fe/internal-website/messages/zh.json`
