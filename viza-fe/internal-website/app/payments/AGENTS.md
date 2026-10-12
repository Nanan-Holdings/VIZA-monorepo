# Payments Page Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/payments/**`.

## Purpose

This module hosts standalone customer payment pages that can be entered from
commercial subscription and pay-per-application surfaces.

## Guardrails

- Never render provider API keys or server access tokens.
- Show CNY prices from server-created payment records.
- Keep checkout pages focused: payment summary, provider widget/actions, result
  state, and a clear return path.
- Keep checkout and result copy in `payment-copy.ts` keyed by the selected `en`
  or `zh` locale. Render provider and attempt statuses through localized safe
  labels; never expose raw provider error text or status codes.
- A locale change may remount the hosted payment widget so its own copy matches
  the selected language, but must not create a new payment intent or submit a
  payment.
