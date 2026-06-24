import type { Page } from "@playwright/test";

export interface VietnamFixedCard {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  holderName: string;
}

export interface RedactedVietnamFixedCard {
  enabled: boolean;
  last4: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  holderNamePresent: boolean;
}

export interface VietnamFixedCardPaymentResult {
  status: "paid" | "declined" | "needs_human" | "disabled";
  receiptReference: string | null;
  reason?: string;
  redactedCard?: RedactedVietnamFixedCard;
}

type EnvLike = Record<string, string | undefined>;
export type VietnamFixedCardInput = {
  pan?: string | null;
  expiry?: string | null;
  cvv?: string | null;
  holderName?: string | null;
};

const RECEIPT_PATTERNS = [
  /receipt[^A-Z0-9]{0,12}([A-Z0-9-]{6,})/i,
  /transaction\s*(?:reference|id)?[^A-Z0-9]{0,12}([A-Z0-9-]{6,})/i,
  /reference[^A-Z0-9]{0,12}([A-Z0-9-]{6,})/i,
  /payment\s*(?:id|code)[^A-Z0-9]{0,12}([A-Z0-9-]{6,})/i,
];

const PAYMENT_CHALLENGE_PATTERN =
  /\b(3d secure|3ds|one[-\s]?time password|otp|verification code|bank app|authenticate|authentication required|securecode|verified by visa|mastercard identity check)\b/i;
const OFFICIAL_APPLICATION_FORM_PATTERN =
  /\b(viet nam e-visa application form|foreigner's images|personal information|requested information|passport information|identity card)\b/i;
const PAYMENT_CONTEXT_PATTERN =
  /\b(payment gateway|transaction|payment amount|card number|credit card|debit card|cvv|cvc|expiry|expiration|pay now|submit payment|thanh toán)\b/i;

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

function normalizeDigits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function parseExpiry(value: string | undefined): { month: string; year: string } | null {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(value ?? "");
  if (!match) return null;
  const monthNumber = Number(match[1]);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return null;
  const month = monthNumber.toString().padStart(2, "0");
  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return { month, year };
}

export function loadVietnamFixedCardFromEnv(env: EnvLike = process.env): VietnamFixedCard | null {
  if (!envEnabled(env.VN_FIXED_CARD_ENABLED) || !envEnabled(env.VN_OFFICIAL_PAYMENT_AUTOPAY)) {
    return null;
  }

  return parseVietnamFixedCardInput(
    {
      pan: env.VN_FIXED_CARD_PAN,
      expiry: env.VN_FIXED_CARD_EXPIRY,
      cvv: env.VN_FIXED_CARD_CVV,
      holderName: env.VN_FIXED_CARD_HOLDER_NAME,
    },
    {
      panLabel: "VN_FIXED_CARD_PAN",
      expiryLabel: "VN_FIXED_CARD_EXPIRY",
      cvvLabel: "VN_FIXED_CARD_CVV",
    },
  );
}

export function parseVietnamFixedCardInput(
  input: VietnamFixedCardInput,
  labels: { panLabel?: string; expiryLabel?: string; cvvLabel?: string } = {},
): VietnamFixedCard {
  const pan = normalizeDigits(input.pan ?? undefined);
  if (!/^\d{12,19}$/.test(pan)) {
    throw new Error(`${labels.panLabel ?? "cardNumber"} must be 12-19 digits.`);
  }

  const expiry = parseExpiry(input.expiry ?? undefined);
  if (!expiry) {
    throw new Error(`${labels.expiryLabel ?? "expiry"} must use MM/YY or MM/YYYY.`);
  }

  const cvv = normalizeDigits(input.cvv ?? undefined);
  if (!/^\d{3,4}$/.test(cvv)) {
    throw new Error(`${labels.cvvLabel ?? "cvv"} must be 3-4 digits.`);
  }

  return {
    pan,
    expiryMonth: expiry.month,
    expiryYear: expiry.year,
    cvv,
    holderName: (input.holderName ?? "VIZA").trim() || "VIZA",
  };
}

export function redactVietnamFixedCard(card: VietnamFixedCard | null): RedactedVietnamFixedCard {
  return {
    enabled: Boolean(card),
    last4: card ? card.pan.slice(-4) : null,
    expiryMonth: card?.expiryMonth ?? null,
    expiryYear: card?.expiryYear ?? null,
    holderNamePresent: Boolean(card?.holderName),
  };
}

export function extractVietnamPaymentReceiptReference(text: string): string | null {
  for (const pattern of RECEIPT_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function vietnamPaymentNeedsHuman(text: string): boolean {
  return PAYMENT_CHALLENGE_PATTERN.test(text);
}

function isLikelyPaymentGateway(pageUrl: string, bodyText: string): boolean {
  if (OFFICIAL_APPLICATION_FORM_PATTERN.test(bodyText) && /\/e-visa\/foreigners\//i.test(pageUrl)) {
    return false;
  }
  return PAYMENT_CONTEXT_PATTERN.test(bodyText) || /\/(?:payment|pay|checkout|gateway)(?:\/|$|\?)/i.test(pageUrl);
}

function isOfficialVietnamPaymentInformationPage(bodyText: string): boolean {
  return (
    /payment[’']?s information/i.test(bodyText) &&
    /e-visa app no\.?|amount paid\s*\(usd\)|i agree to pay/i.test(bodyText)
  );
}

async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 1_000 })) {
        await locator.fill(value, { timeout: 5_000 });
        return true;
      }
    } catch {
      // Try the next selector; payment gateways vary by provider.
    }
  }
  return false;
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 1_000 })) {
        await locator.click({ timeout: 5_000 });
        return true;
      }
    } catch {
      // Try the next selector.
    }
  }
  return false;
}

