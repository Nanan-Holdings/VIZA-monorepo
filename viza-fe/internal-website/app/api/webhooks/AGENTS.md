# Webhooks API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/webhooks/**`.

## Purpose

This module receives third-party provider callbacks that are not owned by a
single existing provider directory.

PhotonPay funding/issuing evidence is handled by
`photonpay/funding/route.ts`. It uses the same raw-body signature verification
as the acquiring callback and stores only redacted, idempotent evidence.

Airwallex Issuing remote authorization is handled by
`airwallex/remote-authorization/route.ts`. It verifies the Airwallex nonce HMAC
and authorizes only an exact amount/currency purchase for a known Airwallex
card whose issuer attempt and allocation are both in active portal processing.
New authorizations also require an explicit per-currency daily ceiling and
count all issued, processing, and consumed Airwallex limits for that UTC day.
Unknown cards and unavailable safety checks fail closed. Production Airwallex
Issuing must configure remote authorization version 2 with the provider-side
default action set to `DECLINED`.

## Guardrails

- Always verify provider signatures against the raw request body before parsing
  webhook JSON.
- Return only minimal acknowledgements to providers.
- Do not log secrets, raw signatures, API keys, or customer payment method
  details.
