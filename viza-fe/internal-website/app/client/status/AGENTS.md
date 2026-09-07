# Client Status Center Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/status/**`.

## Purpose

This module owns the applicant-facing application selector and its shared
customer-safe lifecycle data loader. `/client/status` switches the exact
ongoing application or opens completed application history; `/client/home`
renders lifecycle tasks and `/client/application` renders post-submission
results and updates from the same data.

## Key Responsibilities

- Render `/client/status` as the application and destination selector. The
  page title block and 1040px content column mirror `/client/settings` for
  consistent top spacing, typography, and muted subtitle treatment. The
  index lists every non-current application, expands exact application records
  when a country has more than one, and keeps the current application selection
  separate from browsing. The current selection is a one-country panel linked
  to `/client/home` and must reuse the same panel and row styling as the list
  below it. Single-application countries use a direct right-arrow row, while
  multi-application countries use a down chevron. Choosing an ongoing record
  activates it before opening Home. A `country` query pre-expands that country's
  row. Every interactive application or destination panel must visibly change
  its background on hover. The full destination-card surface, including the
  flag and country header, selects its first listed option; specific visa rows
  remain individually selectable. Disabled coming-soon panels remain
  non-interactive.
- Render destination flags with `react-circle-flags` through the shared
  `DestinationFlag` component so flags do not depend on the operating system's
  emoji coverage. Destination states (`Added`, `Browse`, or `Coming soon`) sit
  beside the country name. Pin the Schengen browse card first, followed by
  available destinations that have not been added. Already-added destinations
  sit directly above the gray coming-soon group, and unavailable destinations
  remain last.
- Keep `/client/destinations` a redirect to this route. The regional pickers
  under `/client/destinations/[region]` and `/client/destinations/schengen`
  stay where they are — only the index merged.
- Application lifecycle tasks live on `/client/home`; post-submission files
  and customer-safe updates live in the application submission/status step.
- Keep `/client/documents` focused on document upload/checklist work; do not
  put document-management UI here unless it is a status summary.
- Surface customer-safe statuses only. Technical backend or external process
  errors must be translated into plain user-facing next steps.
- Status/detail links must preserve the application ID, canonical country, and
  visa type together so the application route cannot combine a historical row
  with a stale active/default product identity.
- Exclude applications whose purpose is `VIZA_PLACEHOLDER_DRY_RUN`; schema-QA
  records are test infrastructure, not customer application history.
- Keep result-delivery links in the submitted application view when
  `applications.result_storage_path`, `applications.receipt_url`, or official
  reference fields are available.
- For newly tracked Vietnam e-Visas, keep safe official status, daily query
  timing, and authenticated artifact links available to the submitted
  application view. Browser page refreshes must not enqueue official CAPTCHA
  queries.

## Data Sources

- `applications`
- `application_documents`
- `visa_application_answers`
- `payment_records`
- `consent_events`
- `application_signatures`
- `application_packets`
- `application_events`
- `notification_events`
- `official_application_tracking` (service-role server read only)

`status-profile-lookup.ts` keeps the current signed-session profile lookup to
one indexed `applicant_profiles.id` read. Auth-user and email lookups are
compatibility fallbacks only; preserve their focused query-count tests when
changing client-session ownership behavior.

`status-data.ts` loads payment records with one owner-scoped OR query over the
resolved applicant and application IDs. Do not restore a package-wide payment
read: visa package IDs are shared across applicants. The query budget and
malformed-ID scope guard live in `status-data.query-budget.test.ts`.

The Home timeline calls `getClientApplicationStatus(applicationId)` after the
dashboard selects the active application. That path keeps the authenticated
profile ownership predicate and adds an exact application-ID predicate. Keep
the authenticated package-link and submitted-SGAC email-link compatibility
paths, also restricted to that ID. Invalid IDs never fall back to a full read;
missing or unauthorized targets must return before payment/detail reads. Keep
the full-detail loader for timeline and submitted-application views.
`status-data.scoped-query.test.ts` covers the ownership fallbacks, full/scoped
detail parity, and the target-only filters on eight detail tables plus live
queue summaries. Payment compatibility still reads within the current user's
profile/application scope; it is not an application-only cache.

`/client/status` uses `getClientStatusIndexData()`, a narrow list projection
from the same authenticated loader. It skips `application_events`,
`notification_events`, `official_application_tracking`, and Storage signing.
Keep consent, signatures, documents, answers, packets, payments, and live queue
summaries because they affect list state/progress. Preserve file metadata
internally for arrival-card state and history ordering; result actions in the
index lead to the exact authenticated application status route. The exported
index must not include private file references or unrelated detail payloads.
`status-data.scoped-query.test.ts` also checks index/full list parity, skipped
reads, and file signing behavior. `page.test.tsx` checks the index-only load,
authentication redirects, exact application/package links, and list rendering.

## Guardrails

- Do not import service-role clients into client components.
- Do not expose internal stack traces, provider errors, secrets, or external
  system tokens.
- Do not add dependencies on `viza-be/submission-service`.
- Keep DS-160 wording clear: VIZA prepares the package; any official signature
  or submission boundary belongs outside this module.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/status`. Without an authenticated session, verify redirect to
`/client/login`.
