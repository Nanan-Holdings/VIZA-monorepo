/**
 * Vietnam e-Visa autofill runner.
 *
 * Drives the evisa.gov.vn application form from the landing page through
 * the post-modal Vue SPA, fills every field present in
 * `VN_FIELD_MAPPINGS`, then HALTS before the Pay/Submit button by default.
 * A fixed-card pilot may continue through payment only when explicitly enabled
 * by runtime secrets and the page is already at the payment checkpoint.
 */

import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  browserbaseEnabled,
  connectBrowserbaseCloudBrowser,
} from "../browserbase-session";
import fs from "node:fs";
import path from "node:path";
import { chooseVietnamApplyEntry } from "./apply-entry";
import { solveVietnamImageCaptcha, type VietnamCaptchaSolveOutcome } from "./captcha";
import {
  fillVietnamConditionalRepeatGroups,
  validateVietnamConditionalAnswers,
} from "./conditional-fields";
import { uncheckedVietnamDeclarationIndexes } from "./declaration";
import {
  getVnPortalOptionText,
  VN_FIELD_MAPPINGS,
  VN_REGISTRATION_CODE_SELECTOR,
  VN_STOP_BUTTON_PATTERNS,
  type VnFieldFallbackRecord,
  type VnFieldType,
} from "./field-mappings";
import { fillDate, fillText, pickRadio, pickSelect, tickCheckbox, toDdMmYyyy } from "./fillers";
import {
  loadVietnamFixedCardFromEnv,
  payVietnamPortalWithFixedCard,
  redactVietnamFixedCard,
  type RedactedVietnamFixedCard,
  type VietnamFixedCard,
} from "./fixed-card-payment";
import {
  classifyVietnamPortalSnapshot,
  isAutoAcknowledgeableVietnamPortalState,
  readVietnamPortalSnapshot,
  waitForVietnamPortalCheckpoint,
  type VietnamPortalSnapshot,
  type VietnamPortalStateId,
} from "./portal-state";
import type { VietnamProgressStage } from "./progress";
import { installVietnamPublicApiProxy } from "./public-api-proxy";
import {
  buildVietnamBrowserAttempts,
  isRetryableVietnamResult,
  type VietnamBrowserChannel,
} from "./retry-policy";
import { readVietnamValidationErrors, type VietnamPortalValidationError } from "./validation-errors";

export interface FillVietnamInput {
  /** Flat answers keyed by VN_E_VISA seed field_name. */
  answers: Record<string, string>;
}

export interface FillVietnamOptions {
  headless?: boolean;
  runId?: string;
  officialBaseUrl?: string;
  officialFallbackBaseUrl?: string;
  /** Per-step advance timeout (ms). Default 60s. */
  stepTimeoutMs?: number;
  /** Optional Playwright trace path for smoke diagnostics. */
  tracePath?: string;
  /** Optional final screenshot path for smoke diagnostics. */
  finalScreenshotPath?: string;
  /** Smoke/recon mode: return after the first reliable official checkpoint. */
  stopAtFirstCheckpoint?: boolean;
  /** Queue/UI progress callback for long official-portal runs. */
  onProgress?: (stage: VietnamProgressStage) => void | Promise<void>;
  /** Full browser-session retries for intermittent official-portal failures. */
  maxPortalAttempts?: number;
  retryBackoffMs?: number;
  browserChannels?: string;
  /** Internal/current Playwright browser channel. Undefined uses bundled Chromium. */
  browserChannel?: VietnamBrowserChannel;
  portalAttempt?: number;
  /** True only after VIZA has a user/admin authorized official-fee intent for this application. */
  allowFixedCardPayment?: boolean;
  /** One-time card captured from the local submission-service card-session endpoint. */
  fixedCard?: VietnamFixedCard | null;
}

export type FillVietnamResult =
  | {
      status: "scaffolded_pending_walk";
      runId?: string;
      reason: string;
      checkpoint?: VietnamPortalStateId;
      url?: string;
      diagnostics?: VietnamDiagnostics;
    }
  | {
      status: "action_required";
      runId?: string;
      actionType:
        | "note_modal_required"
        | "captcha_required"
        | "upload_required"
        | "payment_required"
        | "final_submit_required"
        | "layout_changed"
        | "official_portal_error"
        | "needs_manual_verification";
      checkpoint: VietnamPortalStateId;
      instruction: string;
      url: string;
      diagnostics?: VietnamDiagnostics;
    }
  | {
      status: "submitted_pending_pay";
      runId?: string;
      registrationCode: string;
      submittedAtIso: string;
      fieldsFilled: number;
      fieldsSkipped: number;
      fieldFallbacks: VnFieldFallbackRecord[];
    }
  | {
      status: "submitted_paid";
      runId?: string;
      registrationCode: string | null;
      submittedAtIso: string;
      paymentReceiptReference: string;
      redactedCard: RedactedVietnamFixedCard;
      fieldsFilled: number;
      fieldsSkipped: number;
      fieldFallbacks: VnFieldFallbackRecord[];
    }
  | {
      status: "failed";
      runId?: string;
      failedStep: string;
      error: Record<string, unknown> | null;
      url: string;
      checkpoint?: VietnamPortalStateId;
      diagnostics?: VietnamDiagnostics;
    };

export interface VietnamDiagnostics {
  consoleErrors: string[];
  failedRequests: string[];
  fieldFallbacks?: VnFieldFallbackRecord[];
  captchaSolves?: VietnamCaptchaSolveOutcome[];
  validationErrors?: VietnamPortalValidationError[];
  lastSnapshot?: VietnamPortalSnapshot;
  tracePath?: string;
  finalScreenshotPath?: string;
  browserChannel?: string;
  portalAttempt?: number;
  proxiedPublicRequestCount?: number;
  publicProxyFailures?: string[];
}

const VN_LANDING_URL = process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/";
const VN_FALLBACK_LANDING_URL =
  process.env.VN_OFFICIAL_FALLBACK_BASE_URL ?? "https://thithucdientu.gov.vn/";
const FORM_ROUTE_FRAGMENT = "/e-visa/foreigners";

export async function fillVietnamApplication(
  input: FillVietnamInput,
  options: FillVietnamOptions = {},
): Promise<FillVietnamResult> {
  if (options.portalAttempt) {
    return fillVietnamApplicationOnce(input, options);
  }

  const maxAttempts = options.maxPortalAttempts ?? readPositiveInt(process.env.VN_PORTAL_MAX_ATTEMPTS, 3);
  const retryBackoffMs = options.retryBackoffMs ?? readPositiveInt(process.env.VN_PORTAL_RETRY_BACKOFF_MS, 5_000);
  const channels = options.browserChannel
    ? [options.browserChannel]
    : buildVietnamBrowserAttempts(
        options.browserChannels ?? process.env.VN_BROWSER_CHANNELS ?? "bundled,msedge,chrome",
        maxAttempts,
      );
  let lastResult: FillVietnamResult | null = null;

  for (let index = 0; index < channels.length; index++) {
    const attempt = index + 1;
    const browserChannel = channels[index];
    const result = await fillVietnamApplicationOnce(input, {
      ...options,
      browserChannel,
      portalAttempt: attempt,
      tracePath: suffixArtifactPath(options.tracePath, attempt),
      finalScreenshotPath: suffixArtifactPath(options.finalScreenshotPath, attempt),
    });
    lastResult = result;
    if (!isRetryableVietnamResult(result) || attempt >= channels.length) return result;

    await options.onProgress?.(`portal_retry:${attempt + 1}`);
    await sleep(Math.min(retryBackoffMs * 2 ** index, 30_000));
  }

  return lastResult ?? {
    status: "failed",
    runId: options.runId,
    failedStep: "browser_launching",
    error: { message: "No Vietnam browser attempts were configured." },
    url: options.officialBaseUrl ?? VN_LANDING_URL,
  };
}

