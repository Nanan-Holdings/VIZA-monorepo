"use server";

import { paymentRemovedError } from "./payment-removed";

export interface RefundLineDecision {
  lineId: string;
  kind: string;
  amountCents: number;
  refundable: boolean;
  reason?: string;
}

/** Legacy result shape retained for stale admin callers. */
export interface RefundOutput {
  orderId: string;
  refundId: string | null;
  refundedCents: number;
  currency: string;
  decisions: RefundLineDecision[];
}

/**
 * Stripe refunds are retired. Fail before loading an order or contacting a
 * payment provider, regardless of configured credentials.
 */
export async function refundOrderLines(
  _orderId: string,
  _lineIds: string[],
): Promise<RefundOutput> {
  throw paymentRemovedError("refundOrderLines");
}
