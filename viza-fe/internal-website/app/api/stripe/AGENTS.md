# Stripe API Route Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/stripe/**`.

## Purpose

This module owns Stripe route handlers for agency-fee checkout and webhook
ingestion.

## Key Responsibilities

- Create Stripe Checkout sessions from trusted server-side package/application
  data.
- Verify Stripe webhook signatures before trusting event payloads.
- Upsert `payment_records` idempotently by Stripe session/payment id.
- Trigger internal lifecycle advancement after successful payment.

## Environment

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Guardrails

- Never collect or store raw card details.
- Never trust client-provided amount or currency without reloading the package.
- Never process government portal fees here.
- Do not log full Stripe payloads.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
