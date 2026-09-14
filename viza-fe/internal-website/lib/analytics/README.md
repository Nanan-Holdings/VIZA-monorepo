# Product analytics (OBS-001)

`events.ts` declares the `EVENT` constant object and the `track(event)` helper.
This module is an event taxonomy and optional transport wrapper; it is not
evidence that all listed business events are emitted.

Source baseline: **2026-09-13**.

## Current implementation status

| Area | Current code | Boundary |
| --- | --- | --- |
| Taxonomy | 13 event names in `EVENT` | A declared name is not an instrumented call site |
| Transport | Dynamic import of `posthog-js` when `NEXT_PUBLIC_POSTHOG_KEY` is set | The checked package manifest/lock do not include `posthog-js`; import failure is not handled by this wrapper |
| Call sites | No production imports/calls to this helper found in the current app | Do not claim signup/payment/submission events reach PostHog |
| Browser consent | `track` returns unless `viza_cookie_consent` ends in `=accept` | This check only runs when `document` exists; it is not a server-side consent or legal-compliance guarantee |
| Autocapture | Explicitly disabled in `getClient` | Explicit event wiring is still needed |
| Admin dashboard | Database-backed 30-day operational counts | It does not query the PostHog API or compute cohort conversion |

Setting a key alone does not complete installation, consent handling, producer
instrumentation or end-to-end verification. A missing key makes the helper a
no-op. A configured key with a missing SDK can reject the call.

## Declared event names

The names below exist in `EVENT`; their old proposed producer locations must
not be treated as implemented fire sites:

- `signup_started`, `signup_verified`
- `application_created`, `application_step_completed`
- `payment_intent_created`, `payment_succeeded`
- `doc_uploaded`, `face_match_decided`, `identity_verified`
- `application_submitted`, `application_delivered`
- `refund_requested`, `refund_decided`

`AnalyticsEvent.properties` is currently a generic primitive-value record.
Per-event required property schemas are not enforced by this module.

## Admin analytics

[AdminAnalyticsPage](../../app/admin/analytics/page.tsx) issues five concurrent
Supabase count queries for the previous 30 days:

- `marketing_leads.created_at`
- `applicant_profiles.created_at`
- `applications.created_at`
- `order.paid_at`, limited to `paid`, `submitted`, `completed` statuses
- `runner_job.finished_at`, limited to `succeeded`

The last metric counts successful runner jobs, not deduplicated successful
applicants or a single cohort. The page labels the results as operational stage
volumes, reports unavailable sources, and links out using
`NEXT_PUBLIC_POSTHOG_DASHBOARD_URL` or the generic PostHog site. That link is not
proof of a configured dashboard or an event ingestion pipeline.

## Completing instrumentation in a future implementation

1. Add intentional producer calls and typed property contracts for the selected
   events; verify exact paths instead of copying historical fire-site tables.
2. Install/configure the SDK and explicitly handle transport failure without
   failing the primary user action.
3. Define both browser and server consent/privacy behavior before emitting
   identifiers. The present browser-only cookie guard does not cover server
   calls.
4. Verify one event from producer through transport to the intended dashboard;
   distinguish duplicate/replayed business actions from new events.
5. Keep operational DB counts separate from identity-linked behavioral funnels
   and cohort conversion metrics.

These are remaining integration tasks, not claims of implemented behavior.
Request timings and runtime diagnostics are documented separately in
[Portal Observability](../observability/AGENTS.md).
