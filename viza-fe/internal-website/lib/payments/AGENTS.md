# Payments Library Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/payments/**`.

## Purpose

This module holds shared payment-domain helpers used by client and API routes.

## Key Files

- `commercial-products.ts`: CNY subscription and pay-per-application product
  catalog used by `/client/subscription`.
- `commercial-session.ts`: resolves the current client portal applicant session
  for commercial subscription payment records.
- `refund-rules.ts`: refund eligibility helpers for existing payment records.
- `method-availability.ts`: package/currency policy for direct wallets and
  Stripe Checkout Alipay/WeChat Pay method selection.

## Guardrails

- Store prices in minor units (`amountFen` for CNY) and format at the UI edge.
- Keep official government fees separate from commercial VIZA service fees.
- Do not import client components from this module.
