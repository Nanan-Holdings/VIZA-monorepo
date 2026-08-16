import type { Frame, Locator, Page } from "@playwright/test";

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

export type VietnamOfficialFeeVerification =
  | { verified: true; amountCents: number; currency: string }
  | { verified: false; reason: "expectation_missing" | "amount_missing" | "amount_mismatch" };

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
  /\b(payment gateway|payment amount|card number|cvv|cvc|expiry|expiration|pay now|submit payment)\b/i;
const PAYMENT_ROUTE_PATTERN = /\/(?:payment|pay|checkout|gateway)(?:\/|$|\?)/i;
const STANDARD_CHARTERED_BANK_APP_PATTERN =
  /(?:sc mobile banking app|sc mobile app).*(?:approve this transaction|authenticate payment)|click here to complete your purchase/i;
const BANK_APP_CHALLENGE_FAILURE_PATTERN =
  /(?:authentication|transaction|payment).{0,30}(?:expired|timed out|failed|declined|cancelled)|(?:expired|timed out|failed|declined|cancelled).{0,30}(?:authentication|transaction|payment)/i;
const DEFAULT_BANK_APP_WAIT_MS = 115_000;
const MIN_BANK_APP_WAIT_MS = 10_000;
const MAX_BANK_APP_WAIT_MS = 180_000;
const DEFAULT_BANK_APP_APPEARANCE_WAIT_MS = 45_000;

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
  if (
    env.NODE_ENV === "production" ||
    !envEnabled(env.VN_LOCAL_CARD_SESSION_ENABLED) ||
    !envEnabled(env.VN_FIXED_CARD_ENABLED) ||
    !envEnabled(env.VN_OFFICIAL_PAYMENT_AUTOPAY)
  ) {
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

function parseDisplayedAmount(token: string, currency: string): number | null {
  let normalized = token.replace(/\s/g, "");
  if (!normalized) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const separator = Math.max(lastComma, lastDot);
  if (separator >= 0) {
    const decimals = normalized.length - separator - 1;
    if (decimals === 2 && currency !== "IDR") {
      normalized = `${normalized.slice(0, separator).replace(/[.,]/g, "")}.${normalized.slice(separator + 1)}`;
    } else {
      normalized = normalized.replace(/[.,]/g, "");
    }
  }
  const major = Number(normalized);
  return Number.isFinite(major) ? Math.round(major * 100) : null;
}

/** Fail closed unless the official page visibly contains the allocated amount and currency. */
export function verifyVietnamOfficialFeeText(input: {
  bodyText: string;
  expectedAmountCents?: number | null;
  expectedCurrency?: string | null;
}): VietnamOfficialFeeVerification {
  const expectedAmountCents = input.expectedAmountCents;
  const currency = input.expectedCurrency?.trim().toUpperCase();
  if (!Number.isSafeInteger(expectedAmountCents) || !expectedAmountCents || !currency) {
    return { verified: false, reason: "expectation_missing" };
  }
  const escaped = currency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const amountToken = "([0-9][0-9.,\\s]*)";
  const patterns = [
    new RegExp(`(?:${escaped}|US\\$|USD\\s*\\$)\\s*${amountToken}`, "gi"),
    new RegExp(`${amountToken}\\s*(?:${escaped}|US\\$)`, "gi"),
    new RegExp(`amount(?:\\s+paid)?\\s*\\(\\s*${escaped}\\s*\\)\\s*[:=-]?\\s*${amountToken}`, "gi"),
  ];
  let sawAmount = false;
  for (const pattern of patterns) {
    for (const match of input.bodyText.matchAll(pattern)) {
      const token = match[1];
      if (!token) continue;
      const amountCents = parseDisplayedAmount(token, currency);
      if (amountCents === null) continue;
      sawAmount = true;
      if (amountCents === expectedAmountCents) {
        return { verified: true, amountCents, currency };
      }
    }
  }
  return { verified: false, reason: sawAmount ? "amount_mismatch" : "amount_missing" };
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

export function isStandardCharteredBankAppChallenge(text: string): boolean {
  return STANDARD_CHARTERED_BANK_APP_PATTERN.test(text);
}

export function getVietnamBankAppWaitMs(env: EnvLike = process.env): number {
  const configured = Number(env.VN_BANK_APP_3DS_WAIT_MS ?? DEFAULT_BANK_APP_WAIT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_BANK_APP_WAIT_MS;
  return Math.max(MIN_BANK_APP_WAIT_MS, Math.min(MAX_BANK_APP_WAIT_MS, Math.round(configured)));
}

export function hasVietnamPaymentPageEvidence(pageUrl: string, bodyText: string): boolean {
  if (OFFICIAL_APPLICATION_FORM_PATTERN.test(bodyText) && /\/e-visa\/foreigners\//i.test(pageUrl)) {
    return false;
  }
  return (
    isOfficialVietnamPaymentInformationPage(bodyText) ||
    PAYMENT_CONTEXT_PATTERN.test(bodyText) ||
    /\/thanh-toan-cqtc(?:\/|$|\?)/i.test(pageUrl) ||
    PAYMENT_ROUTE_PATTERN.test(pageUrl)
  );
}

function isOfficialVietnamPaymentInformationPage(bodyText: string): boolean {
  return (
    /payment[’']?s information/i.test(bodyText) &&
    /e-visa app no\.?|amount paid\s*\(usd\)|i agree to pay/i.test(bodyText)
  );
}

export type VietnamCardBrand = "visa" | "mastercard" | "jcb" | "amex";

export interface VietnamCardEntryResult {
  status: "ready" | "not_ready";
  reason?: string;
}

function detectVietnamCardBrand(card: VietnamFixedCard): VietnamCardBrand {
  if (/^4/.test(card.pan)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(card.pan)) return "mastercard";
  if (/^35/.test(card.pan)) return "jcb";
  if (/^3[47]/.test(card.pan)) return "amex";
  return "visa";
}

async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    try {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible({ timeout: 500 }).catch(() => false)) {
          await candidate.fill(value, { timeout: 5_000 });
          return true;
        }
      }
    } catch {
      // Try the next selector; payment gateways vary by provider.
    }
  }
  return false;
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    try {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible({ timeout: 500 }).catch(() => false)) {
          await candidate.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => undefined);
          if (!(await candidate.isEnabled({ timeout: 500 }).catch(() => true))) continue;
          await candidate.click({ timeout: 5_000 });
          return true;
        }
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

