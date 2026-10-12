"use server";

import { PAYMENT_REMOVED_MESSAGE } from "./payment-removed";
import type { RefundOutput } from "./refunds";

type CommandResult = { success: true } | { success: false; error: string };

/** Payment provisioning retries are retired and never touch the job queue. */
export async function retryPaymentProvisioning(_input: {
  jobId: string;
  reason: string;
}): Promise<CommandResult> {
  return { success: false, error: PAYMENT_REMOVED_MESSAGE };
}

/** Refund approval is retired and never mutates refund requests. */
export async function decideAdminRefund(_input: {
  refundRequestId: string;
  approve: boolean;
  reason: string;
}): Promise<CommandResult> {
  return { success: false, error: PAYMENT_REMOVED_MESSAGE };
}

/** Refund execution is retired and never contacts Stripe. */
export async function executeApprovedRefund(_input: {
  refundRequestId: string;
  orderId: string;
  lineIds: string[];
  reason: string;
}): Promise<CommandResult & { output?: RefundOutput }> {
  return { success: false, error: PAYMENT_REMOVED_MESSAGE };
}
