# Airwallex Integration Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/airwallex/**`.

## Purpose

This module owns server-only Airwallex API helpers for VIZA commercial
payments.

## Guardrails

- Keep Airwallex API keys, access tokens, webhook secrets, and raw provider
  payloads out of client components and logs.
- Cache access tokens until shortly before expiry instead of logging in for
  every request.
- Use CNY amounts derived from VIZA's server-side product catalog or database
  rows, never from browser input.
- Verify webhook signatures against the raw request body before parsing.
