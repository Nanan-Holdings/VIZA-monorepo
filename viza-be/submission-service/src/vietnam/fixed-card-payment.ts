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
const STANDARD_CHARTERED_BANK_APP_PATTERN =
  /(?:sc mobile banking app|sc mobile app).*(?:approve this transaction|authenticate payment)|click here to complete your purchase/i;
const BANK_APP_CHALLENGE_FAILURE_PATTERN =
  /(?:authentication|transaction|payment).{0,30}(?:expired|timed out|failed|declined|cancelled)|(?:expired|timed out|failed|declined|cancelled).{0,30}(?:authentication|transaction|payment)/i;
const DEFAULT_BANK_APP_WAIT_MS = 115_000;
const MIN_BANK_APP_WAIT_MS = 10_000;
const MAX_BANK_APP_WAIT_MS = 180_000;

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

export function isStandardCharteredBankAppChallenge(text: string): boolean {
  return STANDARD_CHARTERED_BANK_APP_PATTERN.test(text);
}

export function getVietnamBankAppWaitMs(env: EnvLike = process.env): number {
  const configured = Number(env.VN_BANK_APP_3DS_WAIT_MS ?? DEFAULT_BANK_APP_WAIT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_BANK_APP_WAIT_MS;
  return Math.max(MIN_BANK_APP_WAIT_MS, Math.min(MAX_BANK_APP_WAIT_MS, Math.round(configured)));
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

type VietnamCardBrand = "visa" | "mastercard" | "jcb" | "amex";

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
      const triggerChange = (element: HTMLElement): void => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const radio = document.querySelector<HTMLInputElement>('input[name="payment-method"][value="INTERNATIONAL_CARD"]');
      if (radio && !radio.checked) {
        radio.checked = true;
        triggerChange(radio);
      }

      const internationalHeader = Array.from(document.querySelectorAll<HTMLElement>("label, div, button"))
        .filter((element) => /international payment cards/i.test(element.innerText || element.textContent || ""))
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
        })[0];
      if (internationalHeader) {
        triggerMouseClick(internationalHeader);
      }

      const accordion = document.querySelector<HTMLElement>("#accordionList3");
      if (accordion) {
        accordion.classList.add("show");
        accordion.style.display = "";
      }

      const item = document.querySelector<HTMLElement>(`.list-bank-item[bank-code="${code}"]`);
      if (!item) return false;
      item.scrollIntoView({ block: "center", inline: "center" });
      triggerMouseClick(item);

      const terms = document.querySelector<HTMLInputElement>('input[name="checkbox-terms"]');
      if (terms && !terms.checked) {
        terms.checked = true;
        triggerChange(terms);
      }

      const continueButton = document.querySelector<HTMLButtonElement>("#continueBtn");
      return item.classList.contains("active") && !!continueButton && !/\bdisabled\b/i.test(continueButton.className || "");
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

async function ensureVietcombankTermsAccepted(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const terms = document.querySelector<HTMLInputElement>('input[name="checkbox-terms"]');
      if (!terms) return false;

      const jquery = (window as typeof window & { $?: (selector: string) => { prop: (name: string, value: boolean) => { trigger: (event: string) => void } } }).$;
      if (jquery) {
        jquery('input[name="checkbox-terms"]').prop("checked", true).trigger("change");
      } else if (!terms.checked) {
        terms.checked = true;
        terms.dispatchEvent(new Event("input", { bubbles: true }));
        terms.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const continueButton = document.querySelector<HTMLButtonElement>("#continueBtn");
      return terms.checked && !!continueButton && !/\bdisabled\b/i.test(continueButton.className || "");
    })
    .catch(() => false);
}

