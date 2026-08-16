/**
 * UK Standard Visitor — resume an in-flight application via forceResume URL.
 *
 * Flow:
 *   1. Open the applicant's forceResume URL.
 *   2. Fill the password input + click Sign in.
 *   3. Walk every page in UK_PAGE_ORDER (44 application pages):
 *        - navigate to /edit/application.0.<slug>
 *        - run the page-binding filler (best-effort; missing answers stay empty)
 *        - click Save and continue
 *   4. Walk Documents (tick all checkboxes + Save and continue).
 *   5. Walk Declaration and, only with an allocation-bound managed-card
 *      callback, continue through the verified official payment boundary.
 *
 * Returns a structured result the orchestrator can write back to
 * applications.submission_result.
 */

import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";
import {
  UK_DECLARATION_FILLER,
  UK_DOCUMENTS_FILLER,
  UK_PAGE_FILLERS,
  UK_PAGE_ORDER,
} from "./page-bindings";
import { ukClickSaveContinue } from "./fillers";
import {
  payUkWithManagedCard,
  type UkManagedPaymentCard,
  verifyUkPaymentPageAmount,
} from "./payment";

export interface UkResumeInput {
  resumeUrl: string;
  password: string;
  email: string;
  /** Flat answers keyed by seed-uk-standard-visitor field_name. */
  answers: Record<string, string>;
}

export interface UkResumeOptions {
  headless?: boolean;
  runId?: string;
  /** Per-page navigation timeout (ms). Default 30s. */
  pageTimeoutMs?: number;
  /** Where to write failure screenshots. */
  outputDir?: string;
  /**
   * Lazily acquires a VIZA-managed card only after the payment page is
   * visible. Omit this callback for prefill-only runs.
   */
  takePaymentCard?: () => Promise<UkManagedPaymentCard | null>;
  expectedPaymentAmount?: number;
  expectedPaymentCurrency?: string;
}

export type UkResumeResult =
  | {
      status: "stopped_at_pay";
      runId?: string;
      portalUrl: string;
      portalUsername: string;
      pagesFilled: string[];
      pagesSkipped: string[];
      finalUrl: string;
      applicationReference?: string;
    }
  | {
      status: "halted_before_pay";
      runId?: string;
      portalUrl: string;
      portalUsername: string;
      pagesFilled: string[];
      finalUrl: string;
      reason: string;
    }
  | {
      status: "failed";
      runId?: string;
      failedAt: string;
      error: Record<string, unknown> | null;
      url: string;
    }
  | {
      status: "paid";
      runId?: string;
      pagesFilled: string[];
      pagesSkipped: string[];
      finalUrl: string;
      portalReceiptId: string;
      applicationReference?: string;
    }
  | {
      status: "payment_review_required";
      runId?: string;
      pagesFilled: string[];
      pagesSkipped: string[];
      finalUrl: string;
      reason: string;
      paymentOutcome?: "declined" | "review_required";
      applicationReference?: string;
    };

const STOP_TITLE_PATTERNS = [/^Pay\b/i, /payment/i];
const PAY_URL_PATTERNS = [/\/pay\b/i, /\/payment\b/i];

const APP_BASE = "https://visas-immigration.service.gov.uk/edit/application.0.";

