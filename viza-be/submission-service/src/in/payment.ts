import type { Page } from "@playwright/test";
import { loadEscrowCard, recordPortalReceipt, recordPortalDecline } from "../vietnam/govt-payment.js";

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

const RECEIPT_PATTERNS = [
  /receipt[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i,
  /transaction[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i,
  /reference[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i,
  /application id[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i,
];

async function fillCardForm(page: Page, applicantId: string): Promise<void> {
  const card = await loadEscrowCard(applicantId);
  const fillIfExists = async (selector: string, value: string) => {
    try {
      await page.fill(selector, value, { timeout: 5_000 });
    } catch {
      // selector miss handled by caller fallbacks
    }
  };
  await fillIfExists('input[name="card_number"]', card.pan);
  await fillIfExists('input[autocomplete="cc-number"]', card.pan);
  await fillIfExists('input[name="exp_month"]', card.expiryMonth);
  await fillIfExists('input[name="exp_year"]', card.expiryYear);
  await fillIfExists('input[autocomplete="cc-exp"]', `${card.expiryMonth}/${card.expiryYear.slice(-2)}`);
  await fillIfExists('input[name="cvc"]', card.cvv);
  await fillIfExists('input[autocomplete="cc-csc"]', card.cvv);
}

function extractReceiptFromText(body: string): string | null {
  for (const re of RECEIPT_PATTERNS) {
    const m = re.exec(body);
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function payInWithEscrowCard(input: PayInInput): Promise<PayInResult> {
  const { page, applicantId, orderId, amountCents, currency } = input;
  try {
    await fillCardForm(page, applicantId);
    const submitted =
      (await page.click('button:has-text("Pay")', { timeout: 5_000 }).then(() => true).catch(() => false)) ||
      (await page.click('button:has-text("Submit Payment")', { timeout: 5_000 }).then(() => true).catch(() => false)) ||
      (await page.click('button:has-text("Make Payment")', { timeout: 5_000 }).then(() => true).catch(() => false));
    if (!submitted) {
      return { status: "needs_human", portalReceiptId: null, reason: "could not locate IN payment submit button" };
    }
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    const bodyText = (await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")).slice(0, 4000);
    if (/declined|insufficient funds|payment failed|transaction failed/i.test(bodyText)) {
      await recordPortalDecline(orderId, "card declined on IN portal");
      return { status: "declined", portalReceiptId: null, reason: "IN portal returned decline" };
    }
    const receiptId = extractReceiptFromText(bodyText);
    if (!receiptId) {
      return { status: "needs_human", portalReceiptId: null, reason: "IN portal did not surface a receipt id post-submit" };
    }
    await recordPortalReceipt({ orderId, amountCents, currency, portalReceiptId: receiptId });
    return { status: "paid", portalReceiptId: receiptId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "needs_human", portalReceiptId: null, reason: `IN pay threw: ${msg}` };
  }
}
