# Payment Provider Config (PAYP-002)

Required env vars per provider (validated by
`viza-fe/internal-website/lib/payments/validate-provider-config.ts`). **No
secret values here** — names only.

| Provider | Required env |
| --- | --- |
| Stripe (card) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Airwallex | `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, `AIRWALLEX_WEBHOOK_SECRET`, `AIRWALLEX_ENV` |
| Alipay | `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, `ALIPAY_GATEWAY_URL` |
| WeChat Pay | `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_APP_ID`, `WECHAT_PAY_API_V3_KEY`, `WECHAT_PAY_MERCHANT_SERIAL_NO`, `WECHAT_PAY_PRIVATE_KEY`, `WECHAT_PAY_NOTIFY_URL` |

`validateProviderConfig(enabled, env)` returns `error` issues for missing vars
and a `warn` when `AIRWALLEX_ENV != prod` (non-prod won't settle real money).
Rotation: see `docs/security/secret-rotation-runbook.md` (SEC-003).
