import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import { solveImageCaptcha } from "../captcha";
import {
  loadVietnamFixedCardFromEnv,
  payVietnamPortalWithFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardPaymentResult,
} from "./fixed-card-payment";
import { toVietnamDob } from "./status-check";

export type VietnamPaymentResumeResult =
  | {
      status: "paid";
      receiptReference: string;
      screenshotPath?: string;
    }
  | {
      status: "needs_human" | "declined" | "unavailable";
      reason: string;
      url: string;
      screenshotPath?: string;
    };

export interface VietnamPaymentResumeInput {
  registrationCode: string;
  email: string;
  dateOfBirth: string;
  headless?: boolean;
  searchUrl?: string;
  screenshotPath?: string;
  timeoutMs?: number;
  card?: VietnamFixedCard | null;
}

const DEFAULT_SEARCH_URL = "https://evisa.gov.vn/e-visa/search";
const SEARCH_FIELD_SELECTORS = [
  "#basic_maHoSo",
  "#basic_email",
  "#basic_dateOfBirth",
  "#_tracuuthongtinTTDT_WAR_eVisaportlet_tchs_maSoHoSo",
  "#_tracuuthongtinTTDT_WAR_eVisaportlet_tchs_email",
  "#_tracuuthongtinTTDT_WAR_eVisaportlet_ngaySinh",
  'input[name*="code" i]',
  'input[id*="code" i]',
  'input[placeholder*="code" i]',
  'input[placeholder*="profile" i]',
  'input[placeholder*="registration" i]',
  'input[placeholder*="Mã" i]',
  'input[placeholder*="ma" i]',
  'input[placeholder*="hồ sơ" i]',
  'input[placeholder*="ho so" i]',
  'input[type="email"]',
  'input[name*="email" i]',
  'input[id*="email" i]',
  'input[placeholder*="email" i]',
  'input[name*="birth" i]',
  'input[id*="birth" i]',
  'input[placeholder*="birth" i]',
  'input[placeholder*="dd/mm/yyyy" i]',
  'input[placeholder*="ngày sinh" i]',
  'input[placeholder*="ngay sinh" i]',
];

async function fillByCandidates(page: Page, candidates: string[], value: string): Promise<boolean> {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 1_500 })) {
        const readonly = await locator.getAttribute("readonly").catch(() => null);
        if (readonly !== null) {
          await setInputValue(locator, value);
        } else {
          await locator.fill(value, { timeout: 5_000 });
          await setInputValue(locator, value);
        }
        return true;
      }
    } catch {
      // Try next candidate.
    }
  }
  return false;
}

