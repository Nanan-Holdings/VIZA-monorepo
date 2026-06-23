# U.S. Appointment Client Helper Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/us-appointment/**`.

## Purpose

Typed browser helpers for the U.S. B1/B2 appointment assistant API in
`viza-be/agent-backend/src/routes/us-appointment.routes.ts`.

## Guardrails

- Use the applicant's Supabase access token only; never expose service-role
  keys, portal passwords, cookies, or payment details to the browser.
- Do expose only typed calls into the gated backend/submission-service runner
  for official login, supported CAPTCHA/MFA, waiting rooms, policy prompts,
  payment, rate limits, and final confirmation. Unsupported gates must surface
  as redacted manual-required states, not as browser-side bypass behavior.
- Account email verification may be represented as automated when the backend
  consumes the applicant's VIZA alias email from `inbound_email`; do not expose
  portal passwords, mailbox contents, or unredacted verification payloads to the
  browser.
