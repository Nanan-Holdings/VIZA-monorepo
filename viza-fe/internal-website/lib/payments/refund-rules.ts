/**
 * Per-line refundability rules (PAY-004).
 *
 * Pure classifier so the staff refund action and the customer-facing
 * UI reach the same answer.
 *
 * - `agency`: always refundable from Stripe.
 * - `govt` (viza_passthrough): refundable while the order has not
 *   reached `submitted`/`completed`. Once the runner has paid the
 *   destination portal we cannot recover the funds from the portal,
 *   so we mark the line non-refundable.
 * - `govt` (portal_direct): never refundable through Stripe — the
 *   client paid the portal directly; refunds go through the portal.
 * - `third_party_*` (captcha solves, proxy spend): non-recoverable.
 */

export type LineKind =
  | "agency"
  | "govt"
  | "third_party_captcha"
  | "third_party_proxy"
  | "refund";

export interface RefundContext {
  /** Current `order.status`. */
  orderStatus: string;
  /** govtFeeChannel from the pricing config: 'viza_passthrough' | 'portal_direct'. */
  govtFeeChannel: "viza_passthrough" | "portal_direct";
}

export interface RefundabilityVerdict {
  refundable: boolean;
  reason?: string;
}

export function classifyRefundability(
  kind: LineKind,
  ctx: RefundContext,
): RefundabilityVerdict {
  switch (kind) {
    case "agency":
      return { refundable: true };
    case "govt":
      if (ctx.govtFeeChannel === "portal_direct") {
        return {
          refundable: false,
          reason: "Government fee was paid directly on the portal — refund through the portal.",
        };
      }
      if (
        ctx.orderStatus === "submitted" ||
        ctx.orderStatus === "completed"
      ) {
        return {
          refundable: false,
          reason: "Government fee was already submitted to the destination portal — non-recoverable.",
        };
      }
      return { refundable: true };
    case "third_party_captcha":
    case "third_party_proxy":
      return {
        refundable: false,
        reason: "Third-party operational cost — already incurred, non-recoverable.",
      };
    case "refund":
      return { refundable: false, reason: "Refund line cannot itself be refunded." };
    default:
      return { refundable: false, reason: `Unknown line kind: ${kind}` };
  }
}
