/**
 * UK Standard Visitor — resume an in-flight application via forceResume URL.
 *
 * The runner is deliberately fail-closed: a page is counted as filled only
 * when its filler completed and the portal reported a real navigation. A
 * declaration page is an applicant checkpoint; VIZA never checks its legal
 * acknowledgement or advances into payment.
 */

import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";
import {
  UK_DOCUMENTS_FILLER,
  UK_PAGE_FILLERS,
  UK_PAGE_ORDER,
} from "./page-bindings";
import {
  ukClickSaveContinue,
  probeUkFormState,
  resolveUkPageSlug,
  ukPageHasValidationErrors,
  ukValidationErrorText,
  UkRadioFillError,
  type UkFormProbe,
} from "./fillers";
import {
  createUkTimingRecorder,
  type UkTimingClock,
  type UkTimingOutcome,
  type UkTimingRecorder,
  type UkTimingSink,
} from "./timing.js";

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
  /** Test seam for deterministic browser lifecycle tests. */
  browserLauncher?: typeof launchStealthBrowser;
  /** Optional redacted timing recorder; defaults to a safe summary logger. */
  timing?: UkTimingRecorder;
  /** Clock/sink seams used when the runner creates its timing recorder. */
  timingClock?: UkTimingClock;
  timingSink?: UkTimingSink;
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
      checkpoint?: "payment";
    }
  | {
      status: "halted_before_pay";
      runId?: string;
      portalUrl: string;
      portalUsername: string;
      pagesFilled: string[];
      pagesSkipped?: string[];
      finalUrl: string;
      reason: string;
      checkpoint?: "registration" | "form_incomplete" | "review" | "declaration";
      applicationReference?: string;
    }
  | {
      status: "failed";
      runId?: string;
      failedAt: string;
      error: Record<string, unknown> | null;
      url: string;
    }
  // Historical result variants remain readable by callers, but the current
  // payment-removed runner never produces them.
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
      checkpoint?: "payment";
    };

const STOP_TITLE_PATTERNS = [/^Pay\b/i, /payment/i];
const PAY_URL_PATTERNS = [/\/pay\b/i, /\/payment\b/i];
const UK_ORIGIN = "https://visas-immigration.service.gov.uk";
const UK_LEGACY_ORIGIN = "https://apply-uk-visa.service.gov.uk";
const UK_RESUME_ORIGINS = new Set([UK_ORIGIN, UK_LEGACY_ORIGIN]);
const UK_RESUME_UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu;
const MAX_PAGE_HOPS = Math.max(UK_PAGE_ORDER.length + 8, 64);
const UK_PAGE_SLUGS = new Set(UK_PAGE_ORDER);

