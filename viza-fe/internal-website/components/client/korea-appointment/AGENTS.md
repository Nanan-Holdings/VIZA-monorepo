# Korea Appointment Assistant Component Agent Guide

Scope: this file applies to
`viza-fe/internal-website/components/client/korea-appointment/**`.

## Purpose

Applicant-facing Korea C-3-9 KVAC appointment flow for mainland-China
applicants.

## Guardrails

- Keep the four stages sequential: center, official SMS, official slots, and
  result/final confirmation.
- Steps two through four must let the applicant return one step without
  creating a duplicate booking. Returning from slots requires a fresh official
  SMS session; returning from final approval must preserve all observed slots.
- Display only slots observed in the current official browser session. Never
  invent or label mock slots as official availability.
- A zero-slot result must include a screenshot of the loaded official booking
  window. Wait for the official calendar loading overlay to disappear after
  every month change before reading dates. A navigation or calendar-loading
  timeout is not proof that no slots exist.
- Never mark an appointment booked or cancelled until the official result page
  has been verified and evidence persisted.
- SMS codes are transient and must not be written to logs or the database.
- Keep user-facing copy localized and use the existing portal UI primitives.
