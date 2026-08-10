import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import { reportBadCaptcha, solveImageCaptcha } from "../captcha";
import {
  loadVietnamFixedCardFromEnv,
  payVietnamPortalWithFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardPaymentResult,
} from "./fixed-card-payment";
import {
  captureVietnamCaptchaImage,
  fingerprintVietnamCaptchaImage,
  refreshVietnamCaptchaChallenge,
  solveVietnamImageCaptcha,
  waitForVietnamCaptchaRefresh,
} from "./captcha";
import { toVietnamDob } from "./status-check";

export interface VietnamPaymentSearchCaptchaDiagnostic {
  attempt: number;
  answerLength?: number;
  durationMs?: number;
  challengeFingerprintPrefix?: string;
  outcome: "solved" | "unusable" | "solver_error";
  refreshConfirmed?: boolean;
  refreshStrategy?: "search_reload_control" | "shared_fallback";
}

export interface VietnamPaymentResumeDiagnostics {
  searchCaptchaAttempts?: VietnamPaymentSearchCaptchaDiagnostic[];
  paymentEntry?: VietnamPaymentEntryDiagnostic;
}

export interface VietnamPaymentEntryDiagnostic {
  outcome: "advanced" | "not_found" | "disabled" | "confirmation_missing" | "transition_failed";
  matchedActionLabel?: "Payment" | "Thanh toán" | "支付" | "支払い";
  confirmationObserved?: boolean;
  finalRoute?: "search" | "applicant_detail" | "payment_information" | "other";
}

