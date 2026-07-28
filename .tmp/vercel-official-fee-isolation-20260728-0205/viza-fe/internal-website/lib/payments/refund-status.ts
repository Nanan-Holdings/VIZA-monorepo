/**
 * Refund / chargeback status mapping (PAYP-005).
 *
 * Maps a provider refund/dispute event to the internal order refund state.
 * Documented in docs/payments/refunds.md.
 */
export type InternalRefundState = "refunded" | "partially_refunded" | "refund_failed" | "disputed" | "none";

export function mapStripeRefundEvent(type: string, fullyRefunded?: boolean): InternalRefundState {
  switch (type) {
    case "charge.refunded":
      return fullyRefunded === false ? "partially_refunded" : "refunded";
    case "refund.failed":
    case "charge.refund.updated":
      return "refund_failed";
    case "charge.dispute.created":
    case "charge.dispute.funds_withdrawn":
      return "disputed";
    default:
      return "none";
  }
}