export async function resumeUkApplication(
  input: UkResumeInput,
  options: UkResumeOptions = {},
): Promise<UkResumeResult> {
  const runId = options.runId;
  const headless = options.headless ?? true;
  const pageTimeoutMs = options.pageTimeoutMs ?? 30_000;
  const pagesFilled: string[] = [];
  const pagesSkipped: string[] = [];
  const timing = options.timing ?? createUkTimingRecorder({
    runId,
    clock: options.timingClock,
    sink: options.timingSink,
  });
  let runOutcome: UkTimingOutcome = "failed";
  const complete = <T extends UkResumeResult>(result: T): T => {
    runOutcome = result.status === "failed" ? "failed" : "stopped";
    return result;
  };
  let page: Page | null = null;
  let browser: Awaited<ReturnType<typeof launchStealthBrowser>>["browser"] | null = null;
  let context: Awaited<ReturnType<typeof launchStealthBrowser>>["context"] | null = null;

  try {
    if (!isOfficialResumeUrl(input.resumeUrl)) {
      return complete(navigationFailure(
        null,
        input,
        runId,
        `UK resume URL must use the official origin and a supported resume path`,
        pagesFilled,
        pagesSkipped,
      ));
    }

    const launcher = options.browserLauncher ?? launchStealthBrowser;
    const browserLaunchSpan = timing.start("browser_launch", "resume");
    let handles: Awaited<ReturnType<typeof launchStealthBrowser>>;
    try {
      handles = await launcher({ headless, acceptDownloads: false });
      browserLaunchSpan.end("success");
    } catch (err) {
      browserLaunchSpan.end("failed");
      throw err;
    }
    browser = handles.browser;
    context = handles.context;
    page = handles.page;

    const loginSpan = timing.start("login", "resume");
    try {
      await page.goto(input.resumeUrl, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
      if (!isAllowedResumeOrigin(page.url())) {
        throw new Error("UKVI resume navigation left the allowed official origins");
      }
      const pwInput = page.locator('input[type="password"]').first();
      if ((await pwInput.count()) === 0) {
        throw new Error("Login page did not expose a password input — resume URL may be expired");
      }
      await pwInput.fill(input.password, { timeout: 10_000 });
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: pageTimeoutMs }),
        page.locator('button[type="submit"], input[type="submit"]').first().click({ timeout: 10_000 }),
      ]);
      if (!isOfficialUrl(page.url())) {
        throw new Error("UKVI login navigation left the official origin");
      }
      loginSpan.end("success");
    } catch (err) {
      loginSpan.end("failed");
      throw err;
    }

    let probe = await probeUkFormState(page);
    const probeProblem = validateUkProbe(probe);
    if (probeProblem) {
      return complete(navigationFailure(page, input, runId, probeProblem, pagesFilled, pagesSkipped));
    }
    if (await isStopBoundary(page)) {
      runOutcome = "stopped";
      return handleVisiblePaymentBoundary(page, input, runId, pagesFilled, pagesSkipped);
    }
    if (await isDeclarationPage(page)) {
      runOutcome = "stopped";
      return declarationCheckpoint(page, input, runId, pagesFilled, pagesSkipped);
    }

    const visited = new Set<string>();
    let pageHops = 0;
    while (true) {
      if (pageHops >= MAX_PAGE_HOPS) {
        return complete(navigationFailure(
          page,
          input,
          runId,
          `UKVI exceeded the maximum page-hop limit (${MAX_PAGE_HOPS})`,
          pagesFilled,
          pagesSkipped,
        ));
      }
      pageHops += 1;

      if (await isReviewPage(page)) break;
      if (await isStopBoundary(page)) {
        runOutcome = "stopped";
        return handleVisiblePaymentBoundary(page, input, runId, pagesFilled, pagesSkipped);
      }
      if (await isDeclarationPage(page)) {
        runOutcome = "stopped";
        return declarationCheckpoint(page, input, runId, pagesFilled, pagesSkipped);
      }

      const slug = resolveUkPageSlug(probe);
      if (!slug || !UK_PAGE_SLUGS.has(slug)) {
        return complete(navigationFailure(
          page,
          input,
          runId,
          `UKVI returned an unknown application page${slug ? ` "${slug}"` : ""}`,
          pagesFilled,
          pagesSkipped,
        ));
      }
      if (visited.has(slug)) {
        return complete(navigationFailure(
          page,
          input,
          runId,
          `UKVI application navigation looped on "${slug}"`,
          pagesFilled,
          pagesSkipped,
        ));
      }
      visited.add(slug);

      const filler = UK_PAGE_FILLERS[slug];
      const fillSpan = timing.start("page_fill", slug);
      if (filler) {
        try {
          await filler(page, input.answers);
        } catch (err) {
          fillSpan.end("failed", 1, err instanceof UkRadioFillError ? err.diagnosticCode : "unknown");
          return complete(incompleteResult(
            page,
            input,
            runId,
            pagesFilled,
            pagesSkipped,
            `Filler failed on ${slug}: ${errorMessage(err)}`,
            "form_incomplete",
          ));
        }
        fillSpan.end("success");
      } else {
        fillSpan.end("skipped");
      }

      const saveSpan = timing.start("page_save", slug);
      try {
        const save = await ukClickSaveContinue(page, pageTimeoutMs);
        if (!save.navigated) {
          saveSpan.end("failed");
          const validationSpan = timing.start("validation", slug);
          let validation = "";
          try {
            validation = await validationSuffix(page);
            validationSpan.end(validation ? "failed" : "success");
          } catch (err) {
            validationSpan.end("failed");
            throw err;
          }
          return complete(incompleteResult(
            page,
            input,
            runId,
            pagesFilled,
            pagesSkipped,
            `Save and continue did not navigate on ${slug}${validation}`,
            "form_incomplete",
          ));
        }
        saveSpan.end("success");
        pagesFilled.push(slug);
      } catch (err) {
        saveSpan.end("failed");
        return complete(incompleteResult(
          page,
          input,
          runId,
          pagesFilled,
          pagesSkipped,
          `Save and continue failed on ${slug}: ${errorMessage(err)}`,
          "form_incomplete",
        ));
      }

      probe = await probeUkFormState(page);
      const nextProbeProblem = validateUkProbe(probe);
      if (nextProbeProblem) {
        return complete(navigationFailure(page, input, runId, nextProbeProblem, pagesFilled, pagesSkipped));
      }
      if (await isStopBoundary(page)) {
        runOutcome = "stopped";
        return handleVisiblePaymentBoundary(page, input, runId, pagesFilled, pagesSkipped);
      }
      if (await isDeclarationPage(page)) {
        runOutcome = "stopped";
        return declarationCheckpoint(page, input, runId, pagesFilled, pagesSkipped);
      }
      if (await isReviewPage(page)) break;
      const nextSlug = resolveUkPageSlug(probe);
      if (!nextSlug || !UK_PAGE_SLUGS.has(nextSlug)) {
        return complete(navigationFailure(
          page,
          input,
          runId,
          `UKVI returned an unknown next application page${nextSlug ? ` "${nextSlug}"` : ""}`,
          pagesFilled,
          pagesSkipped,
        ));
      }
    }

    if (await isStopBoundary(page)) {
      runOutcome = "stopped";
      return handleVisiblePaymentBoundary(page, input, runId, pagesFilled, pagesSkipped);
    }
    if (!(await isReviewPage(page))) {
      return complete(incompleteResult(
        page,
        input,
        runId,
        pagesFilled,
        pagesSkipped,
        `Unexpected page before UK documents: ${await page.title()}`,
        "review",
      ));
    }

    const continueBtn = page.locator(
      'button[type="submit"], input[type="submit"]',
      { hasText: /^Continue$/i },
    ).first();
    if ((await continueBtn.count()) === 0) {
      const validationSpan = timing.start("validation", "review");
      let validation = "";
      try {
        validation = await validationSuffix(page);
        validationSpan.end(validation ? "failed" : "success");
      } catch (err) {
        validationSpan.end("failed");
        throw err;
      }
      return complete(incompleteResult(
        page,
        input,
        runId,
        pagesFilled,
        pagesSkipped,
        `UK review page has no Continue control${validation}`,
        "review",
      ));
    }
    const reviewContinueSpan = timing.start("review", "continue");
    try {
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: pageTimeoutMs }),
        continueBtn.click({ timeout: 10_000 }),
      ]);
      reviewContinueSpan.end("success");
    } catch (err) {
      reviewContinueSpan.end("failed");
      return complete(incompleteResult(
        page,
        input,
        runId,
        pagesFilled,
        pagesSkipped,
        `UK review Continue failed: ${errorMessage(err)}`,
        "review",
      ));
    }
    const postReviewProbe = await probeUkFormState(page);
    const postReviewProbeProblem = validateUkProbe(postReviewProbe);
    if (postReviewProbeProblem) {
      return complete(navigationFailure(page, input, runId, postReviewProbeProblem, pagesFilled, pagesSkipped));
    }
    if (await isReviewPage(page)) {
      return complete(incompleteResult(
        page,
        input,
        runId,
        pagesFilled,
        pagesSkipped,
        "UK review Continue did not navigate to a new official checkpoint",
        "review",
      ));
    }
    const reviewValidationSpan = timing.start("validation", "review");
    let reviewHasValidationErrors = false;
    try {
      reviewHasValidationErrors = await ukPageHasValidationErrors(page);
      reviewValidationSpan.end(reviewHasValidationErrors ? "failed" : "success");
    } catch (err) {
      reviewValidationSpan.end("failed");
      throw err;
    }
    if (reviewHasValidationErrors) {
      const validationSuffixSpan = timing.start("validation", "review");
      let validation = "";
      try {
        validation = await validationSuffix(page);
        validationSuffixSpan.end(validation ? "failed" : "success");
      } catch (err) {
        validationSuffixSpan.end("failed");
        throw err;
      }
      return complete(incompleteResult(
        page,
        input,
        runId,
        pagesFilled,
        pagesSkipped,
        `UK review validation failed${validation}`,
        "review",
      ));
    }

    if (await isStopBoundary(page)) {
      runOutcome = "stopped";
      return handleVisiblePaymentBoundary(page, input, runId, pagesFilled, pagesSkipped);
    }
    if (await isDeclarationPage(page)) {
      runOutcome = "stopped";
      return declarationCheckpoint(page, input, runId, pagesFilled, pagesSkipped);
    }

    if (!(await isDocumentsPage(page))) {
      return complete(navigationFailure(
        page,
        input,
        runId,
        "UKVI returned an unknown page after the review checkpoint",
        pagesFilled,
        pagesSkipped,
      ));
    }

    const documentsSpan = timing.start("documents", "documents");
    try {
      await UK_DOCUMENTS_FILLER(page, input.answers);
      const save = await ukClickSaveContinue(page, pageTimeoutMs);
      if (!save.navigated) {
        documentsSpan.end("failed");
        const validationSpan = timing.start("validation", "documents");
        let validation = "";
        try {
          validation = await validationSuffix(page);
          validationSpan.end(validation ? "failed" : "success");
        } catch (err) {
          validationSpan.end("failed");
          throw err;
        }
        return complete(incompleteResult(
          page,
          input,
          runId,
          pagesFilled,
          pagesSkipped,
          `UK documents did not save${validation}`,
          "form_incomplete",
        ));
      }
      documentsSpan.end("success");
    } catch (err) {
      documentsSpan.end("failed");
      return complete(incompleteResult(
        page,
        input,
        runId,
        pagesFilled,
        pagesSkipped,
        `UK documents step failed: ${errorMessage(err)}`,
        "form_incomplete",
      ));
    }
    pagesFilled.push("__documents__");

    const postDocumentsProbe = await probeUkFormState(page);
    const postDocumentsProbeProblem = validateUkProbe(postDocumentsProbe);
    if (postDocumentsProbeProblem) {
      return complete(navigationFailure(page, input, runId, postDocumentsProbeProblem, pagesFilled, pagesSkipped));
    }
    if (await isStopBoundary(page)) {
      runOutcome = "stopped";
      return handleVisiblePaymentBoundary(page, input, runId, pagesFilled, pagesSkipped);
    }
    if (await isDeclarationPage(page)) {
      runOutcome = "stopped";
      return declarationCheckpoint(page, input, runId, pagesFilled, pagesSkipped);
    }

    return complete(navigationFailure(
      page,
      input,
      runId,
      "UKVI returned an unknown page after the documents checkpoint",
      pagesFilled,
      pagesSkipped,
    ));
  } catch (err) {
    runOutcome = "failed";
    const url = redactUkFailureUrl(page?.url() ?? input.resumeUrl);
    return complete({
      status: "failed",
      runId,
      failedAt: url,
      error: serializeError(err),
      url,
    });
  } finally {
    const cleanupSpan = timing.start("cleanup", "resume");
    let cleanupFailed = false;
    try {
      if (context) await context.close();
    } catch {
      /* best-effort */
      cleanupFailed = true;
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* best-effort */
      cleanupFailed = true;
    }
    cleanupSpan.end(cleanupFailed ? "failed" : "success");
    timing.finish(runOutcome);
  }
}

