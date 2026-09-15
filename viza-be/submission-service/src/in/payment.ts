import type { Page } from "@playwright/test";

/**
 * India e-Visa government-fee payment via VIZA escrow card (AUTO-IN-03).
 * Mechanism: PAY-003 `runner_escrow_card`. Mirrors KH/LA/LK/ZA shape.
 */

export interface PayInInput {
  jobId: string;
  applicantId: string;
  applicationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  page: Page;
}

export interface PayInResult {
  status: "paid" | "declined" | "needs_human";
  portalReceiptId: string | null;
  reason?: string;
}

export async function payInWithEscrowCard(_input: PayInInput): Promise<PayInResult> {
  return { status: "needs_human", portalReceiptId: null, reason: "payment_removed: automated payment has been removed" };
}