export async function resumeUkApplication(
  input: UkResumeInput,
  options: UkResumeOptions = {},
): Promise<UkResumeResult> {
  const runId = options.runId;
  const headless = options.headless ?? true;
  const pageTimeoutMs = options.pageTimeoutMs ?? 30_000;
  const pagesFilled: string[] = [];
  const pagesSkipped: string[] = [];
  let page: Page | null = null;
  let browser: Awaited<ReturnType<typeof launchStealthBrowser>>["browser"] | null = null;
  let context: Awaited<ReturnType<typeof launchStealthBrowser>>["context"] | null = null;

  try {
    const handles = await launchStealthBrowser({ headless, acceptDownloads: false });
    browser = handles.browser;
    context = handles.context;
    page = handles.page;

    // ── Login ──────────────────────────────────────────────────────────
    await page.goto(input.resumeUrl, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
    const pwInput = page.locator('input[type="password"]').first();
    if ((await pwInput.count()) === 0) {
      throw new Error("Login page did not expose a password input — resume URL may be expired");
    }
    await pwInput.fill(input.password, { timeout: 10_000 });
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: pageTimeoutMs }),
      page.locator('button[type="submit"], input[type="submit"]').first().click({ timeout: 10_000 }),
    ]);

    // ── Walk all 44 application pages ──────────────────────────────────
    for (const slug of UK_PAGE_ORDER) {
      const url = `${APP_BASE}${slug}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
      } catch {
        pagesSkipped.push(slug);
        continue;
      }

      // Pages that don't apply to this applicant (conditional skips)
      // redirect to Check-Your-Answers or the next-applicable page.
      // Detect by URL drift away from the requested slug.
      const landed = page.url();
      if (!landed.includes(slug)) {
        pagesSkipped.push(slug);
        if (await isStopBoundary(page)) {
          return handleVisiblePaymentBoundary(
            page,
            input,
            options,
            runId,
            pagesFilled,
            pagesSkipped,
          );
        }
        continue;
      }

      const filler = UK_PAGE_FILLERS[slug];
      if (filler) {
        try {
          await filler(page, input.answers);
        } catch (err) {
          console.warn(
            `[uk] page filler errored on ${slug}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      try {
        await ukClickSaveContinue(page, pageTimeoutMs);
        pagesFilled.push(slug);
      } catch {
        pagesSkipped.push(slug);
      }

      // Every Save can land us on either the next application page, the
      // Check-Your-Answers summary, or — for the LAST page in the list —
      // the Documents step. Bail if we've crossed into a stop URL.
      if (await isStopBoundary(page)) {
        return handleVisiblePaymentBoundary(
          page,
          input,
          options,
          runId,
          pagesFilled,
          pagesSkipped,
        );
      }
    }

    // ── Check-Your-Answers + Continue → Documents ──────────────────────
    await page.goto("https://visas-immigration.service.gov.uk/edit/application", {
      waitUntil: "domcontentloaded",
      timeout: pageTimeoutMs,
    });
    const continueBtn = page.locator('button[type="submit"], input[type="submit"]', { hasText: /^Continue$/i }).first();
    if ((await continueBtn.count()) > 0) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: pageTimeoutMs }),
        continueBtn.click({ timeout: 10_000 }),
      ]);
    }

    // ── Documents step ─────────────────────────────────────────────────
    if (/Documents/i.test(await page.title())) {
      await UK_DOCUMENTS_FILLER(page, input.answers);
      await ukClickSaveContinue(page, pageTimeoutMs);
      pagesFilled.push("__documents__");
    }

    if (await isStopBoundary(page)) {
      return handleVisiblePaymentBoundary(
        page,
        input,
        options,
        runId,
        pagesFilled,
        pagesSkipped,
      );
    }

    // ── Declaration + VIZA-managed payment ────────────────────────────
    if (/Declaration/i.test(await page.title())) {
      const applicationReference = await captureApplicationReference(page);
      if (!options.takePaymentCard) {
        await UK_DECLARATION_FILLER(page, input.answers);
        pagesFilled.push("__declaration__");
        // Prefill-only runs preserve the payment boundary. No credential or
        // payment link should be exposed to the applicant by the caller.
        return {
          status: "stopped_at_pay",
          runId,
          portalUrl: input.resumeUrl,
          portalUsername: input.email,
          pagesFilled,
          pagesSkipped,
          finalUrl: page.url(),
          ...(applicationReference ? { applicationReference } : {}),
        };
      }

      // UKVI currently uses two declaration pages. Complete every declaration
      // page already represented by the applicant's VIZA final confirmation,
      // then acquire card material only after the official pay page is visible.
      for (let declarationPage = 0; declarationPage < 4; declarationPage += 1) {
        if (!/Declaration/i.test(await page.title())) break;
        await UK_DECLARATION_FILLER(page, input.answers);
        await ukClickSaveContinue(page, pageTimeoutMs);
        pagesFilled.push(`__declaration_${declarationPage + 1}__`);
      }

      if (!(await isStopBoundary(page))) {
        return {
          status: "payment_review_required",
          runId,
          pagesFilled,
          pagesSkipped,
          finalUrl: page.url(),
          reason: "UKVI did not reach the expected official payment page after declaration",
          ...(applicationReference ? { applicationReference } : {}),
        };
      }

      const expectedPaymentAmount = options.expectedPaymentAmount;
      const expectedPaymentCurrency = options.expectedPaymentCurrency;
      if (
        typeof expectedPaymentAmount !== "number" ||
        !Number.isFinite(expectedPaymentAmount) ||
        expectedPaymentAmount <= 0 ||
        !expectedPaymentCurrency
      ) {
        return {
          status: "payment_review_required",
          runId,
          pagesFilled,
          pagesSkipped,
          finalUrl: page.url(),
          reason: "The allocated UK official-fee amount or currency was unavailable",
          ...(applicationReference ? { applicationReference } : {}),
        };
      }
      const amountCheck = await verifyUkPaymentPageAmount({
        page,
        expectedAmount: expectedPaymentAmount,
        expectedCurrency: expectedPaymentCurrency,
      });
      if (!amountCheck.ok) {
        return {
          status: "payment_review_required",
          runId,
          pagesFilled,
          pagesSkipped,
          finalUrl: page.url(),
          reason: amountCheck.reason,
          ...(applicationReference ? { applicationReference } : {}),
        };
      }

      const card = await options.takePaymentCard();
      if (!card) {
        return {
          status: "payment_review_required",
          runId,
          pagesFilled,
          pagesSkipped,
          finalUrl: page.url(),
          reason: "A VIZA-managed official-fee card was not available",
          ...(applicationReference ? { applicationReference } : {}),
        };
      }
      const payment = await payUkWithManagedCard({
        page,
        card,
        expectedAmount: expectedPaymentAmount,
        expectedCurrency: expectedPaymentCurrency,
      });
      if (payment.status === "paid") {
        return {
          status: "paid",
          runId,
          pagesFilled,
          pagesSkipped,
          finalUrl: payment.finalUrl,
          portalReceiptId: payment.portalReceiptId,
          ...(applicationReference ? { applicationReference } : {}),
        };
      }
      return {
        status: "payment_review_required",
        runId,
        pagesFilled,
        pagesSkipped,
        finalUrl: payment.finalUrl,
        reason: payment.reason,
        paymentOutcome: payment.status,
        ...(applicationReference ? { applicationReference } : {}),
      };
    }

    // Couldn't reach Declaration — return whatever we got.
    return {
      status: "halted_before_pay",
      runId,
      portalUrl: input.resumeUrl,
      portalUsername: input.email,
      pagesFilled,
      finalUrl: page.url(),
      reason: `Unexpected terminal page: ${await page.title()}`,
    };
  } catch (err) {
    const url = page?.url() ?? input.resumeUrl;
    return {
      status: "failed",
      runId,
      failedAt: url,
      error: serializeError(err),
      url,
    };
  } finally {
    try {
      if (context) await context.close();
    } catch {
      /* best-effort */
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* best-effort */
    }
  }
}

