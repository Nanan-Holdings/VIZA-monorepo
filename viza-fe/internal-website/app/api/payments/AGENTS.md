# Commercial Payments API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/payments/**`.

## Purpose

This module owns commercial subscription and pay-per-application payment
callbacks that are not tied to an existing visa application checkout.

## Key Responsibilities

- Poll authenticated `payment_records` for subscription payment status.
- Create settings payment-method binding intents for Airwallex card, WeChat
  Pay, and Alipay payment consents.
- Receive Stripe webhooks for subscription and pay-per-application checkout
  sessions created from `/client/subscription`.
- Receive WeChat Pay v3 notifications for subscription/native QR orders.
- Receive Alipay page-pay notifications and verify RSA2 signatures.
- Update `payment_records` idempotently by provider session/order id.

## Route Handlers

- `bind/qr/route.ts`: authenticated wallet binding entry point for WeChat Pay
  and Alipay accounts. It creates and verifies an Airwallex Payment Consent,
  then renders only the provider-returned authorization target as a QR code.
  `bind/qr/route.test.ts` guards that provider-target-only QR contract.
- `bind/status/[bindingId]/route.ts`: authenticated Airwallex consent polling
  and durable settings binding synchronization.
- `bind/route.ts`: authenticated server-backed payment-method listing,
  nickname/default management, and provider revocation for settings.
- `bind/airwallex-card/route.ts`: authenticated Airwallex card binding intent
  creation for settings.
- `bind/airwallex-card/[bindingId]/complete/route.ts`: authenticated card
  binding completion after the Airwallex hosted card component creates a
  payment consent.
- `bind/stripe-card/route.ts`: legacy authenticated Stripe Checkout
  setup-session creation for card verification. The current settings UI does
  not call this route.

## Guardrails

- Never collect raw card, WeChat, or Alipay credentials in VIZA UI.
- Keep all displayed commercial prices in CNY for the subscription surface.
- Do not mix official government portal fees into these records.
- Verify provider signatures before trusting webhook/notify payloads.
- Configure Airwallex `payment_consent.*` webhook events to use the signed
  `/api/webhooks/airwallex` endpoint so revocation and verification remain in
  sync even when the applicant closes the settings page.
- Keep WeChat recurring-payments enablement and its merchant plan configured
  with Airwallex. Settings implements only the single-product Flow 1 and must
  fail closed unless `AIRWALLEX_WECHAT_RECURRING_FLOW=single_plan`; use the
  checkout plan-id flow for multi-plan products. Never replace provider consent
  with a local completion URL.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
