# Webhooks API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/webhooks/**`.

## Purpose

This module receives third-party provider callbacks that are not owned by a
single existing provider directory.

PhotonPay funding/issuing evidence is handled by
`photonpay/funding/route.ts`. It uses the same raw-body signature verification
as the acquiring callback and stores only redacted, idempotent evidence.

## Guardrails

- Always verify provider signatures against the raw request body before parsing
  webhook JSON.
- Return only minimal acknowledgements to providers.
- Do not log secrets, raw signatures, API keys, or customer payment method
  details.