async function isStopBoundary(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (STOP_TITLE_PATTERNS.some((rx) => rx.test(title))) return true;
  const url = page.url();
  if (PAY_URL_PATTERNS.some((rx) => rx.test(url))) return true;
  return false;
}

async function handleVisiblePaymentBoundary(
  page: Page,
  input: UkResumeInput,
  options: UkResumeOptions,
  runId: string | undefined,
  pagesFilled: string[],
  pagesSkipped: string[],
): Promise<UkResumeResult> {
  const applicationReference = await captureApplicationReference(page);
  if (!options.takePaymentCard) {
    return {
      status: "stopped_at_pay",
      runId,
      portalUrl: input.resumeUrl,
      portalUsername: input.email,
      pagesFilled,
      pagesSkipped,
      finalUrl: page.url(),
      ...(applicationReference ? { applicationReference } : {}),
    };
  }

  const expectedPaymentAmount = options.expectedPaymentAmount;
  const expectedPaymentCurrency = options.expectedPaymentCurrency;
  if (
    typeof expectedPaymentAmount !== "number" ||
    !Number.isFinite(expectedPaymentAmount) ||
    expectedPaymentAmount <= 0 ||
    !expectedPaymentCurrency
  ) {
    return {
      status: "payment_review_required",
      runId,
      pagesFilled,
      pagesSkipped,
      finalUrl: page.url(),
      reason: "The allocated UK official-fee amount or currency was unavailable",
      ...(applicationReference ? { applicationReference } : {}),
    };
  }
  const amountCheck = await verifyUkPaymentPageAmount({
    page,
    expectedAmount: expectedPaymentAmount,
    expectedCurrency: expectedPaymentCurrency,
  });
  if (!amountCheck.ok) {
    return {
      status: "payment_review_required",
      runId,
      pagesFilled,
      pagesSkipped,
      finalUrl: page.url(),
      reason: amountCheck.reason,
      ...(applicationReference ? { applicationReference } : {}),
    };
  }

  const card = await options.takePaymentCard();
  if (!card) {
    return {
      status: "payment_review_required",
      runId,
      pagesFilled,
      pagesSkipped,
      finalUrl: page.url(),
      reason: "A VIZA-managed official-fee card was not available",
      ...(applicationReference ? { applicationReference } : {}),
    };
  }
  const payment = await payUkWithManagedCard({
    page,
    card,
    expectedAmount: expectedPaymentAmount,
    expectedCurrency: expectedPaymentCurrency,
  });
  if (payment.status === "paid") {
    return {
      status: "paid",
      runId,
      pagesFilled,
      pagesSkipped,
      finalUrl: payment.finalUrl,
      portalReceiptId: payment.portalReceiptId,
      ...(applicationReference ? { applicationReference } : {}),
    };
  }
  return {
    status: "payment_review_required",
    runId,
    pagesFilled,
    pagesSkipped,
    finalUrl: payment.finalUrl,
    reason: payment.reason,
    paymentOutcome: payment.status,
    ...(applicationReference ? { applicationReference } : {}),
  };
}

async function captureApplicationReference(page: Page): Promise<string | null> {
  // gov.uk shows "Your application reference number is …" on declaration
  // and confirmation surfaces. Best-effort regex over the body text.
  const body = await page.textContent("body").catch(() => null);
  if (!body) return null;
  const m = body.match(/application\s*reference\s*(?:number)?\s*(?:is)?\s*([A-Z0-9]{6,})/i);
  return m ? m[1] : null;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}
