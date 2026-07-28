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
