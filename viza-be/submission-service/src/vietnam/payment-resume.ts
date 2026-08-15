import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import {
  reportBadCaptcha,
  reportGoodCaptcha,
  solveImageCaptcha,
  TwoCaptchaApiError,
  TwoCaptchaConfigError,
  TwoCaptchaNetworkError,
  TwoCaptchaSolveTimeoutError,
  TwoCaptchaZeroBalanceError,
} from "../captcha";
import {
  advanceVietnamPortalToCardEntry,
  loadVietnamFixedCardFromEnv,
  payVietnamPortalWithFixedCard,
  verifyVietnamOfficialFeeText,
  type VietnamFixedCard,
  type VietnamFixedCardPaymentResult,
} from "./fixed-card-payment";
import {
  captureVietnamCaptchaImage,
  captureVietnamCaptchaFingerprint,
  fingerprintVietnamCaptchaImage,
  hasVisibleVietnamCaptchaChallenge,
  refreshVietnamCaptchaChallenge,
  solveVietnamImageCaptcha,
} from "./captcha";
import { toVietnamDob } from "./status-check";

export interface VietnamPaymentSearchCaptchaDiagnostic {
  attempt: number;
  contextAttempt?: number;
  answerLength?: number;
  durationMs?: number;
  challengeFingerprintPrefix?: string;
  outcome: "solved" | "unusable" | "solver_error" | "stale_challenge" | "refresh_unconfirmed" | "image_unavailable" | "input_unconfirmed" | "rejected";
  refreshConfirmed?: boolean;
  refreshStrategy?: "search_reload_control" | "shared_fallback";
  freshContextRetry?: boolean;
  solverErrorKind?: "unsolvable" | "network" | "timeout" | "configuration" | "balance" | "api" | "unknown";
  sameChallengeRetry?: boolean;
}

export interface VietnamPaymentResumeDiagnostics {
  searchCaptchaAttempts?: VietnamPaymentSearchCaptchaDiagnostic[];
  paymentEntry?: VietnamPaymentEntryDiagnostic;
}

export type VietnamSearchSubmissionOutcome = "accepted" | "captcha_rejected" | "unconfirmed";

export function shouldRefreshVietnamSearchCaptchaBeforeFirstSolve(
  _contextAttempt: number,
): boolean {
  // The first stable challenge in a fresh payment-search run has not been
  // rejected yet and is safe to solve.  Production telemetry showed that the
  // portal can reuse this bitmap across fresh contexts while its reload
  // control is temporarily a no-op.  Requiring an eager reload therefore
  // prevented the first 2Captcha request from ever happening.  Once a
  // fingerprint has been attempted, knownChallengeFingerprints below still
  // requires a proven rotation before it can be sent to the solver again.
  return false;
}

