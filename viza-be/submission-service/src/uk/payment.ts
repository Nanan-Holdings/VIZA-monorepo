import type { Frame, Page } from "@playwright/test";

/**
 * UK Standard Visitor official-fee payment through a VIZA-managed, one-use
 * card. Card material is supplied lazily by the caller after the UKVI payment
 * page is visible and is never read from the applicant vault.
 */

export interface UkManagedPaymentCard {
  /** Full PAN. Sensitive: keep in memory only. */
  pan: string;
  /** MM/YY or MM/YYYY. Sensitive: keep in memory only. */
  expiry: string;
  /** Sensitive: keep in memory only. */
  cvv: string;
  holderName: string;
}

export interface PayUkInput {
  page: Page;
  card: UkManagedPaymentCard;
  /** Expected official fee in major units (for example 135.00 GBP). */
  expectedAmount: number;
  expectedCurrency: string;
  timeoutMs?: number;
}

export type PayUkResult =
  | {
      status: "paid";
      portalReceiptId: string;
      finalUrl: string;
    }
  | {
      status: "declined" | "review_required";
      portalReceiptId: null;
      finalUrl: string;
      reason: string;
    };

const PAYMENT_HOST_SUFFIXES = [
  "visas-immigration.service.gov.uk",
  "apply-uk-visa.service.gov.uk",
  "worldpay.com",
] as const;

const RECEIPT_PATTERNS = [
  /\b(GWF[A-Z0-9]{8,})\b/i,
  /(?:payment|transaction|worldpay|receipt)\s*(?:reference|number|id)?[^A-Z0-9]{0,12}([A-Z0-9-]{6,})/i,
] as const;

const DECLINE_PATTERN = /declined|insufficient funds|payment failed|unable to process|not authorised/i;
const CHALLENGE_PATTERN = /3\s*d\s*secure|verification code|one[- ]time pass(?:word|code)|approve (?:this )?(?:payment|purchase)|authentication required/i;
const SUCCESS_PATTERN = /payment (?:has been )?(?:successful|received|complete)|application (?:has been )?submitted|what happens next|book (?:your )?(?:biometric|appointment)/i;
const CURRENCY_TOKEN_PATTERN = /\b(?:GBP|USD|EUR)\b|[£$€]/gi;

export type UkPaymentAmountCheck =
  | { ok: true; amount: number; currency: string }
  | { ok: false; reason: string };

type CardField = "pan" | "holder" | "expiry" | "expiryMonth" | "expiryYear" | "cvv";

const FIELD_SELECTORS: Record<CardField, readonly string[]> = {
  pan: [
    'input[autocomplete="cc-number"]',
    'input[name="card_number"]',
    'input[name="cardNumber"]',
    'input[name*="cardnumber" i]',
    'input[id*="cardnumber" i]',
  ],
  holder: [
    'input[autocomplete="cc-name"]',
    'input[name="cardholderName"]',
    'input[name*="cardholder" i]',
    'input[id*="cardholder" i]',
  ],
  expiry: [
    'input[autocomplete="cc-exp"]',
    'input[name="expiry"]',
    'input[name*="expiry" i]',
    'input[id*="expiry" i]',
  ],
  expiryMonth: [
    'select[autocomplete="cc-exp-month"]',
    'select[name="exp_month"]',
    'select[name*="month" i]',
    'input[name="exp_month"]',
  ],
  expiryYear: [
    'select[autocomplete="cc-exp-year"]',
    'select[name="exp_year"]',
    'select[name*="year" i]',
    'input[name="exp_year"]',
  ],
  cvv: [
    'input[autocomplete="cc-csc"]',
    'input[name="cvc"]',
    'input[name="cvv"]',
    'input[name*="security" i]',
    'input[id*="security" i]',
  ],
};

function isAllowedPaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return PAYMENT_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

function paymentFrames(page: Page): Frame[] {
  return page.frames().filter((frame) => isAllowedPaymentUrl(frame.url()));
}

function currencyForToken(token: string): string | null {
  const normalized = token.trim().toUpperCase();
  if (normalized === "£" || normalized === "GBP") return "GBP";
  if (normalized === "$" || normalized === "USD") return "USD";
  if (normalized === "€" || normalized === "EUR") return "EUR";
  return null;
}