async function fillVietnamApplicationOnce(
  input: FillVietnamInput,
  options: FillVietnamOptions = {},
): Promise<FillVietnamResult> {
  const runId = options.runId;
  const headless = options.headless ?? true;
  const stepTimeoutMs = options.stepTimeoutMs ?? 60_000;
  const officialBaseUrl = options.officialBaseUrl ?? VN_LANDING_URL;
  const officialFallbackBaseUrl = options.officialFallbackBaseUrl ?? VN_FALLBACK_LANDING_URL;
  let page: Page | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let traceStarted = false;
  let keepBrowserOpenForHumanPayment = false;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const fieldFallbacks: VnFieldFallbackRecord[] = [];
  const captchaSolves: VietnamCaptchaSolveOutcome[] = [];
  let validationErrors: VietnamPortalValidationError[] = [];
  let proxiedPublicRequestCount = 0;
  const publicProxyFailures: string[] = [];
  let mainRequestFailed = false;
  let lastSnapshot: VietnamPortalSnapshot | undefined;

  const diagnostics = (): VietnamDiagnostics => ({
    consoleErrors: consoleErrors.slice(-20),
    failedRequests: failedRequests.slice(-30),
    fieldFallbacks: fieldFallbacks.slice(),
    captchaSolves: captchaSolves.slice(),
    validationErrors: validationErrors.slice(),
    lastSnapshot,
    ...(options.tracePath ? { tracePath: options.tracePath } : {}),
    ...(options.finalScreenshotPath ? { finalScreenshotPath: options.finalScreenshotPath } : {}),
    browserChannel: options.browserChannel ?? "bundled",
    portalAttempt: options.portalAttempt ?? 1,
    proxiedPublicRequestCount,
    publicProxyFailures: publicProxyFailures.slice(-10),
  });
  const emitProgress = async (stage: VietnamProgressStage): Promise<void> => {
    await options.onProgress?.(stage);
  };

  try {
    await emitProgress("browser_launching");
    if (browserbaseEnabled("VN")) {
      const cloud = await connectBrowserbaseCloudBrowser({ prefix: "VN" });
      browser = cloud.browser;
      context = cloud.context;
      page = cloud.page;
    } else {
      browser = await chromium.launch({
        headless,
        ...(options.browserChannel ? { channel: options.browserChannel } : {}),
      });
      context = await browser.newContext({ acceptDownloads: false });
      page = await context.newPage();
    }
    if (process.env.VN_PUBLIC_API_PROXY_ENABLED !== "false") {
      await installVietnamPublicApiProxy(context, {
        onSuccess: () => {
          proxiedPublicRequestCount++;
        },
        onFailure: (url, reason) => {
          publicProxyFailures.push(`${url} - ${reason}`);
        },
      });
    }
    await emitProgress("browser_ready");
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("requestfailed", (request) => {
      const failureText = request.failure()?.errorText ?? "request failed";
      failedRequests.push(`${request.method()} ${request.url()} - ${failureText}`);
      if (request.isNavigationRequest()) {
        mainRequestFailed = true;
      }
    });
    if (options.tracePath) {
      fs.mkdirSync(path.dirname(options.tracePath), { recursive: true });
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      traceStarted = true;
      await emitProgress("trace_started");
    }

    // ── Landing → reliable official checkpoint ────────────────────────
    const bootstrap = await reachVietnamFormCheckpoint(page, {
      officialBaseUrl,
      officialFallbackBaseUrl,
      stepTimeoutMs,
      failedRequestCount: () => failedRequests.length,
      mainRequestFailed: () => mainRequestFailed,
      setMainRequestFailed: (value) => {
        mainRequestFailed = value;
      },
      onSnapshot: (snapshot) => {
        lastSnapshot = snapshot;
      },
      onStage: emitProgress,
      onCaptchaSolved: (outcome) => {
        captchaSolves.push(outcome);
      },
    });

    if (bootstrap.kind === "action_required") {
      return {
        status: "action_required",
        runId,
        actionType: bootstrap.actionType,
        checkpoint: bootstrap.checkpoint,
        instruction: bootstrap.instruction,
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }

    if (bootstrap.kind === "failed") {
      return {
        status: "failed",
        runId,
        failedStep: bootstrap.checkpoint,
        error: {
          code: bootstrap.errorCode,
          message: bootstrap.reason,
          consoleErrors: diagnostics().consoleErrors,
          failedRequests: diagnostics().failedRequests,
        },
        url: page.url(),
        checkpoint: bootstrap.checkpoint,
        diagnostics: diagnostics(),
      };
    }

    if (options.stopAtFirstCheckpoint) {
      return {
        status: "scaffolded_pending_walk",
        runId,
        reason: `Official Vietnam e-Visa checkpoint reached: ${bootstrap.checkpoint}. Smoke stopped before filling applicant data.`,
        checkpoint: bootstrap.checkpoint,
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }

    // ── Fill every mapped field that we have an answer for ─────────────
    await emitProgress("application_form_visible");
    const conditionalAnswerErrors = validateVietnamConditionalAnswers(input.answers);
    if (conditionalAnswerErrors.length > 0) {
      validationErrors.push(
        ...conditionalAnswerErrors.map((error) => ({
          label: error.fieldName,
          domId: VN_FIELD_MAPPINGS[error.fieldName]?.domId,
          message: error.message,
        })),
      );
      return {
        status: "scaffolded_pending_walk",
        runId,
        reason: `Official Vietnam e-Visa portal fill blocked submission: ${validationErrors
          .map((error) => `${error.label || error.domId || "field"}: ${error.message}`)
          .join("; ")}`,
        checkpoint: "application_form_visible",
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }

    await emitProgress("filling_fields");
    let filled = 0;
    let skipped = 0;
    for (const [fieldName, mapping] of Object.entries(VN_FIELD_MAPPINGS)) {
      const value = input.answers[fieldName];
      if (!value) {
        skipped++;
        continue;
      }
      try {
        await fillByType(page, fieldName, mapping.type, mapping.domId, value);
        if (fieldName === "intended_province_city") {
          await waitForDependentAntSelectToHydrate(page, VN_FIELD_MAPPINGS.intended_ward_commune.domId);
        }
        filled += await fillVietnamConditionalRepeatGroups(page, input.answers, fieldName);
        filled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        validationErrors.push({
          label: fieldName,
          domId: mapping.domId,
          message: `Official Vietnam e-Visa portal rejected this value: ${msg}`,
        });
        console.warn(`[vn] fill failed for ${fieldName} (${mapping.domId}); no fallback used: ${msg}`);
        skipped++;
      }
    }

    if (validationErrors.length > 0) {
      return {
        status: "scaffolded_pending_walk",
        runId,
        reason: `Official Vietnam e-Visa portal fill blocked submission: ${validationErrors
          .map((error) => `${error.label || error.domId || "field"}: ${error.message}`)
          .join("; ")}`,
        checkpoint: "application_form_visible",
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }

    // ── Stop-at-pay sentinel + capture registration code ──────────────
    // Click the form's primary "Save" / "Next" button to advance to the
    // pre-pay review screen. Never click anything matching VN_STOP_BUTTON_PATTERNS.
    await emitProgress("advancing_to_review");
    await advanceToReview(page, stepTimeoutMs);
    lastSnapshot = await readVietnamPortalSnapshot(page, failedRequests.length, mainRequestFailed);
    const reviewState = classifyVietnamPortalSnapshot(lastSnapshot);
    let stateAfterCaptcha = reviewState;
    if (stateAfterCaptcha === "captcha_visible") {
      const maxReviewCaptchaAttempts = readPositiveInt(process.env.VN_REVIEW_CAPTCHA_MAX_ATTEMPTS, 3);
      for (let attempt = 1; attempt <= maxReviewCaptchaAttempts && stateAfterCaptcha === "captcha_visible"; attempt++) {
        if (attempt > 1) {
          await refreshVietnamReviewCaptcha(page);
          await page.waitForTimeout(1_000);
        }
        await emitProgress("captcha_solving");
        const captchaOutcome = await solveVietnamImageCaptcha(page, Math.min(stepTimeoutMs, 120_000));
        captchaSolves.push(captchaOutcome);
        if (!captchaOutcome.solved) {
          const recoverySnapshot = await readVietnamPortalSnapshot(
            page,
            failedRequests.length,
            mainRequestFailed,
          ).catch(() => null);
          if (recoverySnapshot) {
            lastSnapshot = recoverySnapshot;
            stateAfterCaptcha = classifyVietnamPortalSnapshot(recoverySnapshot);
            if (stateAfterCaptcha !== "captcha_visible") {
              break;
            }
          }
          return {
            status: "action_required",
            runId,
            actionType: "captcha_required",
            checkpoint: "captcha_visible",
            instruction:
              `The official Vietnam e-Visa portal is showing a CAPTCHA, but automatic solving failed: ${captchaOutcome.reason ?? "unknown CAPTCHA error"}`,
            url: page.url(),
            diagnostics: diagnostics(),
          };
        }
        await emitProgress("captcha_submitted");
        await withTimeout(
          submitReviewCaptchaAndWait(page, stepTimeoutMs),
          Math.min(stepTimeoutMs, 55_000),
          undefined,
        );
        const codeAfterCaptcha = await withTimeout(captureRegistrationCode(page), 8_000, null);
        if (codeAfterCaptcha) {
          console.log(`[vn] Run ${runId} captured registration code after review CAPTCHA.`);
          const confirmed = await withTimeout(
            confirmDeclarationCompletedNotice(page, stepTimeoutMs),
            Math.min(stepTimeoutMs, 30_000),
            false,
          );
          if (confirmed) {
            await page.waitForTimeout(1_000);
          }
        } else {
          const confirmed = await withTimeout(
            confirmDeclarationCompletedNotice(page, stepTimeoutMs),
            Math.min(stepTimeoutMs, 10_000),
            false,
          );
          if (confirmed) {
            await page.waitForTimeout(1_000);
          }
        }
        lastSnapshot = await readVietnamPortalSnapshot(page, failedRequests.length, mainRequestFailed);
        stateAfterCaptcha = classifyVietnamPortalSnapshot(lastSnapshot);
      }
    }
    let registrationCode = await withTimeout(captureRegistrationCode(page), 15_000, null);
    if (registrationCode) {
      const confirmed = await withTimeout(
        confirmDeclarationCompletedNotice(page, stepTimeoutMs),
        Math.min(stepTimeoutMs, 30_000),
        false,
      );
      if (confirmed) {
        lastSnapshot = await readVietnamPortalSnapshot(page, failedRequests.length, mainRequestFailed);
        stateAfterCaptcha = classifyVietnamPortalSnapshot(lastSnapshot);
      }
    }
    if (
      registrationCode &&
      options.allowFixedCardPayment &&
      stateAfterCaptcha !== "payment_page_visible"
    ) {
      stateAfterCaptcha = await continueVietnamSameSessionToPayment(page, stepTimeoutMs);
    }
    if (stateAfterCaptcha === "captcha_visible" && !registrationCode) {
      return {
        status: "action_required",
        runId,
        actionType: "captcha_required",
        checkpoint: "captcha_visible",
        instruction:
          "The official Vietnam e-Visa portal stayed on the security-code step after the CAPTCHA answer was submitted. Retry with a refreshed CAPTCHA or complete the security code manually.",
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }
    if (stateAfterCaptcha === "application_form_visible") {
      validationErrors = await readVietnamValidationErrors(page);
      if (validationErrors.length > 0) {
        return {
          status: "scaffolded_pending_walk",
          runId,
          reason: `Official Vietnam e-Visa portal validation blocked submission: ${validationErrors
            .map((error) => `${error.label || error.domId || "field"}: ${error.message}`)
            .join("; ")}`,
          checkpoint: stateAfterCaptcha,
          url: page.url(),
          diagnostics: diagnostics(),
        };
      }
    }
    if (stateAfterCaptcha === "upload_passport_visible" || stateAfterCaptcha === "upload_portrait_visible") {
      return {
        status: "action_required",
        runId,
        actionType: "upload_required",
        checkpoint: stateAfterCaptcha,
        instruction:
          "The official Vietnam e-Visa portal is asking for a passport or portrait upload. Upload the required file manually on the official page, then continue from VIZA.",
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }
    if (stateAfterCaptcha === "payment_page_visible") {
      await emitProgress("payment_required");
      const fixedCard = options.allowFixedCardPayment
        ? options.fixedCard ?? loadVietnamFixedCardFromEnv()
        : null;
      if (fixedCard) {
        await emitProgress("payment_handoff");
        const payment = await payVietnamPortalWithFixedCard({ page, card: fixedCard });
        if (payment.status === "paid" && payment.receiptReference) {
          return {
            status: "submitted_paid",
            runId,
            registrationCode: registrationCode ?? null,
            submittedAtIso: new Date().toISOString(),
            paymentReceiptReference: payment.receiptReference,
            redactedCard: payment.redactedCard ?? redactVietnamFixedCard(fixedCard),
            fieldsFilled: filled,
            fieldsSkipped: skipped,
            fieldFallbacks,
          };
        }
        keepBrowserOpenForHumanPayment = !headless && payment.status === "needs_human";
        return {
          status: "action_required",
          runId,
          actionType: "payment_required",
          checkpoint: "payment_page_visible",
          instruction:
            `The official Vietnam e-Visa portal reached payment, but fixed-card payment could not complete automatically: ${payment.reason ?? payment.status}`,
          url: page.url(),
          diagnostics: diagnostics(),
        };
      }
      if (!options.allowFixedCardPayment) {
        return {
          status: "action_required",
          runId,
          actionType: "payment_required",
          checkpoint: "payment_page_visible",
          instruction:
            "The official Vietnam e-Visa portal reached payment, but VIZA has not recorded an authorized official-fee payment intent for this application. Authorize payment in VIZA before continuing.",
          url: page.url(),
          diagnostics: diagnostics(),
        };
      }
      return {
        status: "action_required",
        runId,
        actionType: "payment_required",
        checkpoint: "payment_page_visible",
        instruction:
          "The official Vietnam e-Visa portal reached payment. VIZA stopped before Pay/Submit; complete payment manually only if you intend to proceed.",
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }
    if (stateAfterCaptcha === "final_submit_visible") {
      return {
        status: "action_required",
        runId,
        actionType: "final_submit_required",
        checkpoint: "final_submit_visible",
        instruction:
          "The official Vietnam e-Visa portal is at a final submission confirmation. VIZA stopped before the irreversible submit action; review and submit manually only if you intend to proceed.",
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }

    registrationCode = registrationCode ?? await withTimeout(captureRegistrationCode(page), 15_000, null);
    if (!registrationCode) {
      return {
        status: "scaffolded_pending_walk",
        runId,
        reason:
          "Form filled but registration code element not found on review screen — " +
          "selector tweak required (see VN_REGISTRATION_CODE_SELECTOR).",
        checkpoint: stateAfterCaptcha,
        url: page.url(),
        diagnostics: diagnostics(),
      };
    }

    const finalSnapshot = await readVietnamPortalSnapshot(page).catch(() => null);
    const finalState = finalSnapshot ? classifyVietnamPortalSnapshot(finalSnapshot) : stateAfterCaptcha;
    if (finalState === "payment_page_visible") {
      await emitProgress("payment_required");
      const fixedCard = options.allowFixedCardPayment
        ? options.fixedCard ?? loadVietnamFixedCardFromEnv()
        : null;
      if (fixedCard) {
        await emitProgress("payment_handoff");
        const payment = await payVietnamPortalWithFixedCard({ page, card: fixedCard });
        if (payment.status === "paid" && payment.receiptReference) {
          return {
            status: "submitted_paid",
            runId,
            registrationCode,
            submittedAtIso: new Date().toISOString(),
            paymentReceiptReference: payment.receiptReference,
            redactedCard: payment.redactedCard ?? redactVietnamFixedCard(fixedCard),
            fieldsFilled: filled,
            fieldsSkipped: skipped,
            fieldFallbacks,
          };
        }
        keepBrowserOpenForHumanPayment = !headless && payment.status === "needs_human";
        return {
          status: "action_required",
          runId,
          actionType: "payment_required",
          checkpoint: "payment_page_visible",
          instruction:
            `The official Vietnam e-Visa portal reached payment, but fixed-card payment could not complete automatically: ${payment.reason ?? payment.status}`,
          url: page.url(),
          diagnostics: diagnostics(),
        };
      }
    }

    return {
      status: "submitted_pending_pay",
      runId,
      registrationCode,
      submittedAtIso: new Date().toISOString(),
      fieldsFilled: filled,
      fieldsSkipped: skipped,
      fieldFallbacks,
    };
  } catch (err) {
    return {
      status: "failed",
      runId,
      failedStep: page?.url() ?? "bootstrap",
      error: serializeError(err),
      url: page?.url() ?? VN_LANDING_URL,
      diagnostics: diagnostics(),
    };
  } finally {
    if (options.finalScreenshotPath && page) {
      try {
        fs.mkdirSync(path.dirname(options.finalScreenshotPath), { recursive: true });
        await page.screenshot({ path: options.finalScreenshotPath, fullPage: true });
      } catch {
        /* best-effort diagnostics */
      }
    }
    if (traceStarted && context && options.tracePath) {
      try {
        await context.tracing.stop({ path: options.tracePath });
      } catch {
        /* best-effort diagnostics */
      }
    }
    if (keepBrowserOpenForHumanPayment) {
      console.warn(
        `[vn] Run ${runId ?? "(unknown)"} left the official payment browser open for 3DS/OTP/bank-app confirmation.`,
      );
    } else {
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
}

type VietnamBootstrapResult =
  | { kind: "ready"; checkpoint: VietnamPortalStateId }
  | {
      kind: "action_required";
      actionType:
        | "note_modal_required"
        | "captcha_required"
        | "upload_required"
        | "payment_required"
        | "final_submit_required"
        | "layout_changed"
        | "official_portal_error"
        | "needs_manual_verification";
      checkpoint: VietnamPortalStateId;
      instruction: string;
    }
  | {
      kind: "failed";
      checkpoint: VietnamPortalStateId;
      errorCode: string;
      reason: string;
    };

interface VietnamBootstrapOptions {
  officialBaseUrl: string;
  officialFallbackBaseUrl: string;
  stepTimeoutMs: number;
  failedRequestCount: () => number;
  mainRequestFailed: () => boolean;
  setMainRequestFailed: (value: boolean) => void;
  onSnapshot: (snapshot: VietnamPortalSnapshot) => void;
  onStage: (stage: VietnamProgressStage) => void | Promise<void>;
  onCaptchaSolved: (outcome: VietnamCaptchaSolveOutcome) => void;
}

async function reachVietnamFormCheckpoint(
  page: Page,
  options: VietnamBootstrapOptions,
): Promise<VietnamBootstrapResult> {
  const bases = Array.from(new Set([options.officialBaseUrl, options.officialFallbackBaseUrl].filter(Boolean)));
  let lastState: VietnamPortalStateId = "layout_changed";
  let attemptedFallback = false;
  let attemptedFormReload = false;
  let attemptedFormFallback = false;

  const readState = async (): Promise<VietnamPortalStateId> => {
    const snapshot = await readVietnamPortalSnapshot(
      page,
      options.failedRequestCount(),
      options.mainRequestFailed(),
    );
    options.onSnapshot(snapshot);
    const state = classifyVietnamPortalSnapshot(snapshot);
    lastState = state;
    return state;
  };

  const openBase = async (baseUrl: string): Promise<VietnamPortalStateId> => {
    await options.onStage("opening_landing");
    options.setMainRequestFailed(false);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: options.stepTimeoutMs }).catch(() => undefined);
    const checkpoint = await waitForVietnamPortalCheckpoint(page, "any", {
      timeoutMs: Math.min(options.stepTimeoutMs, 30_000),
      failedRequestCount: options.failedRequestCount,
      mainRequestFailed: options.mainRequestFailed,
      onSnapshot: options.onSnapshot,
    });
    lastState = checkpoint.state;
    await options.onStage(`official_checkpoint:${checkpoint.state}`);
    return checkpoint.state;
  };

  let state = await openBase(bases[0] ?? VN_LANDING_URL);
  if (state === "white_screen" || state === "network_blocked") {
    options.setMainRequestFailed(false);
    await page.reload({ waitUntil: "domcontentloaded", timeout: Math.min(options.stepTimeoutMs, 45_000) }).catch(() => undefined);
    state = await readState();
  }
  if ((state === "white_screen" || state === "network_blocked") && bases.length > 1) {
    attemptedFallback = true;
    state = await openBase(bases[1]);
  }

  for (let step = 0; step < 8; step++) {
    if (state === "application_form_visible") {
      return { kind: "ready", checkpoint: state };
    }

    if (
      !attemptedFormReload &&
      page.url().includes(FORM_ROUTE_FRAGMENT) &&
      (state === "apply_now_visible" || state === "landing_page_loaded" || state === "layout_changed")
    ) {
      attemptedFormReload = true;
      await page.reload({ waitUntil: "domcontentloaded", timeout: Math.min(options.stepTimeoutMs, 45_000) }).catch(() => undefined);
      const checkpoint = await waitForVietnamPortalCheckpoint(
        page,
        [
          "form_ready",
          "note_modal_required",
          "captcha_required",
          "upload_required",
          "payment_required",
          "final_submit_required",
          "official_portal_error",
          "layout_changed",
        ],
        {
          timeoutMs: Math.min(options.stepTimeoutMs, 45_000),
          failedRequestCount: options.failedRequestCount,
          mainRequestFailed: options.mainRequestFailed,
          onSnapshot: options.onSnapshot,
        },
      );
      state = checkpoint.state;
      await options.onStage(`official_checkpoint:${state}`);
      continue;
    }

    if (
      !attemptedFormFallback &&
      bases.length > 1 &&
      page.url().includes(FORM_ROUTE_FRAGMENT) &&
      (state === "apply_now_visible" || state === "landing_page_loaded" || state === "layout_changed")
    ) {
      attemptedFormFallback = true;
      const fallbackFormUrl = new URL(FORM_ROUTE_FRAGMENT, bases[1]).toString();
      state = await openBase(fallbackFormUrl);
      continue;
    }

    if (isAutoAcknowledgeableVietnamPortalState(state)) {
      await options.onStage("acknowledging_note");
      const acknowledged = await acknowledgeVietnamNoteModal(page);
      if (!acknowledged) {
        return {
          kind: "action_required",
          actionType: "note_modal_required",
          checkpoint: state,
          instruction:
            "The official Vietnam e-Visa page is showing a NOTE declaration dialog, but VIZA could not find a safe acknowledgement control.",
        };
      }
      const checkpoint = await waitForVietnamPortalCheckpoint(
        page,
        [
          "form_ready",
          "captcha_required",
          "upload_required",
          "payment_required",
          "final_submit_required",
          "official_portal_error",
          "layout_changed",
        ],
        {
          timeoutMs: Math.min(options.stepTimeoutMs, 30_000),
          failedRequestCount: options.failedRequestCount,
          mainRequestFailed: options.mainRequestFailed,
          onSnapshot: options.onSnapshot,
        },
      );
      state = checkpoint.state;
      await options.onStage(`official_checkpoint:${state}`);
      continue;
    }

    if (state === "captcha_visible") {
      await options.onStage("captcha_solving");
      const outcome = await solveVietnamImageCaptcha(page, Math.min(options.stepTimeoutMs, 120_000));
      options.onCaptchaSolved(outcome);
      if (!outcome.solved) {
        return {
          kind: "action_required",
          actionType: "captcha_required",
          checkpoint: state,
          instruction:
            `The official Vietnam e-Visa portal is showing a CAPTCHA, but automatic solving failed: ${outcome.reason ?? "unknown CAPTCHA error"}`,
        };
      }
      await options.onStage("captcha_submitted");
      const checkpoint = await waitForVietnamPortalCheckpoint(
        page,
        [
          "form_ready",
          "note_modal_required",
          "upload_required",
          "payment_required",
          "final_submit_required",
          "official_portal_error",
          "layout_changed",
        ],
        {
          timeoutMs: Math.min(options.stepTimeoutMs, 30_000),
          failedRequestCount: options.failedRequestCount,
          mainRequestFailed: options.mainRequestFailed,
          onSnapshot: options.onSnapshot,
        },
      );
      state = checkpoint.state;
      await options.onStage(`official_checkpoint:${state}`);
      continue;
    }

    if (state === "upload_passport_visible" || state === "upload_portrait_visible") {
      return {
        kind: "action_required",
        actionType: "upload_required",
        checkpoint: state,
        instruction:
          "The official Vietnam e-Visa page is asking for a passport or portrait upload. Upload the required file manually on the official page, then continue from VIZA.",
      };
    }

    if (state === "payment_page_visible" || state === "registration_code_visible") {
      return {
        kind: "action_required",
        actionType: "payment_required",
        checkpoint: state,
        instruction:
          "The official Vietnam e-Visa portal reached a payment/reference checkpoint. VIZA stopped before Pay/Submit.",
      };
    }

    if (state === "final_submit_visible") {
      return {
        kind: "action_required",
        actionType: "final_submit_required",
        checkpoint: state,
        instruction:
          "The official Vietnam e-Visa portal reached a final submission confirmation. VIZA stopped before the irreversible submit action.",
      };
    }

    if (state === "white_screen" || state === "network_blocked") {
      if (!attemptedFallback && bases.length > 1) {
        attemptedFallback = true;
        state = await openBase(bases[1]);
        continue;
      }
      return {
        kind: "failed",
        checkpoint: state,
        errorCode: state === "white_screen" ? "official_portal_white_screen" : "official_portal_network_blocked",
        reason:
          state === "white_screen"
            ? "The official Vietnam e-Visa portal rendered a white screen after reload and fallback attempts."
            : "The official Vietnam e-Visa portal navigation or critical resources were blocked after fallback attempts.",
      };
    }

    if (state === "portal_error") {
      return {
        kind: "failed",
        checkpoint: state,
        errorCode: "official_portal_error",
        reason: "The official Vietnam e-Visa portal returned an error or maintenance page.",
      };
    }

    if (
      state === "landing_page_loaded" ||
      state === "apply_now_visible" ||
      state === "language_switch_visible"
    ) {
      const declarationVisible = await isVietnamDeclarationInstructionPage(page);
      if (declarationVisible) {
        await options.onStage("acknowledging_note");
        const acknowledged = await acknowledgeVietnamNoteModal(page);
        if (!acknowledged) {
          return {
            kind: "action_required",
            actionType: "note_modal_required",
            checkpoint: "note_modal_visible",
            instruction:
              "The official Vietnam e-Visa declaration page is visible, but VIZA could not find a safe acknowledgement control.",
          };
        }
        const checkpoint = await waitForVietnamPortalCheckpoint(
          page,
          [
            "form_ready",
            "captcha_required",
            "upload_required",
            "payment_required",
            "final_submit_required",
            "official_portal_error",
            "layout_changed",
          ],
          {
            timeoutMs: Math.min(options.stepTimeoutMs, 45_000),
            failedRequestCount: options.failedRequestCount,
            mainRequestFailed: options.mainRequestFailed,
            onSnapshot: options.onSnapshot,
          },
        );
        state = checkpoint.state;
        await options.onStage(`official_checkpoint:${state}`);
        continue;
      }
      const clicked = await clickVietnamApplyEntry(page);
      if (!clicked) {
        return {
          kind: "action_required",
          actionType: "needs_manual_verification",
          checkpoint: state,
          instruction:
            "The official Vietnam e-Visa landing page loaded, but the worker could not find a reliable Apply link. Continue manually on the official page or retry after selectors are updated.",
        };
      }
      await page
        .waitForURL(new RegExp(FORM_ROUTE_FRAGMENT.replace(/\//g, "\\/")), { timeout: 15_000 })
        .catch(() => undefined);
      const checkpoint = await waitForVietnamPortalCheckpoint(
        page,
        [
          "form_ready",
          "note_modal_required",
          "captcha_required",
          "upload_required",
          "payment_required",
          "final_submit_required",
          "official_portal_error",
          "layout_changed",
        ],
        {
          timeoutMs: Math.min(options.stepTimeoutMs, 30_000),
          failedRequestCount: options.failedRequestCount,
          mainRequestFailed: options.mainRequestFailed,
          onSnapshot: options.onSnapshot,
        },
      );
      state = checkpoint.state;
      await options.onStage(`official_checkpoint:${state}`);
      continue;
    }

    return {
      kind: "action_required",
      actionType: "layout_changed",
      checkpoint: state,
      instruction:
        "The official Vietnam e-Visa portal layout changed. VIZA stopped before filling so the worker can be updated safely.",
    };
  }

  return {
    kind: "action_required",
    actionType: "layout_changed",
    checkpoint: lastState,
    instruction:
      "The official Vietnam e-Visa portal did not reach the form after multiple safe navigation attempts.",
  };
}

async function isVietnamDeclarationInstructionPage(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").toLowerCase();
      const hasDeclaration =
        (text.includes("declaration instructions") &&
        (text.includes("confirm compliance with vietnamese laws") ||
          text.includes("confirmation of reading carefully instructions") ||
          text.includes("note declaration instructions"))) ||
        text.includes("hướng dẫn khai báo") ||
        text.includes("xác nhận đã đọc kỹ") ||
        text.includes("xác nhận tuân thủ pháp luật");
      const hasNext = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"))
        .some((element) => /^(next|tiếp tục)$/i.test((element.innerText || element.textContent || "").trim()));
      return hasDeclaration && hasNext;
    })
    .catch(() => false);
}

async function clickVietnamApplyEntry(page: Page): Promise<boolean> {
  const candidates = await page
    .evaluate(() => {
      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      const buttons = Array.from(
        document.querySelectorAll<HTMLElement>("button, [role='button']"),
      );
      return {
        buttons: buttons.map((element, index) => ({
          index,
          text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim(),
          visible: visible(element),
        })),
        links: links.map((anchor) => ({
          href: anchor.href || anchor.getAttribute("href") || "",
        })),
      };
    })
    .catch(() => null);
  if (!candidates) return false;

  const choice = chooseVietnamApplyEntry(candidates);
  if (!choice) return false;
  if (choice.kind === "button") {
    await page
      .locator("button, [role='button']")
      .nth(choice.index)
      .click({ timeout: 10_000 });
    return true;
  }
  await page.goto(choice.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
  return true;
}

function isForbiddenVietnamAutoCheckboxText(text: string): boolean {
  return /agree\s+to\s+create\s+account\s+by\s+email|create\s+account\s+by\s+email/i.test(text);
}

async function readCheckboxContextText(input: Locator): Promise<string> {
  return input
    .evaluate((element) => {
      const label = element.closest("label") ?? element.closest(".ant-checkbox-wrapper") ?? element.parentElement;
      return [
        element.getAttribute("aria-label"),
        element.getAttribute("name"),
        element.getAttribute("id"),
        label?.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .catch(() => "");
}

async function acknowledgeVietnamNoteModal(page: Page): Promise<boolean> {
  await page
    .evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior });
      for (const element of Array.from(document.querySelectorAll<HTMLElement>("div, main, section, article"))) {
        if (element.scrollHeight > element.clientHeight + 100) {
          element.scrollTop = element.scrollHeight;
        }
      }
    })
    .catch(() => undefined);
  await page.waitForTimeout(300);

  const checkboxInputs = page.locator("input[type='checkbox']:visible");
  const checkedStates = await checkboxInputs
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).checked))
    .catch(() => [] as boolean[]);
  for (const index of uncheckedVietnamDeclarationIndexes(checkedStates)) {
    const checkbox = checkboxInputs.nth(index);
    const contextText = await readCheckboxContextText(checkbox);
    if (isForbiddenVietnamAutoCheckboxText(contextText)) continue;
    await checkbox.check({ force: true }).catch(() => undefined);
  }
  const allChecked =
    (await checkboxInputs.count()) >= 2 &&
    (await checkboxInputs
      .evaluateAll((inputs) =>
        inputs.every((input) => {
          const htmlInput = input as HTMLInputElement;
          const label = input.closest("label") ?? input.closest(".ant-checkbox-wrapper") ?? input.parentElement;
          const contextText = [
            input.getAttribute("aria-label"),
            input.getAttribute("name"),
            input.getAttribute("id"),
            label?.textContent,
          ]
            .filter(Boolean)
            .join(" ");
          if (/agree\s+to\s+create\s+account\s+by\s+email|create\s+account\s+by\s+email/i.test(contextText)) {
            return true;
          }
          return htmlInput.checked;
        }),
      )
      .catch(() => false));
  if (!allChecked) return false;

  const clicked = await page
    .getByRole("button", {
      name: /^(next|ok|confirm|accept|agree|continue|tiếp tục|đồng ý|xác nhận)$/i,
    })
    .filter({ visible: true })
    .last()
    .click({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!clicked) return false;
  await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);
  return true;
}

async function fillByType(
  page: Page,
  fieldName: string,
  type: VnFieldType,
  domId: string,
  rawValue: string,
): Promise<void> {
  const portalOptionText = getVnPortalOptionText(fieldName, rawValue);
  switch (type) {
    case "text":
    case "textarea":
      await fillText(page, domId, rawValue);
      return;
    case "select":
    case "country":
      await pickSelect(page, domId, portalOptionText);
      return;
    case "radio":
      await pickRadio(page, domId, portalOptionText);
      return;
    case "date":
      await fillDate(page, domId, toPortalDateForField(fieldName, rawValue));
      return;
    case "checkbox":
      await tickCheckbox(page, domId, rawValue);
      return;
    case "upload":
      await uploadVietnamFile(page, domId, rawValue, fieldName);
      return;
    default:
      return;
  }
}

async function waitForDependentAntSelectToHydrate(
  page: Page,
  domId: string,
  timeoutMs = 7_500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const optionCount = await page
      .evaluate(async (id) => {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`);
        const select = input?.closest<HTMLElement>(".ant-select");
        const selector = select?.querySelector<HTMLElement>(".ant-select-selector") ?? select;
        if (!input || !select || !selector) return 0;
        selector.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        selector.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
        selector.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
        input.focus();
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
        await sleep(300);
        const optionTexts = Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown"))
          .filter((dropdown) => {
            const style = window.getComputedStyle(dropdown);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              !dropdown.classList.contains("ant-select-dropdown-hidden")
            );
          })
          .flatMap((dropdown) =>
            Array.from(dropdown.querySelectorAll<HTMLElement>(".ant-select-item-option"))
              .map((option) => (option.innerText || option.textContent || "").trim())
              .filter(Boolean),
          );
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape", code: "Escape" }));
        return optionTexts.length;
      }, domId)
      .catch(() => 0);
    if (optionCount > 0) return;
    await page.waitForTimeout(500);
  }
}

export function toPortalDateForField(fieldName: string, rawValue: string, now = new Date()): string {
  const formatted = toDdMmYyyy(rawValue);
  if (fieldName !== "visa_valid_from") return formatted;
  const parsed = parseDdMmYyyy(formatted);
  if (!parsed) return formatted;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed < today ? formatDdMmYyyy(today) : formatted;
}

function parseDdMmYyyy(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }
  return parsed;
}

function formatDdMmYyyy(value: Date): string {
  const day = `${value.getDate()}`.padStart(2, "0");
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}/${value.getFullYear()}`;
}

async function uploadVietnamFile(page: Page, domId: string, rawPath: string, fieldName: string): Promise<void> {
  const localPath = path.resolve(rawPath);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Vietnam upload file not found for ${domId}: ${localPath}`);
  }
  const uploadPath = await prepareVietnamUploadFile(page, localPath, fieldName);
  const uploadIndex = fieldName === "portrait_photo" ? 0 : 1;
  const labelPattern =
    fieldName === "portrait_photo"
      ? /portrait photography/i
      : /passport data page image/i;
  const byLabel = page
    .locator(".ant-form-item")
    .filter({ hasText: labelPattern })
    .locator('input[type="file"]')
    .first();
  const byId = page.locator(`#${cssEscape(domId)}[type="file"]`).first();
  const fileInput =
    (await byLabel.count().catch(() => 0)) > 0
      ? byLabel
      : (await byId.count().catch(() => 0)) > 0
        ? byId
        : page.locator('input[type="file"]').nth(uploadIndex);
  await fileInput.setInputFiles(uploadPath, { timeout: 20_000 });
  await waitForVietnamUploadPreview(page, domId, uploadIndex, labelPattern);
}

async function prepareVietnamUploadFile(page: Page, localPath: string, fieldName: string): Promise<string> {
  const maxBytes = 1_900_000;
  const stat = fs.statSync(localPath);
  if (stat.size <= maxBytes) return localPath;
  const ext = path.extname(localPath).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return localPath;

  const sourceBase64 = fs.readFileSync(localPath).toString("base64");
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const compressed = await page.evaluate(
    async ({ sourceBase64, mimeType, maxBytes, fieldName }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("image_decode_failed"));
          image.src = src;
        });
      const image = await loadImage(`data:${mimeType};base64,${sourceBase64}`);
      const maxDimension = fieldName === "portrait_photo" ? 900 : 1800;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas_context_unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",", 2)[1] ?? "";
        const bytes = Math.floor((base64.length * 3) / 4);
        if (bytes <= maxBytes || quality === 0.46) {
          return { base64, bytes, width: canvas.width, height: canvas.height, quality };
        }
      }
      throw new Error("image_compression_failed");
    },
    { sourceBase64, mimeType, maxBytes, fieldName },
  );
  const outputPath = path.join(
    path.dirname(localPath),
    `${path.basename(localPath, path.extname(localPath))}-vietnam-upload.jpg`,
  );
  fs.writeFileSync(outputPath, Buffer.from(compressed.base64, "base64"));
  console.log(
    `[vn] compressed ${fieldName} upload ${path.basename(localPath)} ${stat.size}B -> ${path.basename(outputPath)} ${compressed.bytes}B (${compressed.width}x${compressed.height}, q=${compressed.quality})`,
  );
  return outputPath;
}

async function waitForVietnamUploadPreview(
  page: Page,
  domId: string,
  uploadIndex: number,
  labelPattern: RegExp,
): Promise<void> {
  const accepted = await page
    .waitForFunction(
      ({ domId, uploadIndex, labelSource, labelFlags }) => {
        const labelRegex = new RegExp(labelSource, labelFlags);
        const labeledInput =
          Array.from(document.querySelectorAll<HTMLElement>(".ant-form-item"))
            .find((item) => labelRegex.test(item.textContent ?? ""))
            ?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
        const input =
          labeledInput ??
          document.querySelector<HTMLInputElement>(`#${CSS.escape(domId)}[type="file"]`) ??
          Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))[uploadIndex] ??
          null;
        const formItem = input?.closest(".ant-form-item") ?? input?.closest(".ant-upload-wrapper") ?? input?.parentElement;
        const text = (formItem?.textContent ?? "").replace(/\s+/g, " ");
        const hasError = /please enter|not be empty|required/i.test(text);
        const hasPreview =
          Boolean(formItem?.querySelector("img[src^='blob:'], img[src^='data:'], .ant-upload-list-item, .ant-upload-list-item-done")) ||
          Boolean(input?.files && input.files.length > 0);
        return hasPreview && !hasError;
      },
      {
        domId,
        uploadIndex,
        labelSource: labelPattern.source,
        labelFlags: labelPattern.flags,
      },
      { timeout: 8_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!accepted) {
    await page.waitForTimeout(1_000);
  }
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

async function advanceToReview(page: Page, timeoutMs: number): Promise<void> {
  // Click the primary form action (typically "Save" / "Tiếp tục") but only if
  // its label does NOT match one of the stop patterns. If the dominant
  // action is already a Pay/Submit button, leave the page where it is —
  // the registration-code capture either succeeds or returns null.
  await page.evaluate(() => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const declarationWrapper = Array.from(document.querySelectorAll<HTMLElement>(".ant-checkbox-wrapper"))
      .filter(visible)
      .find((wrapper) => /i hereby declare|cam đoan|cam kết/i.test(wrapper.innerText || wrapper.textContent || ""));
    const declarationInput = declarationWrapper?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const isChecked =
      declarationInput?.checked ||
      declarationWrapper?.querySelector(".ant-checkbox-checked") !== null ||
      declarationWrapper?.getAttribute("aria-checked") === "true";
    if (declarationWrapper && !isChecked) {
      declarationWrapper.scrollIntoView({ block: "center" });
      declarationWrapper.click();
    }
  });
  await page.waitForTimeout(300);

  const clicked = await page.evaluate((stopPatterns) => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const stopRegexes = stopPatterns.map((pattern) => new RegExp(pattern, "i"));
    const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .filter(visible)
      .filter((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true")
      .filter((button) => {
        const text = (button.innerText || button.textContent || "").replace(/\s+/g, " ").trim();
        return /^(next|save|continue|tiếp tục|lưu)$/i.test(text) && !stopRegexes.some((rx) => rx.test(text));
      });
    const button = candidates[candidates.length - 1];
    if (!button) return false;
    button.scrollIntoView({ block: "center" });
    button.click();
    return true;
  }, VN_STOP_BUTTON_PATTERNS.map((rx) => rx.source));
  if (!clicked) return;
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 30_000) }).catch(() => undefined);
  await page.waitForTimeout(2_000);
}

