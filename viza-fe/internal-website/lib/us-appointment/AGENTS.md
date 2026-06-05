# U.S. Appointment Client Helper Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/us-appointment/**`.

## Purpose

Typed browser helpers for the U.S. B1/B2 appointment assistant API in
`viza-be/agent-backend/src/routes/us-appointment.routes.ts`.

## Guardrails

- Use the applicant's Supabase access token only; never expose service-role
  keys, portal passwords, cookies, or payment details to the browser.
- Keep executable mode `dry_run` unless a future verified implementation adds
  compliant live support.
- Do not add polling loops. Slot/status checks must remain explicit
  user-triggered actions.
- Do not add CAPTCHA, MFA, email, payment, waiting-room, proxy, fingerprint, or
  rate-limit bypass logic.
