# Agent Backend Internal Automation Routes Guide

Scope: this file applies to
`viza-be/agent-backend/src/routes/internal-automation/**`.

## Purpose

This module owns backend REST APIs for the website automation loop, especially
service-to-service external status ingest and packet handoff.

It must not implement browser automation or official portal submission.

## Key Responsibilities

- Validate external status update bodies with strict allowlists.
- Authenticate service-to-service calls with `EXTERNAL_SUBMISSION_TOKEN` or a
  stronger configured mechanism.
- Update `applications` external/result fields.
- Insert `application_events` for every state mutation.
- Return packet handoff payloads without leaking secrets.

## Data Sources

- `applications`
- `applicant_profiles`
- `visa_application_answers`
- `application_documents`
- `application_signatures`
- `application_packets`
- `application_events`
- `notification_events`

## Guardrails

- Do not log PII, documents, signatures, or tokens.
- Do not call `viza-be/submission-service`.
- Do not solve CAPTCHA, run Playwright, use proxies, or control official
  portals.
- Do not accept unknown statuses from external services.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run lint
```

Smoke the route with a small authenticated request that uses a fake
application id only in local/dev data.
