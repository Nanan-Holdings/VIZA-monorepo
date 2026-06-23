# U.S. Appointment Assistant Component Agent Guide

Scope: this file applies to
`viza-fe/internal-website/components/client/us-appointment/**`.

## Purpose

Applicant-facing U.S. B1/B2 appointment assistant UI after DS-160 capture.

## Guardrails

- Opening the page must only read VIZA DB status; do not create, rerun, or
  rebook an appointment job until the applicant clicks an explicit action.
- Loading/progress UI must be bound only to an active appointment job. Terminal,
  failed, cancelled, or confirmed jobs should show status/results instead of an
  indefinite spinner.
- Do implement or document bypasses for official login, CAPTCHA/MFA,
  waiting rooms, policy prompts, payment controls, rate limits, or final
  confirmation pages.
- The account email-verification path may be automated when it uses the VIZA
  alias email flow (`applicant_profiles.inbox_alias` -> Cloudflare Email
  Worker -> `inbound_email`) and stores only redacted checkpoint metadata.
- Do not ask the applicant to re-enter DS-160-derived appointment location or
  preferred timing fields on this page. The page should create an explicit job
  first, then display slots returned from backend/official-portal observation
  for the user to choose.
- Do not ask for preferred dates, avoided dates, or time preference before the
  backend has read currently available timings. Show backend-observed slots
  first, then let the applicant choose one.
- New appointment account email copy should describe the VIZA alias email path
  (`applicant_profiles.inbox_alias` -> Cloudflare Email Worker ->
  `inbound_email`), not legacy IMAP.
- All text must use `messages/en.json` and `messages/zh.json`.
- Use client portal primitives (`BrandField`, `BrandInput`,
  `BrandActionButton`, shadcn `Card`, `Alert`, and lucide icons).
