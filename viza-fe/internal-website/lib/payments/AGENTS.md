# Payments Library Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/payments/**`.

## Purpose

This module holds shared payment-domain helpers used by client and API routes.

## Key Files

- `commercial-products.ts`: CNY subscription and pay-per-application product
  catalog used by `/client/subscription`.
- `commercial-session.ts`: resolves the current client portal applicant session
  for commercial subscription payment records.
- `refund-rules.ts`: refund eligibility helpers for existing payment records.
- `method-availability.ts`: package/currency policy for direct wallets and
  Stripe Checkout Alipay/WeChat Pay method selection.
- `official-fee-catalog.ts`: typed country/visa classification for VIZA-managed
  virtual-card payments and explicit offline/free exceptions.
- `submission-access.ts`: application-scoped final-submission evaluator. It
  locks valid high-access waivers, reconciles legacy order/payment evidence,
  validates official-fee allocations, and returns the stable
  `SubmissionAccessDecision` used by every server-side submission boundary.

## Guardrails

- Store prices in minor units (`amountFen` for CNY) and format at the UI edge.
- Keep official government fees separate from commercial VIZA service fees.
- Official portal payments use VIZA-managed, application-scoped virtual cards;
  any `portal_direct` value is legacy data, not an instruction for applicants
  to enter their own card.
- Do not import client components from this module.
- Never accept payment evidence from a different application. A ready decision
  requires the exact application entitlement plus matching amount/currency for
  managed official-fee allocations.
- Payment confirmation prepares the entitlement but never enqueues an official
  submission. The applicant must return to Review and explicitly submit again.
