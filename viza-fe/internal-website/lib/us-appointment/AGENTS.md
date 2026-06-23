# U.S. Appointment Client Helper Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/us-appointment/**`.

## Purpose

Typed browser helpers for the U.S. B1/B2 appointment assistant API in
`viza-be/agent-backend/src/routes/us-appointment.routes.ts`.

## Guardrails

- Use the applicant's Supabase access token only; never expose service-role
  keys, portal passwords, cookies, or payment details to the browser.
- Do add bypass behavior for official login, CAPTCHA/MFA,
  waiting rooms, policy prompts, payment, rate limits, or final confirmation.
- Account email verification may be represented as automated when the backend
  consumes the applicant's VIZA alias email from `inbound_email`; do not expose
  portal passwords, mailbox contents, or unredacted verification payloads to the
  browser.
