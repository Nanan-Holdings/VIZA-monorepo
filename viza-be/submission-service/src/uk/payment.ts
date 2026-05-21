import type { Page } from "@playwright/test";
import { loadEscrowCard, recordPortalReceipt, recordPortalDecline } from "../vietnam/govt-payment.js";

/**
 * UK Standard Visitor visa government-fee payment via VIZA escrow card (AUTO-UK-03).
 * Mechanism: PAY-003 `runner_escrow_card`. Mirrors KH/LA/LK/ZA/IN shape.
 *
 * NOTE: UK uses Worldpay; the VAC also charges a separate biometrics
 * appointment fee (TLS Contact / VFS Global) which is NOT handled here —
 * that's a downstream booking flow.
 */

export interface PayUkInput {
  jobId: string;
  applicantId: string;
  applicationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  page: Page;
}

export interface PayUkResult {
  status: "paid" | "declined" | "needs_human";
  portalReceiptId: string | null;
  reason?: string;
}

const RECEIPT_PATTERNS = [
  /reference[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i,
  /worldpay[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i,
  /transaction[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i,
  /GWF[A-Z0-9]{8,}/i,
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
    if (m?.[0] && /^GWF/i.test(m[0])) return m[0];
  }
  return null;
}

export async function payUkWithEscrowCard(input: PayUkInput): Promise<PayUkResult> {
  const { page, applicantId, orderId, amountCents, currency } = input;
  try {
    await fillCardForm(page, applicantId);
    const submitted =
      (await page.click('button:has-text("Pay")', { timeout: 5_000 }).then(() => true).catch(() => false)) ||
      (await page.click('button:has-text("Make payment")', { timeout: 5_000 }).then(() => true).catch(() => false)) ||
      (await page.click('button:has-text("Confirm payment")', { timeout: 5_000 }).then(() => true).catch(() => false));
    if (!submitted) {
      return { status: "needs_human", portalReceiptId: null, reason: "could not locate UK payment submit button" };
    }
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    const bodyText = (await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")).slice(0, 4000);
    if (/declined|insufficient funds|payment failed|unable to process/i.test(bodyText)) {
      await recordPortalDecline(orderId, "card declined on UK Worldpay");
      return { status: "declined", portalReceiptId: null, reason: "UK portal returned decline" };
    }
    const receiptId = extractReceiptFromText(bodyText);
    if (!receiptId) {
      return { status: "needs_human", portalReceiptId: null, reason: "UK portal did not surface a receipt id post-submit" };
    }
    await recordPortalReceipt({ orderId, amountCents, currency, portalReceiptId: receiptId });
    return { status: "paid", portalReceiptId: receiptId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "needs_human", portalReceiptId: null, reason: `UK pay threw: ${msg}` };
  }
}