async function submitReviewCaptchaAndWait(page: Page, timeoutMs: number): Promise<void> {
  const target = await page
    .evaluate(() => {
      const visible = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const captchaInput = Array.from(document.querySelectorAll<HTMLInputElement>("input"))
        .filter(visible)
        .find((input) => /captcha|security code|mã xác nhận|ma xac nhan/i.test(`${input.placeholder} ${input.name} ${input.id} ${input.className}`));
      const inputRect = captchaInput?.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .filter(visible)
        .filter((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true")
        .filter((button) => /^(next|continue|tiếp tục)$/i.test((button.innerText || button.textContent || "").replace(/\s+/g, " ").trim()))
        .map((button) => {
          const rect = button.getBoundingClientRect();
          const distance = inputRect
            ? Math.abs(rect.top - inputRect.bottom) + Math.abs(rect.left - inputRect.left)
            : rect.top;
          return { button, distance };
        })
        .sort((left, right) => left.distance - right.distance);
      const button = candidates[0]?.button;
      if (!button) return null;
      button.scrollIntoView({ block: "center" });
      const rect = button.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    })
    .catch(() => null);
  if (target) {
    await page.mouse.click(target.x, target.y).catch(async () => {
      await page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y) as HTMLElement | null;
        element?.click();
      }, target);
    });
  }
  // The Vietnam portal often keeps analytics/API requests open after the
  // security-code submit. Waiting for networkidle can pin the worker at
  // captcha_submitted even when the page has already advanced to payment.
  await page.waitForTimeout(Math.min(timeoutMs, 5_000));
}

