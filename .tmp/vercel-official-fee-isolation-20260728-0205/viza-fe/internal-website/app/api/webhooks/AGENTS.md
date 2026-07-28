# Webhooks API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/webhooks/**`.

## Purpose

This module receives third-party provider callbacks that are not owned by a
single existing provider directory.

## Guardrails

- Always verify provider signatures against the raw request body before parsing
  webhook JSON.
- Return only minimal acknowledgements to providers.
- Do not log secrets, raw signatures, API keys, or customer payment method
  details.
