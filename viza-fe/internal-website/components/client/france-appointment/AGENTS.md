# France Appointment Assistant Component Agent Guide

Scope: this file applies to
`viza-fe/internal-website/components/client/france-appointment/**`.

## Purpose

Applicant-facing France Schengen TLScontact China appointment assistant UI after
France-Visas official reference capture.

## Guardrails

- Opening the page must only read VIZA appointment status. Do not create, rerun,
  check TLS slots, select a slot, record payment authorization, or request
  booking until the applicant clicks an explicit action.
- Users can choose only backend-observed TLS slots from the current job. Do not
  collect preferred dates or let the frontend invent appointment timings.
- Payment UI may display or collect only redacted one-time authorization
  metadata such as brand, last4, and expiry. Full PAN, CVV, OTP, payment
  password, and provider tokens must never be sent to agent-backend status APIs,
  persisted in DB, logged, or rendered in screenshots.
- Unsupported official-site gates such as MFA, real-name checks, WAF, policy
  blocks, or payment challenges must remain visible as paused checkpoint states;
  do not present them as completed bookings.
- All text must use `messages/en.json` and `messages/zh.json`.
- Use client portal primitives (`BrandField`, `BrandInput`, shadcn `Card`,
  `Alert`, `Button`, and lucide icons).
