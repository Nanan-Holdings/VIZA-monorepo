# Refunds & Chargebacks (PAYP-005)

Audit + flow of the refund/chargeback handling. Mapping helper:
`viza-fe/internal-website/lib/payments/refund-status.ts`.

## Flow

1. Refund initiated in the Stripe dashboard (or via API) — or a dispute opens.
2. Stripe sends `charge.refunded` / `refund.failed` / `charge.dispute.*` to the
   webhook (`app/api/stripe/webhook/route.ts`).
3. `mapStripeRefundEvent(type, fullyRefunded)` → internal state
   (`refunded` | `partially_refunded` | `refund_failed` | `disputed`).
4. The order's refund/dispute state is updated; PAY-004 flips paused
   submission/runner work for disputes so we don't keep processing a
   charged-back order.

## Status mapping

| Stripe event | Internal state |
| --- | --- |
| `charge.refunded` (full) | `refunded` |
| `charge.refunded` (partial) | `partially_refunded` |
| `refund.failed` | `refund_failed` |
| `charge.dispute.created` / `funds_withdrawn` | `disputed` |

## Gaps / TODO

- TODO(PAYP-005): wire `disputed` → pause the application's `runner_job`
  (mirror PAY-004 submission_queue `paused_dispute`) so a chargeback halts
  both queues uniformly.
- TODO: reconcile partial refunds against the agency-vs-gov-fee split
  (PAYP-007) — a partial refund should map to which component was returned.
