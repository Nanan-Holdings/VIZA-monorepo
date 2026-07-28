# Alipay Client Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/alipay/**`.

## Purpose

This module contains server-only helpers for Alipay OpenAPI page-pay flows.

## Guardrails

- Keep private keys in environment variables only; never commit PEM material.
- Use RSA2 signing/verification and canonical sorted parameter strings.
- Keep helpers free of browser/client imports.

## Environment

- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- `ALIPAY_GATEWAY_URL` for sandbox or non-default gateways.
