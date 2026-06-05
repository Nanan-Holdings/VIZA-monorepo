# Subscription API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/subscription/**`.

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
