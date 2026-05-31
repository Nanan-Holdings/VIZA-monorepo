# Commercial Payments API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/payments/**`.

## Purpose

This module owns commercial subscription and pay-per-application payment
callbacks that are not tied to an existing visa application checkout.

## Key Responsibilities

- Poll authenticated `payment_records` for subscription payment status.
- Receive WeChat Pay v3 notifications for subscription/native QR orders.
- Receive Alipay page-pay notifications and verify RSA2 signatures.
- Update `payment_records` idempotently by provider session/order id.

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
