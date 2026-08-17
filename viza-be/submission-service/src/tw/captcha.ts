import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  reportBadCaptcha,
  solveImageCaptcha,
  TwoCaptchaApiError,
  TwoCaptchaConfigError,
  TwoCaptchaNetworkError,
  TwoCaptchaSolveTimeoutError,
  TwoCaptchaZeroBalanceError,
  type CaptchaSolveResult,
  type CaptchaSolveTelemetry,
} from "../captcha";

export const TW_CAPTCHA_BOUNDARY = {
  imageSelector: 'img.captcha[alt="驗證碼"]',
  inputSelector: "input#captchaToken, input[name='captchaToken']",
  imagePath: "/coa-frontend/captcha",
  inputPlaceholder: "請輸入驗證碼",
  submitButtonText: "確認資料",
} as const;

export const TW_EMAIL_CAPTCHA_BOUNDARY = {
  imageSelector: `${TW_CAPTCHA_BOUNDARY.imageSelector}, img[src*="/coa-frontend/captcha"]`,
  inputSelector: `${TW_CAPTCHA_BOUNDARY.inputSelector}, input[placeholder="請輸入驗證碼"]`,
  refreshSelector: "a.reload-captcha",
  sendButtonText: "寄送驗證碼",
  otpVerifyButtonText: "驗證",
} as const;

export type TwCaptchaSubmitOutcome =
  | { status: "submitted"; solve: CaptchaSolveResult }
  | { status: "wrong_answer"; solve: CaptchaSolveResult; validationHint: string }
  | { status: "no_captcha" }
  | { status: "failed"; reason: string };

export type TwCaptchaFillOutcome =
  | { status: "filled"; solve: CaptchaSolveResult }
  | { status: "no_captcha" }
  | { status: "failed"; reason: string };

export type TwCaptchaClickSubmitOutcome =
  | { status: "submitted" }
  | { status: "wrong_answer"; validationHint: string }
  | { status: "failed"; reason: string };

export type TwEmailCaptchaSendOutcome =
  | { status: "sent"; solve?: CaptchaSolveResult; image?: TwCaptchaImageDiagnostic }
  | {
      status: "wrong_answer";
      solve: CaptchaSolveResult;
      validationHint: string;
      image: TwCaptchaImageDiagnostic;
      imageHash: string;
    }
  | {
      status: "failed";
      reason: string;
      category: TwEmailCaptchaFailureCategory;
      image?: TwCaptchaImageDiagnostic;
      imageHash?: string;
    };

export type TwEmailCaptchaFailureCategory =
  | "image_invalid"
  | "duplicate_image"
  | "provider_unsolvable"
  | "provider_config"
  | "provider_balance"
  | "provider_network"
  | "provider_timeout"
  | "provider_error"
  | "input_missing"
  | "send_control_missing"
  | "refresh_failed";

export interface TwCaptchaImageDiagnostic {
  bytes: number;
  width: number;
  height: number;
  contentType: "image/png";
  hashPrefix: string;
}

interface TwCaptchaImageCapture {
  buffer: Buffer;
  hash: string;
  diagnostic: TwCaptchaImageDiagnostic;
}

type TwImageCaptchaSolver = typeof solveImageCaptcha;

interface TwEmailCaptchaDependencies {
  solver?: TwImageCaptchaSolver;
  refreshTimeoutMs?: number;
  onDiagnostic?: (diagnostic: Record<string, unknown>) => void;
  previousImageHash?: string;
}

export interface TwCaptchaSolveWithTelemetry {
  solve: CaptchaSolveResult;
  telemetry: CaptchaSolveTelemetry[];
}

const DEFAULT_TW_CAPTCHA_TIMEOUT_MS = 180_000;
const DEFAULT_TW_CAPTCHA_MAX_ATTEMPTS = 3;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getTwCaptchaTimeoutMs(timeoutMs?: number): number {
  const configured = readPositiveIntEnv("TW_CAPTCHA_TIMEOUT_MS", DEFAULT_TW_CAPTCHA_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs ?? NaN) || (timeoutMs ?? 0) <= 0) return configured;
  return Math.max(timeoutMs ?? configured, configured);
}