async function selectVietcombankCardBrand(page: Page, brand: VietnamCardBrand): Promise<boolean> {
  const brandCode: Record<VietnamCardBrand, string> = {
    visa: "VISA",
    mastercard: "MASTERCARD",
    jcb: "JCB",
    amex: "AMEX",
  };
  const selectedByBankCode = await page
    .evaluate((code) => {
      const triggerMouseClick = (element: HTMLElement): void => {
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      };
      const accordion = document.querySelector<HTMLElement>("#accordionList3");
      if (accordion) {
        accordion.classList.add("show");
        accordion.style.display = "";
      }

      const item = document.querySelector<HTMLElement>(`.list-bank-item[bank-code="${code}"]`);
      if (!item) return false;
      item.scrollIntoView({ block: "center", inline: "center" });
      triggerMouseClick(item);
      return item.classList.contains("active");
    }, brandCode[brand])
    .catch(() => false);
  if (selectedByBankCode) return true;

  const brandIndex: Record<VietnamCardBrand, number> = {
    visa: 0,
    mastercard: 1,
    jcb: 2,
    amex: 3,
  };

  const groupItems = page.locator(".group-col-item");
  const groupCount = await groupItems.count().catch(() => 0);
  const largeBrandItems: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];
  for (let index = 0; index < groupCount; index += 1) {
    const item = groupItems.nth(index);
    const box = await item.boundingBox().catch(() => null);
    if (!box) continue;
    if (box.width >= 100 && box.width <= 260 && box.height >= 45 && box.height <= 130) {
      largeBrandItems.push({ index, x: box.x, y: box.y, width: box.width, height: box.height });
    }
  }
  largeBrandItems.sort((left, right) => {
    const rowDelta = left.y - right.y;
    if (Math.abs(rowDelta) > 20) return rowDelta;
    return left.x - right.x;
  });
  if (largeBrandItems.length >= 4) {
    const target = largeBrandItems[brandIndex[brand]];
    if (target) {
      await groupItems.nth(target.index).click({
        timeout: 5_000,
        force: true,
        position: { x: target.width / 2, y: target.height / 2 },
      });
      return true;
    }
  }

  const targetPoint = await page
    .evaluate(
      ({ targetIndex }) => {
        const isVisible = (element: Element): boolean => {
          const htmlElement = element as HTMLElement;
          const rect = htmlElement.getBoundingClientRect();
          const style = window.getComputedStyle(htmlElement);
          return (
            rect.width > 20 &&
            rect.height > 20 &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            style.pointerEvents !== "none"
          );
        };
        const signature = (element: Element): string => {
          const htmlElement = element as HTMLElement;
          const imageText = Array.from(element.querySelectorAll("img"))
            .map((image) => `${image.alt ?? ""} ${image.title ?? ""} ${image.getAttribute("src") ?? ""}`)
            .join(" ");
          return [
            htmlElement.innerText,
            htmlElement.getAttribute("aria-label"),
            htmlElement.getAttribute("title"),
            htmlElement.getAttribute("class"),
            htmlElement.getAttribute("id"),
            imageText,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        };
        const centerPoint = (element: Element): { x: number; y: number } => {
          const clickable =
            element.closest(
              '.group-col-item, [class*="group-col" i], button, label, [role="button"], a, [class*="card" i], [class*="method" i], [class*="payment" i]',
            ) ??
            element;
          const htmlElement = clickable as HTMLElement;
          htmlElement.scrollIntoView({ block: "center", inline: "center" });
          const rect = htmlElement.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        };

        const broadCandidates = Array.from(
          document.querySelectorAll(
            'button, [role="button"], label, input, img, a, .group-col-item, [class*="group-col" i], [class*="card" i], [class*="method" i], [class*="payment" i]',
          ),
        ).filter(isVisible);

        const headings = Array.from(document.querySelectorAll("body *")).filter((element) =>
          /international payment cards/i.test((element as HTMLElement).innerText ?? ""),
        );
        const heading = headings
          .filter(isVisible)
          .sort((left, right) => {
            const leftRect = (left as HTMLElement).getBoundingClientRect();
            const rightRect = (right as HTMLElement).getBoundingClientRect();
            return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
          })[0];
        if (!heading) return false;

        const headingRect = (heading as HTMLElement).getBoundingClientRect();
        const sectionCandidates = broadCandidates
          .map((element) => ({ element, rect: (element as HTMLElement).getBoundingClientRect(), text: signature(element) }))
          .filter(({ rect, text }) => {
            if (rect.top <= headingRect.top + 20) return false;
            if (rect.top - headingRect.top > 420) return false;
            if (/international payment cards|continue|terms|condition|invoice/.test(text)) return false;
            return rect.width >= 40 && rect.height >= 30;
          })
          .sort((left, right) => {
            const rowDelta = left.rect.top - right.rect.top;
            if (Math.abs(rowDelta) > 20) return rowDelta;
            return left.rect.left - right.rect.left;
          });

        const brandBoxes = sectionCandidates
          .filter(({ rect }) => rect.width >= 120 && rect.height >= 55)
          .filter(({ text }) => !/supported payment apps|domestic payment cards|international payment cards/i.test(text));
        if (brandBoxes.length >= 4) {
          const fallback = brandBoxes[targetIndex];
          if (fallback) return centerPoint(fallback.element);
        }

        return false;
      },
      { targetIndex: brandIndex[brand] },
    )
    .catch(() => false);

  if (!targetPoint || targetPoint === true) return false;
  await page.mouse.click(targetPoint.x, targetPoint.y);
  return true;
}

async function clickTrustedVietcombankCardBrand(page: Page, brand: VietnamCardBrand): Promise<boolean> {
  const brandCode: Record<VietnamCardBrand, string> = {
    visa: "VISA",
    mastercard: "MASTERCARD",
    jcb: "JCB",
    amex: "AMEX",
  };
  const exactItems = page.locator(`.list-bank-item[bank-code="${brandCode[brand]}"]`);
  const exactCount = await exactItems.count().catch(() => 0);
  for (let index = exactCount - 1; index >= 0; index -= 1) {
    const item = exactItems.nth(index);
    if (!(await item.isVisible({ timeout: 500 }).catch(() => false))) continue;
    await item.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => undefined);
    const clicked = await item.click({ timeout: 5_000 }).then(() => true).catch(async () => {
      const box = await item.boundingBox().catch(() => null);
      if (!box) return false;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      return true;
    });
    if (!clicked) continue;
    const deadline = Date.now() + 2_500;
    while (Date.now() < deadline) {
      const className = await item.getAttribute("class").catch(() => "");
      const selected = await item.getAttribute("aria-selected").catch(() => null);
      const checked = await item.getAttribute("aria-checked").catch(() => null);
      if (/\bactive\b/i.test(className ?? "") || selected === "true" || checked === "true") {
        return true;
      }
      await page.waitForTimeout(100);
    }
    console.warn(`[vn-payment] VNPAY ${brandCode[brand]} item click did not commit active state.`);
  }

  const brandPattern: Record<VietnamCardBrand, RegExp> = {
    visa: /\bvisa\b/i,
    mastercard: /master\s*card/i,
    jcb: /\bjcb\b/i,
    amex: /american\s*express|\bamex\b/i,
  };
  const candidates = page.locator("img[alt], img[title], img[src], [aria-label], [title]");
  const count = Math.min(await candidates.count().catch(() => 0), 120);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (!(await candidate.isVisible({ timeout: 250 }).catch(() => false))) continue;
    const signature = await candidate
      .evaluate((element) => [
        element.getAttribute("alt"),
        element.getAttribute("title"),
        element.getAttribute("aria-label"),
        element.getAttribute("src"),
        element.textContent,
      ].filter(Boolean).join(" "))
      .catch(() => "");
    if (!brandPattern[brand].test(signature)) continue;
    const clickable = candidate.locator(
      "xpath=ancestor-or-self::*[self::button or self::label or @role='button' or " +
      "contains(concat(' ', normalize-space(@class), ' '), ' group-col-item ') or " +
      "contains(concat(' ', normalize-space(@class), ' '), ' list-bank-item ')][1]",
    );
    const target = (await clickable.count().catch(() => 0)) > 0 ? clickable : candidate;
    const box = await target.boundingBox().catch(() => null);
    if (!box || box.width < 20 || box.height < 20) continue;
    await target.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => undefined);
    if (await target.click({ timeout: 5_000 }).then(() => true).catch(() => false)) {
      await page.waitForTimeout(500);
      // Generic logos are retained only for older gateway layouts. When the
      // current bank-code nodes exist, require the official active state rather
      // than treating a visually successful click as a committed selection.
      if (exactCount === 0) return true;
      for (let exactIndex = 0; exactIndex < exactCount; exactIndex += 1) {
        const exactItem = exactItems.nth(exactIndex);
        if (!(await exactItem.isVisible({ timeout: 250 }).catch(() => false))) continue;
        const className = await exactItem.getAttribute("class").catch(() => "");
        const selected = await exactItem.getAttribute("aria-selected").catch(() => null);
        const checked = await exactItem.getAttribute("aria-checked").catch(() => null);
        if (/\bactive\b/i.test(className ?? "") || selected === "true" || checked === "true") return true;
      }
      return false;
    }
  }
  return false;
}

