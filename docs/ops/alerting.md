# Failure alerting (OPS-003)

> Last reviewed: 2026-05-07.

## Channels

- **Slack** — primary. `SLACK_WEBHOOK_URL` env points at the
  on-call channel webhook. Every alert (info / warn / error /
  critical) lands here.
- **Resend email** — backup. Triggered for `error` and `critical`
  only. `RESEND_OPS_ALERT_TO` is the on-call rotation alias
  (`oncall@haggstorm.com`).
- **Push** — deferred. The dispatcher API is severity-aware so we
  can add an `error+` push provider (e.g. PagerDuty, Discord
  webhook) without touching the call sites.

## API

```ts
import { sendAlert } from "viza-be/submission-service/src/alerts/dispatch";

await sendAlert({
  severity: "error",
  class: "runner.failed.vietnam",
  title: "VN runner job failed",
  body: "Job xxx hit max_attempts=3. Last error: portal returned 503.",
  jobId,
  applicationId,
  // throttleSeconds defaults to 15 minutes
});
```

`class` is the throttle key — first hit fires, repeats inside the
window are counted in `alert_throttle.fire_count` but not delivered.
This is what keeps a country-portal outage from emitting 100 pages.

## Severity → channel matrix

| Severity | Slack | Email | Notes |
|---|---|---|---|
| info | ✓ | — | Daily reconciliation summary, queue depth heartbeat |
| warn | ✓ | — | Concurrency cap creeping toward limit |
| error | ✓ | ✓ | Job exhausted retries; reconciliation delta |
| critical | ✓ | ✓ | Service-down; everyone on-channel |

## Wired call sites (today)

- `viza-be/submission-service/src/queue/worker.ts` —
  `markFailedWithRetry` fires `runner.failed.<country>` at error
  severity once `max_attempts` is exhausted.
- `viza-be/agent-backend/scripts/reconcile-stripe-payouts.ts` —
  fires `payments.reconcile.delta` when Stripe ↔ orders delta
  exceeds USD 5 (PAY-007). Currently emails directly via Resend;
  migration to `sendAlert` is a one-line follow-on.
- `viza-be/agent-backend/scripts/autoscale-runners.ts` — fires
  `runner.concurrency.violation` when a country's running count
  exceeds its cap (INFRA-003). Same Resend → `sendAlert` migration.

## Adding new alerts

1. Pick a stable `class` ID. Convention: `<area>.<event>[.<scope>]`.
2. Pick a severity from the table above.
3. Pass jobId or applicationId when available — the dispatcher
   appends links to `/admin/jobs/<id>` and `/admin/applications/<id>`
   to the alert body so the responder can jump straight to context.
4. Default throttle (15 min) is fine for most cases. Use
   `throttleSeconds` only when you really mean it.

## Required env

```
SLACK_WEBHOOK_URL          = …
RESEND_API_KEY             = … (already required by PAY-005)
RESEND_OPS_ALERT_TO        = oncall@haggstorm.com
NEXT_PUBLIC_SITE_URL       = https://app.haggstorm.com
```

## Backing table

`viza-be/agent-backend/drizzle/0058_alert_throttle.sql` —
`alert_throttle(class PK, last_fired_at, fire_count)`. Service-role
only; the dispatcher reads + atomically updates per-class.
