# Rewards Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/rewards/**`.

## Purpose

Shared reward helpers for VIZA points earning and redemption.

## Guardrails

- Award spend-based points only from trusted server-side payment confirmation
  paths, never from client input.
- Use `reward_transactions` for all point changes so wallet totals are updated
  by the database trigger.
- Keep purchase rewards idempotent by `payment_record` reference.
- Current earn rule: every RMB 100 of confirmed spend grants 100 points.