async function expandVietcombankInternationalCards(page: Page): Promise<boolean> {
  const targetPoint = await page
    .evaluate(() => {
      const visible = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 20 && rect.height > 20;
      };
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(".ubox, .group-col, .group-col-item, label, div, button"))
        .filter(visible)
        .filter((element) => /international payment cards/i.test(element.innerText || element.textContent || ""))
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
        });
      const target = candidates[0];
      if (!target) return false;
      target.scrollIntoView({ block: "center", inline: "center" });
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })
    .catch(() => false);
  if (!targetPoint || targetPoint === true) return false;
  await page.mouse.click(targetPoint.x, targetPoint.y);
  return true;
}

const VIETCOMBANK_SERVICE_REGULATIONS_HEADING =
  /service regulations|quy định dịch vụ|服务规定|サービス規約/i;
const VIETCOMBANK_SERVICE_REGULATIONS_ACTION = /^(?:Agree|Đồng ý|同意|同意する)$/i;

async function findLiveVietcombankServiceDialog(
  page: Page,
): Promise<{ frame: Frame; dialog: Locator } | null> {
  for (const frame of page.frames()) {
    const roots = frame
      .locator(".modal.v-modal, .modal, .regulations, [role='dialog']")
      .filter({ visible: true });
    const rootCount = Math.min(await roots.count().catch(() => 0), 20);
    for (let index = rootCount - 1; index >= 0; index -= 1) {
      const dialog = roots.nth(index);
      const [hasHeading, hasAction] = await Promise.all([
        dialog
          .getByText(VIETCOMBANK_SERVICE_REGULATIONS_HEADING)
          .filter({ visible: true })
          .first()
          .isVisible({ timeout: 100 })
          .catch(() => false),
        dialog
          .getByText(VIETCOMBANK_SERVICE_REGULATIONS_ACTION)
          .filter({ visible: true })
          .last()
          .isVisible({ timeout: 100 })
          .catch(() => false),
      ]);
      if (hasHeading || hasAction) return { frame, dialog };
    }
  }
  return null;
}