async function isStopBoundary(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (STOP_TITLE_PATTERNS.some((rx) => rx.test(title))) return true;
  return PAY_URL_PATTERNS.some((rx) => rx.test(page.url()));
}

function isOfficialUrl(value: string): boolean {
  try {
    return new URL(value).origin === UK_ORIGIN && !hasExplicitPort(value);
  } catch {
    return false;
  }
}

function isAllowedResumeOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !hasExplicitPort(value)
      && UK_RESUME_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

function isOfficialResumeUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || hasExplicitPort(value)
    || url.hash
  ) return false;

  if (url.origin === UK_ORIGIN) {
    if (url.search !== "") return false;
    if (url.pathname.startsWith("/forceResume/") && url.pathname.length > "/forceResume/".length) {
      return true;
    }
    return url.pathname.startsWith("/resume/")
      && UK_RESUME_UUID.test(url.pathname.slice("/resume/".length));
  }

  if (url.origin !== UK_LEGACY_ORIGIN || url.pathname !== "/forceResume") return false;
  const queryKeys = [...url.searchParams.keys()];
  return queryKeys.length === 1
    && queryKeys[0] === "token"
    && Boolean(url.searchParams.get("token"));
}

function hasExplicitPort(value: string): boolean {
  const authority = value.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/iu)?.[1];
  if (!authority) return false;
  return authority.slice(authority.lastIndexOf("@") + 1).includes(":");
}