async function refreshVietnamReviewCaptcha(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const visible = (element: Element | null): element is HTMLElement | SVGElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const captchaInput = Array.from(document.querySelectorAll<HTMLInputElement>("input"))
        .filter(visible)
        .find((input) => /captcha|security code|mã xác nhận|ma xac nhan/i.test(`${input.placeholder} ${input.name} ${input.id} ${input.className}`));
      captchaInput?.focus();
      if (captchaInput) {
        captchaInput.value = "";
        captchaInput.dispatchEvent(new InputEvent("input", { bubbles: true, data: "", inputType: "deleteContentBackward" }));
        captchaInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const inputRect = captchaInput?.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll<HTMLElement | SVGElement>("button, .anticon, svg, img, a"))
        .filter(visible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const text = `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""} ${element.getAttribute("class") ?? ""}`;
          const isRefresh = /reload|refresh|sync|redo|captcha|anticon-sync/i.test(text);
          const distance = inputRect
            ? Math.abs(rect.left - inputRect.right) + Math.abs(rect.top + rect.height / 2 - (inputRect.top + inputRect.height / 2)) * 2
            : rect.top;
          return { element, score: distance + (isRefresh ? -200 : 0) };
        })
        .sort((left, right) => left.score - right.score);
      const target = candidates[0]?.element as HTMLElement | SVGElement | undefined;
      target?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      target?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      target?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    })
    .catch(() => undefined);
}