async function acceptVietcombankServiceRegulations(page: Page, waitMs = 15_000): Promise<boolean> {
  const actionPattern = VIETCOMBANK_SERVICE_REGULATIONS_ACTION;

  let resolvedDialog = await findLiveVietcombankServiceDialog(page);
  const appearanceDeadline = Date.now() + Math.max(0, waitMs);
  while (!resolvedDialog && Date.now() < appearanceDeadline) {
    await page.waitForTimeout(Math.min(200, Math.max(0, appearanceDeadline - Date.now())));
    resolvedDialog = await findLiveVietcombankServiceDialog(page);
  }
  // The payment-method page itself contains a bold inline “Agree” inside the
  // terms sentence. It is not a dialog action. Falling back to global exact
  // text made the runner click that inert word for several seconds after the
  // real modal had closed, while the terms checkbox remained unchecked.
  if (!resolvedDialog) return false;

  // Prefer the live VNPAY modal root directly. Text locators can resolve to a
  // nested `<b>` (or, in some builds, a text-owning wrapper) whose XPath
  // ancestry is not a stable way to recover the Vue modal. Scoping all later
  // interaction to the visible root also prevents a hidden duplicate modal or
  // the page-level terms label from being mistaken for the live action.
  const serviceDialog = resolvedDialog.dialog;
  const hasAnchoredServiceDialog = true;

  const modalStillVisible = async (): Promise<boolean> => {
    if (hasAnchoredServiceDialog) {
      return serviceDialog.isVisible({ timeout: 250 }).catch(() => false);
    }
    return false;
  };
  if (!(await modalStillVisible())) return false;

  const scrollServiceDialogToEnd = async (
    dialog: ReturnType<Page["locator"]>,
  ): Promise<void> => {
    if (!(await dialog.isVisible({ timeout: 500 }).catch(() => false))) return;
    const scrollSummary = await dialog
      .evaluate((dialog) => {
        const elements = [dialog, ...Array.from(dialog.querySelectorAll<HTMLElement>("*"))] as HTMLElement[];
        let scrollable = 0;
        let scrolled = 0;
        for (const element of elements) {
          if (element.scrollHeight <= element.clientHeight + 1) continue;
          scrollable += 1;
          const before = element.scrollTop;
          element.scrollTop = element.scrollHeight;
          element.dispatchEvent(new Event("scroll", { bubbles: true }));
          if (element.scrollTop > before) scrolled += 1;
        }
        return { scrollable, scrolled };
      })
      .catch(() => ({ scrollable: 0, scrolled: 0 }));
    const dialogBox = await dialog.boundingBox().catch(() => null);
    if (dialogBox) {
      await page.mouse.move(dialogBox.x + dialogBox.width / 2, dialogBox.y + dialogBox.height / 2);
      await page.mouse.wheel(0, Math.max(800, dialogBox.height * 4)).catch(() => undefined);
    }
    await page.waitForTimeout(300);
    console.log(
      `[vn-payment] VNPAY regulations scrollable=${scrollSummary.scrollable} scrolled=${scrollSummary.scrolled}`,
    );
  };

  await scrollServiceDialogToEnd(serviceDialog);

  // VNPAY can keep a hidden duplicate modal mounted after the live dialog. A
  // `.last()` locator may therefore resolve to the hidden clone. Inspect exact
  // visible actions from the Playwright side (not inside `page.evaluate`, where
  // runtime helper injection can break serialization), prefer actions inside a
  // dialog, and require the live overlay to disappear after a trusted click.
  const scopedRawCandidates = serviceDialog.getByText(actionPattern).filter({ visible: true });
  const scopedRawCandidateCount = hasAnchoredServiceDialog
    ? await scopedRawCandidates.count().catch(() => 0)
    : 0;
  const rawCandidates = scopedRawCandidateCount > 0
    ? scopedRawCandidates
    : page.getByText(actionPattern).filter({ visible: true });
  const candidateCount = Math.min(await rawCandidates.count().catch(() => 0), 30);
  const candidates: Array<{
    target: ReturnType<Page["locator"]>;
    insideDialog: boolean;
    interactive: boolean;
    paddingClick: boolean;
  }> = [];
  for (let index = 0; index < candidateCount; index += 1) {
    const raw = rawCandidates.nth(index);
    if (!(await raw.isVisible({ timeout: 100 }).catch(() => false))) continue;
    const text = (await raw.innerText({ timeout: 250 }).catch(() => "")).replace(/\s+/g, " ").trim();
    if (!actionPattern.test(text)) continue;
    const clickable = raw.locator(
      "xpath=ancestor-or-self::*[self::button or self::a or @role='button' or @type='button' or @type='submit' or contains(concat(' ',normalize-space(@class),' '),' ubtn ')][1]",
    );
    const clickableCount = await clickable.count().catch(() => 0);
    const rawDialog = scopedRawCandidateCount > 0
      ? serviceDialog
      : raw.locator(
        "xpath=ancestor-or-self::*[@role='dialog' or (contains(concat(' ',normalize-space(@class),' '),' modal ') and contains(concat(' ',normalize-space(@class),' '),' v-modal '))][1]",
      );
    const rawInsideDialog = scopedRawCandidateCount > 0 || (await rawDialog.count().catch(() => 0)) > 0;
    if (rawInsideDialog) {
      await scrollServiceDialogToEnd(rawDialog);
      // Do not click a percentage of the modal root. The live `.modal.v-modal`
      // can be a full-viewport backdrop, so a lower-right coordinate may merely
      // dismiss the overlay (equivalent to Disagree) while looking like a
      // successful close. Only the exact Agree text's semantic control or a
      // compact ancestor is eligible below.
    }
    if (clickableCount > 0) {
      const insideDialog = rawInsideDialog || (await clickable.locator(
        "xpath=ancestor-or-self::*[@role='dialog' or (contains(concat(' ',normalize-space(@class),' '),' modal ') and contains(concat(' ',normalize-space(@class),' '),' v-modal '))][1]",
      ).count().catch(() => 0)) > 0;
      candidates.push({ target: clickable, insideDialog, interactive: true, paddingClick: false });
      continue;
    }

    // The live VNPAY modal can render `<b>Agree</b>` inside several custom Vue
    // wrappers without semantic button attributes. Its handler may use
    // `.self`, so clicking the text node is intentionally ignored. Try each
    // compact ancestor in order, stopping strictly before the modal root.
    if (rawInsideDialog) {
      const rawBox = await raw.boundingBox().catch(() => null);
      let ancestorCandidates = 0;
      for (let depth = 1; depth <= 5; depth += 1) {
        const ancestor = raw.locator(`xpath=ancestor::*[${depth}]`);
        if ((await ancestor.count().catch(() => 0)) === 0) break;
        const className = await ancestor.getAttribute("class").catch(() => "");
        if (/(?:^|\s)(?:modal|v-modal)(?:\s|$)/i.test(className ?? "")) break;
        const box = await ancestor.boundingBox().catch(() => null);
        if (
          rawBox && box &&
          box.height >= 20 && box.height <= 140 &&
          box.width >= rawBox.width + 8 && box.width <= 1_000
        ) {
          candidates.push({ target: ancestor, insideDialog: true, interactive: true, paddingClick: true });
          ancestorCandidates += 1;
        }
      }
      if (ancestorCandidates > 0) continue;
    }
    candidates.push({ target: raw, insideDialog: rawInsideDialog, interactive: false, paddingClick: false });
  }
  candidates.sort((left, right) =>
    Number(right.insideDialog) - Number(left.insideDialog) ||
    Number(right.interactive) - Number(left.interactive),
  );

  console.log(
    `[vn-payment] VNPAY regulations visibleActions=${candidateCount} ` +
    `dialogActions=${candidates.filter((candidate) => candidate.insideDialog).length}`,
  );

  for (const { target, paddingClick } of candidates) {
    const targetTag = await target.evaluate((element) => element.tagName.toLowerCase()).catch(() => "unknown");
    for (const strategy of ["locator", "mouse", "keyboard", "dispatch"] as const) {
      if (!(await target.isVisible({ timeout: 500 }).catch(() => false))) break;
      let interactionCompleted = false;
      if (strategy === "locator") {
        const box = await target.boundingBox().catch(() => null);
        const position = paddingClick && box
          ? { x: Math.min(12, Math.max(2, box.width / 4)), y: box.height / 2 }
          : undefined;
        interactionCompleted = await target.click({ timeout: 5_000, position }).then(() => true).catch(() => false);
      } else if (strategy === "mouse") {
        const box = await target.boundingBox().catch(() => null);
        if (box) {
          const localX = paddingClick ? Math.min(12, Math.max(2, box.width / 4)) : box.width / 2;
          await page.mouse.click(box.x + localX, box.y + box.height / 2);
          interactionCompleted = true;
        }
      } else if (strategy === "keyboard") {
        await target.focus({ timeout: 2_000 }).catch(() => undefined);
        interactionCompleted = await page.keyboard.press("Enter").then(() => true).catch(() => false);
      } else {
        interactionCompleted = await target.dispatchEvent("click").then(() => true).catch(() => false);
      }
      const closeDeadline = Date.now() + 2_000;
      while (Date.now() < closeDeadline) {
        if (!(await modalStillVisible())) {
          console.log(
            `[vn-payment] VNPAY regulations accepted target=${targetTag} strategy=${strategy}`,
          );
          return true;
        }
        await page.waitForTimeout(100);
      }
      console.log(
        `[vn-payment] VNPAY regulations action did not close modal ` +
        `target=${targetTag} strategy=${strategy} interactionCompleted=${interactionCompleted}`,
      );
    }
  }

  // A gateway skin may paint the exact Agree text in a pointer-transparent
  // overlay above the real footer button. If the scoped semantic candidates
  // did not close the dialog, inspect only the hit-test stack at that exact
  // text position and dispatch to a compact interactive control inside the
  // already-verified service dialog. This never clicks a percentage of the
  // full-screen modal/backdrop and cannot select the page-level terms copy.
  const exactAction = serviceDialog.getByText(actionPattern).filter({ visible: true }).last();
  const actionPoint = await exactAction
    .evaluate((element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })
    .catch(() => null);
  if (actionPoint) {
    const rootMarker = `viza-regulations-root-${Date.now().toString(36)}`;
    const targetMarker = `viza-regulations-target-${Date.now().toString(36)}`;
    await serviceDialog
      .evaluate((element, marker) => element.setAttribute("data-viza-regulations-root", marker), rootMarker)
      .catch(() => undefined);
    const targetMarked = await resolvedDialog.frame
      .evaluate(
        ({ x, y, rootMarker, targetMarker }) => {
          const root = document.querySelector<HTMLElement>(
            `[data-viza-regulations-root="${rootMarker}"]`,
          );
          if (!root) return false;
          const target = document.elementsFromPoint(x, y).find((element) => {
            if (!(element instanceof HTMLElement) || element === root || !root.contains(element)) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (
              style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none" ||
              rect.width < 20 || rect.height < 20 || rect.width > 1_000 || rect.height > 160
            ) return false;
            return element.matches(
              "button, a, [role='button'], [type='button'], [type='submit'], .ubtn",
            );
          });
          if (!target) return false;
          target.setAttribute("data-viza-regulations-target", targetMarker);
          return true;
        },
        {
          x: actionPoint.x,
          y: actionPoint.y,
          rootMarker,
          targetMarker,
        },
      )
      .catch(() => false);
    if (targetMarked) {
      const pointTarget = resolvedDialog.frame.locator(
        `[data-viza-regulations-target="${targetMarker}"]`,
      );
      await pointTarget.dispatchEvent("click").catch(() => undefined);
      const pointCloseDeadline = Date.now() + 3_000;
      while (Date.now() < pointCloseDeadline) {
        if (!(await modalStillVisible())) {
          console.log("[vn-payment] VNPAY regulations accepted target=point-stack strategy=dispatch");
          return true;
        }
        await page.waitForTimeout(100);
      }
    }
  }

  const dialogRoleAction = page
    .getByRole("button", { name: actionPattern })
    .filter({ visible: true })
    .last();
  if (await dialogRoleAction.isVisible({ timeout: 500 }).catch(() => false)) {
    await dialogRoleAction.click({ timeout: 5_000 }).catch(() => undefined);
    const roleCloseDeadline = Date.now() + 3_000;
    while (Date.now() < roleCloseDeadline) {
      if (!(await modalStillVisible())) {
        console.log(`[vn-payment] VNPAY regulations accepted target=button strategy=role`);
        return true;
      }
      await page.waitForTimeout(100);
    }
  }
  return false;
}

