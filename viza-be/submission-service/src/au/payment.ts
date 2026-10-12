import type { Page } from "@playwright/test";

/**
 * Australia Subclass 600 payment via VIZA escrow card (AUTO-AU-03).
 * Mechanism: PAY-003 `runner_escrow_card`. AU returns a TRN
 * (Transaction Reference Number) post-payment which is the grant
 * reference; capture it for status='delivered' transition.
 */

export interface PayAuInput {
  jobId: string;
  applicantId: string;
  applicationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  page: Page;
}

export interface PayAuResult {
  status: "paid" | "declined" | "needs_human";
  portalReceiptId: string | null;
  trn?: string;
  reason?: string;
}

export async function payAuWithEscrowCard(_input: PayAuInput): Promise<PayAuResult> {
  return { status: "needs_human", portalReceiptId: null, reason: "payment_removed: automated payment has been removed" };
}