async function submitVnpayInternationalCardForm(page: Page): Promise<boolean> {
  const payButton = page.locator("#btnContinue, a.btnContinue").first();
  if (!(await payButton.isVisible({ timeout: 1_500 }).catch(() => false))) return false;

  await payButton.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => undefined);
  await payButton.click({ timeout: 10_000, force: true });
  await page.waitForTimeout(1_000);

  const agreeButton = page.locator("#btnAgree").first();
  if (await agreeButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await agreeButton.click({ timeout: 10_000, force: true });
  }
  return true;
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
  onBankAuthenticationRequired?: () => void | Promise<void>;
}): Promise<BankAppChallengeResult> {
  const initial = await findStandardCharteredBankAppFrame(input.page);
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

async function prepareVietcombankGatewayForCard(page: Page, card: VietnamFixedCard): Promise<void> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!/vietcombank|vnpay|select payment method|international payment cards/i.test(bodyText)) return;

  const internationalCard = page.locator('text="International payment cards"').first();
  if (await internationalCard.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await internationalCard.click({ timeout: 10_000 }).catch(async () => {
      await page.locator('input[name="payment-method"]').last().check({ timeout: 5_000 });
    });
    await page.waitForTimeout(750);
  }

  const brand = detectVietnamCardBrand(card);
  let brandSelected = await selectVietcombankCardBrand(page, brand);
  if (!brandSelected) {
    await expandVietcombankInternationalCards(page);
    await page.waitForTimeout(750);
    brandSelected = await selectVietcombankCardBrand(page, brand);
  }
  if (brandSelected) {
    await page.waitForTimeout(750);
  }

  let termsAccepted = await ensureVietcombankTermsAccepted(page);
  if (!termsAccepted) {
    const terms = page.locator('input[name="checkbox-terms"]').first();
    if (await terms.count().catch(() => 0)) {
      await terms.check({ timeout: 5_000, force: true }).catch(async () => {
        await terms.evaluate((element) => {
          const checkbox = element as HTMLInputElement;
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("input", { bubbles: true }));
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
      await page.waitForTimeout(500);
    }
    termsAccepted = await ensureVietcombankTermsAccepted(page);
  }
  const termsLabel = page.locator('text=/I have read/i').first();
  if (!termsAccepted && await termsLabel.isVisible({ timeout: 1_500 }).catch(() => false)) {
    const box = await termsLabel.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(Math.max(1, box.x - 20), box.y + box.height / 2);
    } else {
      await termsLabel.click({ timeout: 5_000, force: true });
    }
    await page.waitForTimeout(500);
    await ensureVietcombankTermsAccepted(page);
  }

  const continueButton = page.locator('button:has-text("Continue")').first();
  if (await continueButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await ensureVietcombankTermsAccepted(page);
    await continueButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const className = await continueButton.getAttribute("class").catch(() => "");
      if (!/\bdisabled\b/i.test(className ?? "") && await continueButton.isEnabled({ timeout: 500 }).catch(() => false)) break;
      await page.waitForTimeout(500);
    }
    const className = await continueButton.getAttribute("class").catch(() => "");
    if (/\bdisabled\b/i.test(className ?? "") || !(await continueButton.isEnabled({ timeout: 500 }).catch(() => false))) return;
    const clicked = await continueButton.click({ timeout: 10_000 }).then(() => true).catch(async () => {
      return page
        .evaluate(() => {
          const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
            .find((candidate) => /continue/i.test(candidate.innerText || candidate.textContent || ""));
          if (!button || /\bdisabled\b/i.test(button.className || "") || button.disabled) return false;
          button.scrollIntoView({ block: "center", inline: "center" });
          button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          return true;
        })
        .catch(() => false);
    });
    if (!clicked) return;
    await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
  }
}

export async function payVietnamPortalWithFixedCard(input: {
  page: Page;
  card: VietnamFixedCard;
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

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(500);

  const submitted = await submitVnpayInternationalCardForm(page) || await clickFirstVisible(page, [
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
  if (!submitted) {
    return {
      status: "needs_human",
      receiptReference: null,
      reason: "Could not locate a supported payment submit button.",
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
