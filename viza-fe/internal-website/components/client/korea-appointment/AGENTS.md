# Korea Appointment Assistant Component Agent Guide

Scope: this file applies to
`viza-fe/internal-website/components/client/korea-appointment/**`.

## Purpose

Applicant-facing Korea C-3-9 KVAC appointment flow for mainland-China
applicants.

## Guardrails

- Keep the five persisted stages sequential: review/details and center,
  official verification, official slots, final confirmation, and result.
- Render exactly one current-stage card. Verified zero-slot, worker unavailable,
  SMS, and manual-guidance states replace the current stage content instead of
  stacking global status cards above it.
- Steps two through five must let the applicant return one step without
  creating a duplicate booking. Returning from slots requires a fresh official
  SMS session; returning from final approval must preserve all observed slots.
- Persist review confirmation before starting an official session. Initial page
  load remains read-only and must not create a job or wake a Fly machine.
- Display only slots observed in the current official browser session. Never
  invent or label mock slots as official availability.
- A zero-slot result must include a screenshot of the loaded official booking
  window. Wait for the official calendar loading overlay to disappear after
  every month change before reading dates. A navigation or calendar-loading
  timeout is not proof that no slots exist.
- Treat a verified zero-slot result as normal availability, not a system
  failure. Show a localized neutral notice and never expose submission-service
  URLs, HTTP status codes, or worker error text to applicants.
- Official-guidance/manual center states must provide an in-flow return action
  that clears the checkpoint and reopens review/center selection; the page-header
  back button remains reserved for returning to the application form.
- Keep reschedule, cancellation, and appointment history behind the result
  page's appointment-management sheet so they do not compete with the current
  first-booking task.
- Never mark an appointment booked or cancelled until the official result page
  has been verified and evidence persisted.
- SMS codes are transient and must not be written to logs or the database.
- Keep user-facing copy localized and use the existing portal UI primitives.

## Shenyang review contract

- For the exact Shenyang center, the single review card is assembled in this
  order: application answers first, universal profile fallbacks second, and
  unresolved required fields last. The card must show the resolved source and
  the missing fields together so the applicant can complete one review task.
- Any applicant supplements saved from this card apply only to the current
  application. They must not mutate the universal profile or become defaults
  for another application.
- `GET` remains read-only: loading or revisiting the review card must not wake
  Fly, create a job, or contact VFS. Keep source/redaction rules visible in the
  card and expose one primary CTA for saving/continuing the review.
- Non-Shenyang centers retain the existing review and routing behavior; do not
  apply this fallback or supplement contract to them.
