# Product analytics (OBS-001)

PostHog project 662475 (US cloud), the same project as the marketing site.
Source baseline: **2026-10-16**.

| File | Role |
| --- | --- |
| `taxonomy.ts` | `EVENT` names and the typed property shape of each event |
| `events.ts` | Browser `track(name, props)` helper and `currentRoute()` |
| `posthog.ts` | posthog-js loader, privacy config, `before_send` URL sanitiser, identify/reset |
| `server.ts` | posthog-node capture for server-only events, flushed per call |
| `application-draft.ts` | `ensureDraftApplication` wrapper that emits `application_started` |
| `components/analytics/posthog-analytics.tsx` | Root-layout component: loads PostHog, identifies on session restore/sign-in, resets on sign-out |

## When it sends

All of these must hold, otherwise every helper is a no-op:

- `NEXT_PUBLIC_POSTHOG_KEY` is set (`NEXT_PUBLIC_POSTHOG_HOST` defaults to
  `https://us.i.posthog.com`).
- Browser: the page is served from `app.viza.it.com` (previews and localhost
  never load PostHog). Server: `VERCEL_ENV === "production"`.
- Browser: the `viza_cookie_consent` cookie is not `reject` or `configure`.
  The consent banner (`components/cookie-consent.tsx`) is not mounted today,
  so in practice this is an opt-out that matches the privacy policy's
  "Cookies and Analytics Technologies" section and the marketing site.

## Privacy boundary

The portal holds passport scans, photos and identity answers, so:

- Session replay is disabled and the recorder cannot load:
  `disable_external_dependency_loading` blocks every lazy PostHog script.
- Autocapture, rage/dead clicks, heatmaps, exception capture and network
  performance capture are off. `mask_all_text` and `mask_all_element_attributes`
  stay on as a second fence.
- Pageviews fire on pathname changes. `before_send` reduces every URL-like
  property (`*url`, `*referrer`, `*pathname`, including `$set_once` initial
  values) to origin plus route: no query string, no hash, ids replaced by `:id`.
- People are created only on identify. Identify sends the Supabase auth uid
  with `role` (`users.role`, or `applicant`) and `is_staff`. No email, name or
  profile field. Staff (`admin`, `staff`, `doctor`, or anyone inside `/admin`)
  are tagged `is_staff: true` and every event they send carries it, so filter
  them out with `is_staff != true`.
- Every event carries `app: "portal"` to separate it from marketing traffic.

## Events

| Event | Fired from | Properties |
| --- | --- | --- |
| `application_started` | `application-draft.ts`, when `ensureDraftApplication` returns `created: true` (long-form, wizard shell, onboarding) | `destination_country`, `visa_type`, `source` |
| `documents_uploaded` | `lib/document-upload-client.ts` after `/api/document-upload` returns `ok` | `count`, `doc_types` (snake_case keys, else `other`), `source` |
| `application_submitted` | long-form review step after the submission queue accepts the job (also the JP/KR direct-submit and reconciled paths) | `destination_country`, `visa_type`, `mode`, `intent`, `source` |
| `application_result_recorded` | server: `POST /api/external-submission` when `resultStatus` changes and the applicant has an auth uid | `destination_country`, `visa_type`, `result`, `source` |
| `chat_assistant_used` | VIZA AI `handleSendMessage`, travel planner `sendMessage` | `assistant` (`visa` or `travel`), `source` |

`source` is the current route with ids replaced. Property values are codes,
counts and labels only; never add names, emails, document numbers, file
names, free text or record ids.

Not instrumented: the universal-info side-effect draft, team companion
creation, "apply again" result-card applications, submission retries from
status cards, and results written by the backend worker directly to the
database (only the `/api/external-submission` path emits a result event).

## Admin analytics

[AdminAnalyticsPage](../../app/admin/analytics/page.tsx) shows database-backed
30-day operational counts and links out to `NEXT_PUBLIC_POSTHOG_DASHBOARD_URL`.
It does not query PostHog.