export function getTwCaptchaMaxAttempts(maxAttempts?: number): number {
  const configured = readPositiveIntEnv("TW_CAPTCHA_MAX_ATTEMPTS", DEFAULT_TW_CAPTCHA_MAX_ATTEMPTS);
  if (!Number.isFinite(maxAttempts ?? NaN) || (maxAttempts ?? 0) <= 0) return configured;
  return Math.max(1, Math.trunc(maxAttempts ?? configured));
}

export async function solveTwEmailCaptchaAndSendCodeWithRetry(
  page: Page,
  options: {
    timeoutMs?: number;
    maxAttempts?: number;
    solver?: TwImageCaptchaSolver;
    refreshTimeoutMs?: number;
    onDiagnostic?: (diagnostic: Record<string, unknown>) => void;
  } = {},
): Promise<CaptchaSolveTelemetry[]> {
  const telemetry: CaptchaSolveTelemetry[] = [];
  const maxAttempts = getTwCaptchaMaxAttempts(options.maxAttempts);
  let lastOutcome: TwEmailCaptchaSendOutcome | null = null;
  let attemptsPerformed = 0;
  let refreshes = 0;
  let previousImageHash: string | undefined;
  const emit = options.onDiagnostic ?? emitTwCaptchaDiagnostic;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsPerformed = attempt;
    const outcome = await solveTwEmailCaptchaAndSendCodeOnce(page, options.timeoutMs, {
      solver: options.solver,
      previousImageHash,
      onDiagnostic: emit,
    });
    lastOutcome = outcome;
    emit({
      event: "tw_email_captcha_attempt",
      attempt,
      outcome: outcome.status,
      ...(outcome.status === "failed" ? { category: outcome.category } : {}),
      ...(outcome.image ? { image: outcome.image } : {}),
    });

    if (outcome.status === "sent") {
      if (outcome.solve) {
        telemetry.push({
          solveId: outcome.solve.solveId,
          durationMs: outcome.solve.durationMs,
          attempt,
          outcome: "solved",
        });
      }
      return telemetry;
    }

    if (outcome.status === "wrong_answer") {
      telemetry.push({
        solveId: outcome.solve.solveId,
        durationMs: outcome.solve.durationMs,
        attempt,
        outcome: "wrong_answer_retry",
      });
      await reportBadCaptcha(outcome.solve.solveId).catch(() => undefined);
      if (attempt < maxAttempts) {
        const refreshed = await refreshTwEmailCaptcha(
          page,
          outcome.image.hashPrefix,
          outcome.imageHash,
          options.refreshTimeoutMs,
          emit,
        );
        if (refreshed.clicked) refreshes += 1;
        if (!refreshed.ok) {
          lastOutcome = {
            status: "failed",
            category: "refresh_failed",
            reason: refreshed.reason,
            image: outcome.image,
            imageHash: outcome.imageHash,
          };
          break;
        }
        previousImageHash = refreshed.previousHash;
        continue;
      }
    } else {
      telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
      if (
        outcome.category === "provider_unsolvable" &&
        outcome.image &&
        outcome.imageHash &&
        attempt < maxAttempts
      ) {
        const refreshed = await refreshTwEmailCaptcha(
          page,
          outcome.image.hashPrefix,
          outcome.imageHash,
          options.refreshTimeoutMs,
          emit,
        );
        if (refreshed.clicked) refreshes += 1;
        if (!refreshed.ok) {
          lastOutcome = {
            status: "failed",
            category: "refresh_failed",
            reason: refreshed.reason,
            image: outcome.image,
            imageHash: outcome.imageHash,
          };
          break;
        }
        previousImageHash = refreshed.previousHash;
        continue;
      }
    }

    break;
  }

  const detail = lastOutcome?.status === "failed" ?
    `category=${lastOutcome.category}; reason=${lastOutcome.reason}` :
    lastOutcome?.status === "wrong_answer" ? lastOutcome.validationHint :
    lastOutcome?.status ?? "unknown";
  throw new Error(
    `Taiwan email CAPTCHA solve/send failed: attempts=${attemptsPerformed}/${maxAttempts}; refreshes=${refreshes}; ${detail}`,
  );
}