async function setInputValue(locator: Locator, value: string): Promise<void> {
  await locator.evaluate(
    (element, nextValue) => {
      if (!(element instanceof HTMLInputElement)) return;
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      if (descriptor?.set) {
        descriptor.set.call(element, nextValue);
      } else {
        element.value = nextValue;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    },
    value,
  );
}

async function fillSearchFields(page: Page, input: VietnamPaymentResumeInput): Promise<void> {
  const filledCode = await fillByCandidates(page, [
    "#basic_maHoSo",
    "#_tracuuthongtinTTDT_WAR_eVisaportlet_tchs_maSoHoSo",
    'input[name*="code" i]',
    'input[id*="code" i]',
    'input[placeholder*="code" i]',
    'input[placeholder*="profile" i]',
    'input[placeholder*="registration" i]',
  ], input.registrationCode);
  const filledEmail = await fillByCandidates(page, [
    "#basic_email",
    "#_tracuuthongtinTTDT_WAR_eVisaportlet_tchs_email",
    'input[type="email"]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
  ], input.email);
  const filledDob = await fillByCandidates(page, [
    "#basic_dateOfBirth",
    "#_tracuuthongtinTTDT_WAR_eVisaportlet_ngaySinh",
    'input[name*="birth" i]',
    'input[id*="birth" i]',
    'input[placeholder*="birth" i]',
    'input[placeholder*="dd/mm/yyyy" i]',
  ], toVietnamDob(input.dateOfBirth));
  await page.keyboard.press("Escape").catch(() => undefined);
  if (!filledCode || !filledEmail || !filledDob) {
    const visibleInputs = await page.locator("input:visible").count().catch(() => 0);
    const bodyText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    if (visibleInputs === 0 && bodyText.trim().length < 30) {
      throw new Error("The official Vietnam payment search page loaded blank; retry later or open the official portal manually.");
    }
    throw new Error(`Could not locate all Vietnam payment resume search fields. visibleInputs=${visibleInputs}`);
  }
}

export function shouldRetryVietnamSearchAfterCriticalAssetFailure(input: {
  elapsedMs: number;
  bodyTextLength: number;
  criticalAssetFailureDetected: boolean;
}): boolean {
  return (
    input.elapsedMs >= 3_000 &&
    input.bodyTextLength < 30 &&
    input.criticalAssetFailureDetected
  );
}

async function waitForSearchPageReady(
  page: Page,
  timeoutMs: number,
  criticalAssetFailureDetected: () => boolean = () => false,
): Promise<boolean> {
  const startedAt = Date.now();
  const deadline = Date.now() + Math.min(timeoutMs, 45_000);
  while (Date.now() < deadline) {
    for (const selector of SEARCH_FIELD_SELECTORS) {
      if (await page.locator(selector).first().isVisible({ timeout: 500 }).catch(() => false)) {
        return true;
      }
    }
    const bodyText = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
    if (/cloudflare|checking your browser|security verification|verify you are human/i.test(bodyText)) {
      return false;
    }
    if (shouldRetryVietnamSearchAfterCriticalAssetFailure({
      elapsedMs: Date.now() - startedAt,
      bodyTextLength: bodyText.trim().length,
      criticalAssetFailureDetected: criticalAssetFailureDetected(),
    })) {
      return false;
    }
    await page.waitForTimeout(1_000);
  }
  return false;
}

export interface FreshVietnamSearchPageRetryOptions<T> {
  attempts: number;
  openPage: (attempt: number) => Promise<T>;
  isReady: (page: T, attempt: number) => Promise<boolean>;
  closePage: (page: T) => Promise<void>;
  waitBeforeRetry?: (attempt: number) => Promise<void>;
}

export interface FreshVietnamSearchPageRetryResult<T> {
  page: T | null;
  ready: boolean;
  lastError?: unknown;
}

/**
 * Retry the official search page in a fresh browser context each time.
 *
 * evisa.gov.vn occasionally returns a transient 4xx response for one of its
 * hashed SPA chunks. Reloading the same page can retain the failed module graph,
 * leaving the body blank for every subsequent reload. A fresh context discards
 * that failed graph while retaining the last failed page for diagnostics.
 */
export async function retryFreshVietnamSearchPage<T>(
  options: FreshVietnamSearchPageRetryOptions<T>,
): Promise<FreshVietnamSearchPageRetryResult<T>> {
  const attempts = Math.max(1, options.attempts);
  let page: T | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (page) {
      await options.closePage(page).catch(() => undefined);
      page = null;
    }
    if (attempt > 1) {
      await options.waitBeforeRetry?.(attempt);
    }

    try {
      page = await options.openPage(attempt);
      if (await options.isReady(page, attempt)) {
        return { page, ready: true };
      }
    } catch (error) {
      lastError = error;
    }
  }

  return { page, ready: false, lastError };
}

function paymentBrowserIgnoresHttpsErrors(): boolean {
  return /^(?:1|true|yes|on)$/i.test(process.env.VN_IGNORE_HTTPS_ERRORS?.trim() ?? "");
}