async function advanceOfficialVietnamPaymentInformationPage(page: Page): Promise<boolean> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!isOfficialVietnamPaymentInformationPage(bodyText)) return false;

  const agreeCheckbox = page.locator('input[type="checkbox"]').first();
  if (await agreeCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await agreeCheckbox.check({ timeout: 5_000 }).catch(async () => {
      await agreeCheckbox.click({ timeout: 5_000, force: true });
    });
  } else {
    const agreeText = page.locator("text=/I agree to pay/i").first();
    if (await agreeText.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await agreeText.click({ timeout: 5_000, force: true });
    }
  }

  await page.waitForTimeout(500);
  const paymentButton = page.locator('button:has-text("Payment"), input[type="button"][value*="Payment" i], input[type="submit"][value*="Payment" i]').first();
  if (!(await paymentButton.isVisible({ timeout: 5_000 }).catch(() => false))) return false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await paymentButton.isEnabled({ timeout: 500 }).catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  if (!(await paymentButton.isEnabled({ timeout: 500 }).catch(() => false))) return false;
  await paymentButton.click({ timeout: 10_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);
  return true;
}

async function prepareVietcombankGatewayForCard(page: Page): Promise<void> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!/vietcombank|vnpay|select payment method|international payment cards/i.test(bodyText)) return;

  const internationalCard = page.locator('text="International payment cards"').first();
  if (await internationalCard.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await internationalCard.click({ timeout: 10_000 }).catch(async () => {
      await page.locator('input[name="payment-method"]').last().check({ timeout: 5_000 });
    });
    await page.waitForTimeout(750);
  }

  const terms = page.locator('input[name="checkbox-terms"], input[type="checkbox"]:visible').first();
  if (await terms.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await terms.check({ timeout: 5_000 }).catch(async () => {
      await terms.click({ timeout: 5_000, force: true });
    });
    await page.waitForTimeout(500);
  }
  const termsLabel = page.locator('text=/I have read/i').first();
  if (await termsLabel.isVisible({ timeout: 1_500 }).catch(() => false)) {
    const box = await termsLabel.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(Math.max(1, box.x - 20), box.y + box.height / 2);
    } else {
      await termsLabel.click({ timeout: 5_000, force: true });
    }
    await page.waitForTimeout(500);
  }

  const continueButton = page.locator('button:has-text("Continue")').first();
  if (await continueButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await continueButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await continueButton.isEnabled({ timeout: 500 }).catch(() => false)) break;
      await page.waitForTimeout(500);
    }
    if (!(await continueButton.isEnabled({ timeout: 500 }).catch(() => false))) return;
    await continueButton.click({ timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
  }
}