function parseMajorAmount(value: string): number | null {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

/** Pure guard used before card issuance and again before PAN entry. */
export function verifyUkPaymentAmount(input: {
  bodyText: string;
  expectedAmount: number;
  expectedCurrency: string;
}): UkPaymentAmountCheck {
  const expectedAmount = Math.round(input.expectedAmount * 100) / 100;
  const expectedCurrency = input.expectedCurrency.trim().toUpperCase();
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || !expectedCurrency) {
    return { ok: false, reason: "The expected UK official-fee amount or currency is invalid" };
  }

  const candidates: Array<{ amount: number; currency: string }> = [];
  const patterns = [
    /\b(GBP|USD|EUR)\b\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
    /([£$€])\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,
    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*\b(GBP|USD|EUR)\b/gi,
  ] as const;
  for (const [index, pattern] of patterns.entries()) {
    for (const match of input.bodyText.matchAll(pattern)) {
      const amountText = index === 2 ? match[1] : match[2];
      const currencyText = index === 2 ? match[2] : match[1];
      const amount = parseMajorAmount(amountText);
      const currency = currencyForToken(currencyText);
      if (amount !== null && currency) candidates.push({ amount, currency });
    }
  }

  if (candidates.some((candidate) =>
    candidate.currency === expectedCurrency && candidate.amount === expectedAmount
  )) {
    return { ok: true, amount: expectedAmount, currency: expectedCurrency };
  }

  const visibleCurrencies = new Set(
    Array.from(input.bodyText.matchAll(CURRENCY_TOKEN_PATTERN))
      .map((match) => currencyForToken(match[0]))
      .filter((value): value is string => Boolean(value)),
  );
  if (visibleCurrencies.size > 0 && !visibleCurrencies.has(expectedCurrency)) {
    return {
      ok: false,
      reason: `The UK payment page currency did not match the allocated ${expectedCurrency} fee`,
    };
  }
  return {
    ok: false,
    reason: `The UK payment page did not prove the allocated ${expectedCurrency} ${expectedAmount.toFixed(2)} fee`,
  };
}

async function readPaymentText(page: Page): Promise<string> {
  const texts = await Promise.all(
    paymentFrames(page).map((frame) =>
      frame.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
    ),
  );
  return texts.join("\n").slice(0, 24_000);
}

export async function verifyUkPaymentPageAmount(input: {
  page: Page;
  expectedAmount: number;
  expectedCurrency: string;
}): Promise<UkPaymentAmountCheck> {
  if (paymentFrames(input.page).length === 0) {
    return {
      ok: false,
      reason: "UK payment page did not use an allowlisted UKVI/Worldpay origin",
    };
  }
  return verifyUkPaymentAmount({
    bodyText: await readPaymentText(input.page),
    expectedAmount: input.expectedAmount,
    expectedCurrency: input.expectedCurrency,
  });
}

async function fillFirst(
  frames: readonly Frame[],
  selectors: readonly string[],
  value: string,
): Promise<boolean> {
  for (const frame of frames) {
    for (const selector of selectors) {
      const locator = frame.locator(selector).first();
      if ((await locator.count().catch(() => 0)) === 0) continue;
      if (!(await locator.isVisible().catch(() => false))) continue;
      const tag = await locator.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
      if (tag === "select") {
        const selected = await locator.selectOption(value).then(() => true).catch(() => false);
        if (selected) return true;
        const selectedByLabel = await locator.selectOption({ label: value }).then(() => true).catch(() => false);
        if (selectedByLabel) return true;
      } else {
        const filled = await locator.fill(value).then(() => true).catch(() => false);
        if (filled) return true;
      }
    }
  }
  return false;
}

function splitExpiry(expiry: string): { month: string; year: string; shortYear: string } | null {
  const match = /^(0?[1-9]|1[0-2])\s*[/-]\s*(\d{2}|\d{4})$/.exec(expiry.trim());
  if (!match) return null;
  const month = match[1].padStart(2, "0");
  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return { month, year, shortYear: year.slice(-2) };
}

