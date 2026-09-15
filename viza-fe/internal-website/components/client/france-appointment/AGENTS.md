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
- After the applicant checks consent, the explicit start action may idempotently
  record that consent, create the assisted-live job, and immediately run the
  first account/slot step. Keep the four-stage alias, slots, final approval, and
  confirmation progress surface bound to persisted backend status.
- Users can choose only backend-observed TLS slots from the current job. Do not
  collect preferred dates or let the frontend invent appointment timings.
- Start new jobs in `assisted_live` mode by default. Dry-run is for tests only
  and must not be presented as real TLS availability.
- Payment collection and authorization have been removed. Do not render card
  fields or invoke payment-session APIs, including for historical dry-run jobs.
  Official fee requirements remain unresolved checkpoints, never paid evidence.
- Unsupported official-site gates such as MFA, real-name checks, WAF, policy
  blocks, or payment challenges must remain visible as paused checkpoint states;
  do not present them as completed bookings.
- All text must use `messages/en.json` and `messages/zh.json`.
- Use client portal primitives (`BrandField`, `BrandInput`,
  `BrandActionButton`, shadcn `Card`, `Alert`, `Button`, and Phosphor icons).
- `france-appointment-assistant.test.tsx` covers the assisted-live read-only
  slot observation boundary; keep selection, payment, and final-booking
  controls absent from that mode.
- The assistant's status refresh is read-only and must keep one request in
  flight. Use the per-request abort signal for cleanup, pause at the existing
  hidden-tab cadence, and preserve the persisted terminal-status boundary;
  visibility refreshes must never invoke appointment mutations.