async function gotoSearchPageWithRetry(
  browser: Browser,
  input: VietnamPaymentResumeInput,
): Promise<FreshVietnamSearchPageRetryResult<Page>> {
  const searchUrl = input.searchUrl ?? DEFAULT_SEARCH_URL;
  const attempts = Math.max(1, Math.min(Number(process.env.VN_PAYMENT_SEARCH_LOAD_ATTEMPTS ?? 5), 5));
  const criticalAssetFailures = new WeakMap<Page, Set<string>>();

  return retryFreshVietnamSearchPage<Page>({
    attempts,
    openPage: async () => {
      const page = await browser.newPage({
        ignoreHTTPSErrors: paymentBrowserIgnoresHttpsErrors(),
        serviceWorkers: "block",
      });
      const failures = new Set<string>();
      criticalAssetFailures.set(page, failures);
      page.on("requestfailed", (request) => {
        try {
          const url = new URL(request.url());
          if (url.origin === new URL(searchUrl).origin && url.pathname.startsWith("/assets/")) {
            failures.add(url.pathname);
          }
        } catch {
          // Ignore malformed or non-HTTP request URLs.
        }
      });
      page.on("response", (response) => {
        try {
          const url = new URL(response.url());
          if (
            response.status() >= 400 &&
            url.origin === new URL(searchUrl).origin &&
            url.pathname.startsWith("/assets/")
          ) {
            failures.add(url.pathname);
          }
        } catch {
          // Ignore malformed or non-HTTP response URLs.
        }
      });
      await page.setExtraHTTPHeaders({
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      });
      try {
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: input.timeoutMs ?? 60_000,
        });
      } catch (error) {
        await page.close().catch(() => undefined);
        throw error;
      }
      return page;
    },
    isReady: async (page, attempt) => {
      const ready = await waitForSearchPageReady(
        page,
        input.timeoutMs ?? 60_000,
        () => (criticalAssetFailures.get(page)?.size ?? 0) > 0,
      );
      if (!ready) {
        const bodyTextLength = await page.locator("body").innerText({ timeout: 2_000 })
          .then((text) => text.trim().length)
          .catch(() => 0);
        console.warn(
          `[vn-payment] Official search page was not ready attempt=${attempt}/${attempts} ` +
          `bodyTextLength=${bodyTextLength} criticalAssetFailures=${criticalAssetFailures.get(page)?.size ?? 0}`,
        );
      }
      return ready;
    },
    closePage: (page) => page.close(),
    waitBeforeRetry: async (attempt) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt - 1)));
    },
  });
}

async function solveSearchCaptcha(page: Page, timeoutMs: number): Promise<void> {
  let captchaText = "";
  const expectedLength = page.url().includes("evisa.gov.vn") ? 6 : 4;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const image = page.locator([
      "img.captcha",
      'img[alt*="Identify" i]',
      'img[src*="captcha" i]',
      'img[src*="capcha" i]',
      'img[alt*="captcha" i]',
      'img[id*="captcha" i]',
      'canvas',
      '.captcha img',
    ].join(", ")).first();
    if (!(await image.isVisible({ timeout: 3_000 }).catch(() => false))) return;
    const png = await image.screenshot({ timeout: Math.min(timeoutMs, 15_000) });
    try {
      const solution = await solveImageCaptcha(png, Math.min(timeoutMs, 120_000), {
        case: false,
        comment: "Vietnam e-Visa search CAPTCHA. Enter only the visible digits.",
      });
      captchaText = solution.text.trim().replace(/\D/g, "");
      if (captchaText.length === expectedLength) break;
    } catch {
      captchaText = "";
    }
    if (attempt < 3) {
      await page.locator([
        "button:has(.anticon-reload)",
        ".anticon-reload",
        'button[aria-label*="refresh" i]',
        'button[aria-label*="reload" i]',
        'img[title*="refresh" i]',
        'img[alt*="refresh" i]',
      ].join(", ")).first().click({ timeout: 3_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
    }
  }
  if (captchaText.length !== expectedLength) {
    throw new Error(`2captcha returned unusable Vietnam search CAPTCHA answers; expected ${expectedLength} digits.`);
  }
  const captchaInput = page.locator([
    "#basic_captcha",
    "#_tracuuthongtinTTDT_WAR_eVisaportlet_captchaText",
    'input[name*="captcha" i]',
    'input[id*="captcha" i]',
    'input[placeholder*="captcha" i]',
    'input[placeholder*="security" i]',
  ].join(", ")).first();
  await captchaInput.fill(captchaText, { timeout: 10_000 });
  await setInputValue(captchaInput, captchaText);
}

async function submitSearch(page: Page): Promise<void> {
  const submitted =
    await page.locator('button:has-text("Search")').first().click({ timeout: 5_000 }).then(() => true).catch(() => false) ||
    await page.locator('button:has-text("Tra cứu")').first().click({ timeout: 5_000 }).then(() => true).catch(() => false) ||
    await page.locator('input[type="button"][value*="Search" i]').first().click({ timeout: 5_000 }).then(() => true).catch(() => false) ||
    await page.locator('input[type="submit"][value*="Search" i]').first().click({ timeout: 5_000 }).then(() => true).catch(() => false) ||
    await page.locator('input[type="submit"]').first().click({ timeout: 5_000 }).then(() => true).catch(() => false);
  if (!submitted) throw new Error("Could not locate Vietnam search submit button.");
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(1_500);
}

async function clickVisibleButtonByText(page: Page, labels: string[]): Promise<boolean> {
  const startedAt = Date.now();
  for (const label of labels) {
    while (Date.now() - startedAt < 45_000) {
      const bodyText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
      const currentUrl = page.url();
      if (/payment gateway|payment amount|card number|credit card|debit card|cvv|cvc|pay now|submit payment|transaction/i.test(bodyText) ||
        /\/(?:payment|pay|checkout|gateway)(?:\/|$|\?)/i.test(currentUrl)) {
        return true;
      }

      const locator = page.locator(`button:has-text("${label}")`).first();
      if (!(await locator.isVisible({ timeout: 1_000 }).catch(() => false))) {
        break;
      }
      if (await locator.isEnabled({ timeout: 1_000 }).catch(() => false)) {
        await locator.click({ timeout: 15_000 });
        await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => undefined);
        await page.waitForTimeout(2_000);
        return true;
      }
      await page.waitForTimeout(1_000);
    }
  }
  return false;
}