async function captureRegistrationCode(page: Page): Promise<string | null> {
  // Try the explicit selector first; fall back to body-text regexes for
  // "Mã hồ sơ" / "Registration code" / "Electronic document code" patterns.
  const visibleCode = await page
    .evaluate(() => {
      const texts = [
        document.body?.innerText ?? "",
        ...Array.from(document.querySelectorAll<HTMLElement>(".ant-modal, .ant-modal-root, .ant-modal-content, [role='dialog'], .notice"))
          .map((element) => element.innerText || element.textContent || ""),
      ];
      for (const text of texts) {
        const electronic = text.match(/\bE\d{6}[A-Z0-9]{8,}\b/i);
        if (electronic) return electronic[0].toUpperCase();
        const labeled = text.match(/(?:mã hồ sơ|registration\s*code|electronic\s+document\s+code)[:\s]+([A-Z0-9]{8,})/i);
        if (labeled) return labeled[1].toUpperCase();
      }
      return null;
    })
    .catch(() => null);
  if (visibleCode) return visibleCode;

  const explicit = await page
    .locator(VN_REGISTRATION_CODE_SELECTOR)
    .first()
    .textContent()
    .catch(() => null);
  if (explicit) {
    const m = explicit.match(/[A-Z0-9]{8,}/);
    if (m) return m[0];
  }
  const body = await page.textContent("body").catch(() => null);
  if (body) {
    const m = body.match(/(?:mã hồ sơ|registration\s*code|electronic\s+document\s+code)[:\s]+([A-Z0-9]{8,})/i);
    if (m) return m[1];
    const electronicCode = body.match(/\bE\d{6}[A-Z0-9]{8,}\b/i);
    if (electronicCode) return electronicCode[0].toUpperCase();
  }
  return null;
}