interface VietnamSearchCaptchaSolveSuccess {
  diagnostics: VietnamPaymentSearchCaptchaDiagnostic[];
  solveId?: string;
  challengeFingerprint?: string;
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
      status: "needs_human" | "declined" | "unavailable" | "review_required";
      reason: string;
      url: string;
      screenshotPath?: string;
      diagnostics?: VietnamPaymentResumeDiagnostics;
    }
  | {
      status: "card_entry_ready";
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
  stopBeforeCardEntry?: boolean;
  takeCard?: () => Promise<VietnamFixedCard | null>;
  expectedPaymentAmountCents?: number | null;
  expectedPaymentCurrency?: string | null;
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
        if (await locateLoadedVietnamSearchCaptchaImage(page)) return true;
        // The SPA mounts its fields before the CAPTCHA API response. Do not
        // classify the page ready while the browser still shows alt text.
        break;
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

export interface FreshVietnamCaptchaContextRetryOptions<T, TResult> {
  attempts: number;
  openContext: (attempt: number) => Promise<T>;
  runContext: (context: T, attempt: number) => Promise<TResult>;
  closeContext: (context: T) => Promise<void>;
  shouldRetry: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => Promise<void> | void;
}

/**
 * Re-run the complete official search in a new browser context after a stale
 * or unrefreshable CAPTCHA. A failed challenge is never solved again in the
 * same context, and the previous page is closed before the next one opens.
 */
export async function retryVietnamSearchCaptchaInFreshContexts<T, TResult>(
  options: FreshVietnamCaptchaContextRetryOptions<T, TResult>,
): Promise<{ context: T; result: TResult }> {
  const attempts = Math.max(1, options.attempts);
  let context: T | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (context) {
      await options.closeContext(context).catch(() => undefined);
      context = null;
    }
    context = await options.openContext(attempt);
    try {
      const result = await options.runContext(context, attempt);
      return { context, result };
    } catch (error) {
      if (attempt >= attempts || !options.shouldRetry(error, attempt)) throw error;
      await options.onRetry?.(error, attempt);
    }
  }

  throw new Error("Vietnam search CAPTCHA fresh-context retries were exhausted.");
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
  deadlineAt = Date.now() + (input.timeoutMs ?? 60_000),
): Promise<FreshVietnamSearchPageRetryResult<Page>> {
  const searchUrl = input.searchUrl ?? DEFAULT_SEARCH_URL;
  const attempts = Math.max(1, Math.min(Number(process.env.VN_PAYMENT_SEARCH_LOAD_ATTEMPTS ?? 5), 5));
  const criticalAssetFailures = new WeakMap<Page, Set<string>>();

  return retryFreshVietnamSearchPage<Page>({
    attempts,
    openPage: async () => {
      const remainingMs = Math.max(1, deadlineAt - Date.now());
      if (remainingMs <= 1) throw new Error("Vietnam payment search page deadline was exhausted.");
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
      // Do not add Cache-Control/Pragma globally. The SPA fetches its CAPTCHA
      // from api.evisa.gov.vn; non-simple custom headers force a CORS preflight
      // that the public API does not consistently accept, leaving only a
      // broken <img> placeholder. Fresh contexts and blocked service workers
      // already give each bounded retry a clean module graph.
      try {
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: Math.min(input.timeoutMs ?? 60_000, remainingMs),
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
        Math.max(1, Math.min(input.timeoutMs ?? 60_000, deadlineAt - Date.now())),
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
      const delayMs = Math.min(2_000 * (attempt - 1), Math.max(0, deadlineAt - Date.now()));
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
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
  // 2Captcha's numeric workers can enter visually identical full-width digits
  // from an East Asian input method.  The official portal accepts only ASCII
  // digits, so normalize compatibility forms before enforcing the exact
  // six-digit contract.  Do not guess letters such as O/I/S as digits.
  return value.normalize("NFKC").replace(/\s+/g, "").trim();
}

export function isVietnamSearchCaptchaAnswerUsable(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function registerVietnamSearchCaptchaChallenge(
  knownFingerprints: Set<string>,
  fingerprint: string,
): boolean {
  if (knownFingerprints.has(fingerprint)) return false;
  knownFingerprints.add(fingerprint);
  return true;
}

function classifyVietnamSearchCaptchaSolverError(error: unknown): {
  kind: NonNullable<VietnamPaymentSearchCaptchaDiagnostic["solverErrorKind"]>;
  retrySameChallenge: boolean;
} {
  if (error instanceof TwoCaptchaConfigError) {
    return { kind: "configuration", retrySameChallenge: false };
  }
  if (error instanceof TwoCaptchaZeroBalanceError) {
    return { kind: "balance", retrySameChallenge: false };
  }
  if (error instanceof TwoCaptchaNetworkError) {
    return { kind: "network", retrySameChallenge: true };
  }
  if (error instanceof TwoCaptchaSolveTimeoutError) {
    return { kind: "timeout", retrySameChallenge: true };
  }
  if (error instanceof TwoCaptchaApiError) {
    return {
      kind: error.apiErrorCode === "ERROR_CAPTCHA_UNSOLVABLE" || error.apiErrorCode === "ERROR_BAD_DUPLICATES"
        ? "unsolvable"
        : "api",
      retrySameChallenge:
        error.apiErrorCode === "ERROR_CAPTCHA_UNSOLVABLE" || error.apiErrorCode === "ERROR_BAD_DUPLICATES",
    };
  }
  return { kind: "unknown", retrySameChallenge: false };
}

class VietnamSearchCaptchaSolveError extends Error {
  constructor(
    message: string,
    readonly diagnostics: VietnamPaymentSearchCaptchaDiagnostic[],
    readonly retryWithFreshContext = false,
  ) {
    super(message);
    this.name = "VietnamSearchCaptchaSolveError";
  }
}

class VietnamSearchPageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VietnamSearchPageUnavailableError";
  }
}

function readBoundedPositiveInteger(name: string, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(process.env[name]?.trim() ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

const VIETNAM_SEARCH_CAPTCHA_REFRESH_SELECTORS = [
  'form img[alt="reload" i]',
  'img[alt="reload" i]',
  'img[title*="reload" i]',
  'button[aria-label*="reload" i]',
  'button[title*="reload" i]',
  '[role="button"][aria-label*="reload" i]',
  '[role="button"][title*="reload" i]',
  'button:has(img[alt="reload" i])',
].join(", ");

const VIETNAM_SEARCH_CAPTCHA_IMAGE_SELECTORS = [
  "img.captcha",
  'img[alt*="Identify" i]',
  'img[src*="captcha" i]',
  'img[src*="capcha" i]',
  'img[alt*="captcha" i]',
  'img[id*="captcha" i]',
  ".captcha img",
  "canvas",
].join(", ");

interface StableVietnamSearchCaptchaCapture {
  buffer: Buffer;
  fingerprint: string;
}

async function locateLoadedVietnamSearchCaptchaImage(page: Page): Promise<Locator | null> {
  const candidates = page.locator(VIETNAM_SEARCH_CAPTCHA_IMAGE_SELECTORS);
  const count = Math.min(await candidates.count().catch(() => 0), 20);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const visible = await candidate.isVisible({ timeout: 250 }).catch(() => false);
    if (!visible) continue;
    const loaded = await candidate
      .evaluate((element) => {
        if (element instanceof HTMLImageElement) {
          return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
        }
        if (element instanceof HTMLCanvasElement) {
          return element.width > 0 && element.height > 0;
        }
        return false;
      })
      .catch(() => false);
    if (loaded) return candidate;
  }
  return null;
}

/**
 * The search SPA replaces its CAPTCHA image while mounting and after reload.
 * Treat a challenge as current only after two consecutive captures agree, and
 * re-resolve the locator for every sample so a Vue node replacement cannot
 * leave the worker observing a detached or superseded image.
 */
async function captureStableVietnamSearchCaptcha(
  page: Page,
  timeoutMs: number,
  excludedFingerprint?: string,
): Promise<StableVietnamSearchCaptchaCapture | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let candidateFingerprint: string | null = null;
  let candidateBuffer: Buffer | null = null;
  let matchingSamples = 0;
  do {
    const remainingMs = Math.max(0, deadline - Date.now());
    const image = await locateLoadedVietnamSearchCaptchaImage(page);
    if (image) {
      const capture = await captureVietnamCaptchaImage(
        image,
        Math.max(1, Math.min(remainingMs, 2_000)),
      ).catch(() => null);
      if (capture) {
        const fingerprint = fingerprintVietnamCaptchaImage(capture.buffer);
        if (fingerprint !== excludedFingerprint) {
          if (candidateFingerprint === fingerprint) {
            matchingSamples += 1;
          } else {
            candidateFingerprint = fingerprint;
            candidateBuffer = capture.buffer;
            matchingSamples = 1;
          }
          if (matchingSamples >= 2 && candidateBuffer) {
            return { buffer: candidateBuffer, fingerprint };
          }
        } else {
          candidateFingerprint = null;
          candidateBuffer = null;
          matchingSamples = 0;
        }
      }
    }
    if (Date.now() < deadline) await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return null;
}

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

  const clickAndConfirm = async (
    control: Locator,
    dispatch: "trusted" | "vue_event_fallback",
  ): Promise<boolean> => {
    const responseWaitMs = Math.max(1, Math.min(remainingMs(), 3_000));
    const captchaResponse = page.waitForResponse(
      (response) => {
        try {
          const url = new URL(response.url());
          return response.request().method() === "GET"
            && url.hostname === "api.evisa.gov.vn"
            && url.pathname.endsWith("/authorization-service/captcha/generate")
            && response.ok();
        } catch {
          return false;
        }
      },
      { timeout: responseWaitMs },
    ).then(() => true).catch(() => false);
    const clicked = dispatch === "trusted"
      ? await control
        .click({ timeout: Math.max(1, Math.min(remainingMs(), 2_000)) })
        .then(() => true)
        .catch(() => false)
      : await control
        .evaluate((element) => {
          if (!(element instanceof HTMLElement)) return false;
          element.click();
          return true;
        })
        .catch(() => false);
    if (!clicked) return false;

    // Accept either an inline challenge rotation or the official API response
    // as the first synchronization signal.  After the API answers, keep the
    // rest of the caller's bounded deadline available for Vue to replace and
    // paint the image.  The previous fixed 1.6 second bitmap window routinely
    // expired on Fly before the successful API response reached the SPA.
    const firstSignal = await Promise.race([
      captchaResponse.then((responseObserved) => ({ kind: "response", responseObserved } as const)),
      captureStableVietnamSearchCaptcha(
        page,
        Math.max(1, Math.min(remainingMs(), 2_600)),
        previousFingerprint,
      ).then((changed) => ({ kind: "capture", changed } as const)),
    ]);
    if (firstSignal.kind === "capture" && firstSignal.changed) return true;
    const responseObserved = firstSignal.kind === "response"
      ? firstSignal.responseObserved
      : await captchaResponse;
    if (!responseObserved) return false;

    const changedAfterResponse = await captureStableVietnamSearchCaptcha(
      page,
      Math.max(1, remainingMs()),
      previousFingerprint,
    );
    return changedAfterResponse !== null;
  };

  // The live portal occasionally accepts the trusted reload click without
  // rotating the bitmap (typically while the Vue request is still settling).
  // Re-resolve and retry the same annotated control a small number of times;
  // the old control-index loop clicked a page with one reload image only once.
  const resolveReloadControls = async (): Promise<Locator> => {
    const scopedReloadControls = page
      .locator("#basic_captcha")
      .locator("xpath=ancestor::form[1]")
      .locator('img[alt="reload" i]');
    return await scopedReloadControls.count().catch(() => 0) > 0
      ? scopedReloadControls
      : page.locator(VIETNAM_SEARCH_CAPTCHA_REFRESH_SELECTORS);
  };

  // Give a real pointer click two chances before the DOM fallback. Doing the
  // synthetic click immediately after every no-op consumed the entire refresh
  // budget and prevented the second trusted click that the live Vue control
  // sometimes needs while mounting.
  for (let clickAttempt = 1; clickAttempt <= 2 && remainingMs() > 0; clickAttempt += 1) {
    const reloadControls = await resolveReloadControls();
    const count = Math.min(await reloadControls.count().catch(() => 0), 10);
    for (let index = 0; index < count && remainingMs() > 0; index += 1) {
      const control = reloadControls.nth(index);
      if (!(await control.isVisible({ timeout: Math.min(remainingMs(), 750) }).catch(() => false))) continue;
      if (await clickAndConfirm(control, "trusted")) return "search_reload_control";
    }
  }

  // The official Vue bundle binds a plain onClick handler to the reload image.
  // On some headless Fly sessions both pointer clicks land without dispatching
  // that handler. A DOM click is a safe, scoped final fallback; success still
  // requires the official API response and a new stable bitmap.
  const fallbackControls = await resolveReloadControls();
  const fallbackCount = Math.min(await fallbackControls.count().catch(() => 0), 10);
  for (let index = 0; index < fallbackCount && remainingMs() > 0; index += 1) {
    const control = fallbackControls.nth(index);
    if (!(await control.isVisible({ timeout: Math.min(remainingMs(), 750) }).catch(() => false))) continue;
    if (await clickAndConfirm(control, "vue_event_fallback")) return "search_reload_control";
  }

  // A Fly-to-official API response can arrive after the per-click response
  // observer expires. Keep a final bounded bitmap watch after all scoped
  // clicks so a successful late Vue repaint is not classified as stale. This
  // preserves the second trusted/synthetic click fallbacks instead of letting
  // the first slow click consume the entire refresh budget.
  if (remainingMs() > 0) {
    const lateChanged = await captureStableVietnamSearchCaptcha(
      page,
      Math.max(1, Math.min(remainingMs(), 2_500)),
      previousFingerprint,
    );
    if (lateChanged) return "search_reload_control";
  }

  if (remainingMs() <= 0) return null;
  const sharedConfirmed = await refreshVietnamCaptchaChallenge(page, remainingMs()).catch(() => false);
  return sharedConfirmed ? "shared_fallback" : null;
}

export async function solveVietnamPaymentSearchCaptcha(
  page: Page,
  timeoutMs: number,
  options: {
    attemptOffset?: number;
    contextAttempt?: number;
    maxAttempts?: number;
    knownChallengeFingerprints?: Set<string>;
    refreshInitialChallenge?: boolean;
    deadlineAt?: number;
    solveCaptcha?: typeof solveImageCaptcha;
    reportBad?: typeof reportBadCaptcha;
  } = {},
): Promise<VietnamSearchCaptchaSolveSuccess> {
  const diagnostics: VietnamPaymentSearchCaptchaDiagnostic[] = [];
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 3));
  const deadlineAt = options.deadlineAt ?? Date.now() + timeoutMs;
  const remainingMs = () => Math.max(0, deadlineAt - Date.now());
  const solveCaptcha = options.solveCaptcha ?? solveImageCaptcha;
  const reportBad = options.reportBad ?? reportBadCaptcha;
  for (let localAttempt = 1; localAttempt <= maxAttempts; localAttempt += 1) {
    if (remainingMs() <= 0) {
      throw new VietnamSearchCaptchaSolveError(
        "Vietnam search CAPTCHA deadline was exhausted.",
        diagnostics,
        false,
      );
    }
    const attempt = (options.attemptOffset ?? 0) + localAttempt;
    let stableCapture = await captureStableVietnamSearchCaptcha(
      page,
      Math.min(5_000, remainingMs()),
    );
    if (!stableCapture) {
      if (remainingMs() <= 0) {
        throw new VietnamSearchCaptchaSolveError(
          "Vietnam search CAPTCHA deadline was exhausted while waiting for a stable challenge.",
          diagnostics,
          false,
        );
      }
      diagnostics.push({
        attempt,
        contextAttempt: options.contextAttempt,
        outcome: "image_unavailable",
        freshContextRetry: true,
      });
      throw new VietnamSearchCaptchaSolveError(
        "The official Vietnam search CAPTCHA image did not load; refusing to solve a placeholder.",
        diagnostics,
        true,
      );
    }
    let capture = { buffer: stableCapture.buffer };
    let challengeFingerprint = stableCapture.fingerprint;
    let challengeFingerprintPrefix = challengeFingerprint.slice(0, 12);
    let preSolveRefreshStrategy: "search_reload_control" | "shared_fallback" | null = null;
    if (localAttempt === 1 && options.refreshInitialChallenge) {
      preSolveRefreshStrategy = await refreshVietnamSearchCaptchaChallenge(
        page,
        challengeFingerprint,
        Math.max(1, Math.min(10_000, remainingMs())),
      ).catch(() => null);
      if (!preSolveRefreshStrategy) {
        diagnostics.push({
          attempt,
          contextAttempt: options.contextAttempt,
          challengeFingerprintPrefix,
          outcome: "refresh_unconfirmed",
          refreshConfirmed: false,
        });
        throw new VietnamSearchCaptchaSolveError(
          "The initial Vietnam search CAPTCHA refresh was not confirmed.",
          diagnostics,
          true,
        );
      }
      stableCapture = await captureStableVietnamSearchCaptcha(
        page,
        Math.max(1, Math.min(remainingMs(), 5_000)),
        challengeFingerprint,
      );
      if (!stableCapture) {
        diagnostics.push({
          attempt,
          contextAttempt: options.contextAttempt,
          challengeFingerprintPrefix,
          outcome: "refresh_unconfirmed",
          refreshConfirmed: false,
        });
        throw new VietnamSearchCaptchaSolveError(
          "The refreshed Vietnam search CAPTCHA did not become stable.",
          diagnostics,
          true,
        );
      }
      capture = { buffer: stableCapture.buffer };
      challengeFingerprint = stableCapture.fingerprint;
      challengeFingerprintPrefix = challengeFingerprint.slice(0, 12);
    }
    if (options.knownChallengeFingerprints?.has(challengeFingerprint)) {
      const refreshAttempts = Math.min(2, Math.max(0, maxAttempts));
      for (let refreshAttempt = 1; refreshAttempt <= refreshAttempts && remainingMs() > 0; refreshAttempt += 1) {
        preSolveRefreshStrategy = await refreshVietnamSearchCaptchaChallenge(
          page,
          challengeFingerprint,
          Math.max(1, Math.min(10_000, remainingMs())),
        ).catch(() => null);
        if (!preSolveRefreshStrategy) break;

        stableCapture = await captureStableVietnamSearchCaptcha(
          page,
          Math.max(1, Math.min(remainingMs(), 5_000)),
          challengeFingerprint,
        );
        if (!stableCapture) break;
        capture = { buffer: stableCapture.buffer };
        challengeFingerprint = stableCapture.fingerprint;
        challengeFingerprintPrefix = challengeFingerprint.slice(0, 12);
        if (!options.knownChallengeFingerprints.has(challengeFingerprint)) break;
      }
    }
    if (
      options.knownChallengeFingerprints &&
      !registerVietnamSearchCaptchaChallenge(options.knownChallengeFingerprints, challengeFingerprint)
    ) {
      diagnostics.push({
        attempt,
        contextAttempt: options.contextAttempt,
        challengeFingerprintPrefix,
        outcome: "stale_challenge",
        refreshConfirmed: preSolveRefreshStrategy !== null,
        ...(preSolveRefreshStrategy ? { refreshStrategy: preSolveRefreshStrategy } : {}),
      });
      throw new VietnamSearchCaptchaSolveError(
        "The Vietnam search CAPTCHA remained previously rejected after a bounded reload attempt.",
        diagnostics,
        true,
      );
    }
    try {
      const solution = await solveCaptcha(
        capture.buffer,
        Math.max(1, Math.min(remainingMs(), 120_000)),
        VIETNAM_SEARCH_CAPTCHA_TASK_OPTIONS,
      );
      if (remainingMs() <= 0) {
        throw new VietnamSearchCaptchaSolveError(
          "Vietnam search CAPTCHA deadline was exhausted while waiting for 2captcha.",
          diagnostics,
          false,
        );
      }
      const captchaText = normalizeVietnamSearchCaptchaAnswer(solution.text);
      if (isVietnamSearchCaptchaAnswerUsable(captchaText)) {
        const currentCapture = await captureStableVietnamSearchCaptcha(
          page,
          Math.max(1, Math.min(remainingMs(), 5_000)),
        );
        const currentFingerprint = currentCapture?.fingerprint ?? null;
        if (!currentFingerprint || currentFingerprint !== challengeFingerprint) {
          diagnostics.push({
            attempt,
            contextAttempt: options.contextAttempt,
            answerLength: captchaText.length,
            durationMs: solution.durationMs,
            challengeFingerprintPrefix,
            outcome: "stale_challenge",
            refreshConfirmed: false,
          });
          throw new VietnamSearchCaptchaSolveError(
            "The Vietnam search CAPTCHA changed while 2captcha was solving it.",
            diagnostics,
            true,
          );
        }
        const solvedDiagnostic: VietnamPaymentSearchCaptchaDiagnostic = {
          attempt,
          contextAttempt: options.contextAttempt,
          answerLength: captchaText.length,
          durationMs: solution.durationMs,
          challengeFingerprintPrefix,
          outcome: "solved",
          ...(preSolveRefreshStrategy
            ? { refreshConfirmed: true, refreshStrategy: preSolveRefreshStrategy }
            : {}),
        };
        const captchaInput = page.locator([
          "#basic_captcha",
          "#_tracuuthongtinTTDT_WAR_eVisaportlet_captchaText",
          'input[name*="captcha" i]',
          'input[id*="captcha" i]',
          'input[placeholder*="captcha" i]',
          'input[placeholder*="security" i]',
        ].join(", ")).first();
        const inputConfirmed = await captchaInput
          .fill(captchaText, { timeout: Math.max(1, Math.min(10_000, remainingMs())) })
          .then(async () => {
            await setInputValue(captchaInput, captchaText);
            const value = await captchaInput.inputValue({
              timeout: Math.max(1, Math.min(3_000, remainingMs())),
            });
            return normalizeVietnamSearchCaptchaAnswer(value) === captchaText;
          })
          .catch(() => false);
        if (!inputConfirmed) {
          diagnostics.push({ ...solvedDiagnostic, outcome: "input_unconfirmed" });
          throw new VietnamSearchCaptchaSolveError(
            "The Vietnam search CAPTCHA input was redrawn before its value could be confirmed.",
            diagnostics,
            true,
          );
        }
        diagnostics.push(solvedDiagnostic);
        return { diagnostics, solveId: solution.solveId, challengeFingerprint };
      }

      const diagnostic: VietnamPaymentSearchCaptchaDiagnostic = {
        attempt,
        contextAttempt: options.contextAttempt,
        answerLength: captchaText.length,
        durationMs: solution.durationMs,
        challengeFingerprintPrefix,
        outcome: "unusable",
        ...(preSolveRefreshStrategy
          ? { refreshConfirmed: true, refreshStrategy: preSolveRefreshStrategy }
          : {}),
      };
      diagnostics.push(diagnostic);
      await reportBad(solution.solveId).catch(() => undefined);
      // A structurally unusable provider answer was never entered into the
      // official portal, so the challenge has not been rejected. Release this
      // fingerprint for another bounded solver request instead of depending
      // on the portal's occasionally no-op refresh control.
      options.knownChallengeFingerprints?.delete(challengeFingerprint);
      diagnostic.sameChallengeRetry = localAttempt < maxAttempts && remainingMs() > 0;
      if (diagnostic.sameChallengeRetry) {
        const retryDelayMs = Math.max(0, Math.min(1_500 * localAttempt, remainingMs()));
        if (retryDelayMs > 0) await page.waitForTimeout(retryDelayMs);
        continue;
      }
    } catch (error) {
      if (error instanceof VietnamSearchCaptchaSolveError) throw error;
      const solverFailure = classifyVietnamSearchCaptchaSolverError(error);
      const canRetrySameChallenge = solverFailure.retrySameChallenge && remainingMs() > 0;
      diagnostics.push({
        attempt,
        contextAttempt: options.contextAttempt,
        challengeFingerprintPrefix,
        outcome: "solver_error",
        solverErrorKind: solverFailure.kind,
        sameChallengeRetry: canRetrySameChallenge,
        ...(preSolveRefreshStrategy
          ? { refreshConfirmed: true, refreshStrategy: preSolveRefreshStrategy }
          : {}),
      });
      if (!canRetrySameChallenge) {
        throw new VietnamSearchCaptchaSolveError(
          error instanceof Error ? error.message : String(error),
          diagnostics,
          false,
        );
      }
      // The provider did not produce an answer, so nothing was entered into or
      // rejected by the official portal. Release this fingerprint for one of
      // the remaining bounded solver attempts. Once an answer exists, the
      // unusable/rejected/stale branches keep the fingerprint registered and
      // still require a proven official challenge rotation.
      options.knownChallengeFingerprints?.delete(challengeFingerprint);
      if (localAttempt === maxAttempts) {
        throw new VietnamSearchCaptchaSolveError(
          error instanceof Error ? error.message : String(error),
          diagnostics,
          true,
        );
      }
      const retryDelayMs = Math.max(0, Math.min(1_500 * localAttempt, remainingMs()));
      if (retryDelayMs > 0) await page.waitForTimeout(retryDelayMs);
      continue;
    }
    if (localAttempt < maxAttempts) {
      const refreshStrategy = await refreshVietnamSearchCaptchaChallenge(
        page,
        challengeFingerprint,
        Math.max(1, Math.min(10_000, remainingMs())),
      ).catch(() => null);
      diagnostics[diagnostics.length - 1].refreshConfirmed = refreshStrategy !== null;
      if (refreshStrategy) diagnostics[diagnostics.length - 1].refreshStrategy = refreshStrategy;
      if (!refreshStrategy) {
        throw new VietnamSearchCaptchaSolveError(
          "Vietnam search CAPTCHA refresh was not confirmed; refusing to resend the stale challenge.",
          diagnostics,
          true,
        );
      }
      await page.waitForTimeout(1_000);
    }
  }
  throw new VietnamSearchCaptchaSolveError(
    "2captcha returned unusable Vietnam search CAPTCHA answers; expected exactly 6 digits.",
    diagnostics,
    true,
  );
}

const VIETNAM_SEARCH_CAPTCHA_REJECTION_PATTERN =
  /(?:captcha|security code|mã xác nhận|ma xac nhan|mã bảo mật|ma bao mat).{0,80}(?:invalid|incorrect|wrong|required|not correct|không đúng|khong dung|không chính xác|错误|无效|不正确|正しくない|無効)|(?:invalid|incorrect|wrong|required|not correct|không đúng|khong dung|không chính xác|错误|无效|不正确|正しくない|無効).{0,80}(?:captcha|security code|mã xác nhận|ma xac nhan|mã bảo mật|ma bao mat)/i;

export async function waitForVietnamSearchSubmissionOutcome(
  page: Page,
  submittedChallengeFingerprint: string | undefined,
  timeoutMs: number,
): Promise<VietnamSearchSubmissionOutcome> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let challengeChangedAt: number | null = null;
  do {
    const currentUrl = page.url();
    if (/\/e-visa\/foreigners\/[^/?]+|\/thanh-toan-cqtc(?:\/|$|\?)/i.test(currentUrl)) {
      return "accepted";
    }
    const paymentAction = page.getByRole("button", { name: VIETNAM_PAYMENT_ACTION_NAME, exact: true }).first();
    if (await paymentAction.isVisible({ timeout: 250 }).catch(() => false)) return "accepted";
    const resultRows = await page.locator(".ant-table-row:visible, table:visible tbody tr:visible")
      .count()
      .catch(() => 0);
    if (resultRows > 0) return "accepted";

    const bodyText = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
    if (/no results?(?: were)? found|không tìm thấy|khong tim thay/i.test(bodyText)) return "accepted";
    const captchaErrorText = await page.locator([
      "#basic_captcha",
      "input[name*='captcha' i]",
      "input[id*='captcha' i]",
    ].join(", ")).first().locator("xpath=ancestor::*[contains(@class, 'ant-form-item')][1]")
      .innerText({ timeout: 500 })
      .catch(() => "");
    const visibleErrorText = await page.locator(".ant-form-item-explain-error:visible, .ant-message-error:visible")
      .allInnerTexts()
      .then((texts) => texts.join(" "))
      .catch(() => "");
    if (VIETNAM_SEARCH_CAPTCHA_REJECTION_PATTERN.test(`${captchaErrorText} ${visibleErrorText}`)) {
      return "captcha_rejected";
    }

    if (submittedChallengeFingerprint) {
      const currentFingerprint = await captureVietnamCaptchaFingerprint(page, 250).catch(() => null);
      if (currentFingerprint && currentFingerprint !== submittedChallengeFingerprint) {
        challengeChangedAt ??= Date.now();
      }
    }
    // A changed challenge without an explicit validation message is not proof
    // that the solver was wrong: the portal may rotate CAPTCHA after a valid
    // lookup before Vue finishes rendering its result. Give the result UI a
    // short grace, then retry in a fresh context without penalizing 2captcha.
    if (challengeChangedAt && Date.now() - challengeChangedAt >= 3_000) return "unconfirmed";
    if (Date.now() < deadline) await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return "unconfirmed";
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
    const activeStepText = await page
      .locator(".ant-steps-item-process, .ant-steps-item-active")
      .first()
      .innerText({ timeout: 1_000 })
      .catch(() => "");
    const onApplicationStep = /fill out the application form|khai thông tin đề nghị|填写申请表|申請フォームを記入する/i.test(
      activeStepText || bodyText,
    );
    const onReviewStep = /review application form|xem lại hồ sơ|审查申请表|申請フォームを確認する/i.test(
      activeStepText,
    );
    if (onApplicationStep && !onReviewStep) {
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
    if (onReviewStep || /review application form|xem lại hồ sơ|审查申请表|申請フォームを確認する/i.test(bodyText)) {
      if (await hasVisibleVietnamCaptchaChallenge(page)) {
        const reviewCaptcha = await solveVietnamImageCaptcha(page, timeoutMs);
        if (!reviewCaptcha.solved) {
          throw new Error(reviewCaptcha.reason ?? "Could not solve the Vietnam review CAPTCHA.");
        }
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
  const initialCard = input.stopBeforeCardEntry
    ? null
    : input.card ?? (input.takeCard ? null : loadVietnamFixedCardFromEnv());
  if (!input.stopBeforeCardEntry && !initialCard && !input.takeCard) {
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
    const captchaContextAttempts = readBoundedPositiveInteger(
      "VN_PAYMENT_SEARCH_CAPTCHA_CONTEXT_ATTEMPTS",
      3,
      5,
    );
    const maxSolverAttempts = readBoundedPositiveInteger(
      "VN_PAYMENT_SEARCH_CAPTCHA_SOLVER_ATTEMPTS",
      6,
      9,
    );
    const knownChallengeFingerprints = new Set<string>();
    const combinedCaptchaDiagnostics: VietnamPaymentSearchCaptchaDiagnostic[] = [];
    const searchDeadlineAt = Date.now() + Math.max(1_000, input.timeoutMs ?? 120_000);
    const remainingSearchMs = () => Math.max(0, searchDeadlineAt - Date.now());
    const countSolverAttempts = () => combinedCaptchaDiagnostics.filter(
      (attempt) => !["stale_challenge", "refresh_unconfirmed", "image_unavailable"].includes(attempt.outcome),
    ).length;

    const searchExecution = await retryVietnamSearchCaptchaInFreshContexts<Page, void>({
      attempts: captchaContextAttempts,
      openContext: async () => {
        if (remainingSearchMs() <= 0) {
          throw new VietnamSearchCaptchaSolveError(
            "Vietnam payment search CAPTCHA deadline was exhausted.",
            [...combinedCaptchaDiagnostics],
            false,
          );
        }
        const searchPage = await gotoSearchPageWithRetry(browser, input, searchDeadlineAt);
        page = searchPage.page;
        if (!searchPage.ready || !page) {
          if (!page) {
            const suffix = searchPage.lastError instanceof Error
              ? `: ${searchPage.lastError.message}`
              : "";
            throw new VietnamSearchPageUnavailableError(
              `The official Vietnam payment search page could not be opened after retries${suffix}`,
            );
          }
          const bodyText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
          throw new VietnamSearchPageUnavailableError(
            bodyText.trim().length < 30
              ? "The official Vietnam payment search page loaded blank after retries."
              : "The official Vietnam payment search page did not expose the expected search fields after retries.",
          );
        }
        return page;
      },
      runContext: async (currentPage, contextAttempt) => {
        if (remainingSearchMs() <= 0) {
          throw new VietnamSearchCaptchaSolveError(
            "Vietnam payment search CAPTCHA deadline was exhausted.",
            [...combinedCaptchaDiagnostics],
            false,
          );
        }
        await fillSearchFields(currentPage, input);
        const remainingSolverAttempts = maxSolverAttempts - countSolverAttempts();
        if (remainingSolverAttempts <= 0) {
          throw new VietnamSearchCaptchaSolveError(
            "Vietnam search CAPTCHA solver attempt budget was exhausted.",
            [...combinedCaptchaDiagnostics],
            false,
          );
        }
        try {
          const solveResult = await solveVietnamPaymentSearchCaptcha(
            currentPage,
            remainingSearchMs(),
            {
              attemptOffset: combinedCaptchaDiagnostics.length,
              contextAttempt,
              maxAttempts: Math.min(3, remainingSolverAttempts),
              knownChallengeFingerprints,
              // A stable challenge may be solved once. Repeated fingerprints
              // are rejected by knownChallengeFingerprints and must rotate
              // before another solver request, even in a fresh context.
              refreshInitialChallenge:
                shouldRefreshVietnamSearchCaptchaBeforeFirstSolve(contextAttempt),
              deadlineAt: searchDeadlineAt,
            },
          );
          combinedCaptchaDiagnostics.push(...solveResult.diagnostics);
          diagnostics.searchCaptchaAttempts = [...combinedCaptchaDiagnostics];
          await fillSearchFields(currentPage, input);
          await submitSearch(currentPage);
          const submissionOutcome = await waitForVietnamSearchSubmissionOutcome(
            currentPage,
            solveResult.challengeFingerprint,
            Math.min(20_000, remainingSearchMs()),
          );
          if (submissionOutcome !== "accepted") {
            const lastDiagnostic = combinedCaptchaDiagnostics.at(-1);
            if (lastDiagnostic?.outcome === "solved") lastDiagnostic.outcome = "rejected";
            diagnostics.searchCaptchaAttempts = [...combinedCaptchaDiagnostics];
            if (submissionOutcome === "captcha_rejected" && solveResult.solveId) {
              await reportBadCaptcha(solveResult.solveId).catch(() => undefined);
            }
            throw new VietnamSearchCaptchaSolveError(
              submissionOutcome === "captcha_rejected"
                ? "The official Vietnam search page rejected the solved CAPTCHA."
                : "The official Vietnam search page did not confirm the CAPTCHA submission before the deadline.",
              [],
              true,
            );
          }
          if (solveResult.solveId) {
            await reportGoodCaptcha(solveResult.solveId).catch(() => undefined);
          }
        } catch (error) {
          if (error instanceof VietnamSearchCaptchaSolveError) {
            combinedCaptchaDiagnostics.push(...error.diagnostics);
            diagnostics.searchCaptchaAttempts = [...combinedCaptchaDiagnostics];
            throw new VietnamSearchCaptchaSolveError(
              error.message,
              [...combinedCaptchaDiagnostics],
              error.retryWithFreshContext,
            );
          }
          throw error;
        }
      },
      closeContext: (currentPage) => currentPage.close(),
      shouldRetry: (error) => (
        error instanceof VietnamSearchCaptchaSolveError &&
        error.retryWithFreshContext &&
        countSolverAttempts() < maxSolverAttempts
      ),
      onRetry: async (_error, contextAttempt) => {
        const lastDiagnostic = combinedCaptchaDiagnostics.at(-1);
        if (lastDiagnostic) lastDiagnostic.freshContextRetry = true;
        diagnostics.searchCaptchaAttempts = [...combinedCaptchaDiagnostics];
        console.warn(
          `[vn-payment] Retrying the official search CAPTCHA in a fresh context ` +
          `after context=${contextAttempt}/${captchaContextAttempts}.`,
        );
      },
    });
    page = searchExecution.context;
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (/no results?(?: were)? found|không tìm thấy|khong tim thay/i.test(bodyText)) {
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

    if (input.stopBeforeCardEntry) {
      const cardEntry = await advanceVietnamPortalToCardEntry({
        page,
        cardBrand: "visa",
        timeoutMs: Math.min(input.timeoutMs ?? 120_000, 45_000),
      });
      if (cardEntry.status !== "ready") {
        return {
          status: "needs_human",
          reason: cardEntry.reason ?? "The official card-entry page was not reached.",
          url: page.url(),
          diagnostics,
        };
      }
      return {
        status: "card_entry_ready",
        url: page.url(),
        diagnostics,
      };
    }

    const paymentText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const feeVerification = verifyVietnamOfficialFeeText({
      bodyText: paymentText,
      expectedAmountCents: input.expectedPaymentAmountCents,
      expectedCurrency: input.expectedPaymentCurrency,
    });
    if (!feeVerification.verified) {
      return {
        status: "review_required",
        reason: `Visible Vietnam official fee could not be verified (${feeVerification.reason}); no payment card was acquired.`,
        url: page.url(),
        diagnostics,
      };
    }
    const card = initialCard ?? await input.takeCard?.() ?? loadVietnamFixedCardFromEnv();
    if (!card) {
      return {
        status: "review_required",
        reason: "The verified Vietnam payment page was reached, but managed card acquisition was unavailable.",
        url: page.url(),
        diagnostics,
      };
    }

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
      status: error instanceof VietnamSearchPageUnavailableError ? "unavailable" : "needs_human",
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
