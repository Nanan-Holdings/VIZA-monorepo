# Commercial Payments API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/payments/**`.

## Purpose

This module owns commercial subscription and pay-per-application payment
callbacks that are not tied to an existing visa application checkout.

## Key Responsibilities

- Poll authenticated `payment_records` for subscription payment status.
- Create settings payment-method binding intents for Airwallex card
  verification, and do not expose wallet QR binding until a real provider
  wallet-binding flow is configured.
- Receive Stripe webhooks for subscription and pay-per-application checkout
  sessions created from `/client/subscription`.
- Receive WeChat Pay v3 notifications for subscription/native QR orders.
- Receive Alipay page-pay notifications and verify RSA2 signatures.
- Update `payment_records` idempotently by provider session/order id.

## Route Handlers

- `bind/qr/route.ts`: authenticated wallet binding entry point for WeChat Pay
  and Alipay accounts. It returns unavailable unless a real provider
  wallet-binding flow is enabled; do not generate local callback QR codes as a
  substitute for provider authorization.
- `bind/status/[bindingId]/route.ts`: wallet QR completion callback and
  authenticated status polling for settings.
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

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
