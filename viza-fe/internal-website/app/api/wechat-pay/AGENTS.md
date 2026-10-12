# WeChat Pay API Route Guide

Scope: this file applies to `app/api/wechat-pay/**`.

## Responsibilities

- `notify/route.ts` verifies and applies native-payment notifications.
- `refund/notify/route.ts` verifies and applies domestic-refund notifications.
- `status/[orderId]/route.ts` exposes the bounded checkout polling state.

## Guardrails

- Verify the WeChat Pay v3 platform signature over the untouched request body
  before parsing or decrypting it.
- Decrypt callback resources only with the configured API v3 key.
- Match merchant and provider identifiers, exact CNY fen amounts, and currency
  against persisted checkout/refund ledger data before changing state.
- Callback replays must succeed without repeating ledger mutations.
- Return a failure response on verification, decryption, identity, or storage
  errors so WeChat retries instead of silently losing the event.

## Validation

Run focused route and event-handler tests, then frontend type-check and lint.
