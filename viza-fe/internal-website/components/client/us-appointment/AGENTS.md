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
- The website may poll VIZA's own status endpoint every 5-10 seconds, but must
  not high-frequency refresh the official appointment portal.
- Keep security-sensitive official portal boundaries visible in UI. The actual
  official-site browser work belongs in `viza-be/submission-service`; do not add
  CAPTCHA bypass, stealth browser behavior, or proxy instructions to frontend
  code.
- New appointment account email copy should describe the VIZA alias email path
  (`applicant_profiles.inbox_alias` -> Cloudflare Email Worker ->
  `inbound_email`), not legacy IMAP.
- All text must use `messages/en.json` and `messages/zh.json`.
- Use client portal primitives (`BrandField`, `BrandInput`,
  `BrandActionButton`, shadcn `Card`, `Alert`, and lucide icons).
