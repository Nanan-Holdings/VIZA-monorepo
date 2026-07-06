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
- `home/page.tsx`: dashboard (hero, subscription entry, universal information
  summary, recent activity). Destination selection moved to
  `destinations/page.tsx`.
- `destinations/page.tsx`: country/application switch page — "my applications"
  switcher plus the popular-destinations catalog (featured, region groups,
  search). Reached via the hamburger menu "Change country" item. Progress
  computation lives in `lib/client/application-progress.ts` (shared with home's
  activity hrefs). Region browse subpages: `destinations/[region]/`.
- `home/home-load-errors.ts`: safe dashboard load-error classification for
  refresh/abort handling.
- `home/home-activity.ts`: safe activity-feed helpers, including document type
  label fallback for unknown uploads.
- `session-check-errors.ts`: safe client-shell session-check error
  classification for transient browser fetch/abort failures.
- `application/page.tsx`: status hub by default; direct `country`/`visaType`
  links open the application form workflow.
- `arrival-cards/**`: country-specific digital arrival-card preview entries
  that route into dedicated DB-driven application packages without changing the
  main destination catalog before review.
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
- `subscription/**`: RMB subscription and pay-per-application pricing, plus
  Stripe/WeChat Pay/Alipay payment entry points for commercial plans.
- `chat/page.tsx` and `chat/chat-client.tsx`: VIZA AI and Travel AI tabbed chat.
- `support/**`: customer service help center, self-service support bot, and
  human/email handoff. This must remain separate from the visa/travel AI chat.
- `travel-chat/page.tsx` and `travel-chat/travel-chat-client.tsx`: dedicated
  Travel AI route.
- `applications/[applicationId]/us-appointment/page.tsx`: U.S. B1/B2
  appointment assistant entry after DS-160 capture/submission. It may use China
  USVisaScheduling gated assisted-live from explicit user actions, while other
  countries/posts remain dry-run or manual until verified.
- `applications/[applicationId]/korea-appointment/page.tsx`: Korea C-3-9 KVAC
  appointment assistant entry after official e-Form/fallback packet generation.
  It reads the recommended China KVAC center, lets users choose observed slots,
  and records dry-run booking confirmation only after explicit slot selection.
- `applications/[applicationId]/korea-appointment/rules/page.tsx`: Korea C-3-9
  rule detail page for recommended KVAC/consular routing, walk-in notes,
  official-source links, and alternative mainland China channels.
- `applications/[applicationId]/france-appointment/page.tsx`: France Schengen
  TLScontact China appointment assistant entry after France-Visas official
  reference capture. It reads backend-observed TLS slots, keeps user slot
  selection and final approval explicit, and records only redacted one-time TLS
  service-fee authorization metadata.
- `universal-info/page.tsx`: reusable applicant profile editor.
- `(auth)/*`: client login/register/signup pages.

## Ownership Boundaries

- Shared client UI belongs in `components/client/**`, not directly in route
  files, once it is reused or grows beyond route orchestration.
- Filling/editing pages in the client portal must visually and behaviorally
  align with the application form. Reuse the bilingual form shared controls for
  Chinese-language two-column fields and the same date, country, and option
  controls before introducing any local input/select/date UI.
- Application form internals are governed by
  `app/client/application/AGENTS.md`.
- Chat internals are governed by `app/client/chat/AGENTS.md`.
- Status, documents, checkout, billing, consent, and settings routes have their
  own child `AGENTS.md`; read those before changing the relevant route.
- Travel component internals are governed by
  `components/client/travel/AGENTS.md`.
- U.S. appointment component internals are governed by
  `components/client/us-appointment/AGENTS.md`; browser API helpers are governed
  by `lib/us-appointment/AGENTS.md`.
- France appointment component internals are governed by
  `components/client/france-appointment/AGENTS.md`; browser API helpers and
  TLS China center options are governed by `lib/france-appointment/AGENTS.md`.
- Korea appointment component internals live in
  `components/client/korea-appointment/**`; official e-Form status lives under
  `app/api/applications/[id]/korea-official-eform/**`; KVAC routing and fallback
  PDF helpers live in `lib/korea-c39/**`.
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
- `viza-fe/internal-website/app/client/session-check-errors.ts`
- `viza-fe/internal-website/app/client/home/page.tsx`
- `viza-fe/internal-website/app/client/application/page.tsx`
- `viza-fe/internal-website/app/client/arrival-cards/AGENTS.md`
- `viza-fe/internal-website/app/client/status/AGENTS.md`
- `viza-fe/internal-website/app/client/documents/AGENTS.md`
- `viza-fe/internal-website/app/client/checkout/AGENTS.md`
- `viza-fe/internal-website/app/client/billing/AGENTS.md`
- `viza-fe/internal-website/app/client/consent/AGENTS.md`
- `viza-fe/internal-website/app/client/settings/AGENTS.md`
- `viza-fe/internal-website/app/client/support/AGENTS.md`
- `viza-fe/internal-website/app/client/chat/chat-client.tsx`
- `viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx`
- `viza-fe/internal-website/app/client/applications/[applicationId]/us-appointment/page.tsx`
- `viza-fe/internal-website/app/client/applications/[applicationId]/korea-appointment/page.tsx`
- `viza-fe/internal-website/app/client/applications/[applicationId]/korea-appointment/rules/page.tsx`
- `viza-fe/internal-website/app/client/applications/[applicationId]/france-appointment/page.tsx`
- `viza-fe/internal-website/components/client/us-appointment/AGENTS.md`
- `viza-fe/internal-website/components/client/france-appointment/AGENTS.md`
- `viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentAssistant.tsx`
- `viza-fe/internal-website/components/client/korea-appointment/KoreaAppointmentRules.tsx`
- `viza-fe/internal-website/lib/us-appointment/AGENTS.md`
- `viza-fe/internal-website/lib/france-appointment/AGENTS.md`
- `viza-fe/internal-website/lib/korea-c39/*`
- `viza-fe/internal-website/app/actions/client-auth.ts`
- `viza-fe/internal-website/app/actions/form-requests.ts`
- `viza-fe/internal-website/lib/auth/get-authenticated-user.ts`
- `viza-fe/internal-website/messages/en.json`
- `viza-fe/internal-website/messages/zh.json`
