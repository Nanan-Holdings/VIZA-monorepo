# VIZA Internal Automation Copy/Paste Prompts

This page is the handoff sheet. Copy one block at a time into a separate
Codex/process. Each block tells that agent exactly which detailed prompt page
to read and which files it owns.

Global rule for every agent:

- Do not touch `viza-be/submission-service`.
- Do not add Playwright official submission runners, CAPTCHA solving, proxy
  rotation, browser fingerprinting, runner artifacts, or official portal
  automation.
- Build only the VIZA website automation loop: payment, consent, forms,
  documents, OCR, packet generation, status, notifications, monitoring, and
  external status ingest.
- Staff monitors and supports. Staff approval must not become required for the
  happy path.

## 1. Copy To Client Status Agent

```text
You are the Client Status Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/client-status-agent.md
- viza-fe/internal-website/app/client/status/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/client/status/**

Your task:
Implement /client/status as the customer-facing automation progress center.
Show payment, consent, form answers, documents, packet generation, external
handoff, submitted/result states, next actions, official reference, receipts,
approval/rejection/result files when available.

Do not edit other modules unless explicitly needed and coordinated. Do not touch
viza-be/submission-service or any official portal runner code.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/status or report the auth/session gap.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 2. Copy To Client Documents Agent

```text
You are the Client Documents Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/client-documents-agent.md
- viza-fe/internal-website/app/client/documents/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/client/documents/**

Your task:
Implement /client/documents as the real document checklist center. Show
required/optional documents by visa package, upload status, missing items,
re-upload flow, passport OCR confirmation state, photo compliance state, and
Travel AI supporting-document save entry points where existing output supports
it.

Do not write OCR fields into profile/application answers until the user
confirms them. Do not touch viza-be/submission-service or official portal
automation.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/documents or report the auth/session gap.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 3. Copy To Client Checkout Agent

```text
You are the Client Checkout Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/client-checkout-agent.md
- viza-fe/internal-website/app/client/checkout/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/client/checkout/**

Your task:
Implement /client/checkout for VIZA agency fee payment. Show package summary,
agency fee, government fee disclosure, Stripe Checkout CTA, success/cancel
return states, and safe next-step routing after payment.

Do not collect card details directly. Do not imply VIZA automatically pays
government portal fees. Do not touch viza-be/submission-service or official
portal runner code.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/checkout or report the auth/session gap.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 4. Copy To Client Billing Agent

```text
You are the Client Billing Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/client-billing-agent.md
- viza-fe/internal-website/app/client/billing/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/client/billing/**

Your task:
Implement /client/billing for payment history, receipt downloads, invoice
request flow, refund eligibility/status, and links back to checkout/status.
Keep agency fee records separate from government fee disclosure.

Do not expose full card numbers, Stripe secrets, or raw provider payloads. Do
not touch viza-be/submission-service or official portal automation.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/billing or report the auth/session gap.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 5. Copy To Client Consent Agent

```text
You are the Client Consent Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/client-consent-agent.md
- viza-fe/internal-website/app/client/consent/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/client/consent/**

Your task:
Implement /client/consent for ToS, Privacy, agency authorisation, and
e-signature. Record accepted versions, signed/unsigned state, and route users
to the next missing step.

Do not auto-check consent boxes. Do not treat DS-160 official final signature
or official submission as completed inside VIZA. Do not touch
viza-be/submission-service.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/consent or report the auth/session gap.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 6. Copy To Client Privacy Settings Agent

```text
You are the Client Privacy Settings Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/client-privacy-settings-agent.md
- viza-fe/internal-website/app/client/settings/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/client/settings/**

Your task:
Add privacy/data-rights controls under /client/settings for personal data export
requests and deletion requests. Show request history/status where available and
explain retention constraints in customer-safe language.

Do not directly delete passport/application data from the UI. Do not expose
other users' data. Do not touch viza-be/submission-service.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/settings or report the auth/session gap.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 7. Copy To Admin Applications Agent

```text
You are the Admin Applications Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/admin-applications-agent.md
- viza-fe/internal-website/app/admin/(dashboard)/applications/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/admin/(dashboard)/applications/**

Your task:
Implement /admin/applications and /admin/applications/[id] for staff monitoring.
Show lifecycle state, missing items, payment, consent, documents, packet,
external status, events, notifications, result files, and support-oriented safe
actions.

Staff must monitor/support only; do not add manual approval gates to the happy
path. Do not add runner controls, Playwright controls, CAPTCHA actions, proxy
controls, or submission-service dependencies.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /admin/applications or verify redirect to /admin/login.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 8. Copy To Admin Packages Agent

```text
You are the Admin Packages Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/admin-packages-agent.md
- viza-fe/internal-website/app/admin/(dashboard)/packages/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/admin/(dashboard)/packages/**

Your task:
Implement /admin/packages as the package coverage matrix. Track schema,
document checklist, payment, packet generation, external submission handoff,
result ingest, and status UI coverage. Make US DS-160 and France/Schengen
visible as first-batch targets.

Do not claim official portal automation support unless another explicit service
owns and proves it. Do not touch viza-be/submission-service.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /admin/packages or verify redirect to /admin/login.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 9. Copy To Admin Billing Agent

```text
You are the Admin Billing Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/admin-billing-agent.md
- viza-fe/internal-website/app/admin/(dashboard)/billing/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/admin/(dashboard)/billing/**

Your task:
Implement /admin/billing for staff payment support. Show payment status,
invoice status, refund status, customer/application/package references, receipt
links, invoice request metadata, refund eligibility, and links to application
details.

Do not show full card numbers or raw provider secrets. Do not perform refunds
unless an approved backend action exists. Do not touch viza-be/submission-service.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /admin/billing or verify redirect to /admin/login.

Final response must list files changed, behavior implemented, validation
results, and blockers.
```

## 10. Copy To Internal Automation Actions Agent

```text
You are the Internal Automation Actions Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/internal-automation-actions-agent.md
- viza-fe/internal-website/app/actions/internal-automation/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/actions/internal-automation/**

Your task:
Create trusted server actions for lifecycle summaries, payment state, consent,
document readiness, packet state, notification events, refund/invoice requests,
coverage reads, admin/customer status summaries, and data-rights requests.

Use authenticated user checks and admin role gates. Return typed result objects.
Do not import browser-only code. Do not call viza-be/submission-service or add
official portal runner behavior.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke at least one consuming route or report that UI is not wired yet.

Final response must list files changed, actions added, validation results, and
DB/backend blockers.
```

## 11. Copy To Stripe API Agent

```text
You are the Stripe API Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/stripe-api-agent.md
- viza-fe/internal-website/app/api/stripe/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/api/stripe/**

Your task:
Implement Stripe Checkout session creation and webhook handling for VIZA agency
fee payment. Write/update payment_records idempotently, advance application
state after confirmed payment when allowed, and insert application/notification
events.

Verify Stripe webhook signatures. Keep secret keys server-only. Do not collect
government portal fees. Do not touch viza-be/submission-service.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke route handler where possible or report missing Stripe config.

Final response must list files changed, route handlers added, validation
results, and required env vars.
```

## 12. Copy To External Submission API Agent

```text
You are the External Submission API Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/external-submission-api-agent.md
- viza-fe/internal-website/app/api/external-submission/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/api/external-submission/**

Your task:
Implement a lightweight status/result ingest API for the external official
submission owner. Validate application id, status allowlist, result status,
reference, file references, and update source. Update application external
status/result fields and insert events/notifications.

This is not a runner. Do not implement Playwright, CAPTCHA, proxy, browser
fingerprint, or official portal automation. Do not touch viza-be/submission-service.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke route handler with missing/invalid auth and verify safe rejection.

Final response must list files changed, payload contract, validation results,
and external-team handoff notes.
```

## 13. Copy To Passport OCR API Agent

```text
You are the Passport OCR API Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/passport-ocr-api-agent.md
- viza-fe/internal-website/app/api/passport-ocr/AGENTS.md

Your owned write scope:
- viza-fe/internal-website/app/api/passport-ocr/**

Your task:
Implement the server-side passport OCR route. Validate file/application
ownership, call the selected OCR provider through a server-only adapter, and
return normalized proposed fields for user confirmation.

OCR output is a proposal only. Do not silently overwrite profile/application
answers. Do not put provider keys in client code. Do not log passport images or
raw extracted PII. Do not touch viza-be/submission-service.

Before final response, run:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke route with missing auth or missing file and verify safe rejection.

Final response must list files changed, OCR behavior, validation results, and
provider config needed.
```

## 14. Copy To Backend Internal Routes Agent

```text
You are the Backend Internal Routes Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/backend-internal-routes-agent.md
- viza-be/agent-backend/src/routes/internal-automation/AGENTS.md

Your owned write scope:
- viza-be/agent-backend/src/routes/internal-automation/**
- viza-be/agent-backend/src/app.ts only if route mounting is needed

Your task:
Implement Express REST routes for website automation support: packet handoff,
external status/result ingest if backend owns that boundary, lifecycle/status
summary if needed, and admin-safe internal APIs. Validate request bodies and
auth/service tokens. Delegate business logic to services.

Do not implement browser automation, official portal submission, CAPTCHA,
Playwright, proxy behavior, or runner artifacts. Do not touch
viza-be/submission-service.

Before final response, run:
- cd viza-be/agent-backend
- npm run type-check
- npm run lint
- Smoke changed endpoint or report missing env/auth setup.

Final response must list files changed, endpoints/payloads, validation results,
and frontend integration notes.
```

## 15. Copy To Backend Internal Services Agent

```text
You are the Backend Internal Services Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/backend-internal-services-agent.md
- viza-be/agent-backend/src/services/internal-automation/AGENTS.md

Your owned write scope:
- viza-be/agent-backend/src/services/internal-automation/**

Your task:
Build reusable service logic for state normalization, lifecycle readiness,
packet handoff payload shaping, notification payloads, refund eligibility, and
external status mapping.

Keep services independent from Express request/response objects. Do not include
official portal automation logic. Do not log raw PII. Do not touch
viza-be/submission-service.

Before final response, run:
- cd viza-be/agent-backend
- npm run type-check
- npm run lint
- npm run test if local tests can run

Final response must list files changed, service functions/status mappings,
validation results, and route/action integration notes.
```

## 16. Copy To Backend DB Agent

```text
You are the Backend DB Agent for VIZA.

Read and follow:
- docs/internal-automation/agent-prompts/backend-db-agent.md
- viza-be/agent-backend/drizzle/AGENTS.md
- viza-be/agent-backend/src/db/AGENTS.md

Your owned write scope:
- viza-be/agent-backend/drizzle/**
- viza-be/agent-backend/src/db/schema.ts

Your task:
Own migrations and Drizzle schema for payment records, consent events,
signatures, packets, events, notifications, coverage matrix, government fee
rules, invoice/refund requests, data-rights requests, retention jobs, and
application/application_document automation columns.

Keep migrations sequential and schema.ts aligned. Do not store secrets, raw
provider credentials, full card data, or official runner artifacts. Do not touch
viza-be/submission-service.

Before final response, run:
- cd viza-be/agent-backend
- npm run type-check
- npm run db:migrate if local database is configured; otherwise report the gap.

Final response must list files changed, tables/columns/indexes added,
validation results, and migration/backfill notes.
```

