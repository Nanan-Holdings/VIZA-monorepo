# Client Checkout Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/checkout/**`.

## Purpose

This module owns applicant checkout for VIZA agency fees. It starts payment and
activates the internal preparation workflow after Stripe confirms payment.

Government portal payments are not processed by this Stripe checkout. Explain
clearly that VIZA provisions an application-scoped virtual card and pays the
official portal on the applicant's behalf when that later step becomes due.

## Key Responsibilities

- Render eligible `visa_packages` with agency fee, currency, and government
  fee display notes.
- When `applicationId` is present, lock checkout to that exact application's
  package. Do not show an active-package chooser or allow checkout to fall back
  silently to another application.
- Start Stripe Checkout through trusted server actions or route handlers.
- Create/update `payment_records` for pending and paid sessions.
- After successful payment, move the application toward the next internal
  automation state.
- Provide clear missing-configuration messaging when Stripe env vars are not
  configured.

## Data Sources

- `visa_packages`
- `user_packages`
- `applications`
- `payment_records`

## Environment

Required for real checkout:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` or equivalent app base URL

## Guardrails

- Never collect card details directly in VIZA UI. Use Stripe Checkout or Stripe
  hosted flows.
- Never mix government fees into agency fee records unless a package explicitly
  defines that behavior.
- Do not store raw payment method details.
- Do not add a dependency on official portal automation.
- Never ask applicants for official-portal card details or tell them to pay an
  official portal directly. VIZA's submission worker owns just-in-time virtual
  card issuance and official-fee payment.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/checkout`; without Stripe env vars, verify the page fails
gracefully.

## Important Files

- `page.tsx`: `/client/checkout` route UI, return-state rendering, package
  summary, fee disclosure, and next-step routing.
- `actions.ts`: server action that creates Stripe-hosted Checkout sessions for
  agency fees only.
- `data.ts`: server-only checkout data loading, payment-state reconciliation,
  government-fee disclosure helpers, and scoped Supabase typing.
- `data.test.ts`: regression coverage for exact application/package selection.
- `submit-button.tsx`: client submit button with pending state for the Stripe
  Checkout form.
