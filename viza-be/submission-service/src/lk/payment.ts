import type { Page } from "@playwright/test";

/**
 * Sri Lanka ETA government-fee payment via VIZA escrow card (AUTO-LK-03).
 * Mechanism: PAY-003 `runner_escrow_card`. Mirrors KH/LA shape.
 */

export interface PayLkInput {
  jobId: string;
  applicantId: string;
  applicationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  page: Page;
}

export interface PayLkResult {
  status: "paid" | "declined" | "needs_human";
  portalReceiptId: string | null;
  reason?: string;
}

export async function payLkWithEscrowCard(_input: PayLkInput): Promise<PayLkResult> {
  return { status: "needs_human", portalReceiptId: null, reason: "payment_removed: automated payment has been removed" };
}
