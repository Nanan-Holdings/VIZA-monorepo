# Runbook — Stripe ↔ orders reconciliation delta

> Last reviewed: 2026-05-07.
> Alert class: `payments.reconcile.delta`.
> Source: `viza-be/agent-backend/scripts/reconcile-stripe-payouts.ts`.

## Symptoms

- Daily reconciler emitted an alert: net Stripe charges in last 24 h
  differ from internal `order` totals by > USD 5.

## Diagnosis

- Pull the reconciler's stdout from the cron host. Both numbers
  appear in the log line.
- Inspect orders that didn't make it to `paid`:

  ```sql
  SELECT id, status, agency_fee_cents, currency, created_at,
         stripe_checkout_session_id, paid_at
    FROM "order"
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
  ```

- Cross-check Stripe dashboard for any charges that didn't surface
  the `checkout.session.completed` webhook (e.g. webhook delivery
  blocked, replay needed).

## Mitigation

1. If the delta is from a missed webhook: replay the events from
   the Stripe dashboard. The webhook handler is idempotent
   (PAY-002).
2. If a charge legitimately landed in Stripe with no internal
   order (manual charge, test mode in live, ...): log a
   reconciliation note in the orders' metadata and either refund
   from Stripe or back-fill the order manually.
3. If the internal side has a paid order without a matching Stripe
   charge (rare): something is writing `status='paid'` outside the
   webhook path — investigate.

## Escalation

- Repeated deltas across 3+ days → freeze admin order writes (no
  manual `status='paid'` flips) until investigation completes.
- Delta > USD 1000 → loop in finance + maintainer immediately.
