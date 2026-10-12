# Payment Provider Config (PAYP-002)

Required env vars per provider (validated by
`viza-fe/internal-website/lib/payments/validate-provider-config.ts`). **No
secret values here** — names only.

| Provider | Required env |
| --- | --- |
| Stripe (card) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| PhotonPay (card) | `PHOTONPAY_BASE_URL`, `PHOTONPAY_APP_ID`, `PHOTONPAY_APP_SECRET`, `PHOTONPAY_SITE_ID`, plus inline or file-path merchant/private keys |
| Airwallex | `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, `AIRWALLEX_WEBHOOK_SECRET`, `AIRWALLEX_ENV` |
| Alipay | `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, `ALIPAY_GATEWAY_URL` |
| WeChat Pay | `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_APP_ID`, `WECHAT_PAY_API_V3_KEY`, `WECHAT_PAY_MERCHANT_SERIAL_NO`, `WECHAT_PAY_PRIVATE_KEY`, `WECHAT_PAY_NOTIFY_URL`, `WECHAT_PAY_REFUND_NOTIFY_URL` |

Production must set `VIZA_ENABLED_PAYMENT_PROVIDERS` to the exact active rails.
It must include `photonpay` when `PHOTONPAY_ENABLED=true`; otherwise it must
include the Stripe fallback. `GET /api/health/payment-providers` is restricted
to admin/staff, never returns credential values, and returns HTTP 503 in
production for missing, inconsistent, or known-test configuration.
WeChat readiness also requires distinct public HTTPS callback URLs ending in
`/api/wechat-pay/notify` and `/api/wechat-pay/refund/notify`.

Rotation: see `docs/security/secret-rotation-runbook.md` (SEC-003).

## Provisioning retry operations

Set `CRON_SECRET` in the portal's production Vercel project. The configured
five-minute `GET /api/payment-provisioning/worker` cron first retries durable
`payment_provisioning_jobs`, then reconciles a single operations work item per
job. A `dead_letter` job opens an immediate P0 item; a `queued`, `retry`, or
`running` job that is at least 15 minutes old opens a P1 item. The item resolves automatically
when the job recovers and reopens if it later relapses, using the stable dedupe
key `payment-provisioning-alert:<job-id>`.

The sweep is provider-independent, so Stripe, WeChat, and 100%-off beta
provisioning (`provider = free`) have the same alert coverage. It writes only
to the audited admin work queue and does not send customer or staff messages.
Production readiness still requires the Vercel cron deployment, a valid
`CRON_SECRET`, and monitoring that pages on cron invocation failures.