async function ensureVietcombankTermsAccepted(page: Page): Promise<boolean> {
  const terms = page.locator('input[name="checkbox-terms"]').last();
  const termsText = page
    .getByText(/I have read and Agree to the Terms and Conditions|Tôi đã đọc và đồng ý|我已阅读并同意|規約を読み同意/i)
    .filter({ visible: true })
    .first();
  const continueButton = page
    .locator('#continueBtn, button:has-text("Continue"), a:has-text("Continue")')
    .filter({ visible: true })
    .last();
  if ((await terms.count().catch(() => 0)) === 0) return false;

  const isReady = async (): Promise<boolean> => {
    const checked = await terms.isChecked().catch(() => false);
    const className = await continueButton.getAttribute("class").catch(() => "");
    const nativeDisabled = await continueButton.isDisabled().catch(() => true);
    return checked && !nativeDisabled && !/\bdisabled\b/i.test(className ?? "");
  };
  if (await isReady()) return true;

  const waitForTermsReady = async (timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await isReady()) return true;
      await page.waitForTimeout(100);
    }
    return isReady();
  };
  const isTermsCommittedWithoutDialog = async (): Promise<boolean> => {
    if (!(await terms.isChecked().catch(() => false))) return false;
    return !(await findLiveVietcombankServiceDialog(page));
  };
  const settleTermsAfterRegulations = async (): Promise<boolean> => {
    // The live gateway commits the modal's Agree action to its checkbox model
    // asynchronously. Re-checking immediately can open the same modal again
    // before that model update lands. Give the official handler a bounded
    // chance to settle, then use one trusted fallback and accept a reopened
    // modal once if necessary.
    // The production gateway briefly paints the input as checked immediately
    // after Agree, then can reset it once the modal model commit completes.
    // Do not treat that transient checkmark as readiness. Wait out the commit,
    // then replay one trusted off/on transition only if the CTA is still truly
    // disabled.
    await page.waitForTimeout(1_000);
    if (await waitForTermsReady(2_000)) return true;
    // Terms and the Continue button are separate gateway models. Once the
    // official dialog is closed and the checkbox remains checked after the
    // async commit window, report the terms step as complete even if the
    // payment method or bank-brand model still needs to be replayed by the
    // caller.
    if (await isTermsCommittedWithoutDialog()) return true;
    if (await terms.isChecked().catch(() => false)) {
      await terms.uncheck({ timeout: 5_000, force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
    }
    const surfaceClicked = await clickVisibleTermsSquare();
    if (!surfaceClicked) {
      await terms.check({ timeout: 5_000, force: true }).catch(() => undefined);
    }
    await page.waitForTimeout(500);
    const reopened = Boolean(await findLiveVietcombankServiceDialog(page));
    if (reopened && !(await acceptVietcombankServiceRegulations(page, 5_000))) return false;
    if (reopened) {
      await page.waitForTimeout(1_000);
      if (!(await terms.isChecked().catch(() => false))) {
        await terms.check({ timeout: 5_000, force: true }).catch(() => undefined);
      }
    }
    return waitForTermsReady(3_000);
  };

  const clickVisibleTermsSquare = async (): Promise<boolean> => {
    const inputBox = await terms.boundingBox().catch(() => null);
    if (inputBox && inputBox.width >= 8 && inputBox.height >= 8) {
      // Use a real pointer at the painted checkbox. VNPAY places a framework
      // surface over the native input; `check({ force: true })` can update the
      // DOM property without reaching that surface/model, while this hit-tested
      // click follows the same path as a user click.
      await page.mouse.click(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2);
      await page.waitForTimeout(400);
      return true;
    }
    const box = await termsText.boundingBox().catch(() => null);
    if (!box || box.width <= 0 || box.height <= 0) return false;
    // Depending on the gateway build, the text locator either resolves to the
    // text-only label (where any interior click toggles its associated input)
    // or to the whole terms row (whose checkbox sits at its left edge). The old
    // `left - 19px` assumption clicked outside the latter. Stay inside the
    // trusted visible surface in both layouts.
    await page.mouse.click(box.x + Math.min(12, Math.max(2, box.width / 4)), box.y + box.height / 2);
    await page.waitForTimeout(400);
    return true;
  };

  // A synthetic jQuery/property update can paint the checkmark while leaving
  // the gateway framework's model false. If that happened, toggle the native
  // control off and on through Playwright's trusted checkbox actions. `check`
  // targets the real input even when VNPAY paints a custom square above it and
  // dispatches the click/input/change sequence expected by the page model.
  if (await terms.isChecked().catch(() => false)) {
    await terms.uncheck({ timeout: 5_000, force: true }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  if (!(await terms.isChecked().catch(() => false))) {
    await terms.check({ timeout: 5_000, force: true }).catch(() => undefined);
  }
  if (await acceptVietcombankServiceRegulations(page)) {
    if (await settleTermsAfterRegulations()) return true;
  }

  const trustedDeadline = Date.now() + 2_000;
  while (Date.now() < trustedDeadline) {
    if (await isReady()) return true;
    await page.waitForTimeout(200);
  }

  // Some gateway builds attach the framework handler to the associated label
  // instead of the hidden input. Replay one bounded real label click from a
  // known unchecked state, then require both the native state and enabled CTA.
  // VNPAY currently renders the hidden checkbox next to a separate
  // `label[for=...]`; it is not necessarily nested by that label. Resolve the
  // browser's native associated label and let Playwright issue a trusted click
  // on the visible surface.
  const termsLabelMarker = `viza-terms-${Date.now().toString(36)}`;
  const associatedLabelMarked = await terms
    .evaluate((input, marker) => {
      const label = (input as HTMLInputElement).labels?.[0];
      if (!label) return false;
      label.setAttribute("data-viza-terms-label", marker);
      return true;
    }, termsLabelMarker)
    .catch(() => false);
  const associatedLabel = associatedLabelMarked
    ? page.locator(`[data-viza-terms-label="${termsLabelMarker}"]`).first()
    : terms.locator("xpath=ancestor::label[1]");
  if (await associatedLabel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    if (await terms.isChecked().catch(() => false)) {
      await terms.uncheck({ timeout: 5_000, force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
    await associatedLabel.click({ timeout: 5_000, force: true }).catch(() => undefined);
    if (await acceptVietcombankServiceRegulations(page, 15_000)) {
      if (await settleTermsAfterRegulations()) return true;
    }
  }

  if (!(await isReady()) && await clickVisibleTermsSquare()) {
    const modalAccepted = await acceptVietcombankServiceRegulations(page, 15_000);
    if (modalAccepted && await settleTermsAfterRegulations()) return true;
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await isReady()) return true;
    await page.waitForTimeout(250);
  }
  if (await isTermsCommittedWithoutDialog()) {
    await page.waitForTimeout(750);
    if (await isTermsCommittedWithoutDialog()) return true;
  }
  console.warn(
    `[vn-payment] VNPAY terms remained unready ` +
    `checked=${await terms.isChecked().catch(() => false)} ` +
    `termsInputs=${await page.locator('input[name="checkbox-terms"]').count().catch(() => 0)} ` +
    `associatedLabels=${await terms.evaluate((input) => (input as HTMLInputElement).labels?.length ?? 0).catch(() => 0)} ` +
    `exactAgreeVisible=${await page.getByText(/^(?:Agree|Đồng ý|同意|同意する)$/i).filter({ visible: true }).last().isVisible({ timeout: 250 }).catch(() => false)} ` +
    `continueClass=${(await continueButton.getAttribute("class").catch(() => "")) || "none"} ` +
    `continueDisabled=${await continueButton.isDisabled().catch(() => true)}`,
  );
  return false;
}

async function selectVietcombankInternationalCards(page: Page): Promise<boolean> {
  const label = page
    .locator('text="International payment cards"')
    .filter({ visible: true })
    .first();
  if (!(await label.isVisible({ timeout: 2_000 }).catch(() => false))) return false;

  const scopedRadio = label
    .locator("xpath=ancestor-or-self::*[self::label or @role='radio' or .//input[@type='radio']][1]")
    .locator('input[type="radio"]')
    .first();
  let radio = scopedRadio;
  if ((await radio.count().catch(() => 0)) === 0) {
    const allRadios = page.locator('input[type="radio"]');
    const radioCount = await allRadios.count().catch(() => 0);
    if (radioCount > 0) radio = allRadios.nth(radioCount - 1);
  }

  if ((await radio.count().catch(() => 0)) > 0) {
    const row = label.locator(
      "xpath=ancestor-or-self::*[self::label or @role='radio' or " +
      "contains(concat(' ', normalize-space(@class), ' '), ' payment-method ') or " +
      "contains(concat(' ', normalize-space(@class), ' '), ' group-col ')][1]",
    );
    const target = (await row.count().catch(() => 0)) > 0 ? row : label;
    // A previous synthetic selection can leave the radio painted as checked
    // while VNPAY's framework model is still empty. Force a genuine change by
    // selecting another method first, then click the international row with a
    // trusted pointer event.
    if (await radio.isChecked().catch(() => false)) {
      const allRadios = page.locator('input[type="radio"]');
      const radioCount = await allRadios.count().catch(() => 0);
      for (let index = 0; index < radioCount; index += 1) {
        const alternative = allRadios.nth(index);
        if (await alternative.isChecked().catch(() => false)) continue;
        const alternativeRow = alternative.locator("xpath=ancestor::label[1]");
        if (await alternativeRow.isVisible({ timeout: 500 }).catch(() => false)) {
          await alternativeRow.click({ timeout: 5_000 }).catch(() => undefined);
        } else {
          await alternative.check({ timeout: 5_000, force: true }).catch(() => undefined);
        }
        await page.waitForTimeout(250);
        break;
      }
    }
    if (await target.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await target.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      if (await radio.isChecked().catch(() => false)) return true;
    }
    await radio.check({ timeout: 5_000, force: true }).catch(async () => {
      await radio.evaluate((element) => {
        const input = element as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    });
    await page.waitForTimeout(500);
    if (await radio.isChecked().catch(() => false)) return true;
  }

  const row = label.locator(
    "xpath=ancestor-or-self::*[self::label or @role='radio' or " +
    "contains(concat(' ', normalize-space(@class), ' '), ' payment-method ') or " +
    "contains(concat(' ', normalize-space(@class), ' '), ' group-col ')][1]",
  );
  const target = (await row.count().catch(() => 0)) > 0 ? row : label;
  await target.click({ timeout: 5_000, force: true }).catch(() => undefined);
  await page.waitForTimeout(500);
  if ((await radio.count().catch(() => 0)) > 0) {
    return radio.isChecked().catch(() => false);
  }
  return target.getAttribute("aria-checked").then((value) => value === "true").catch(() => false);
}

export async function waitForVnpayPaymentSubmissionTransition(
  page: Page,
  initialUrl: string,
  timeoutMs = 20_000,
): Promise<boolean> {
  const deadline = Date.now() + Math.max(1_000, timeoutMs);
  while (Date.now() < deadline && !page.isClosed()) {
    const currentUrl = page.url();
    const allFrameText = await readAllPaymentFrameText(page);
    if (currentUrl !== initialUrl) return true;
    if (
      /\b(3d secure|3ds|otp|one[-\s]?time password|authentication|required|transaction failed|payment failed|declined|receipt|reference|successful|success)\b/i.test(
        allFrameText,
      ) ||
      isStandardCharteredBankAppChallenge(allFrameText)
    ) {
      return true;
    }

    const cardEntryVisible = await page
      .locator(
        'input[autocomplete="cc-number"], input[placeholder*="card number" i], input[name*="card" i][name*="number" i], input[id*="card" i][id*="number" i]',
      )
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    const confirmationVisible = await page
      .locator("#btnAgree")
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!cardEntryVisible && !confirmationVisible) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function submitVnpayInternationalCardForm(
  page: Page,
  timeoutMs: number,
): Promise<{ clicked: boolean; transitioned: boolean }> {
  const payButton = page.locator("#btnContinue, a.btnContinue").first();
  if (!(await payButton.isVisible({ timeout: 1_500 }).catch(() => false))) {
    return { clicked: false, transitioned: false };
  }

  const initialUrl = page.url();
  await payButton.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => undefined);
  await payButton.click({ timeout: 10_000, force: true });
  await page.waitForTimeout(1_000);

  const agreeButton = page.locator("#btnAgree").first();
  if (await agreeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await agreeButton.click({ timeout: 10_000, force: true });
  }
  return {
    clicked: true,
    transitioned: await waitForVnpayPaymentSubmissionTransition(page, initialUrl, timeoutMs),
  };
}

async function waitForVnpayPaymentSettlement(page: Page, timeoutMs = 300_000): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const loadingVisible = Array.from(document.querySelectorAll<HTMLElement>(".loading, .loading-wrap, .modal-backdrop"))
          .some((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
          });
        const bodyText = document.body?.innerText ?? "";
        const url = window.location.href;
        return (
          !loadingVisible ||
          !/\/MasterCard\/Transaction\/Index\.html/i.test(url) ||
          /\b(3d secure|3ds|otp|one[-\s]?time password|authentication|required|transaction failed|payment failed|declined|receipt|reference|successful|success)\b/i.test(bodyText)
        );
      },
      undefined,
      { timeout: timeoutMs, polling: 1_000 },
    )
    .catch(() => undefined);
}

async function readAllPaymentFrameText(page: Page): Promise<string> {
  const chunks: string[] = [];
  for (const frame of page.frames()) {
    const text = await frame.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
    if (text.trim()) chunks.push(text);
  }
  return chunks.join("\n");
}

async function findStandardCharteredBankAppFrame(page: Page) {
  for (const frame of page.frames()) {
    const button = frame.locator("#OOBValidateButton").first();
    const hasButton = (await button.count().catch(() => 0)) > 0;
    const bodyText = await frame.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
    if (hasButton || isStandardCharteredBankAppChallenge(bodyText)) {
      return { frame, button, bodyText };
    }
  }
  return null;
}

export type BankAppChallengeResult = "not_present" | "settled" | "failed" | "timed_out";

export async function waitForStandardCharteredBankAppChallenge(input: {
  page: Page;
  timeoutMs: number;
  appearanceTimeoutMs?: number;
  onBankAuthenticationRequired?: () => void | Promise<void>;
}): Promise<BankAppChallengeResult> {
  const appearanceTimeoutMs = Math.max(
    0,
    input.appearanceTimeoutMs ?? Math.min(DEFAULT_BANK_APP_APPEARANCE_WAIT_MS, input.timeoutMs),
  );
  const appearanceDeadline = Date.now() + appearanceTimeoutMs;
  let initial = await findStandardCharteredBankAppFrame(input.page);
  while (!initial && Date.now() < appearanceDeadline && !input.page.isClosed()) {
    const paymentText = await readAllPaymentFrameText(input.page);
    if (
      extractVietnamPaymentReceiptReference(paymentText) ||
      /declined|insufficient funds|payment failed|transaction failed|card invalid/i.test(paymentText) ||
      (vietnamPaymentNeedsHuman(paymentText) &&
        !isStandardCharteredBankAppChallenge(paymentText))
    ) {
      return "not_present";
    }
    await input.page.waitForTimeout(500);
    initial = await findStandardCharteredBankAppFrame(input.page);
  }
  if (!initial) return "not_present";

  await input.onBankAuthenticationRequired?.();

  // The issuer page also polls automatically every five seconds. Submit the
  // visible completion control once so its supported LINK_CLICK path is armed;
  // if approval is still pending the issuer keeps polling without losing the
  // challenge session.
  if (await initial.button.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await initial.button
      .evaluate((element) => (element as HTMLButtonElement).click(), undefined, { timeout: 5_000 })
      .catch(async () => {
        await initial.button.click({ timeout: 5_000 }).catch(() => undefined);
      });
  }

  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline && !input.page.isClosed()) {
    const challenge = await findStandardCharteredBankAppFrame(input.page);
    if (!challenge) {
      await input.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      return "settled";
    }
    if (BANK_APP_CHALLENGE_FAILURE_PATTERN.test(challenge.bodyText)) return "failed";
    await input.page.waitForTimeout(1_000);
  }
  return "timed_out";
}

async function prepareVietcombankGatewayForCardBrand(
  page: Page,
  brand: VietnamCardBrand,
): Promise<void> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!/vietcombank|vnpay|select payment method|international payment cards/i.test(bodyText)) return;

  await selectVietcombankInternationalCards(page);
  await page.waitForTimeout(750);

  // Prefer a trusted pointer event on the visible logo. Synthetic clicks can
  // toggle CSS without updating the gateway's selected-brand model.
  let brandSelected = await clickTrustedVietcombankCardBrand(page, brand);
  if (!brandSelected) {
    brandSelected = await selectVietcombankCardBrand(page, brand);
  }
  if (!brandSelected) {
    await expandVietcombankInternationalCards(page);
    await page.waitForTimeout(750);
    brandSelected =
      await clickTrustedVietcombankCardBrand(page, brand) ||
      await selectVietcombankCardBrand(page, brand);
  }
  if (brandSelected) {
    await page.waitForTimeout(750);
  }

  const continueButton = page
    .locator('#continueBtn, button:has-text("Continue"), a:has-text("Continue")')
    .filter({ visible: true })
    .last();
  const continueReady = async (): Promise<boolean> => {
    const className = await continueButton.getAttribute("class").catch(() => "");
    return !/\bdisabled\b/i.test(className ?? "") &&
      await continueButton.isEnabled({ timeout: 500 }).catch(() => false);
  };

  let termsAccepted = await ensureVietcombankTermsAccepted(page);
  if (!termsAccepted) return;
  if (!(await continueReady())) {
    // The live gateway can commit the service-regulations checkbox while the
    // method/brand model remains empty. In that state the page looks selected,
    // but Continue keeps its CSS `disabled` class. Replay the exact official
    // method and bank-code nodes with trusted pointer events, then require the
    // CTA state to prove that the framework model accepted the selection.
    console.warn("[vn-payment] VNPAY Continue is disabled after terms handling; replaying method and card brand.");
    await selectVietcombankInternationalCards(page);
    await expandVietcombankInternationalCards(page);
    const replayedBrand =
      await clickTrustedVietcombankCardBrand(page, brand) ||
      await selectVietcombankCardBrand(page, brand);
    if (!replayedBrand) return;
    termsAccepted = await ensureVietcombankTermsAccepted(page);
    if (!termsAccepted) return;
    const replayDeadline = Date.now() + 5_000;
    while (Date.now() < replayDeadline && !(await continueReady())) {
      await page.waitForTimeout(200);
    }
    termsAccepted = await continueReady();
  }
  if (await continueButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await continueButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await continueReady()) break;
      await page.waitForTimeout(500);
    }
    if (!(await continueReady())) return;
    const initialUrl = page.url();
    const clicked = await continueButton.click({ timeout: 10_000 }).then(() => true).catch(async () => {
      if (await continueButton.click({ timeout: 5_000, force: true }).then(() => true).catch(() => false)) {
        return true;
      }
      return page
        .evaluate(() => {
          const visible = (element: HTMLElement): boolean => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          };
          const button = Array.from(document.querySelectorAll<HTMLElement>("button, a"))
            .filter(visible)
            .reverse()
            .find((candidate) => /continue/i.test(candidate.innerText || candidate.textContent || ""));
          if (!button || /\bdisabled\b/i.test(button.className || "")) return false;
          if (button instanceof HTMLButtonElement && button.disabled) return false;
          button.scrollIntoView({ block: "center", inline: "center" });
          button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          return true;
        })
        .catch(() => false);
    });
    if (!clicked) return;
    const regulationsAccepted = await acceptVietcombankServiceRegulations(page, 15_000);
    if (regulationsAccepted && /select payment method/i.test(await page.locator("body").innerText().catch(() => ""))) {
      // The live gateway acknowledges the regulations by closing the modal,
      // then resets the terms checkbox. Re-accept the terms and submit the
      // already-selected method once more; this second Continue is what opens
      // the empty international-card form.
      const readyAfterRegulations = await ensureVietcombankTermsAccepted(page);
      if (readyAfterRegulations) {
        await continueButton.click({ timeout: 10_000 }).catch(async () => {
          await continueButton.click({ timeout: 5_000, force: true }).catch(() => undefined);
        });
      }
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    const advanced = await page
      .waitForFunction(
        ({ initialUrl, cardSelector }) =>
          window.location.href !== initialUrl ||
          Boolean(document.querySelector(cardSelector)) ||
          !/select payment method/i.test(document.body?.innerText ?? ""),
        { initialUrl, cardSelector: VIETNAM_CARD_NUMBER_SELECTOR },
        { timeout: 10_000, polling: 250 },
      )
      .then(() => true)
      .catch(() => false);
    if (!advanced && /select payment method/i.test(await page.locator("body").innerText().catch(() => ""))) {
      console.warn("[vn-payment] VNPAY Continue did not advance; replaying trusted method and terms selection.");
      await selectVietcombankInternationalCards(page);
      await clickTrustedVietcombankCardBrand(page, brand);
      const readyAfterReplay = await ensureVietcombankTermsAccepted(page);
      if (readyAfterReplay) {
        await continueButton.click({ timeout: 10_000 }).catch(async () => {
          await continueButton.click({ timeout: 5_000, force: true }).catch(() => undefined);
        });
        const replayRegulationsAccepted = await acceptVietcombankServiceRegulations(page, 15_000);
        if (replayRegulationsAccepted && /select payment method/i.test(await page.locator("body").innerText().catch(() => ""))) {
          const readyAfterReplayRegulations = await ensureVietcombankTermsAccepted(page);
          if (readyAfterReplayRegulations) {
            await continueButton.click({ timeout: 10_000 }).catch(async () => {
              await continueButton.click({ timeout: 5_000, force: true }).catch(() => undefined);
            });
          }
        }
        await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(1_000);
      }
    }
  }
}