function validateUkProbe(probe: UkFormProbe): string | null {
  if (!isOfficialUrl(probe.url)) {
    return "UKVI page probe left the official origin";
  }
  if (/\/save\/application\.0\./i.test(probe.url)) {
    return "UKVI remained on a save acknowledgement page after navigation";
  }
  if (probe.formAction) {
    try {
      if (new URL(probe.formAction, UK_ORIGIN).origin !== UK_ORIGIN) {
        return "UKVI form action left the official origin";
      }
    } catch {
      return "UKVI page exposed an invalid form action";
    }
  }
  return null;
}

async function isReviewPage(page: Page): Promise<boolean> {
  const url = page.url();
  if (!/\/(?:edit\/application|next)(?:[/?#]|$)/i.test(url)) return false;
  const title = await page.title().catch(() => "");
  if (/check your answers|review/i.test(title)) return true;
  const heading = ((await page.locator("h1").textContent().catch(() => "")) ?? "").trim();
  return /check your answers|review/i.test(heading);
}

async function isDeclarationPage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (/declaration/i.test(title)) return true;
  return /\/declaration(?:[/?#]|$)/i.test(page.url());
}

async function isDocumentsPage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  let pathname = "";
  try {
    pathname = new URL(page.url()).pathname;
  } catch {
    return false;
  }
  if (!/^\/(?:next|documents(?:[./]|$)|edit\/documents(?:[./]|$))/i.test(pathname)) {
    return false;
  }
  if (/documents/i.test(title)) return true;
  const heading = ((await page.locator("h1").textContent().catch(() => "")) ?? "").trim();
  return /documents/i.test(heading);
}

function navigationFailure(
  page: Page | null,
  input: UkResumeInput,
  runId: string | undefined,
  reason: string,
  pagesFilled: string[],
  pagesSkipped: string[],
): UkResumeResult {
  const url = redactUkFailureUrl(page?.url() ?? input.resumeUrl);
  return {
    status: "halted_before_pay",
    runId,
    portalUrl: redactUkFailureUrl(input.resumeUrl),
    portalUsername: input.email,
    pagesFilled,
    pagesSkipped,
    finalUrl: url,
    reason,
    checkpoint: "form_incomplete",
  };
}

function redactUkFailureUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.origin === UK_LEGACY_ORIGIN && url.pathname === "/forceResume") {
      return `${url.origin}${url.pathname}`;
    }
    if (url.origin === UK_ORIGIN && url.pathname.startsWith("/forceResume/")) {
      return `${url.origin}/forceResume/[redacted]`;
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return UK_ORIGIN;
  }
}

async function handleVisiblePaymentBoundary(
  page: Page,
  input: UkResumeInput,
  runId: string | undefined,
  pagesFilled: string[],
  pagesSkipped: string[],
): Promise<UkResumeResult> {
  const applicationReference = await captureApplicationReference(page);
  return {
    status: "stopped_at_pay",
    runId,
    portalUrl: input.resumeUrl,
    portalUsername: input.email,
    pagesFilled,
    pagesSkipped,
    finalUrl: page.url(),
    checkpoint: "payment",
    ...(applicationReference ? { applicationReference } : {}),
  };
}

function declarationCheckpoint(
  page: Page,
  input: UkResumeInput,
  runId: string | undefined,
  pagesFilled: string[],
  pagesSkipped: string[],
): Promise<UkResumeResult> {
  return captureApplicationReference(page).then((applicationReference) => ({
    status: "halted_before_pay" as const,
    runId,
    portalUrl: input.resumeUrl,
    portalUsername: input.email,
    pagesFilled,
    pagesSkipped,
    finalUrl: page.url(),
    reason: "Official declaration requires applicant review and acknowledgement",
    checkpoint: "declaration" as const,
    ...(applicationReference ? { applicationReference } : {}),
  }));
}

function incompleteResult(
  page: Page,
  input: UkResumeInput,
  runId: string | undefined,
  pagesFilled: string[],
  pagesSkipped: string[],
  reason: string,
  checkpoint: "form_incomplete" | "review",
): UkResumeResult {
  return {
    status: "halted_before_pay",
    runId,
    portalUrl: input.resumeUrl,
    portalUsername: input.email,
    pagesFilled,
    pagesSkipped,
    finalUrl: page.url(),
    reason,
    checkpoint,
  };
}

async function validationSuffix(page: Page): Promise<string> {
  if (!(await ukPageHasValidationErrors(page))) return "";
  const text = await ukValidationErrorText(page);
  return text ? `: ${text.slice(0, 500)}` : ": official validation errors are visible";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function captureApplicationReference(page: Page): Promise<string | null> {
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
