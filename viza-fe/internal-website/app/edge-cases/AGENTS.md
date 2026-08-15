# Application Schema Edge Cases Gallery

Scope: this file applies to `app/edge-cases/**`.

## Purpose

`/edge-cases` is a development-only, live gallery of every issue marked
`designEdgeCase` by the master application-schema UI compiler. It groups
equivalent issues into component studies while retaining the full affected
visa-type and field inventory.

## Guardrails

- Keep the route unavailable in production unless Edward explicitly approves
  publishing internal schema diagnostics.
- Read schema metadata server-side. Never expose service-role credentials or
  applicant answers to the client.
- Derive the inventory from `compileApplicationSchemaForUi`; do not maintain a
  hand-written country list of issues.
- Reuse canonical application components for studies. Do not modify the frozen
  `/ui-components` page or primitives from this route.
- New `designEdgeCase` codes must appear automatically with a generic fallback;
  add a focused component study only after the design question is understood.

## Validation

Run the catalog test, frontend type-check and lint, the strict schema/UI audit,
and smoke `/edge-cases` in a browser.