async function clickVisibleTextOrCheckbox(page: Page, labels: string[]): Promise<boolean> {
  for (const label of labels) {
    const labelLocator = page.locator(`label:has-text("${label}")`).first();
    if (await labelLocator.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await labelLocator.click({ timeout: 10_000 });
      await page.waitForTimeout(750);
      return true;
    }
    const textLocator = page.locator(`text="${label}"`).first();
    if (await textLocator.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await textLocator.click({ timeout: 10_000 });
      await page.waitForTimeout(750);
      return true;
    }
  }
  const visibleCheckbox = page.locator('input[type="checkbox"]:visible').first();
  if (await visibleCheckbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await visibleCheckbox.check({ timeout: 5_000 }).catch(async () => {
      await visibleCheckbox.click({ timeout: 5_000 });
    });
    await page.waitForTimeout(750);
    return true;
  }
  return false;
}

async function advanceOfficialFormToPayment(page: Page, timeoutMs: number): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const currentUrl = page.url();
    if (/payment gateway|payment amount|card number|credit card|debit card|cvv|cvc|pay now|submit payment|transaction/i.test(bodyText) ||
      /\/(?:payment|pay|checkout|gateway)(?:\/|$|\?)/i.test(currentUrl)) {
      return;
    }
    if (/additional completed|electronic document code/i.test(bodyText)) {
      if (!(await clickVisibleButtonByText(page, ["Confirm", "OK"]))) {
        throw new Error("Could not confirm the Vietnam additional-completed dialog.");
      }
      continue;
    }
    if (/payment’s information|payment's information|amount paid \(usd\)|i agree to pay/i.test(bodyText)) {
      await clickVisibleTextOrCheckbox(page, ["I agree to pay"]);
      if (!(await clickVisibleButtonByText(page, ["Payment", "Pay", "Continue"]))) {
        throw new Error("Could not click the Vietnam official payment confirmation button.");
      }
      continue;
    }
    if (/review application form/i.test(bodyText) && /security code/i.test(bodyText)) {
      await solveSearchCaptcha(page, timeoutMs);
      if (!(await clickVisibleButtonByText(page, ["Next", "Continue", "Payment"]))) {
        throw new Error("Could not advance from Vietnam review page to payment.");
      }
      continue;
    }
    if (/viet nam e-visa application form|fill out the application form/i.test(bodyText)) {
      if (!(await clickVisibleButtonByText(page, ["Next", "Continue"]))) {
        throw new Error("Could not advance from Vietnam application form to review.");
      }
      continue;
    }
    if (await clickPaymentEntry(page)) {
      continue;
    }
    return;
  }
}