export async function solveTwEmailCaptchaAndSendCodeOnce(
  page: Page,
  timeoutMs?: number,
  dependencies: TwEmailCaptchaDependencies = {},
): Promise<TwEmailCaptchaSendOutcome> {
  const captchaImage = page.locator(TW_EMAIL_CAPTCHA_BOUNDARY.imageSelector).first();
  const hasCaptcha = (await captchaImage.count().catch(() => 0)) > 0 &&
    (await captchaImage.isVisible({ timeout: 2_000 }).catch(() => false));

  let solve: CaptchaSolveResult | undefined;
  let image: TwCaptchaImageCapture | undefined;
  if (hasCaptcha) {
    const imageResult = await captureVisibleTwCaptcha(captchaImage, "Taiwan email CAPTCHA");
    if (typeof imageResult === "string") {
      return { status: "failed", category: "image_invalid", reason: imageResult };
    }
    image = imageResult;
    dependencies.onDiagnostic?.({
      event: "tw_email_captcha_image",
      ...image.diagnostic,
    });
    if (dependencies.previousImageHash && image.hash === dependencies.previousImageHash) {
      return {
        status: "failed",
        category: "duplicate_image",
        reason: `Taiwan email CAPTCHA image did not change (hash=${image.diagnostic.hashPrefix})`,
        image: image.diagnostic,
        imageHash: image.hash,
      };
    }

    try {
      solve = await (dependencies.solver ?? solveImageCaptcha)(image.buffer, getTwCaptchaTimeoutMs(timeoutMs), {
        case: true,
        minLength: 4,
        maxLength: 8,
        comment: "Taiwan NIA email verification CAPTCHA",
      });
    } catch (err) {
      return {
        status: "failed",
        category: classifyTwEmailCaptchaFailure(err),
        reason: `2captcha solve failed: ${err instanceof Error ? err.message : String(err)}`,
        image: image.diagnostic,
        imageHash: image.hash,
      };
    }

    const input = page.locator(TW_EMAIL_CAPTCHA_BOUNDARY.inputSelector).first();
    if ((await input.count().catch(() => 0)) === 0) {
      return {
        status: "failed",
        category: "input_missing",
        reason: "Taiwan email CAPTCHA input not found",
        image: image.diagnostic,
        imageHash: image.hash,
      };
    }
    await input.fill(solve.text.trim(), { timeout: 10_000 });
  }

  const send = page
    .getByRole("button", { name: TW_EMAIL_CAPTCHA_BOUNDARY.sendButtonText, exact: false })
    .or(page.getByRole("link", { name: TW_EMAIL_CAPTCHA_BOUNDARY.sendButtonText, exact: false }))
    .first();
  if ((await send.count().catch(() => 0)) === 0) {
    return { status: "failed", category: "send_control_missing", reason: "Taiwan send-verification-code control not found" };
  }

  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined),
    send.click({ timeout: 10_000 }),
  ]);
  await page.waitForTimeout(1_000);

  if (await isTwEmailOtpEntryReady(page)) return { status: "sent", solve, image: image?.diagnostic };
  if (solve && image && (await isTwEmailCaptchaStillVisible(page))) {
    const validationHint = await readTwValidationHint(page);
    return {
      status: "wrong_answer",
      solve,
      validationHint: validationHint || "Taiwan email CAPTCHA remained visible after send-code click",
      image: image.diagnostic,
      imageHash: image.hash,
    };
  }

  return { status: "sent", solve, image: image?.diagnostic };
}

export async function solveTwCaptchaAndSubmitOnce(
  page: Page,
  timeoutMs?: number,
  beforeFinalSubmit?: () => void,
): Promise<TwCaptchaSubmitOutcome> {
  const fillOutcome = await solveAndFillTwCaptchaOnce(page, timeoutMs);
  if (fillOutcome.status !== "filled") return fillOutcome;

  const submitOutcome = await clickTwFinalSubmit(page, beforeFinalSubmit);
  if (submitOutcome.status === "submitted") {
    return { status: "submitted", solve: fillOutcome.solve };
  }
  if (submitOutcome.status === "wrong_answer") {
    return { status: "wrong_answer", solve: fillOutcome.solve, validationHint: submitOutcome.validationHint };
  }
  return submitOutcome;
}

