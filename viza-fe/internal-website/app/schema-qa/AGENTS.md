# Non-persistent Schema QA Preview

Scope: this file applies to `app/schema-qa/**`.

## Purpose

`/schema-qa` is a development-only preview of a complete master-schema form.
It uses deterministic fictional answers in browser memory so country forms can
be visually inspected without writing QA data to customer applications.

## Guardrails

- Keep the route unavailable in production.
- Never load applicant profiles, application answers, documents, or credentials.
- Never call application save, assistant, queue, payment, or submission APIs.
- Build the preview from the live master schema and the shared dynamic form
  components; do not maintain a duplicate field inventory.
- Preview values must remain obviously fictional and must never be exported to
  Universal Profile or Supabase.
- `scripts/generate-all-application-qa-fixtures.ts` may read the master schemas,
  but its 75-route fixture report must remain a local, ignored file and must
  always be marked synthetic and non-submittable.

## Validation

Run the fixture test, frontend type-check/lint, strict schema UI audit, and a
browser smoke of the five newly added tourist schemas.
