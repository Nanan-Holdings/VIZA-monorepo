# Refunds + disputes (PRODUCT-001)

## Two flows, one table

The `refund_request` table (migration `0081_refunds.sql`) records every applicant-initiated refund request and the staff decision against it. `refund_request.status` walks:

```
requested → approved → refunded
         ↘  denied
                       (or)
requested →                disputed   ← Stripe charge.dispute.created
```

## File layout

| Where                                                            | Owns                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| `viza-fe/internal-website/app/actions/refund-request.ts`         | Applicant `requestRefund` + staff `decideRefund` + webhook helpers `recordStripeRefund` / `recordStripeDispute` |
| `viza-fe/internal-website/app/actions/refunds.ts` (existing PAY-004) | Line-based `refundOrderLines(orderId, lineIds)` — the underlying Stripe call. |
| `viza-be/agent-backend/drizzle/0081_refunds.sql`                 | `refund_request` table + RLS                          |

The applicant action is intentionally lightweight (no Stripe call) — it just records the request. Staff approves via `decideRefund` (sets status='approved' + staff_note). The staff member then runs the existing `refundOrderLines` against the linked order to actually move the money; the Stripe webhook (`charge.refunded`) calls `recordStripeRefund` which flips the request row to `refunded`.

Disputes (`charge.dispute.created`) bypass the applicant flow entirely and stamp `status='disputed'` directly via `recordStripeDispute`.

## Webhook wiring

Add the two events to the Stripe webhook handler under `app/api/stripe/webhooks/route.ts` (PAY-001 territory):

```ts
case "charge.refunded": {
  const charge = event.data.object as Stripe.Charge;
  await recordStripeRefund({
    paymentIntentId: charge.payment_intent as string,
    refundId: charge.refunds?.data[0]?.id ?? "",
  });
  break;
}
case "charge.dispute.created": {
  const dispute = event.data.object as Stripe.Dispute;
  await recordStripeDispute({
    paymentIntentId: dispute.payment_intent as string,
    disputeId: dispute.id,
  });
  break;
}
```

## UI

- **Applicant**: `/application/[id]` shows a "Request refund" button once an application is in `submitted_to_government` or `delivered` state — opens a drawer with amount + reason fields.
- **Staff**: `/admin/cs/refunds` lists `status='requested'` rows with approve/deny CTAs (PRODUCT-003 surface — implemented under the /admin/cs umbrella).
- **Audit**: every status flip stamps `decided_by` and `decided_at`. Disputes are tracked even when they bypass the applicant flow so we have one source of truth.