export async function solveAndFillTwCaptchaOnce(
  page: Page,
  timeoutMs?: number,
): Promise<TwCaptchaFillOutcome> {
  const captchaImage = page.locator(TW_CAPTCHA_BOUNDARY.imageSelector).first();
  if ((await captchaImage.count().catch(() => 0)) === 0) {
    return { status: "no_captcha" };
  }

  const image = await captureVisibleTwCaptcha(captchaImage, "Taiwan CAPTCHA");
  if (typeof image === "string") return { status: "failed", reason: image };

  let solve: CaptchaSolveResult;
  try {
    solve = await solveImageCaptcha(image.buffer, getTwCaptchaTimeoutMs(timeoutMs), {
      case: true,
      minLength: 4,
      maxLength: 8,
      comment: "Taiwan NIA entry permit CAPTCHA",
    });
  } catch (err) {
    return {
      status: "failed",
      reason: `2captcha solve failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const input = page.locator(TW_CAPTCHA_BOUNDARY.inputSelector).first();
  if ((await input.count().catch(() => 0)) === 0) {
    return { status: "failed", reason: "Taiwan CAPTCHA input not found" };
  }
  await input.fill(solve.text.trim(), { timeout: 10_000 });

  return { status: "filled", solve };
}

export async function clickTwFinalSubmit(
  page: Page,
  beforeFinalSubmit?: () => void,
): Promise<TwCaptchaClickSubmitOutcome> {
  const submit = page
    .getByRole("button", { name: TW_CAPTCHA_BOUNDARY.submitButtonText, exact: false })
    .or(page.locator("form#traveller-apply-form button[type='submit'], button[type='submit']"))
    .first();
  if ((await submit.count().catch(() => 0)) === 0) {
    return { status: "failed", reason: "Taiwan final submit button not found after CAPTCHA fill" };
  }

  beforeFinalSubmit?.();
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined),
    submit.click({ timeout: 10_000 }),
  ]);
  await page.waitForTimeout(2_000);

  if ((await isTwCaptchaBoundaryVisible(page))) {
    const validationHint = await readTwValidationHint(page);
    return {
      status: "wrong_answer",
      validationHint: validationHint || "Taiwan CAPTCHA boundary remained visible after submit",
    };
  }

  return { status: "submitted" };
}

export async function solveTwCaptchaForSubmitWithRetry(
  page: Page,
  options: { timeoutMs?: number; maxAttempts?: number } = {},
): Promise<TwCaptchaSolveWithTelemetry> {
  const telemetry: CaptchaSolveTelemetry[] = [];
  const maxAttempts = getTwCaptchaMaxAttempts(options.maxAttempts);
  let lastOutcome: TwCaptchaFillOutcome | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outcome = await solveAndFillTwCaptchaOnce(page, options.timeoutMs);
    lastOutcome = outcome;

    if (outcome.status === "filled") {
      telemetry.push({
        solveId: outcome.solve.solveId,
        durationMs: outcome.solve.durationMs,
        attempt,
        outcome: "solved",
      });
      return { solve: outcome.solve, telemetry };
    }

    telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
    if (attempt < maxAttempts) {
      await refreshTwCaptcha(page);
      continue;
    }
  }

  const detail = lastOutcome?.status === "failed" ? lastOutcome.reason : lastOutcome?.status ?? "unknown";
  throw new Error(`Taiwan CAPTCHA solve/fill failed after ${maxAttempts} attempt(s): ${detail}`);
}

export async function solveTwCaptchaAndSubmitWithRetry(
  page: Page,
  options: { timeoutMs?: number; maxAttempts?: number; beforeFinalSubmit?: () => void } = {},
): Promise<TwCaptchaSolveWithTelemetry> {
  const telemetry: CaptchaSolveTelemetry[] = [];
  const maxAttempts = getTwCaptchaMaxAttempts(options.maxAttempts);
  let lastOutcome: TwCaptchaSubmitOutcome | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outcome = await solveTwCaptchaAndSubmitOnce(page, options.timeoutMs, options.beforeFinalSubmit);
    lastOutcome = outcome;

    if (outcome.status === "submitted") {
      telemetry.push({
        solveId: outcome.solve.solveId,
        durationMs: outcome.solve.durationMs,
        attempt,
        outcome: "solved",
      });
      return { solve: outcome.solve, telemetry };
    }

    if (outcome.status === "wrong_answer") {
      telemetry.push({
        solveId: outcome.solve.solveId,
        durationMs: outcome.solve.durationMs,
        attempt,
        outcome: "wrong_answer_retry",
      });
      await reportBadCaptcha(outcome.solve.solveId).catch(() => undefined);
      if (attempt < maxAttempts) {
        await refreshTwCaptcha(page);
        continue;
      }
    } else {
      telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
    }

    break;
  }

  const detail =
    lastOutcome?.status === "failed" ? lastOutcome.reason :
    lastOutcome?.status === "wrong_answer" ? lastOutcome.validationHint :
    lastOutcome?.status ?? "unknown";
  throw new Error(`Taiwan CAPTCHA solve/submit failed after ${maxAttempts} attempt(s): ${detail}`);
}

async function isTwCaptchaBoundaryVisible(page: Page): Promise<boolean> {
  return (await page.locator(TW_CAPTCHA_BOUNDARY.imageSelector).first().isVisible().catch(() => false)) ||
    (await page.locator(TW_CAPTCHA_BOUNDARY.inputSelector).first().isVisible().catch(() => false)) ||
    (await page.getByText("換下一組", { exact: false }).first().isVisible().catch(() => false));
}

async function refreshTwCaptcha(page: Page): Promise<void> {
  const refresh = page.locator("a.reload-captcha").or(page.getByText("換下一組", { exact: false })).first();
  if (await refresh.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await refresh.click({ timeout: 5_000 }).catch(() => undefined);
  }
  const input = page.locator(TW_CAPTCHA_BOUNDARY.inputSelector).first();
  await input.fill("", { timeout: 3_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
}

async function refreshTwEmailCaptcha(
  page: Page,
  previousHashPrefix: string,
  previousHash: string,
  timeoutMs = 8_000,
  emit: (diagnostic: Record<string, unknown>) => void = emitTwCaptchaDiagnostic,
): Promise<
  | { ok: true; previousHash: string; clicked: boolean }
  | { ok: false; reason: string; clicked: boolean }
> {
  const captchaImage = page.locator(TW_EMAIL_CAPTCHA_BOUNDARY.imageSelector).first();
  const before = await captureVisibleTwCaptcha(captchaImage, "Taiwan email CAPTCHA");
  if (typeof before === "string") return { ok: false, reason: before, clicked: false };
  if (before.hash !== previousHash) {
    return { ok: true, previousHash, clicked: false };
  }
  const refresh = page.locator(TW_EMAIL_CAPTCHA_BOUNDARY.refreshSelector).or(page.getByText("換下一組", { exact: false })).first();
  if (!(await refresh.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return { ok: false, reason: "Taiwan email CAPTCHA refresh control is not visible", clicked: false };
  }
  await refresh.click({ timeout: 5_000 });
  const input = page.locator(TW_EMAIL_CAPTCHA_BOUNDARY.inputSelector).first();
  await input.fill("", { timeout: 3_000 }).catch(() => undefined);
  const deadline = Date.now() + Math.max(500, timeoutMs);
  while (Date.now() < deadline) {
    await page.waitForTimeout(150);
    const next = await captureVisibleTwCaptcha(captchaImage, "Taiwan email CAPTCHA");
    if (typeof next === "string") continue;
    if (next.hash !== before.hash) {
      emit({ event: "tw_email_captcha_refreshed", ...next.diagnostic });
      return { ok: true, previousHash, clicked: true };
    }
  }
  return {
    ok: false,
    reason: `Taiwan email CAPTCHA refresh did not produce a new image (hash=${before.diagnostic.hashPrefix})`,
    clicked: true,
  };
}

export function inspectTwCaptchaPng(imageBuffer: Buffer): TwCaptchaImageCapture | string {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (imageBuffer.byteLength < 200) return "CAPTCHA PNG image buffer is too small";
  if (!imageBuffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    return "CAPTCHA image is not a PNG screenshot";
  }
  if (imageBuffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    return "CAPTCHA PNG is missing the IHDR header";
  }
  const width = imageBuffer.readUInt32BE(16);
  const height = imageBuffer.readUInt32BE(20);
  if (width < 40 || height < 20) {
    return `CAPTCHA PNG dimensions are too small (${width}x${height})`;
  }
  const hash = createHash("sha256").update(imageBuffer).digest("hex");
  return {
    buffer: imageBuffer,
    hash,
    diagnostic: {
      bytes: imageBuffer.byteLength,
      width,
      height,
      contentType: "image/png",
      hashPrefix: hash.slice(0, 12),
    },
  };
}

async function captureVisibleTwCaptcha(
  captchaImage: ReturnType<Page["locator"]>,
  label: string,
): Promise<TwCaptchaImageCapture | string> {
  try {
    await captchaImage.waitFor({ state: "visible", timeout: 15_000 });
    await captchaImage.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
    const box = await captchaImage.boundingBox({ timeout: 5_000 });
    if (!box || box.width <= 0 || box.height <= 0) {
      return `${label} image has no visible size`;
    }
  } catch (err) {
    return `${label} image did not load: ${err instanceof Error ? err.message : String(err)}`;
  }

  const imageBuffer = await captchaImage.screenshot({ timeout: 15_000 });
  const inspected = inspectTwCaptchaPng(imageBuffer);
  return typeof inspected === "string" ? `${label}: ${inspected}` : inspected;
}

function classifyTwEmailCaptchaFailure(error: unknown): TwEmailCaptchaFailureCategory {
  if (error instanceof TwoCaptchaApiError && error.apiErrorCode === "ERROR_CAPTCHA_UNSOLVABLE") {
    return "provider_unsolvable";
  }
  if (error instanceof TwoCaptchaConfigError) return "provider_config";
  if (error instanceof TwoCaptchaZeroBalanceError) return "provider_balance";
  if (error instanceof TwoCaptchaNetworkError) return "provider_network";
  if (error instanceof TwoCaptchaSolveTimeoutError) return "provider_timeout";
  return "provider_error";
}

function emitTwCaptchaDiagnostic(diagnostic: Record<string, unknown>): void {
  console.info(JSON.stringify(diagnostic));
}

async function isTwEmailCaptchaStillVisible(page: Page): Promise<boolean> {
  return (await page.locator(TW_EMAIL_CAPTCHA_BOUNDARY.imageSelector).first().isVisible().catch(() => false)) ||
    (await page.locator(TW_EMAIL_CAPTCHA_BOUNDARY.inputSelector).first().isVisible().catch(() => false)) ||
    (await page.getByText("換下一組", { exact: false }).first().isVisible().catch(() => false));
}

async function isTwEmailOtpEntryReady(page: Page): Promise<boolean> {
  return (await page.getByText(TW_EMAIL_CAPTCHA_BOUNDARY.otpVerifyButtonText, { exact: false }).first().isVisible().catch(() => false)) ||
    (await page.locator("input").filter({ hasText: /驗證碼/ }).first().isVisible().catch(() => false)) ||
    (await page.getByText(/請於30分鐘內完成驗證|驗證碼/i).first().isVisible().catch(() => false));
}

async function readTwValidationHint(page: Page): Promise<string> {
  const hint = await page.locator(".invalid-feedback, .text-danger, .error, [role='alert']")
    .first()
    .innerText({ timeout: 1_000 })
    .catch(() => "");
  if (hint.trim()) return hint.trim().slice(0, 240);
  const body = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
  const match = body.match(/(?:驗證碼|captcha|錯誤|不正確|請輸入)[^\n]{0,120}/i);
  return (match?.[0] ?? "").trim().slice(0, 240);
}