async function clickPaymentEntry(page: Page): Promise<boolean> {
  const selectors = [
    'button:has-text("Pay")',
    'a:has-text("Pay")',
    'button:has-text("Payment")',
    'a:has-text("Payment")',
    'button:has-text("pay visa fee")',
    'a:has-text("pay visa fee")',
    'button:has-text("Pay to edit")',
    'a:has-text("Pay to edit")',
    'button:has-text("Thanh toán")',
    'a:has-text("Thanh toán")',
    'button:has-text("Nộp phí")',
    'a:has-text("Nộp phí")',
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await locator.click({ timeout: 10_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => undefined);
      await page.waitForTimeout(1_500);
      return true;
    }
  }
  return false;
}

function mapPaymentResult(payment: VietnamFixedCardPaymentResult, page: Page): VietnamPaymentResumeResult {
  if (payment.status === "paid" && payment.receiptReference) {
    return { status: "paid", receiptReference: payment.receiptReference };
  }
  if (payment.status === "declined") {
    return { status: "declined", reason: payment.reason ?? "The payment gateway declined the payment.", url: page.url() };
  }
  return { status: "needs_human", reason: payment.reason ?? "The payment gateway requires human handling.", url: page.url() };
}

export async function resumeVietnamOfficialPayment(
  input: VietnamPaymentResumeInput,
): Promise<VietnamPaymentResumeResult> {
  const card = input.card ?? loadVietnamFixedCardFromEnv();
  if (!card) {
    return {
      status: "unavailable",
      reason: "No one-time card session or Vietnam fixed-card payment env is configured for this worker process.",
      url: input.searchUrl ?? DEFAULT_SEARCH_URL,
    };
  }

  const browser = await chromium.launch({ headless: input.headless ?? true });
  let page: Page | null = null;
  try {
    const searchPage = await gotoSearchPageWithRetry(browser, input);
    page = searchPage.page;
    if (!searchPage.ready || !page) {
      if (!page) {
        if (searchPage.lastError) throw searchPage.lastError;
        return {
          status: "unavailable",
          reason: "The official Vietnam payment search page could not be opened after retries.",
          url: input.searchUrl ?? DEFAULT_SEARCH_URL,
        };
      }
      const bodyText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
      return {
        status: "unavailable",
        reason: bodyText.trim().length < 30
          ? "The official Vietnam payment search page loaded blank after retries."
          : "The official Vietnam payment search page did not expose the expected search fields after retries.",
        url: page.url(),
      };
    }
    await fillSearchFields(page, input);
    await solveSearchCaptcha(page, input.timeoutMs ?? 120_000);
    await fillSearchFields(page, input);
    await submitSearch(page);
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (/no result found|không tìm thấy|khong tim thay/i.test(bodyText)) {
      return {
        status: "unavailable",
        reason: "The official Vietnam search page returned no result for this registration code, email, and date of birth.",
        url: page.url(),
      };
    }

    if (!(await clickPaymentEntry(page))) {
      return {
        status: "unavailable",
        reason: "The official Vietnam search result did not expose a payment entry.",
        url: page.url(),
      };
    }
    await advanceOfficialFormToPayment(page, input.timeoutMs ?? 120_000);

    const payment = await payVietnamPortalWithFixedCard({
      page,
      card,
      contactEmail: input.email,
    });
    return mapPaymentResult(payment, page);
  } catch (error) {
    return {
      status: "needs_human",
      reason: error instanceof Error ? error.message : String(error),
      url: page?.url() ?? input.searchUrl ?? DEFAULT_SEARCH_URL,
    };
  } finally {
    if (input.screenshotPath && page) {
      await page.screenshot({ path: input.screenshotPath, fullPage: true }).catch(() => undefined);
    }
    await browser.close().catch(() => undefined);
  }
}