async function prepareVietcombankGatewayForCard(page: Page, card: VietnamFixedCard): Promise<void> {
  await prepareVietcombankGatewayForCardBrand(page, detectVietnamCardBrand(card));
}

const VIETNAM_CARD_NUMBER_SELECTOR = [
  'input[autocomplete="cc-number"]',
  'input[placeholder*="card number" i]',
  'input[name*="card" i][name*="number" i]',
  'input[id*="card" i][id*="number" i]',
  'input[aria-label*="card" i][aria-label*="number" i]',
].join(", ");

export async function isVietnamPaymentFlowPage(page: Page): Promise<boolean> {
  const [bodyText, cardNumberVisible] = await Promise.all([
    page.locator("body").innerText({ timeout: 2_000 }).catch(() => ""),
    page.locator(VIETNAM_CARD_NUMBER_SELECTOR).first().isVisible({ timeout: 500 }).catch(() => false),
  ]);
  return cardNumberVisible || hasVietnamPaymentPageEvidence(page.url(), bodyText);
}

/**
 * Advances through the official payment-information and VNPAY method screens
 * until an empty card-number field is visible.  This helper never receives,
 * fills, or submits card details and is therefore safe for pre-payment QA.
 */
export async function advanceVietnamPortalToCardEntry(input: {
  page: Page;
  cardBrand?: VietnamCardBrand;
  timeoutMs?: number;
}): Promise<VietnamCardEntryResult> {
  const { page } = input;
  let bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (isOfficialVietnamPaymentInformationPage(bodyText)) {
    const advanced = await advanceOfficialVietnamPaymentInformationPage(page);
    if (!advanced) {
      return {
        status: "not_ready",
        reason: "Could not advance from the official Vietnam payment information page.",
      };
    }
    bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  }
  if (!(await isVietnamPaymentFlowPage(page))) {
    return {
      status: "not_ready",
      reason: "The official Vietnam flow did not reach a supported payment gateway.",
    };
  }
  if (vietnamPaymentNeedsHuman(bodyText)) {
    return {
      status: "not_ready",
      reason: "The payment gateway requested authentication before exposing the card form.",
    };
  }

  await prepareVietcombankGatewayForCardBrand(page, input.cardBrand ?? "visa");
  const deadline = Date.now() + Math.max(1_000, Math.min(input.timeoutMs ?? 30_000, 60_000));
  while (Date.now() < deadline && !page.isClosed()) {
    const cardInput = page.locator(VIETNAM_CARD_NUMBER_SELECTOR).first();
    if (await cardInput.isVisible({ timeout: 500 }).catch(() => false)) {
      const value = await cardInput.inputValue({ timeout: 1_000 }).catch(() => "");
      if (value.trim()) {
        return {
          status: "not_ready",
          reason: "The card form was not empty; pre-payment QA stopped without changing it.",
        };
      }
      return { status: "ready" };
    }
    bodyText = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
    if (/payment\s+failed.*recreate\s+profile|recreate\s+profile\s+and\s+retry\s+payment/i.test(bodyText)) {
      return {
        status: "not_ready",
        reason: "The official portal rejected this payment profile before the card form.",
      };
    }
    await page.waitForTimeout(500);
  }
  return {
    status: "not_ready",
    reason: "The VNPAY card-number field did not become visible before the bounded wait expired.",
  };
}

