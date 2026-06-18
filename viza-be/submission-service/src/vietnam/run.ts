/**
 * Vietnam e-Visa autofill runner.
 *
 * Drives the evisa.gov.vn application form from the landing page through
 * the post-modal Vue SPA, fills every field present in
 * `VN_FIELD_MAPPINGS`, then HALTS before the Pay/Submit button. The
 * applicant completes payment manually on evisa.gov.vn using the captured
 * `registrationCode`; the actual e-visa PDF arrives via email ~3 working
 * days after payment is approved.
 *
 * Stops short of any irreversible action — the runner clicks "Next" /
 * "Save" only, never "Submit" or "Pay".
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { solveVietnamImageCaptcha, type VietnamCaptchaSolveOutcome } from "./captcha";
import {
  buildVnFieldFallback,
  getVnPortalOptionText,
  getVnFieldFallbackValue,
  VN_FIELD_MAPPINGS,
  VN_REGISTRATION_CODE_SELECTOR,
  VN_STOP_BUTTON_PATTERNS,
  type VnFieldFallbackRecord,
  type VnFieldType,
} from "./field-mappings";
import { fillDate, fillText, pickRadio, pickSelect, tickCheckbox, toDdMmYyyy } from "./fillers";
import {
  classifyVietnamPortalSnapshot,
  isAutoAcknowledgeableVietnamPortalState,
  readVietnamPortalSnapshot,
  waitForVietnamPortalCheckpoint,
  type VietnamPortalSnapshot,
  type VietnamPortalStateId,
} from "./portal-state";
import type { VietnamProgressStage } from "./progress";
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
}

const VN_LANDING_URL = process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/";
const VN_FALLBACK_LANDING_URL =
  process.env.VN_OFFICIAL_FALLBACK_BASE_URL ?? "https://thithucdientu.gov.vn/";
const FORM_ROUTE_FRAGMENT = "/e-visa/foreigners";

export async function fillVietnamApplication(
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
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const fieldFallbacks: VnFieldFallbackRecord[] = [];
  const captchaSolves: VietnamCaptchaSolveOutcome[] = [];
  let validationErrors: VietnamPortalValidationError[] = [];
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
  });
  const emitProgress = async (stage: VietnamProgressStage): Promise<void> => {
    await options.onProgress?.(stage);
  };

  try {
    await emitProgress("browser_launching");
    browser = await chromium.launch({ headless });
    context = await browser.newContext({ acceptDownloads: false });
    page = await context.newPage();
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
        filled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const fallbackValue = getVnFieldFallbackValue(fieldName);
        const fallbackRecord = buildVnFieldFallback({
          fieldName,
          domId: mapping.domId,
          type: mapping.type,
          userValue: value,
          errorMessage: msg,
        });
        if (fallbackValue && fallbackRecord) {
          try {
            await fillByType(page, fieldName, mapping.type, mapping.domId, fallbackValue);
            fieldFallbacks.push(fallbackRecord);
            filled++;
            console.warn(
              `[vn] fill fallback for ${fieldName} (${mapping.domId}): ${msg}; used ${fallbackValue}`,
            );
            continue;
          } catch (fallbackErr) {
            const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            console.warn(
              `[vn] fallback fill failed for ${fieldName} (${mapping.domId}): ${fallbackMsg}`,
            );
          }
        }
        console.warn(`[vn] fill failed for ${fieldName} (${mapping.domId}): ${msg}`);
        skipped++;
      }
    }

    // ── Stop-at-pay sentinel + capture registration code ──────────────
    // Click the form's primary "Save" / "Next" button to advance to the
    // pre-pay review screen. Never click anything matching VN_STOP_BUTTON_PATTERNS.
    await emitProgress("advancing_to_review");
    await advanceToReview(page, stepTimeoutMs);
    lastSnapshot = await readVietnamPortalSnapshot(page, failedRequests.length, mainRequestFailed);
    const reviewState = classifyVietnamPortalSnapshot(lastSnapshot);
    if (reviewState === "captcha_visible") {
      await emitProgress("captcha_solving");
      const captchaOutcome = await solveVietnamImageCaptcha(page, Math.min(stepTimeoutMs, 120_000));
      captchaSolves.push(captchaOutcome);
      if (!captchaOutcome.solved) {
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
      await advanceToReview(page, stepTimeoutMs);
      lastSnapshot = await readVietnamPortalSnapshot(page, failedRequests.length, mainRequestFailed);
    }
    const stateAfterCaptcha = classifyVietnamPortalSnapshot(lastSnapshot);
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

    const registrationCode = await captureRegistrationCode(page);
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
          "needs_manual_verification",
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
          "needs_manual_verification",
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
          "needs_manual_verification",
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
            "needs_manual_verification",
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
          "needs_manual_verification",
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
        text.includes("declaration instructions") &&
        (text.includes("confirm compliance with vietnamese laws") ||
          text.includes("confirmation of reading carefully instructions") ||
          text.includes("note declaration instructions"));
      const hasNext = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"))
        .some((element) => /^(next|tiếp tục)$/i.test((element.innerText || element.textContent || "").trim()));
      return hasDeclaration && hasNext;
    })
    .catch(() => false);
}

async function clickVietnamApplyEntry(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      const href = links
        .map((anchor) => anchor.href || anchor.getAttribute("href") || "")
        .find((candidate) => /\/e-visa\/foreigners/i.test(candidate));
      if (href) {
        window.location.href = href;
        return true;
      }
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"));
      const match = candidates.find((element) => {
        const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
        return (
          /for foreigners outside viet ?nam applying personally|apply now|e-visa for foreigners/i.test(text)
        );
      });
      if (!match) return false;
      match.click();
      return true;
    })
    .catch(() => false);
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

  const ticked = await page
    .evaluate(() => {
      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      let count = 0;
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(".ant-checkbox-input, input[type='checkbox'], .ant-checkbox-wrapper, label, [role='checkbox']"))) {
        if (!visible(element)) continue;
        const input =
          element instanceof HTMLInputElement && element.type === "checkbox"
            ? element
            : element.querySelector<HTMLInputElement>("input[type='checkbox']");
        if (input?.checked) continue;
        if (input) {
          input.click();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          element.click();
        }
        count++;
      }
      return count;
    })
    .catch(() => 0);

  const clicked = await page
    .evaluate(() => {
      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const buttons = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"));
      const button = buttons.find((element) => {
        if (!visible(element)) return false;
        if (element.getAttribute("disabled") !== null || element.getAttribute("aria-disabled") === "true") {
          return false;
        }
        const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
        return /^(next|ok|confirm|accept|agree|continue|tiếp tục|đồng ý|xác nhận)$/i.test(text);
      });
      if (!button) return false;
      button.click();
      return true;
    })
    .catch(() => false);

  if (!clicked) return false;
  await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(ticked > 0 ? 2_000 : 1_000);
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
      await fillDate(page, domId, toDdMmYyyy(rawValue));
      return;
    case "checkbox":
      await tickCheckbox(page, domId, rawValue);
      return;
    case "upload":
      // Uploads require a local file path threaded from applicationDocuments.
      // Skip silently — orchestrator logs are noisy enough; the FE will surface
      // a missing-portrait error from the portal review screen if it matters.
      return;
    default:
      return;
  }
}

async function advanceToReview(page: Page, timeoutMs: number): Promise<void> {
  // Click the primary form action (typically "Save" / "Tiếp tục") but only if
  // its label does NOT match one of the stop patterns. If the dominant
  // action is already a Pay/Submit button, leave the page where it is —
  // the registration-code capture either succeeds or returns null.
  const candidate = page
    .locator('button.ant-btn-primary, button[type="submit"]')
    .first();
  const text = ((await candidate.textContent().catch(() => "")) ?? "").trim();
  if (VN_STOP_BUTTON_PATTERNS.some((rx) => rx.test(text))) return;

  await candidate.click({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 30_000) }).catch(() => undefined);
}

async function captureRegistrationCode(page: Page): Promise<string | null> {
  // Try the explicit selector first; fall back to a body-text regex for
  // "Mã hồ sơ" / "Registration code" patterns.
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
    const m = body.match(/(?:mã hồ sơ|registration\s*code)[:\s]+([A-Z0-9]{8,})/i);
    if (m) return m[1];
  }
  return null;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}