async function fillManagedCard(page: Page, card: UkManagedPaymentCard): Promise<string | null> {
  const frames = paymentFrames(page);
  if (frames.length === 0) return "UK payment page did not use an allowlisted UKVI/Worldpay origin";
  const expiry = splitExpiry(card.expiry);
  if (!expiry) return "PhotonPay returned an unsupported expiry format";

  const panFilled = await fillFirst(frames, FIELD_SELECTORS.pan, card.pan);
  const cvvFilled = await fillFirst(frames, FIELD_SELECTORS.cvv, card.cvv);
  await fillFirst(frames, FIELD_SELECTORS.holder, card.holderName);
  const combinedExpiryFilled = await fillFirst(
    frames,
    FIELD_SELECTORS.expiry,
    `${expiry.month}/${expiry.shortYear}`,
  );
  const monthFilled = combinedExpiryFilled
    ? true
    : await fillFirst(frames, FIELD_SELECTORS.expiryMonth, expiry.month);
  const yearFilled = combinedExpiryFilled
    ? true
    : (await fillFirst(frames, FIELD_SELECTORS.expiryYear, expiry.year)) ||
      (await fillFirst(frames, FIELD_SELECTORS.expiryYear, expiry.shortYear));

  if (!panFilled || !cvvFilled || !monthFilled || !yearFilled) {
    return "UK payment controls were not fully mapped on the allowlisted payment page";
  }
  return null;
}

async function clickPaymentSubmit(page: Page): Promise<boolean> {
  const frames = paymentFrames(page);
  const selectors = [
    'button:has-text("Pay")',
    'button:has-text("Make payment")',
    'button:has-text("Confirm payment")',
    'input[type="submit"][value*="Pay" i]',
    'button[type="submit"]',
  ];
  for (const frame of frames) {
    for (const selector of selectors) {
      const button = frame.locator(selector).first();
      if ((await button.count().catch(() => 0)) === 0) continue;
      if (!(await button.isVisible().catch(() => false))) continue;
      const clicked = await button.click({ timeout: 10_000 }).then(() => true).catch(() => false);
      if (clicked) return true;
    }
  }
  return false;
}

function extractReceipt(body: string): string | null {
  for (const pattern of RECEIPT_PATTERNS) {
    const match = pattern.exec(body);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function classifyUkPaymentPage(input: {
  bodyText: string;
  finalUrl: string;
}): PayUkResult {
  const body = input.bodyText.slice(0, 12_000);
  if (DECLINE_PATTERN.test(body)) {
    return {
      status: "declined",
      portalReceiptId: null,
      finalUrl: input.finalUrl,
      reason: "The UK payment provider declined the VIZA-managed card",
    };
  }
  if (CHALLENGE_PATTERN.test(body)) {
    return {
      status: "review_required",
      portalReceiptId: null,
      finalUrl: input.finalUrl,
      reason: "The UK payment provider requires a 3DS or bank authentication review",
    };
  }
  const receipt = extractReceipt(body);
  if (receipt && SUCCESS_PATTERN.test(body)) {
    return { status: "paid", portalReceiptId: receipt, finalUrl: input.finalUrl };
  }
  return {
    status: "review_required",
    portalReceiptId: null,
    finalUrl: input.finalUrl,
    reason: "The UK payment result was not conclusive enough to record as paid",
  };
}

export async function payUkWithManagedCard(input: PayUkInput): Promise<PayUkResult> {
  const timeoutMs = input.timeoutMs ?? 90_000;
  const amountCheck = await verifyUkPaymentPageAmount(input);
  if (!amountCheck.ok) {
    return {
      status: "review_required",
      portalReceiptId: null,
      finalUrl: input.page.url(),
      reason: amountCheck.reason,
    };
  }
  const fillError = await fillManagedCard(input.page, input.card);
  if (fillError) {
    return {
      status: "review_required",
      portalReceiptId: null,
      finalUrl: input.page.url(),
      reason: fillError,
    };
  }
  if (!(await clickPaymentSubmit(input.page))) {
    return {
      status: "review_required",
      portalReceiptId: null,
      finalUrl: input.page.url(),
      reason: "UK payment submit control was not found",
    };
  }

  await Promise.race([
    input.page.waitForLoadState("domcontentloaded", { timeout: timeoutMs }),
    input.page.waitForTimeout(Math.min(timeoutMs, 15_000)),
  ]).catch(() => undefined);
  const bodyText = await input.page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  return classifyUkPaymentPage({ bodyText, finalUrl: input.page.url() });
}

export const __INTERNALS = {
  extractReceipt,
  isAllowedPaymentUrl,
  splitExpiry,
};
