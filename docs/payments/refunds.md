# Refunds & Chargebacks (PAYP-005)

Audit + flow of the refund/chargeback handling. Mapping helper:
`viza-fe/internal-website/lib/payments/refund-status.ts`.

## Flow

1. The trusted line-based action classifies refundable order lines and caps the
   request to the exact provider amount stored in
   `order.metadata.checkout_payment`.
2. Stripe orders use the Stripe refund API. Native WeChat orders use
   `POST /v3/refund/domestic/refunds` with a deterministic merchant refund id,
   the stored CNY fen total, and `WECHAT_PAY_REFUND_NOTIFY_URL`.
3. Stripe sends refund/dispute events to `app/api/stripe/webhook/route.ts`.
   WeChat sends `REFUND.SUCCESS` to
   `app/api/wechat-pay/refund/notify/route.ts`.
4. The WeChat callback verifies the platform signature over the raw body,
   decrypts with the API v3 key, and matches the provider transaction, merchant
   order/refund ids, amount, total, and currency against the stored refund line.
5. The admin request stores the accepted provider refund id but remains
   `approved` until a signed provider callback confirms settlement. The
   callback then updates both the order and request to `refunded`. Replayed
   WeChat callbacks are acknowledged without repeating refund-line or order
   mutations.

`refund_request.stripe_refund_id` retains its legacy schema name but is the
provider-refund-id correlation field for this lifecycle. Stripe completion
remains correlated by `stripe_payment_intent_id` through `recordStripeRefund`;
WeChat completion matches the legacy refund-id field. A WeChat callback that
arrives before its correlation write, or encounters a failed database write,
returns failure so the provider retry can finish reconciliation later.

## Status mapping

| Stripe event | Internal state |
| --- | --- |
| `charge.refunded` (full) | `refunded` |
| `charge.refunded` (partial) | `partially_refunded` |
| `refund.failed` | `refund_failed` |
| `charge.dispute.created` / `funds_withdrawn` | `disputed` |

## Gaps / TODO

- Stripe disputes now pause both `submission_queue` and `runner_job`, clearing
  any runner lease so the job cannot be reclaimed while the financial hold is
  active.
- TODO: reconcile partial refunds against the agency-vs-gov-fee split
  (PAYP-007) — a partial refund should map to which component was returned.

## Native WeChat production configuration

- Set `WECHAT_PAY_REFUND_NOTIFY_URL` to the public HTTPS URL ending in
  `/api/wechat-pay/refund/notify`. Do not point it at the payment notification
  route.
- The common WeChat merchant id, merchant certificate serial/private key, API
  v3 key, and platform-certificate access must also be configured.
- Register/allow the refund notification URL in the merchant environment and
  run one sandbox or low-value end-to-end refund before launch. The application
  fails closed when this configuration or the stored collection identity is
  incomplete.
