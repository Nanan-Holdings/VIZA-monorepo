import type { Page } from "@playwright/test";

/**
 * Laos government-fee payment via VIZA escrow card (AUTO-LA-03).
 *
 * Mechanism: PAY-003 `runner_escrow_card`. Mirrors AUTO-KH-03;
 * shares the vault-loaded escrow card helper.
 */

export interface PayLaInput {
  jobId: string;
  applicantId: string;
  applicationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  page: Page;
}

export interface PayLaResult {
  status: "paid" | "declined" | "needs_human";
  portalReceiptId: string | null;
  reason?: string;
}

export async function payLaWithEscrowCard(_input: PayLaInput): Promise<PayLaResult> {
  return { status: "needs_human", portalReceiptId: null, reason: "payment_removed: automated payment has been removed" };
}
