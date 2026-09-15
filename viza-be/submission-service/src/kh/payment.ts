import type { Page } from "@playwright/test";

/**
 * Cambodia government-fee payment via VIZA escrow card (AUTO-KH-03).
 *
 * Mechanism: PAY-003 `runner_escrow_card` — same mechanism as VN.
 * The runner already loaded the applicant's vault entries
 * `viza.escrow.card.{pan,expiry,cvv}` via `loadEscrowCard()` (the
 * helper lives under viza-be/submission-service/src/vietnam/ since
 * it's the canonical reference; we re-export instead of duplicating).
 *
 * Selectors derive from the recon walker output for evisa.gov.kh.
 * Each portal updates them periodically — when the selectors drift,
 * runner falls back to label-based fills.
 */

export interface PayKhInput {
  jobId: string;
  applicantId: string;
  applicationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  page: Page;
}

export interface PayKhResult {
  status: "paid" | "declined" | "needs_human";
  portalReceiptId: string | null;
  reason?: string;
}

export async function payKhWithEscrowCard(_input: PayKhInput): Promise<PayKhResult> {
  return { status: "needs_human", portalReceiptId: null, reason: "payment_removed: automated payment has been removed" };
}
