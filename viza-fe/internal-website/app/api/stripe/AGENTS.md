# Stripe API Route Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/stripe/**`.

Current product policy (2026-09-15): Stripe checkout, webhook, and payout
routes are retired. They return HTTP 410 with `code: "payment_removed"` and
perform no signature verification, provider calls, database writes, or
lifecycle advancement, even when Stripe credentials are configured.

## Purpose

This module owns Stripe route handlers for agency-fee checkout and webhook
ingestion.

## Key Responsibilities

- Create Stripe Checkout sessions from trusted server-side package/application
  data.
- Verify Stripe webhook signatures before trusting event payloads.
- Upsert `payment_records` idempotently by Stripe session/payment id.
- Trigger internal lifecycle advancement after successful payment.
- Final-submission Checkout uses the canonical `order`/`order_line` ledger and
  the atomic `confirm_submission_order_payment` RPC. It creates or verifies the
  exact government allocation and entitlement evidence, but it must never
  enqueue an official submission; the applicant returns to Review and
  explicitly submits again.

## Route Handlers

- `checkout/route.ts`: authenticated `POST /api/stripe/checkout` for creating
  Stripe Checkout sessions for a user's own application and agency fee only.
- `webhook/route.ts`: signature-verified `POST /api/stripe/webhook` for
  Checkout, PaymentIntent, charge, refund, and invoice events.
- `payout-webhook/route.ts`: separately configured, signature-verified Stripe
  payout evidence receiver. It records redacted payout state only; it never
  configures or initiates payouts.
- The former `_shared.ts` Stripe/Supabase helper was removed with the retired
  payment routes; no provider helper is available from this boundary.

## Environment

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

Stripe Dashboard must have Alipay and WeChat Pay enabled for the account before
eligible one-time Checkout sessions can use them. The application sends
`wechat_pay.client=web`; it does not configure account capabilities.

## Guardrails

- Never collect or store raw card details.
- Never trust client-provided amount or currency without reloading the package.
- Never process government portal fees here.
- Stripe checkout copy must distinguish the agency fee from the later official
  fee while making clear that VIZA pays the official portal with an
  application-scoped virtual card; never direct applicants to enter a card on
  the official portal.
- Do not log full Stripe payloads.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