export async function payVietnamPortalWithFixedCard(input: {
  page: Page;
  card: VietnamFixedCard;
}): Promise<VietnamFixedCardPaymentResult> {
  const { page, card } = input;
  const redactedCard = redactVietnamFixedCard(card);
  let beforeText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (isOfficialVietnamPaymentInformationPage(beforeText)) {
    const advanced = await advanceOfficialVietnamPaymentInformationPage(page);
    if (!advanced) {
      return {
        status: "needs_human",
        receiptReference: null,
        reason: "Could not click I agree to pay / Payment on the official Vietnam payment information page.",
        redactedCard,
      };
    }
    beforeText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  }
  if (!isLikelyPaymentGateway(page.url(), beforeText)) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "The current official page is not a payment gateway, so the card was not entered.",
      redactedCard,
    };
  }
  if (vietnamPaymentNeedsHuman(beforeText)) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Payment page requires 3DS/OTP/bank authentication.",
      redactedCard,
    };
  }
  await prepareVietcombankGatewayForCard(page);
  const afterPreparationText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (/payment\s+failed.*recreate\s+profile|recreate\s+profile\s+and\s+retry\s+payment/i.test(afterPreparationText)) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "The official portal returned 'payment failed, please recreate profile and retry payment'. This official-site failure requires a new profile run with a fresh one-time card session.",
      redactedCard,
    };
  }

  const cardNumberFilled = await fillFirstVisible(page, [
    'input[autocomplete="cc-number"]',
    'input[placeholder*="card number" i]',
    'input[name*="card" i][name*="number" i]',
    'input[id*="card" i][id*="number" i]',
    'input[aria-label*="card" i][aria-label*="number" i]',
  ], card.pan);
  if (!cardNumberFilled) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Could not locate a supported card-number field on the payment page.",
      redactedCard,
    };
  }

  await fillFirstVisible(page, [
    'input[autocomplete="cc-name"]',
    'input[placeholder*="full name" i]',
    'input[name*="name" i]',
    'input[id*="name" i]',
  ], card.holderName);
  await fillFirstVisible(page, [
    'input[autocomplete="cc-exp"]',
    'input[placeholder*="expiry" i]',
    'input[placeholder*="expired" i]',
    'input[name*="expiry" i]',
    'input[name*="expired" i]',
    'input[id*="expiry" i]',
    'input[id*="expired" i]',
  ], `${card.expiryMonth}/${card.expiryYear.slice(-2)}`);
  await fillFirstVisible(page, [
    'input[name*="exp_month" i]',
    'input[id*="exp_month" i]',
    'input[name*="month" i][name*="exp" i]',
  ], card.expiryMonth);
  await fillFirstVisible(page, [
    'input[name*="exp_year" i]',
    'input[id*="exp_year" i]',
    'input[name*="year" i][name*="exp" i]',
  ], card.expiryYear);
  await fillFirstVisible(page, [
    'input[autocomplete="cc-csc"]',
    'input[placeholder*="cvc" i]',
    'input[placeholder*="cvv" i]',
    'input[name*="cvv" i]',
    'input[id*="cvv" i]',
    'input[name*="cvc" i]',
    'input[id*="cvc" i]',
  ], card.cvv);
  await fillFirstVisible(page, [
    'input[autocomplete="email"]',
    'input[placeholder*="email" i]',
    'input[name*="email" i]',
    'input[id*="email" i]',
  ], process.env.VN_FIXED_CARD_EMAIL ?? "e1484122@u.nus.edu");
  await fillFirstVisible(page, [
    'input[placeholder*="province" i]',
    'input[name*="province" i]',
    'input[id*="province" i]',
  ], process.env.VN_FIXED_CARD_PROVINCE ?? "Singapore");
  await fillFirstVisible(page, [
    'textarea[placeholder*="address" i]',
    'input[placeholder*="address" i]',
    'textarea[name*="address" i]',
    'input[name*="address" i]',
    'textarea[id*="address" i]',
    'input[id*="address" i]',
  ], process.env.VN_FIXED_CARD_ADDRESS ?? "Singapore");

  const submitted = await clickFirstVisible(page, [
    'button:has-text("Pay")',
    'button:has-text("Pay now")',
    'button:has-text("Submit Payment")',
    'button:has-text("Thanh toán")',
    'input[type="submit"][value*="Pay" i]',
  ]);
  if (!submitted) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Could not locate a supported payment submit button.",
      redactedCard,
    };
  }

  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
  const afterText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (vietnamPaymentNeedsHuman(afterText)) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Payment gateway requested 3DS/OTP/bank authentication after card submit.",
      redactedCard,
    };
  }
  if (/declined|insufficient funds|payment failed|transaction failed|card invalid/i.test(afterText)) {
    return {
      status: "declined",
      receiptReference: null,
      reason: "Payment gateway returned a decline/failure message.",
      redactedCard,
    };
  }

  const receiptReference = extractVietnamPaymentReceiptReference(afterText);
  if (!receiptReference) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Payment may have submitted, but no receipt/reference was visible.",
      redactedCard,
    };
  }

  return {
    status: "paid",
    receiptReference,
    redactedCard,
  };
}
