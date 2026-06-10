# Payment Provider Go-Live Runbook (PAYP-003)

Cutover from test/demo to production. **Docs only — no dashboard actions by the
agent.** Cross-ref `docs/security/secret-rotation-runbook.md` (SEC-003) and
`docs/payments/provider-config.md` (PAYP-002).

## Per-provider cutover

| Provider | Change | Workspace | Redeploy |
| --- | --- | --- | --- |
| Stripe | swap `sk_test_*`→`sk_live_*`, live `STRIPE_WEBHOOK_SECRET`, register live webhook endpoint, set tax rates | internal-website (Vercel) | `vercel --prod` |
| Airwallex | `AIRWALLEX_ENV=demo`→`prod`, live `AIRWALLEX_API_KEY`/`AIRWALLEX_WEBHOOK_SECRET` | internal-website | `vercel --prod` |
| Alipay | live `ALIPAY_APP_ID` + keypair, prod `ALIPAY_GATEWAY_URL` | internal-website | `vercel --prod` |
| WeChat Pay | live `WECHAT_PAY_MCH_ID`, APIv3 key, merchant cert serial + private key, prod `WECHAT_PAY_NOTIFY_URL` | internal-website | `vercel --prod` |

## Per-country provider availability

Card is universal. WeChat/Alipay availability is config-driven
(`lib/payments/method-availability.ts`, PAYP-004): currently
`WECHAT_COUNTRIES`/`ALIPAY_COUNTRIES = {indonesia}`; widen as merchant coverage
grows. Government-fee collection per country is in
`viza-be/submission-service/src/payment-routing.ts` (`decisionFor`, PAYP-001).

## Go-live checklist

1. Rotate all provider keys to live (SEC-003).
2. Flip `AIRWALLEX_ENV=prod`; confirm `validateProviderConfig` returns no warns.
3. Register live webhook endpoints (Stripe, Airwallex, WeChat notify URL).
4. Smoke a live $1 card charge in incognito; confirm webhook → order paid → runner_job enqueued.
5. Verify refund path (PAYP-005) on a live test charge, then refund it.
