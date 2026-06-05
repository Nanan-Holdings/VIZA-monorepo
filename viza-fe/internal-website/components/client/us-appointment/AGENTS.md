# U.S. Appointment Assistant Component Agent Guide

Scope: this file applies to
`viza-fe/internal-website/components/client/us-appointment/**`.

## Purpose

Applicant-facing U.S. B1/B2 appointment assistant UI after DS-160 capture.

## Guardrails

- The runnable experience is dry-run first. Do not imply a real appointment,
  payment, CAPTCHA, MFA, email verification, or official portal action happened
  unless the backend confirmation proves it.
- Keep every sensitive portal boundary as a manual checkpoint. Do not add
  bypass, auto-refresh, scraping loops, stealth browser behavior, or proxy
  instructions.
- All text must use `messages/en.json` and `messages/zh.json`.
- Use client portal primitives (`BrandField`, `BrandInput`,
  `BrandActionButton`, shadcn `Card`, `Alert`, and lucide icons).
