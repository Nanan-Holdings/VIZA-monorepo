# Product analytics (OBS-001)

Single taxonomy file: `events.ts` exports the `EVENT` enum + `track(event)` helper. **Add to the enum first** — drifted string literals cause dashboards that silently disagree with reality.

## Vendor

PostHog at MVP. `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` envs control it; the helper is a no-op when the key is unset (dev runs are quiet).

## Consent gate

`track()` reads the `viza_cookie_consent` cookie (PRODUCT-008) and short-circuits unless the applicant chose **accept**. GDPR is enforced at the call site — no auto-init.

## Standard events

| Name                          | Where fired                                                            | Required properties                      |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| `signup_started`              | `/signup` page mount                                                  | locale                                   |
| `signup_verified`             | `/verify-email` callback                                              | email_verified=true                      |
| `application_created`         | `app/actions/visa-application-answers.ts:ensureDraftApplication`      | application_id, country, visa_type       |
| `application_step_completed`  | `app/application/[id]/answer/_components/AnswerForm.tsx` (next click) | application_id, step_index               |
| `payment_intent_created`      | Stripe checkout-session creation                                       | application_id, amount_cents, currency   |
| `payment_succeeded`           | Stripe webhook `checkout.session.completed`                            | application_id, amount_cents, currency   |
| `doc_uploaded`                | `components/document-upload.tsx` onUploaded callback                  | application_id, kind                     |
| `face_match_decided`          | `app/actions/face-match.ts:runFaceMatch`                              | application_id, decision, score          |
| `identity_verified`           | Stripe webhook `identity.verification_session.verified`                | application_id                           |
| `application_submitted`       | runner-side persist functions (`persist*Submitted`)                   | application_id, country                  |
| `application_delivered`       | runner-side persist functions (`persist*Delivered`)                   | application_id, country                  |
| `refund_requested`            | `app/actions/refund-request.ts:requestRefund`                         | application_id, amount_cents             |
| `refund_decided`              | `app/actions/refund-request.ts:decideRefund`                          | refund_request_id, approve               |

## /admin/analytics dashboard

`/admin/analytics/page.tsx` server-fetches funnel counts via PostHog query API (or a Postgres view backed by `notification_event_log` + your event ingestion path) and renders 4 funnel cards using brand-* tokens. Deep-dive button links to the PostHog dashboard.

## Adding a new event

1. Add the constant to `EVENT` in `events.ts`.
2. Document the required properties in the table above.
3. Call `track({ name: EVENT.<key>, properties: { ... } })` from the producing code.
4. Update `/admin/analytics` if the new event belongs in the funnel.
