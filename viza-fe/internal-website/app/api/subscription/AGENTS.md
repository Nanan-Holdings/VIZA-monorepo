# Subscription API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/subscription/**`.

Current product policy (2026-09-15): commercial subscriptions are retired.
The current, cancel, and resume routes return HTTP 410 with
`code: "payment_removed"` and never read or mutate subscription/payment state.

## Purpose

This module exposes authenticated client subscription state for the VIZA
commercial monthly plans.

## Guardrails

- Treat `payment_records` with `fee_type = subscription_fee` as the current
  sandbox subscription source until a provider recurring-billing API is enabled.
- Do not expose payment provider secrets, raw webhook payloads, card data, or
  wallet credentials.
- Cancellation should mark `cancel_at_period_end` style metadata; do not delete
  paid payment records.