export type VietnamPaymentResumeResult =
  | {
      status: "paid";
      receiptReference: string;
      screenshotPath?: string;
      diagnostics?: VietnamPaymentResumeDiagnostics;
    }
  | {
      status: "needs_human" | "declined" | "unavailable";
      reason: string;
      url: string;
      screenshotPath?: string;
      diagnostics?: VietnamPaymentResumeDiagnostics;
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

export const VIETNAM_SEARCH_CAPTCHA_TASK_OPTIONS = {
  case: false,
  numeric: 1,
  minLength: 6,
  maxLength: 6,
  comment: "Vietnam e-Visa search CAPTCHA. Enter exactly the six visible digits.",
} as const;

export function normalizeVietnamSearchCaptchaAnswer(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export function isVietnamSearchCaptchaAnswerUsable(value: string): boolean {
  return /^\d{6}$/.test(value);
}

class VietnamSearchCaptchaSolveError extends Error {
  constructor(
    message: string,
    readonly diagnostics: VietnamPaymentSearchCaptchaDiagnostic[],
  ) {
    super(message);
    this.name = "VietnamSearchCaptchaSolveError";
  }
}

const VIETNAM_SEARCH_CAPTCHA_REFRESH_SELECTORS = [
  'img[alt="reload" i]',
  'img[title*="reload" i]',
  'button[aria-label*="reload" i]',
  'button[title*="reload" i]',
  '[role="button"][aria-label*="reload" i]',
  '[role="button"][title*="reload" i]',
  'button:has(img[alt="reload" i])',
].join(", ");

/**
 * Refresh the CAPTCHA on the current Vue search page with a trusted browser
 * click, then prove that the challenge bitmap changed. The live portal uses a
 * standalone `img[alt="reload"]`; HTMLElement.click() does not reliably
 * trigger its Vue handler, which previously sent the same rejected challenge
 * to 2Captcha three times.
 */
export async function refreshVietnamSearchCaptchaChallenge(
  page: Page,
  previousFingerprint: string,
  timeoutMs = 10_000,
): Promise<"search_reload_control" | "shared_fallback" | null> {
  const deadline = Date.now() + Math.max(timeoutMs, 0);
  const remainingMs = () => Math.max(0, deadline - Date.now());
  await page.locator("#basic_captcha, input[name*='captcha' i], input[id*='captcha' i]")
    .first()
    .fill("")
    .catch(() => undefined);

  const reloadControls = page.locator(VIETNAM_SEARCH_CAPTCHA_REFRESH_SELECTORS);
  const count = Math.min(await reloadControls.count().catch(() => 0), 10);
  for (let index = 0; index < count && remainingMs() > 0; index += 1) {
    const control = reloadControls.nth(index);
    if (!(await control.isVisible({ timeout: Math.min(remainingMs(), 1_000) }).catch(() => false))) continue;
    const clicked = await control
      .click({ timeout: Math.max(1, Math.min(remainingMs(), 3_000)) })
      .then(() => true)
      .catch(() => false);
    if (!clicked) continue;
    if (await waitForVietnamCaptchaRefresh(page, previousFingerprint, Math.min(remainingMs(), 6_000))) {
      return "search_reload_control";
    }
  }

  if (remainingMs() <= 0) return null;
  const sharedConfirmed = await refreshVietnamCaptchaChallenge(page, remainingMs()).catch(() => false);
  return sharedConfirmed ? "shared_fallback" : null;
}

async function solveSearchCaptcha(
  page: Page,
  timeoutMs: number,
): Promise<VietnamPaymentSearchCaptchaDiagnostic[]> {
  const diagnostics: VietnamPaymentSearchCaptchaDiagnostic[] = [];
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
    if (!(await image.isVisible({ timeout: 3_000 }).catch(() => false))) return diagnostics;
    const capture = await captureVietnamCaptchaImage(image, Math.min(timeoutMs, 30_000));
    const challengeFingerprintPrefix = fingerprintVietnamCaptchaImage(capture.buffer).slice(0, 12);
    try {
      const solution = await solveImageCaptcha(
        capture.buffer,
        Math.min(timeoutMs, 120_000),
        VIETNAM_SEARCH_CAPTCHA_TASK_OPTIONS,
      );
      const captchaText = normalizeVietnamSearchCaptchaAnswer(solution.text);
      if (isVietnamSearchCaptchaAnswerUsable(captchaText)) {
        diagnostics.push({
          attempt,
          answerLength: captchaText.length,
          durationMs: solution.durationMs,
          challengeFingerprintPrefix,
          outcome: "solved",
        });
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
        return diagnostics;
      }

      const diagnostic: VietnamPaymentSearchCaptchaDiagnostic = {
        attempt,
        answerLength: captchaText.length,
        durationMs: solution.durationMs,
        challengeFingerprintPrefix,
        outcome: "unusable",
      };
      diagnostics.push(diagnostic);
      await reportBadCaptcha(solution.solveId).catch(() => undefined);
    } catch (error) {
      diagnostics.push({
        attempt,
        challengeFingerprintPrefix,
        outcome: "solver_error",
      });
      if (attempt === 3) {
        throw new VietnamSearchCaptchaSolveError(
          error instanceof Error ? error.message : String(error),
          diagnostics,
        );
      }
    }
    if (attempt < 3) {
      const previousFingerprint = fingerprintVietnamCaptchaImage(capture.buffer);
      const refreshStrategy = await refreshVietnamSearchCaptchaChallenge(
        page,
        previousFingerprint,
        10_000,
      ).catch(() => null);
      diagnostics[diagnostics.length - 1].refreshConfirmed = refreshStrategy !== null;
      if (refreshStrategy) diagnostics[diagnostics.length - 1].refreshStrategy = refreshStrategy;
      if (!refreshStrategy) {
        throw new VietnamSearchCaptchaSolveError(
          "Vietnam search CAPTCHA refresh was not confirmed; refusing to resend the stale challenge.",
          diagnostics,
        );
      }
      await page.waitForTimeout(1_000);
    }
  }
  throw new VietnamSearchCaptchaSolveError(
    "2captcha returned unusable Vietnam search CAPTCHA answers; expected exactly 6 digits.",
    diagnostics,
  );
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
}

const VIETNAM_PAYMENT_ACTION_LABELS = ["Payment", "Thanh toán", "支付", "支払い"] as const;
const VIETNAM_PAYMENT_ACTION_NAME = /^(?:Payment|Thanh toán|支付|支払い)$/i;
const VIETNAM_PAYMENT_CONFIRMATION_TEXT = /(?:Are you sure you want to pay for the selected applications\?|Bạn có chắc chắn thanh toán các hồ sơ đã chọn\?|您确定要为所选应用程序付费吗？|選択したアプリケーションの料金を支払いますか\?)/i;
const VIETNAM_CONFIRM_ACTION_NAME = /^(?:Confirm|Xác nhận|确认|確認)$/i;

function classifyVietnamPaymentRoute(page: Page): VietnamPaymentEntryDiagnostic["finalRoute"] {
  const currentUrl = page.url();
  if (/\/e-visa\/search(?:\/|$|\?)/i.test(currentUrl)) return "search";
  if (/\/e-visa\/foreigners\/[^/?]+/i.test(currentUrl)) return "applicant_detail";
  if (/\/thanh-toan-cqtc(?:\/|$|\?)/i.test(currentUrl)) return "payment_information";
  return "other";
}

function vietnamPaymentEntryTransitionVisible(page: Page): Promise<boolean> {
  return Promise.all([
    page.locator("body").innerText({ timeout: 1_000 }).catch(() => ""),
    Promise.resolve(page.url()),
  ]).then(([bodyText, currentUrl]) => (
    /payment[’']?s information|payment information|thông tin thanh toán|付款信息|支払い情報|amount paid \(usd\)|i agree to pay/i.test(bodyText) ||
    /\/thanh-toan-cqtc(?:\/|$|\?)/i.test(currentUrl) ||
    /\/e-visa\/foreigners\/[^/?]+/i.test(currentUrl)
  ));
}

function paymentActionLabel(text: string): VietnamPaymentEntryDiagnostic["matchedActionLabel"] {
  const normalized = text.trim();
  return VIETNAM_PAYMENT_ACTION_LABELS.find((label) => label.toLocaleLowerCase() === normalized.toLocaleLowerCase());
}

/**
 * Follows both official SPA handoffs. Individual applications navigate directly
 * to their detail route; organization applications open a confirmation modal
 * before /thanh-toan-cqtc. A click alone is never considered a transition.
 */
export async function followVietnamSearchPaymentEntry(
  page: Page,
  timeoutMs = 45_000,
): Promise<VietnamPaymentEntryDiagnostic> {
  const deadline = Date.now() + Math.max(500, timeoutMs);
  let sawDisabled = false;

  while (Date.now() < deadline) {
    if (await vietnamPaymentEntryTransitionVisible(page)) {
      return {
        outcome: "advanced",
        finalRoute: classifyVietnamPaymentRoute(page),
      };
    }

    const paymentAction = page.getByRole("button", { name: VIETNAM_PAYMENT_ACTION_NAME, exact: true }).first();
    if (await paymentAction.isVisible({ timeout: 500 }).catch(() => false)) {
      const label = paymentActionLabel(await paymentAction.innerText().catch(() => ""));
      if (!(await paymentAction.isEnabled({ timeout: 500 }).catch(() => false))) {
        sawDisabled = true;
        await page.waitForTimeout(250);
        continue;
      }

      await paymentAction.click({ timeout: Math.min(10_000, Math.max(500, deadline - Date.now())) });
      await page.waitForTimeout(250);
      if (await vietnamPaymentEntryTransitionVisible(page)) {
        return {
          outcome: "advanced",
          matchedActionLabel: label,
          finalRoute: classifyVietnamPaymentRoute(page),
        };
      }

      let confirmationObserved = false;
      while (Date.now() < deadline) {
        const confirmationText = page.getByText(VIETNAM_PAYMENT_CONFIRMATION_TEXT).first();
        confirmationObserved = await confirmationText.isVisible({ timeout: 500 }).catch(() => false);
        if (confirmationObserved) break;
        if (await vietnamPaymentEntryTransitionVisible(page)) {
          return {
            outcome: "advanced",
            matchedActionLabel: label,
            finalRoute: classifyVietnamPaymentRoute(page),
          };
        }
        await page.waitForTimeout(250);
      }
      if (!confirmationObserved) {
        return {
          outcome: "confirmation_missing",
          matchedActionLabel: label,
          confirmationObserved: false,
          finalRoute: classifyVietnamPaymentRoute(page),
        };
      }

      const visibleDialog = page.locator('[role="dialog"]:visible, .ant-modal:visible').filter({
        hasText: VIETNAM_PAYMENT_CONFIRMATION_TEXT,
      }).first();
      const scopedConfirm = visibleDialog.getByRole("button", { name: VIETNAM_CONFIRM_ACTION_NAME, exact: true }).first();
      const pageConfirm = page.getByRole("button", { name: VIETNAM_CONFIRM_ACTION_NAME, exact: true }).first();
      const confirmAction = await scopedConfirm.isVisible({ timeout: 500 }).catch(() => false)
        ? scopedConfirm
        : pageConfirm;
      if (!(await confirmAction.isVisible({ timeout: 1_500 }).catch(() => false)) ||
        !(await confirmAction.isEnabled({ timeout: 500 }).catch(() => false))) {
        return {
          outcome: "confirmation_missing",
          matchedActionLabel: label,
          confirmationObserved: true,
          finalRoute: classifyVietnamPaymentRoute(page),
        };
      }

      await confirmAction.click({ timeout: Math.min(10_000, Math.max(500, deadline - Date.now())) });
      while (Date.now() < deadline) {
        if (await vietnamPaymentEntryTransitionVisible(page)) {
          return {
            outcome: "advanced",
            matchedActionLabel: label,
            confirmationObserved: true,
            finalRoute: classifyVietnamPaymentRoute(page),
          };
        }
        await page.waitForTimeout(250);
      }
      return {
        outcome: "transition_failed",
        matchedActionLabel: label,
        confirmationObserved: true,
        finalRoute: classifyVietnamPaymentRoute(page),
      };
    }

    await page.waitForTimeout(250);
  }

  return {
    outcome: sawDisabled ? "disabled" : "not_found",
    finalRoute: classifyVietnamPaymentRoute(page),
  };
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

export async function advanceOfficialFormToPayment(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + Math.min(Math.max(timeoutMs, 1_000), 45_000);
  for (let attempt = 0; attempt < 12 && Date.now() < deadline; attempt += 1) {
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const currentUrl = page.url();
    if (/payment gateway|payment amount|card number|credit card|debit card|cvv|cvc|pay now|submit payment|transaction/i.test(bodyText) ||
      /\/(?:payment|pay|checkout|gateway)(?:\/|$|\?)/i.test(currentUrl)) {
      return;
    }
    if (/additional completed|electronic document code|bổ sung hoàn thành|电子文件代码|電子文書コード/i.test(bodyText)) {
      if (!(await clickVisibleButtonByText(page, ["Confirm", "Xác nhận", "确认", "確認", "OK"]))) {
        throw new Error("Could not confirm the Vietnam additional-completed dialog.");
      }
      continue;
    }
    if (/payment’s information|payment's information|amount paid \(usd\)|i agree to pay|tôi đồng ý thanh toán|我同意支付|支払いに同意する/i.test(bodyText)) {
      await clickVisibleTextOrCheckbox(page, [
        "I agree to pay",
        "Tôi đồng ý thanh toán",
        "我同意支付",
        "支払いに同意する",
      ]);
      if (!(await clickVisibleButtonByText(page, [
        "Payment",
        "Pay",
        "Continue",
        "Thanh toán",
        "Tiếp tục",
        "支付",
        "继续",
        "支払い",
        "続行",
      ]))) {
        throw new Error("Could not click the Vietnam official payment confirmation button.");
      }
      continue;
    }
    if (/review application form|xem lại hồ sơ|审查申请表|申請フォームを確認する/i.test(bodyText)) {
      const reviewCaptcha = await solveVietnamImageCaptcha(page, timeoutMs);
      if (!reviewCaptcha.solved) {
        throw new Error(reviewCaptcha.reason ?? "Could not solve the Vietnam review CAPTCHA.");
      }
      if (!(await clickVisibleButtonByText(page, [
        "Next",
        "Continue",
        "Payment",
        "Tiếp tục",
        "Thanh toán",
        "下一步",
        "继续",
        "支付",
        "次へ",
        "続行",
        "支払い",
      ]))) {
        throw new Error("Could not advance from Vietnam review page to payment.");
      }
      continue;
    }
    if (/viet nam e-visa application form|fill out the application form|khai thông tin đề nghị|填写申请表|申請フォームを記入する/i.test(bodyText)) {
      if (!(await clickVisibleButtonByText(page, [
        "Next",
        "Continue",
        "Tiếp tục",
        "下一步",
        "继续",
        "次へ",
        "続行",
      ]))) {
        throw new Error("Could not advance from Vietnam application form to review.");
      }
      continue;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("The official Vietnam application detail did not expose an expected review or payment step after the handoff.");
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
  const diagnostics: VietnamPaymentResumeDiagnostics = {};
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
    diagnostics.searchCaptchaAttempts = await solveSearchCaptcha(page, input.timeoutMs ?? 120_000);
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

    diagnostics.paymentEntry = await followVietnamSearchPaymentEntry(
      page,
      Math.min(input.timeoutMs ?? 120_000, 45_000),
    );
    if (diagnostics.paymentEntry.outcome !== "advanced") {
      const reasonByOutcome: Record<VietnamPaymentEntryDiagnostic["outcome"], string> = {
        advanced: "",
        not_found: "The official Vietnam search result did not expose a payment entry before the bounded wait expired.",
        disabled: "The official Vietnam search result exposed a disabled payment entry.",
        confirmation_missing: "The official Vietnam payment action did not expose its confirmation dialog.",
        transition_failed: "The official Vietnam payment confirmation did not advance to the payment information page.",
      };
      return {
        status: "unavailable",
        reason: reasonByOutcome[diagnostics.paymentEntry.outcome],
        url: page.url(),
        diagnostics,
      };
    }
    await advanceOfficialFormToPayment(page, input.timeoutMs ?? 120_000);

    const payment = await payVietnamPortalWithFixedCard({
      page,
      card,
      contactEmail: input.email,
    });
    return { ...mapPaymentResult(payment, page), diagnostics };
  } catch (error) {
    if (error instanceof VietnamSearchCaptchaSolveError) {
      diagnostics.searchCaptchaAttempts = error.diagnostics;
    }
    return {
      status: "needs_human",
      reason: error instanceof Error ? error.message : String(error),
      url: page?.url() ?? input.searchUrl ?? DEFAULT_SEARCH_URL,
      diagnostics,
    };
  } finally {
    if (input.screenshotPath && page) {
      await page.screenshot({ path: input.screenshotPath, fullPage: true }).catch(() => undefined);
    }
    await browser.close().catch(() => undefined);
  }
}
