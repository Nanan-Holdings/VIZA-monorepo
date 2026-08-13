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
