import type { Page } from "@playwright/test";

/**
 * South Africa eVisa government-fee payment via VIZA escrow card (AUTO-ZA-03).
 * Mechanism: PAY-003 `runner_escrow_card`. Mirrors KH/LA/LK shape.
 */

export interface PayZaInput {
  jobId: string;
  applicantId: string;
  applicationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  page: Page;
}

export interface PayZaResult {
  status: "paid" | "declined" | "needs_human";
  portalReceiptId: string | null;
  reason?: string;
}

export async function payZaWithEscrowCard(_input: PayZaInput): Promise<PayZaResult> {
  return { status: "needs_human", portalReceiptId: null, reason: "payment_removed: automated payment has been removed" };
}
