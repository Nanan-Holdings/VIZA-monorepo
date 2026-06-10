# Payment Webhooks — Signature & Idempotency Audit (PAYP-008)

| Webhook | Signature verification | Idempotency |
| --- | --- | --- |
| Stripe `app/api/stripe/webhook/route.ts` | `stripe.webhooks.constructEvent` (HMAC via `STRIPE_WEBHOOK_SECRET`) | event id dedup in `lib/stripe/handle-event.ts#applyStripeEvent` |
| WeChat `app/api/wechat-pay/notify/route.ts` | APIv3 signature verify + AES-256-GCM resource decrypt (`lib/wechatpay/client.ts`) | idempotent on `wechat_out_trade_no` (`lib/wechatpay/handle-event.ts`) |
| Airwallex (if enabled) | `AIRWALLEX_WEBHOOK_SECRET` HMAC | event id dedup |

## Idempotency contract

- `lib/payments/webhook-idempotency.ts#webhookIdempotencyKey(provider, eventId)`
  is the canonical dedup key.
- The post-paid side-effect (`enqueueRunnerJob`) is **independently idempotent**:
  it reuses an existing `queued`/`running` runner_job for the same
  `application_id`, so a replayed `paid` event never creates a duplicate job
  (lib/queue/enqueue.ts). Verified by tests
  (`lib/payments/webhook-idempotency.test.ts`, `lib/queue/countries.test.ts`).

## Result

All three webhooks verify signatures and dedup by provider event id; the
runner_job side-effect adds a second idempotency layer keyed on application_id.
No missing verification found.