async function confirmDeclarationCompletedNotice(page: Page, timeoutMs: number): Promise<boolean> {
  const hasNotice = await page
    .locator("text=/DECLARATION COMPLETED|ADDITIONAL COMPLETED|Electronic document code/i")
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
  if (!hasNotice) return false;
  const clicked = await page
    .getByRole("button", { name: /^confirm$/i })
    .filter({ visible: true })
    .last()
    .click({ timeout: 10_000 })
    .then(() => true)
    .catch(async () => {
      return page
        .evaluate(() => {
          const visible = (element: Element | null): element is HTMLElement => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          };
          const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
            .filter(visible)
            .filter((button) => /^confirm$/i.test((button.innerText || button.textContent || "").trim()));
          const button = buttons[buttons.length - 1];
          if (!button) return false;
          button.scrollIntoView({ block: "center" });
          button.click();
          return true;
        })
        .catch(() => false);
    });
  if (!clicked) return false;
  await page
    .waitForFunction(
      () => {
        const body = document.body?.innerText ?? "";
        return /payment|pay|phí|thanh toán|registration code|electronic document code|additional completed/i.test(body);
      },
      { timeout: Math.min(timeoutMs, 20_000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(2_000);
  return true;
}

async function continueVietnamSameSessionToPayment(
  page: Page,
  timeoutMs: number,
): Promise<VietnamPortalStateId> {
  const deadline = Date.now() + Math.min(timeoutMs, 90_000);
  let lastState: VietnamPortalStateId = "registration_code_visible";
  while (Date.now() < deadline) {
    const snapshot = await readVietnamPortalSnapshot(page);
    lastState = classifyVietnamPortalSnapshot(snapshot);
    if (lastState === "payment_page_visible") return lastState;
    if (lastState === "final_submit_visible") {
      const clicked = await clickVietnamVisibleButton(page, [
        "Payment",
        "Pay",
        "Confirm",
        "Submit",
        "Next",
        "Continue",
      ]);
      if (!clicked) return lastState;
      await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 45_000) }).catch(() => undefined);
      await page.waitForTimeout(1_500);
      continue;
    }
    const clicked = await clickVietnamVisibleButton(page, [
      "Payment",
      "Pay",
      "Confirm",
      "Next",
      "Continue",
      "OK",
    ]);
    if (!clicked) return lastState;
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 45_000) }).catch(() => undefined);
    await page.waitForTimeout(1_500);
  }
  return lastState;
}

async function clickVietnamVisibleButton(page: Page, labels: string[]): Promise<boolean> {
  return page
    .evaluate((buttonLabels) => {
      const visible = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const normalizedLabels = buttonLabels.map((label) => label.toLowerCase());
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], a"))
        .filter(visible)
        .filter((element) => {
          const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
          if (!text) return false;
          return normalizedLabels.some((label) => text === label || text.includes(label));
        })
        .filter((element) => {
          if (element instanceof HTMLButtonElement && element.disabled) return false;
          if (element.getAttribute("aria-disabled") === "true") return false;
          return !/\bdisabled\b/i.test(element.className.toString());
        });
      const target = candidates[candidates.length - 1];
      if (!target) return false;
      target.scrollIntoView({ block: "center" });
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      target.click();
      return true;
    }, labels)
    .catch(() => false);
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}

function readPositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function suffixArtifactPath(filePath: string | undefined, attempt: number): string | undefined {
  if (!filePath) return undefined;
  const extension = path.extname(filePath);
  const base = extension ? filePath.slice(0, -extension.length) : filePath;
  return `${base}-attempt-${attempt}${extension}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