export async function payVietnamPortalWithFixedCard(input: {
  page: Page;
  card: VietnamFixedCard;
  contactEmail?: string | null;
  paymentTransitionTimeoutMs?: number;
  onBankAuthenticationRequired?: () => void | Promise<void>;
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
  if (!(await isVietnamPaymentFlowPage(page))) {
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
  await prepareVietcombankGatewayForCard(page, card);
  const afterPreparationText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (/payment\s+failed.*recreate\s+profile|recreate\s+profile\s+and\s+retry\s+payment/i.test(afterPreparationText)) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "The official portal returned 'payment failed, please recreate profile and retry payment'. This official-site failure requires a new profile run with a fresh one-time card session.",
      redactedCard,
    };
  }

  const cardNumberFilled = await fillFirstVisible(page, VIETNAM_CARD_NUMBER_SELECTOR.split(", "), card.pan);
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
  const expiryFilled = await fillFirstVisible(page, [
    'input[autocomplete="cc-exp"]',
    'input[placeholder*="MM/YY" i]',
    'input[placeholder*="expiry" i]',
    'input[placeholder*="expired" i]',
    'input[name*="expire" i]',
    'input[name*="expiry" i]',
    'input[name*="expired" i]',
    'input[id*="expire" i]',
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
  const cvvFilled = await fillFirstVisible(page, [
    'input[autocomplete="cc-csc"]',
    'input[placeholder*="cvc" i]',
    'input[placeholder*="cvv" i]',
    'input[name*="cvv" i]',
    'input[id*="cvv" i]',
    'input[name*="cvc" i]',
    'input[id*="cvc" i]',
  ], card.cvv);
  if (!expiryFilled || !cvvFilled) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Could not locate all required expiry/CVV fields on the VNPAY card form; payment was not submitted.",
      redactedCard,
    };
  }
  const contactEmail = input.contactEmail?.trim() || process.env.VN_FIXED_CARD_EMAIL?.trim() || "";
  if (contactEmail) {
    await fillFirstVisible(page, [
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
      'input[name*="email" i]',
      'input[id*="email" i]',
    ], contactEmail);
  }
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

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(500);

  const transitionTimeoutMs = input.paymentTransitionTimeoutMs ?? 20_000;
  let submission = await submitVnpayInternationalCardForm(page, transitionTimeoutMs);
  if (!submission.clicked) {
    const initialUrl = page.url();
    const clicked = await clickFirstVisible(page, [
      "#btnContinue",
      "a.btnContinue",
      'a:has-text("Pay")',
      'button:has-text("Pay")',
      'button:has-text("Pay now")',
      'button:has-text("Continue")',
      'button:has-text("Confirm")',
      'button:has-text("Submit")',
      'button:has-text("Submit Payment")',
      'button:has-text("Thanh toán")',
      '[role="button"]:has-text("Pay")',
      '[role="button"]:has-text("Continue")',
      '[role="button"]:has-text("Confirm")',
      '[role="button"]:has-text("Submit")',
      'input[type="submit"][value*="Pay" i]',
      'input[type="button"][value*="Pay" i]',
      'input[type="submit"][value*="Continue" i]',
      'input[type="button"][value*="Continue" i]',
    ]);
    submission = {
      clicked,
      transitioned: clicked
        ? await waitForVnpayPaymentSubmissionTransition(page, initialUrl, transitionTimeoutMs)
        : false,
    };
  }
  if (!submission.clicked) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Could not locate a supported payment submit button.",
      redactedCard,
    };
  }
  if (!submission.transitioned) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "VNPAY kept the card form visible after confirmation, so no bank authentication was initiated.",
      redactedCard,
    };
  }

  await waitForVnpayPaymentSettlement(page);
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  const bankAppChallenge = await waitForStandardCharteredBankAppChallenge({
    page,
    timeoutMs: getVietnamBankAppWaitMs(),
    onBankAuthenticationRequired: input.onBankAuthenticationRequired,
  });
  if (bankAppChallenge === "failed" || bankAppChallenge === "timed_out") {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: bankAppChallenge === "timed_out"
        ? "Bank-app 3DS approval was not completed before the issuer challenge expired."
        : "The issuer reported that bank-app 3DS authentication failed or expired.",
      redactedCard,
    };
  }
  if (bankAppChallenge === "settled") {
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
  }

  const afterText = await readAllPaymentFrameText(page);
  if (
    vietnamPaymentNeedsHuman(afterText) ||
    /(?:3ds|auth-notify|secure-devicefp|id-check|authentication)/i.test(page.url()) ||
    /mobile banking app|authenticate payment|approve this transaction|complete your purchase/i.test(afterText)
  ) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Payment gateway requested 3DS/OTP/bank-app authentication after card submit.",
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
