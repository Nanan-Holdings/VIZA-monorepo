# France Appointment Client Helper Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/france-appointment/**`.

## Purpose

Typed browser helpers and mainland China TLScontact center options for the
France Schengen appointment assistant API in
`viza-be/agent-backend/src/routes/france-appointment.routes.ts`.

## Guardrails

- Use the applicant's Supabase access token only; never expose service-role
  keys, France-Visas/TLS passwords, cookies, full official references, payment
  card numbers, CVV, OTP, or payment passwords to browser helpers.
- Keep the mainland China center list aligned with the submission-service
  France TLS registry. Center-specific differences should stay data-driven by
  code/name, not forked UI flows.
- API helpers may trigger only explicit user actions: consent, job creation,
  user-triggered slot checks, choosing an observed slot, recording redacted
  payment authorization, final approval, booking request, and cancellation.
