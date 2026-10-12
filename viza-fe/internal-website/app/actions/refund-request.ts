"use server";

import { PAYMENT_REMOVED_MESSAGE, paymentRemovedError } from "./payment-removed";

export interface RefundRequestInput {
  applicationId: string;
  amountCents: number;
  reason: string;
}

export interface RefundActionResult {
  ok: boolean;
  refundRequestId?: string;
  reason?: string;
}

/** Refund requests are retired and never create a database record. */
export async function requestRefund(
  _input: RefundRequestInput,
): Promise<RefundActionResult> {
  return { ok: false, reason: PAYMENT_REMOVED_MESSAGE };
}

/** Staff refund decisions are retired and never mutate refund state. */
export async function decideRefund(_input: {
  refundRequestId: string;
  approve: boolean;
  staffNote: string;
}): Promise<RefundActionResult> {
  return { ok: false, reason: PAYMENT_REMOVED_MESSAGE };
}

/** Legacy webhook export retained as an explicit retired operation. */
export async function recordStripeRefund(_input: {
  paymentIntentId: string;
  refundId: string;
}): Promise<void> {
  throw paymentRemovedError("recordStripeRefund");
}

/** Legacy dispute export retained as an explicit retired operation. */
export async function recordStripeDispute(_input: {
  paymentIntentId: string;
  disputeId: string;
}): Promise<void> {
  throw paymentRemovedError("recordStripeDispute");
}
