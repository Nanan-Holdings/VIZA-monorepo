# Admin Application Monitoring Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/admin/(dashboard)/applications/**`.

## Purpose

This module owns staff monitoring for website-owned automation. Staff use it to
observe application state and help customers, not to manually run the normal
application workflow.

## Key Responsibilities

- Render `/admin/applications` as a user-card monitoring queue.
- Render `/admin/applications/[id]` as a user overview with related applications.
- Show applicant profile, package, payment, consent, signatures, documents,
  packet status, external status, result delivery, submission-entitlement
  eligibility/evidence, and event timeline.
- Provide customer-service context for chat/support escalation.
- Allow admin-safe state corrections only when explicitly scoped and audited.
- Exclude `VIZA_PLACEHOLDER_DRY_RUN` schema-QA records from the normal staff
  monitoring queue so synthetic applicants and answers cannot be mistaken for
  customer work.

## Local Files

- `page.tsx`: user-card monitoring queue with package, expiry, application
  count, lifecycle progress, and lifecycle/payment/consent/document/packet/
  external/result filters.
- `[id]/page.tsx`: user overview with profile/package context, related
  applications, progress, missing support items, events, notifications, result
  file references, and support actions.
- `data.ts`: server-side admin data loader and lifecycle derivation helpers.
- `copy.ts`: English/Chinese admin monitoring copy and formatting helpers
  keyed by the global interface language.
- `actions.ts`: audited support-only server actions for this route. The
  "status email" button sends a customer-safe `status_update` email through
  `lib/notify/dispatch.ts` (same verified sender and logging as outcomes).
- `outcome-transitions.ts`: pure plans for the four staff outcomes
  (submitted to government, approved with file, refused, needs info). Each
  plan is the `applications` patch, the `application_status_history` row,
  the customer-visible `application_events` row and the email event. Only
  fields and values `/client/status` already reads are written.
- `outcome-panel.tsx`: the "Record outcome" panel on the case page. Files go
  straight from the browser to Storage (`application-documents/results/<appId>/`)
  through a signed upload URL, then `app/actions/admin-staff-ops.ts` records
  the outcome and emails the applicant.
- `support-actions.tsx`: client-side copy/email helper controls.
- `ui.tsx`: route-local admin display primitives.

## Data Sources

- `applicant_profiles`
- `applications`
- `visa_packages`
- `application_documents`
- `visa_application_answers`
- `payment_records`
- `consent_events`
- `application_signatures`
- `application_packets`
- `application_events`
- `notification_events`
- `application_submission_entitlements`

## Outcome statuses

| Outcome | applications.status | result_status | Email event |
|---|---|---|---|
| Submitted to government | `submitted` (+ `external_status=submitted`, `external_reference`, `submitted_at`) | unchanged (cleared if `needs_attention`) | `submitted` |
| Approved | `approved` | `approved` + `result_storage_path` | `visa_approved` |
| Refused | `rejected` | `refused` + `result_notes` | `visa_refused` |
| Needs info | `awaiting_applicant` | `needs_attention` + `result_notes` | `info_requested` |

Every outcome also sets `submission_result_status` (submitted, approved,
refused, needs_attention). When `submission_result` is the MANUAL hand-off
(`ManualHandoffSubmissionResult` in `lib/submission-result.ts`), the object is
kept and moved on in place (`status` = the outcome kind, `updatedAt`,
`reference`, `notes`) so the applicant's card shows it. Automation results
are never overwritten.

`/admin/staff-queue` (`../staff-queue/`) lists every case that needs a human
and links to `#outcome-<applicationId>` on the case page.

## Guardrails

- The happy path must not require staff approval to continue.
- Do not add official-portal runner controls, Playwright controls, CAPTCHA
  actions, proxy controls, or `submission-service` dependencies.
- Do not expose secrets, raw payment method details, or full external tokens.
- Every admin mutation must be auditable through `application_events`.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/admin/applications`. Without an admin session, verify redirect to
`/admin/login`.
