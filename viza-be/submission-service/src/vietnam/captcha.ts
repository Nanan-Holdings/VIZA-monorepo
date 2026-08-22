import type { Frame, Locator, Page } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  reportBadCaptcha,
  reportGoodCaptcha,
  solveImageCaptcha,
  TwoCaptchaConfigError,
  TwoCaptchaZeroBalanceError,
  type CaptchaSolveResult,
} from "../captcha/two-captcha";

export interface VietnamCaptchaSolveOutcome {
  solved: boolean;
  reason?: string;
  telemetry?: {
    solveId: string;
    durationMs: number;
    challengeFingerprint: string;
    answerLength?: number;
    captureWidth?: number;
    captureHeight?: number;
    sourceWidth?: number;
    sourceHeight?: number;
  };
}

export interface VietnamCaptchaAnswerConstraints {
  minLength: number;
  maxLength: number;
}

export function buildVietnamReviewCaptchaTaskOptions(
  constraints: VietnamCaptchaAnswerConstraints,
) {
  return {
    case: false,
    numeric: 1,
    minLength: constraints.minLength,
    maxLength: constraints.maxLength,
    comment:
      `Vietnam e-Visa review security code. Return only the ` +
      `${constraints.minLength}-${constraints.maxLength} visible digits.`,
  } as const;
}

const CAPTCHA_IMAGE_SELECTOR = [
  "img[src*='captcha' i]",
  "img[id*='captcha' i]",
  "img[class*='captcha' i]",
  "img[alt*='captcha' i]",
  ".captcha img",
].join(", ");

const CAPTCHA_INPUT_SELECTOR = [
  "input[name*='captcha' i]",
  "input[id*='captcha' i]",
  "input[class*='captcha' i]",
  "input[placeholder*='captcha' i]",
  "input[placeholder*='security code' i]",
  "input[placeholder*='enter code' i]",
  "input[placeholder*='mã xác nhận' i]",
  "input[placeholder*='ma xac nhan' i]",
  "input[name='maXacNhan' i]",
  "input[id='maXacNhan' i]",
].join(", ");

const CAPTCHA_SUBMIT_LABEL_PATTERN =
  /\b(next|continue|submit|verify|confirm|send|check|ok)\b|tiếp tục|xác nhận|kiểm tra|kiểm chứng|hoàn tất|hoàn thành|gửi|nộp|đồng ý/i;

export const DEFAULT_VIETNAM_CAPTCHA_TIMEOUT_MS = 180_000;
const CAPTCHA_INPUT_WAIT_MS = 15_000;
export const DEFAULT_VIETNAM_CAPTCHA_ATTEMPTS = 5;
export const DEFAULT_VIETNAM_CAPTCHA_TOTAL_BUDGET_MS = 480_000;

type CaptchaRoot = Page | Frame;

interface VietnamCaptchaControls {
  root: CaptchaRoot;
  input: Locator;
  image: Locator;
}

interface VietnamCaptchaInputControls {
  root: CaptchaRoot;
  input: Locator;
}

interface VietnamCaptchaCapture {
  buffer: Buffer;
  width?: number;
  height?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getVietnamCaptchaTimeoutMs(timeoutMs?: number): number {
  const configured = readPositiveIntEnv("VN_CAPTCHA_TIMEOUT_MS", DEFAULT_VIETNAM_CAPTCHA_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs ?? NaN) || (timeoutMs ?? 0) <= 0) return configured;
  // Callers pass the remaining step/flow budget. Treat the environment value
  // as the normal solver ceiling, never as a floor that silently expands a
  // smaller caller deadline (120s used to become 180s here).
  return Math.min(timeoutMs ?? configured, configured);
}

export function shouldSolveVietnamCaptcha(): boolean {
  return process.env.VN_CAPTCHA_SOLVING_ENABLED !== "false";
}

export function describeVietnamCaptchaError(error: unknown): string {
  if (error instanceof TwoCaptchaConfigError) {
    return "TWOCAPTCHA_API_KEY is missing; cannot solve the official portal CAPTCHA.";
  }
  if (error instanceof TwoCaptchaZeroBalanceError) {
    return "2captcha account has zero balance; cannot solve the official portal CAPTCHA.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function fingerprintVietnamCaptchaImage(image: Buffer): string {
  return createHash("sha256").update(image).digest("hex");
}

export async function captureVietnamCaptchaImage(
  image: Locator,
  timeoutMs: number,
): Promise<VietnamCaptchaCapture> {
  const imageState = await image
    .evaluate((element) => {
      if (!(element instanceof HTMLImageElement)) return { isImage: false, loaded: true };
      return {
        isImage: true,
        loaded: element.complete && element.naturalWidth > 0 && element.naturalHeight > 0,
      };
    })
    .catch(() => ({ isImage: true, loaded: false }));
  if (imageState.isImage && !imageState.loaded) {
    // A locator screenshot of a broken <img> captures only the browser's alt
    // text placeholder.  2Captcha can still invent a shape-valid answer for
    // that placeholder, which the official portal will always reject.
    throw new Error("Vietnam CAPTCHA image is not loaded; refusing to solve a browser placeholder.");
  }
  // The official challenge is displayed inside a CSS-sized box whose aspect
  // ratio does not necessarily match the image's intrinsic pixels. Drawing
  // into that CSS box stretches the glyphs. Upscale the intrinsic bitmap so
  // the solver receives the same proportions that the portal generated.
  const rasterized = await image
    .evaluate((element) => {
      if (!(element instanceof HTMLImageElement || element instanceof HTMLCanvasElement)) return null;
      const rect = element.getBoundingClientRect();
      const sourceWidth =
        element instanceof HTMLImageElement ? element.naturalWidth : element.width || rect.width;
      const sourceHeight =
        element instanceof HTMLImageElement ? element.naturalHeight : element.height || rect.height;
      if (sourceWidth <= 0 || sourceHeight <= 0) return null;
      const scale = Math.max(
        2,
        Math.min(4, Math.ceil(420 / sourceWidth), Math.ceil(120 / sourceHeight)),
      );
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      try {
        context.drawImage(element, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/png");
        const comma = dataUrl.indexOf(",");
        return comma >= 0
          ? { base64: dataUrl.slice(comma + 1), width, height, sourceWidth, sourceHeight }
          : null;
      } catch {
        return null;
      }
    })
    .catch(() => null);
  if (rasterized?.base64) {
    return {
      buffer: Buffer.from(rasterized.base64, "base64"),
      width: rasterized.width,
      height: rasterized.height,
      sourceWidth: rasterized.sourceWidth,
      sourceHeight: rasterized.sourceHeight,
    };
  }

  const buffer = await image.screenshot({ timeout: Math.max(1, Math.min(timeoutMs, 30_000)) });
  const box = await image.boundingBox().catch(() => null);
  return {
    buffer,
    width: box ? Math.round(box.width) : undefined,
    height: box ? Math.round(box.height) : undefined,
    sourceWidth: box ? Math.round(box.width) : undefined,
    sourceHeight: box ? Math.round(box.height) : undefined,
  };
}

export function isVietnamCaptchaSolveCurrent(
  solvedFingerprint: string,
  currentFingerprint: string | null,
): boolean {
  return Boolean(currentFingerprint && solvedFingerprint === currentFingerprint);
}

export function normalizeVietnamCaptchaAnswer(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export function isVietnamCaptchaAnswerUsable(
  value: string,
  constraints: VietnamCaptchaAnswerConstraints,
): boolean {
  return (
    value.length >= constraints.minLength &&
    value.length <= constraints.maxLength &&
    /^[A-Za-z0-9]+$/.test(value)
  );
}

export function isVietnamCaptchaFailureRetryable(reason: string | undefined): boolean {
  if (!reason) return true;
  return !/TWOCAPTCHA_API_KEY is missing|zero balance|solving is disabled/i.test(reason);
}

export async function reportRejectedVietnamCaptcha(
  outcome: VietnamCaptchaSolveOutcome,
  reporter: (solveId: string) => Promise<void> = reportBadCaptcha,
): Promise<boolean> {
  const solveId = outcome.solved ? outcome.telemetry?.solveId : undefined;
  if (!solveId) return false;
  try {
    await reporter(solveId);
    return true;
  } catch {
    return false;
  }
}

export async function reportAcceptedVietnamCaptcha(
  outcome: VietnamCaptchaSolveOutcome,
  reporter: (solveId: string) => Promise<void> = reportGoodCaptcha,
): Promise<boolean> {
  const solveId = outcome.solved ? outcome.telemetry?.solveId : undefined;
  if (!solveId) return false;
  try {
    await reporter(solveId);
    return true;
  } catch {
    return false;
  }
}

export async function solveVietnamImageCaptcha(
  page: Page,
  timeoutMs: number,
  solver: (
    image: Buffer,
    timeoutMs: number,
    constraints: VietnamCaptchaAnswerConstraints,
  ) => Promise<CaptchaSolveResult> = (image, budgetMs, constraints) =>
    solveImageCaptcha(image, budgetMs, {
      comment: "Vietnam e-Visa security code. Return only the visible characters and preserve letter case.",
      minLength: constraints.minLength,
      maxLength: constraints.maxLength,
    }),
): Promise<VietnamCaptchaSolveOutcome> {
  const solveTimeoutMs = getVietnamCaptchaTimeoutMs(timeoutMs);
  if (!shouldSolveVietnamCaptcha()) {
    return { solved: false, reason: "Vietnam CAPTCHA solving is disabled by VN_CAPTCHA_SOLVING_ENABLED=false." };
  }

  const controls = await locateVietnamCaptchaControls(page, CAPTCHA_INPUT_WAIT_MS);
  if (!controls) {
    const diagnostics = await describeVietnamCaptchaDom(page);
    console.warn(`[vn-prearrival] CAPTCHA input not found ${diagnostics}`);
    return {
      solved: false,
      reason: `Could not locate a visible Vietnam CAPTCHA input on the official portal. ${diagnostics}`,
    };
  }
  const { input, image } = controls;
  const constraints = await readVietnamCaptchaAnswerConstraints(input);

  let lastReason = "unknown CAPTCHA error";
  // The owning portal flow already refreshes and retries rejected/stale
  // challenges. Default to one provider task here so retries are not
  // multiplied by another hidden three-attempt loop.
  const maxSolverAttempts = readPositiveIntEnv("VN_CAPTCHA_SOLVER_ATTEMPTS", 1);
  for (let attempt = 1; attempt <= maxSolverAttempts; attempt++) {
    try {
      const capture = await captureVietnamCaptchaImage(image, solveTimeoutMs);
      const challengeFingerprint = fingerprintVietnamCaptchaImage(capture.buffer);
      const result = await solver(capture.buffer, solveTimeoutMs, constraints);
      const currentControls = await locateVietnamCaptchaControls(page, CAPTCHA_INPUT_WAIT_MS);
      const currentFingerprint = currentControls
        ? fingerprintVietnamCaptchaImage(
            (await captureVietnamCaptchaImage(currentControls.image, solveTimeoutMs)).buffer,
          )
        : null;
      if (!isVietnamCaptchaSolveCurrent(challengeFingerprint, currentFingerprint)) {
        lastReason = "Vietnam CAPTCHA changed while 2captcha was solving; discarded the stale answer.";
        continue;
      }
      const answer = normalizeVietnamCaptchaAnswer(result.text);
      if (!isVietnamCaptchaAnswerUsable(answer, constraints)) {
        lastReason =
          `2captcha returned an unusable Vietnam CAPTCHA answer; expected ` +
          `${constraints.minLength}-${constraints.maxLength} alphanumeric characters.`;
        continue;
      }
      await currentControls?.input.fill(answer, { timeout: 10_000 });
      const persistedAnswer = await currentControls?.input.inputValue({ timeout: 5_000 }).catch(() => "");
      if (persistedAnswer !== answer) {
        lastReason = "Vietnam CAPTCHA answer did not persist in the official portal input.";
        continue;
      }
      return {
        solved: true,
        telemetry: {
          solveId: result.solveId,
          durationMs: result.durationMs,
          challengeFingerprint,
          answerLength: answer.length,
          captureWidth: capture.width,
          captureHeight: capture.height,
          sourceWidth: capture.sourceWidth,
          sourceHeight: capture.sourceHeight,
        },
      };
    } catch (error) {
      lastReason = describeVietnamCaptchaError(error);
      if (!isVietnamCaptchaFailureRetryable(lastReason) || attempt === maxSolverAttempts) {
        break;
      }
      if (/ERROR_CAPTCHA_UNSOLVABLE|unsolvable/i.test(lastReason)) {
        await refreshVietnamCaptcha(input).catch(() => undefined);
      }
      await page.waitForTimeout(1_000);
    }
  }
  return {
    solved: false,
    reason: lastReason,
  };
}

const VIETNAM_IMAGE_CAPTCHA_PROVIDER_TIMEOUT_MS = 120_000;
const VIETNAM_IMAGE_CAPTCHA_MAX_PROVIDER_ATTEMPTS = 3;

/**
 * Retry a portal-owned Vietnam image CAPTCHA without multiplying retries
 * inside one 2captcha task. The official portal can redraw the challenge
 * while a provider task is still running; in that case the new image is
 * already current and should be solved directly on the next attempt.
 */
export async function solveVietnamImageCaptchaWithRetry(
  page: Page,
  timeoutMs: number,
  options: {
    maxAttempts?: number;
    solveAttempt?: (attemptTimeoutMs: number) => Promise<VietnamCaptchaSolveOutcome>;
    refreshChallenge?: () => Promise<boolean>;
  } = {},
): Promise<VietnamCaptchaSolveOutcome> {
  const deadline = Date.now() + Math.max(1_000, timeoutMs);
  const maxAttempts = Math.max(
    1,
    Math.min(options.maxAttempts ?? VIETNAM_IMAGE_CAPTCHA_MAX_PROVIDER_ATTEMPTS, 5),
  );
  const solveAttempt = options.solveAttempt ?? ((attemptTimeoutMs: number) =>
    solveVietnamImageCaptcha(page, attemptTimeoutMs));
  const refreshChallenge = options.refreshChallenge ?? (() =>
    refreshVietnamCaptchaChallenge(
      page,
      Math.min(15_000, Math.max(1_000, deadline - Date.now())),
    ));
  let lastOutcome: VietnamCaptchaSolveOutcome = {
    solved: false,
    reason: "Vietnam CAPTCHA provider attempts were exhausted.",
  };

  for (let attempt = 1; attempt <= maxAttempts && Date.now() < deadline; attempt += 1) {
    const remainingMs = deadline - Date.now();
    lastOutcome = await solveAttempt(
      Math.max(1_000, Math.min(VIETNAM_IMAGE_CAPTCHA_PROVIDER_TIMEOUT_MS, remainingMs)),
    );
    if (lastOutcome.solved || !isVietnamCaptchaFailureRetryable(lastOutcome.reason)) {
      return lastOutcome;
    }

    const reason = lastOutcome.reason ?? "";
    const challengeAlreadyChanged = /changed while|stale answer/i.test(reason);
    const requiresExplicitRefresh =
      /unsolvable|unusable|image is not loaded|browser placeholder/i.test(reason);
    console.warn(
      `[vn] Image CAPTCHA provider attempt ${attempt}/${maxAttempts} failed ` +
      `kind=${challengeAlreadyChanged ? "challenge_changed" : requiresExplicitRefresh ? "challenge_rejected" : "transient"}.`,
    );

    if (requiresExplicitRefresh) {
      const refreshed = await refreshChallenge().catch(() => false);
      if (!refreshed) {
        return {
          solved: false,
          reason: "The Vietnam CAPTCHA refresh could not be confirmed after a provider failure.",
        };
      }
    }

    if (attempt < maxAttempts && Date.now() < deadline) {
      await page.waitForTimeout(Math.min(1_000, Math.max(0, deadline - Date.now())));
    }
  }

  return lastOutcome;
}

// Match the shared 2Captcha ImageToText default. Production tasks frequently
// complete just after 90 seconds during provider congestion; cutting them off
// early creates duplicate tasks without improving the bounded outer budget.
const VIETNAM_REVIEW_CAPTCHA_PROVIDER_TIMEOUT_MS = 120_000;
const VIETNAM_REVIEW_CAPTCHA_MAX_PROVIDER_ATTEMPTS = 3;

/**
 * The official review challenge is numeric, but its length varies (production
 * has emitted both five- and six-digit images). Provider tasks use the live
 * input's observed constraints rather than the payment-search page's separate
 * fixed six-digit contract. Tasks remain individually bounded so a task left
 * processing cannot consume the entire review checkpoint.
 */
export async function solveVietnamReviewCaptchaWithRetry(
  page: Page,
  timeoutMs: number,
  options: {
    maxAttempts?: number;
    solveAttempt?: (attemptTimeoutMs: number) => Promise<VietnamCaptchaSolveOutcome>;
    refreshChallenge?: () => Promise<boolean>;
  } = {},
): Promise<VietnamCaptchaSolveOutcome> {
  const deadline = Date.now() + Math.max(1_000, timeoutMs);
  const maxAttempts = Math.max(
    1,
    Math.min(options.maxAttempts ?? VIETNAM_REVIEW_CAPTCHA_MAX_PROVIDER_ATTEMPTS, 5),
  );
  const solveAttempt = options.solveAttempt ?? ((attemptTimeoutMs: number) =>
    solveVietnamImageCaptcha(
      page,
      attemptTimeoutMs,
      (image, budgetMs, constraints) => solveImageCaptcha(
        image,
        budgetMs,
        buildVietnamReviewCaptchaTaskOptions(constraints),
      ),
    ));
  const refreshChallenge = options.refreshChallenge ?? (() =>
    refreshVietnamCaptchaChallenge(page, Math.min(15_000, Math.max(1_000, deadline - Date.now()))));
  let lastOutcome: VietnamCaptchaSolveOutcome = {
    solved: false,
    reason: "Vietnam review CAPTCHA provider attempts were exhausted.",
  };

  for (let attempt = 1; attempt <= maxAttempts && Date.now() < deadline; attempt += 1) {
    const remainingMs = deadline - Date.now();
    const attemptTimeoutMs = Math.min(VIETNAM_REVIEW_CAPTCHA_PROVIDER_TIMEOUT_MS, remainingMs);
    lastOutcome = await solveAttempt(Math.max(1_000, attemptTimeoutMs));
    if (lastOutcome.solved || !isVietnamCaptchaFailureRetryable(lastOutcome.reason)) {
      return lastOutcome;
    }
    const reason = lastOutcome.reason ?? "";
    const requiresNewChallenge = /unsolvable|unusable|changed while|stale answer/i.test(reason);
    console.warn(
      `[vn] Review CAPTCHA provider attempt ${attempt}/${maxAttempts} failed ` +
      `kind=${requiresNewChallenge ? "challenge_rejected" : /timed out/i.test(reason) ? "provider_timeout" : "transient"}.`,
    );
    if (requiresNewChallenge) {
      const refreshed = await refreshChallenge().catch(() => false);
      if (!refreshed) {
        return {
          solved: false,
          reason: "The Vietnam review CAPTCHA refresh could not be confirmed after a provider failure.",
        };
      }
    }
    if (attempt < maxAttempts && Date.now() < deadline) {
      await page.waitForTimeout(Math.min(1_000, Math.max(0, deadline - Date.now())));
    }
  }
  return lastOutcome;
}

async function readVietnamCaptchaAnswerConstraints(
  input: Locator,
): Promise<VietnamCaptchaAnswerConstraints> {
  const observed = await input
    .evaluate((element) => {
      const input = element as HTMLInputElement;
      const pattern = element.getAttribute("pattern") ?? "";
      const exactLength = pattern.match(/\{(\d+)\}/)?.[1];
      return {
        minLength: input.minLength > 0 ? input.minLength : null,
        maxLength: input.maxLength > 0 ? input.maxLength : null,
        exactLength: exactLength ? Number.parseInt(exactLength, 10) : null,
      };
    })
    .catch(() => ({ minLength: null, maxLength: null, exactLength: null }));
  const exactLength =
    observed.exactLength && observed.exactLength >= 2 && observed.exactLength <= 12
      ? observed.exactLength
      : null;
  if (exactLength) return { minLength: exactLength, maxLength: exactLength };
  const maxLength =
    observed.maxLength && observed.maxLength >= 2 && observed.maxLength <= 12
      ? observed.maxLength
      : 8;
  const minLength =
    observed.minLength && observed.minLength >= 2 && observed.minLength <= maxLength
      ? observed.minLength
      : Math.min(4, maxLength);
  return { minLength, maxLength };
}

export async function refreshVietnamCaptchaChallenge(
  page: Page,
  timeoutMs = 10_000,
): Promise<boolean> {
  const deadline = Date.now() + Math.max(timeoutMs, 0);
  const remainingMs = () => Math.max(0, deadline - Date.now());
  const controls = await locateVietnamCaptchaControls(page, Math.min(remainingMs(), CAPTCHA_INPUT_WAIT_MS));
  if (!controls) return false;
  // Baseline and polling must use the identical intrinsic-raster transform.
  // Comparing a raw locator screenshot with a rasterized PNG makes an
  // unchanged challenge look refreshed and caused production to re-solve the
  // same rejected image repeatedly.
  const previousFingerprint = fingerprintVietnamCaptchaImage(
    (await captureVietnamCaptchaImage(controls.image, Math.max(1, Math.min(remainingMs(), 10_000)))).buffer,
  );
  await controls.input.fill("").catch(() => undefined);
  // Rank and click candidates in one browser-context operation. The old
  // implementation made several Playwright round trips for each of up to 80
  // elements; on the production review page that could spend more than two
  // minutes here and exhaust the whole CAPTCHA budget before another solver
  // task even started.
  await controls.root.evaluate("window.__name = window.__name || ((fn) => fn)");
  const clicked = await controls.input
    .evaluate((currentInput, captchaImageSelector) => {
      const isVisible = (element: Element | null): element is HTMLElement | SVGElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
      };
      const metadataFor = (element: Element) =>
        `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""} ` +
        `${element.getAttribute("title") ?? ""} ${element.getAttribute("class") ?? ""} ` +
        `${element.getAttribute("src") ?? ""} ${element.getAttribute("data-icon") ?? ""}`;
      const inputRect = currentInput.getBoundingClientRect();
      const imageRects = Array.from(document.querySelectorAll(captchaImageSelector))
        .filter(isVisible)
        .map((element) => element.getBoundingClientRect());
      const ranked = new Map<Element, { target: Element; score: number }>();
      const candidates = Array.from(
        document.querySelectorAll(
          "button, [role='button'], a, img, svg, [data-icon], .anticon, [class*='refresh' i], [class*='sync' i]",
        ),
      );
      for (const candidate of candidates) {
        if (!isVisible(candidate)) continue;
        const candidateMetadata = metadataFor(candidate);
        const strongRefresh = /reload|refresh|sync|redo|rotate|anticon-sync/i.test(candidateMetadata);
        const captchaTarget = /captcha/i.test(candidateMetadata);
        if (!strongRefresh && !captchaTarget) continue;
        const target = candidate.closest("button, [role='button'], a") ?? candidate;
        if (!isVisible(target)) continue;
        const rect = target.getBoundingClientRect();
        const distanceToInput =
          Math.abs(rect.x - (inputRect.x + inputRect.width)) +
          Math.abs(rect.y + rect.height / 2 - (inputRect.y + inputRect.height / 2)) * 2;
        const distanceToImage = imageRects.length
          ? Math.min(
              ...imageRects.map(
                (imageRect) =>
                  Math.abs(rect.x - (imageRect.x + imageRect.width)) +
                  Math.abs(rect.y + rect.height / 2 - (imageRect.y + imageRect.height / 2)) * 2,
              ),
            )
          : distanceToInput;
        const score = Math.min(distanceToInput, distanceToImage) + (strongRefresh ? -2_000 : -500);
        const existing = ranked.get(target);
        if (!existing || score < existing.score) ranked.set(target, { target, score });
      }
      const target = [...ranked.values()].sort((left, right) => left.score - right.score)[0]?.target;
      if (!target) return false;
      if (target instanceof HTMLElement) {
        target.click();
      } else {
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      }
      return true;
    }, CAPTCHA_IMAGE_SELECTOR)
    .catch((error) => {
      console.warn(
        `[vn] CAPTCHA refresh candidate selection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    });
  const firstWaitMs = clicked ? Math.min(remainingMs(), Math.floor(timeoutMs / 2)) : 0;
  if (clicked && await waitForVietnamCaptchaRefresh(page, previousFingerprint, firstWaitMs)) {
    return true;
  }

  // Some versions of the official widget attach refresh directly to the
  // challenge image instead of exposing an annotated sync control.
  if (remainingMs() <= 0) return false;
  const currentControls = await locateVietnamCaptchaControls(page, Math.min(remainingMs(), 1_000));
  if (!currentControls) return false;
  const imageClicked = await currentControls.image
    .click({ timeout: Math.max(1, Math.min(remainingMs(), 1_000)) })
    .then(() => true)
    .catch(() => false);
  return imageClicked
    ? waitForVietnamCaptchaRefresh(page, previousFingerprint, remainingMs())
    : false;
}

/**
 * Submit the currently-filled CAPTCHA from the same DOM/frame as the input.
 * The official portal has used several labels for this control over time, so
 * prefer a nearby enabled submit/verification control and fall back to the
 * owning form or Enter. This is only called after portal-state detection has
 * positively identified a visible CAPTCHA.
 */
export async function submitVietnamCaptchaAnswer(
  page: Page,
  timeoutMs = 10_000,
): Promise<boolean> {
  // Filling the controlled CAPTCHA input can cause the official Vue/Ant dialog
  // to redraw or briefly hide the image. Submission only needs the still-live
  // input and its frame, so do not require the image to remain visible here.
  const controls = await locateVietnamCaptchaInputControls(
    page,
    Math.min(timeoutMs, CAPTCHA_INPUT_WAIT_MS),
  );
  if (!controls) {
    const diagnostics = await describeVietnamCaptchaDom(page);
    console.warn(`[vn] CAPTCHA submit input not found. ${diagnostics}`);
    return false;
  }
  const inputBox = await controls.input.boundingBox().catch(() => null);
  const submitMarker = `viza-captcha-${Date.now().toString(36)}`;
  await controls.input
    .evaluate((element, marker) => element.setAttribute("data-viza-captcha-submit", marker), submitMarker)
    .catch(() => undefined);
  // Resolve and activate the nearest positive action in one browser-context
  // task before walking every button through Playwright. The live review page
  // can contain dozens of controls; the old per-control scan consumed the
  // remaining CAPTCHA budget after a valid 2Captcha answer was already filled.
  const fastDomTargetMarked = await dispatchVietnamCaptchaSubmitFallback(
    controls.root,
    `[data-viza-captcha-submit="${submitMarker}"]`,
  ).catch((error) => {
    console.warn(
      `[vn] CAPTCHA fast DOM submit failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  });
  const fastDomClicked = fastDomTargetMarked
    ? await controls.root
        .locator(`[data-viza-captcha-action="${submitMarker}"]`)
        .first()
        .click({ timeout: Math.min(timeoutMs, 5_000) })
        .then(() => true)
        .catch(() => false)
    : false;
  if (fastDomClicked) {
    await page.waitForTimeout(Math.min(timeoutMs, 5_000));
    return true;
  }
  const candidates = controls.root.locator(
    "button, input[type='submit'], input[type='button'], [role='button'], a",
  );
  const count = Math.min(await candidates.count().catch(() => 0), 80);
  let best: { locator: Locator; score: number } | null = null;
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const [visible, enabled, box] = await Promise.all([
      candidate.isVisible().catch(() => false),
      candidate.isEnabled().catch(() => false),
      candidate.boundingBox().catch(() => null),
    ]);
    if (!visible || !enabled || !box) continue;
    const [text, value, ariaLabel, title, tagName, type] = await Promise.all([
      candidate.innerText({ timeout: 1_000 }).catch(() => ""),
      candidate.getAttribute("value").catch(() => null),
      candidate.getAttribute("aria-label").catch(() => null),
      candidate.getAttribute("title").catch(() => null),
      candidate.evaluate((element) => element.tagName.toLowerCase()).catch(() => ""),
      candidate.getAttribute("type").catch(() => null),
    ]);
    const label = `${text} ${value ?? ""} ${ariaLabel ?? ""} ${title ?? ""}`.replace(/\s+/g, " ").trim();
    const nativeSubmit =
      (tagName === "button" && (type === null || type.toLowerCase() === "submit")) ||
      (tagName === "input" && type?.toLowerCase() === "submit");
    if (!CAPTCHA_SUBMIT_LABEL_PATTERN.test(label) && !nativeSubmit) continue;
    const distance = inputBox
      ? Math.abs(box.y + box.height / 2 - (inputBox.y + inputBox.height / 2)) * 2 +
        Math.abs(box.x - (inputBox.x + inputBox.width))
      : box.y;
    const score = distance + (CAPTCHA_SUBMIT_LABEL_PATTERN.test(label) ? -1_000 : -500);
    if (!best || score < best.score) best = { locator: candidate, score };
  }

  const clicked = best
    ? await best.locator
        .click({ timeout: Math.min(timeoutMs, 5_000) })
        .then(() => true)
        .catch(() => false)
    : false;
  // Vue can replace the input/button nodes between the controlled-input fill
  // and Playwright's click. Re-resolve both nodes inside one browser task so a
  // late Ant dialog redraw cannot leave us holding a detached locator. The
  // fallback is intentionally scoped to the input's dialog/form and excludes
  // destructive navigation controls before considering proximity.
  const enterSubmitted = clicked
    ? false
    : await controls.input
        .press("Enter", { timeout: Math.min(timeoutMs, 5_000) })
        .then(() => true)
        .catch(() => false);
  await page.waitForTimeout(Math.min(timeoutMs, 5_000));
  if (!clicked && !enterSubmitted) {
    console.warn(`[vn] CAPTCHA submit control was not activated (candidates=${count}, matched=${Boolean(best)}).`);
  }
  return clicked || enterSubmitted;
}

async function dispatchVietnamCaptchaSubmitFallback(
  root: CaptchaRoot,
  inputSelector = CAPTCHA_INPUT_SELECTOR,
): Promise<boolean> {
  // tsx/esbuild can preserve its `__name` helper inside functions serialized
  // into Playwright's page context. Mirror the select filler bootstrap so the
  // fallback works in both tests and the production bundle.
  await root.evaluate("window.__name = window.__name || ((fn) => fn)");
  return root.evaluate((inputSelector) => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(inputSelector));
    const input = inputs.find((candidate) => visible(candidate) && !candidate.disabled && !candidate.readOnly);
    if (!input) return false;

    // The live review page mounts the CAPTCHA input in a small Ant form while
    // its Back/Next actions are sibling controls outside that form. Search the
    // visible document and rank by proximity; limiting this to closest(form)
    // caused the old path to synthesize Enter without ever clicking Next.
    const scope = document.body;
    const inputRect = input.getBoundingClientRect();
    const positive =
      /\b(next|continue|submit|verify|confirm|send|check|ok)\b|tiếp tục|xác nhận|kiểm tra|kiểm chứng|hoàn tất|hoàn thành|gửi|nộp|đồng ý|duyệt/i;
    const negative = /\b(back|cancel|close|refresh|reload|previous)\b|quay lại|hủy|đóng|làm mới/i;
    const candidates = Array.from(
      scope.querySelectorAll<HTMLElement>("button, input[type='submit'], input[type='button'], [role='button'], a"),
    )
      .filter((candidate) => visible(candidate) && !candidate.hasAttribute("disabled"))
      .map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const label = `${candidate.textContent ?? ""} ${candidate.getAttribute("value") ?? ""} ${candidate.getAttribute("aria-label") ?? ""} ${candidate.getAttribute("title") ?? ""}`
          .replace(/\s+/g, " ")
          .trim();
        const nativeSubmit =
          (candidate.tagName.toLowerCase() === "button" &&
            (!candidate.getAttribute("type") || candidate.getAttribute("type")?.toLowerCase() === "submit")) ||
          (candidate.tagName.toLowerCase() === "input" && candidate.getAttribute("type")?.toLowerCase() === "submit");
        const distance =
          Math.abs(rect.y + rect.height / 2 - (inputRect.y + inputRect.height / 2)) * 2 +
          Math.abs(rect.x - (inputRect.x + inputRect.width));
        const score = distance + (positive.test(label) ? -1_000 : nativeSubmit ? -500 : 0);
        return { candidate, label, nativeSubmit, distance, score };
      })
      .filter(({ label, nativeSubmit, distance }) => !negative.test(label) && (positive.test(label) || nativeSubmit || distance < 500))
      .sort((left, right) => left.score - right.score);
    const target = candidates[0]?.candidate;
    if (target) {
      // Mark in the browser process, then let Playwright perform the actual
      // trusted click. Some official Vue handlers ignore synthetic
      // HTMLElement.click()/KeyboardEvent dispatches.
      const marker = input.getAttribute("data-viza-captcha-submit");
      if (!marker) return false;
      target.setAttribute("data-viza-captcha-action", marker);
      return true;
    }
    return false;
  }, inputSelector);
}

export async function captureVietnamCaptchaFingerprint(
  page: Page,
  waitMs = 1_000,
): Promise<string | null> {
  const controls = await locateVietnamCaptchaControls(page, waitMs);
  if (!controls) return null;
  const capture = await captureVietnamCaptchaImage(controls.image, 10_000).catch(() => null);
  return capture ? fingerprintVietnamCaptchaImage(capture.buffer) : null;
}

export async function waitForVietnamCaptchaRefresh(
  page: Page,
  previousFingerprint: string | null,
  timeoutMs = 10_000,
): Promise<boolean> {
  const deadline = Date.now() + Math.max(timeoutMs, 0);
  do {
    const currentFingerprint = await captureVietnamCaptchaFingerprint(page, 500);
    if (currentFingerprint && (!previousFingerprint || currentFingerprint !== previousFingerprint)) {
      return true;
    }
    if (Date.now() < deadline) await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return false;
}

async function firstUsableInput(locator: Locator): Promise<Locator | null> {
  // Keep this lookup inside the browser process. On Fly, walking a review page
  // input-by-input through Playwright can take tens of seconds and consume the
  // CAPTCHA solver's total deadline before a task is even created.
  const index = await locator
    .evaluateAll((elements) => {
      const limit = Math.min(elements.length, 30);
      for (let current = 0; current < limit; current += 1) {
        const element = elements[current];
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) continue;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          !element.disabled &&
          !element.readOnly
        ) {
          return current;
        }
      }
      return -1;
    })
    .catch(() => -1);
  return index >= 0 ? locator.nth(index) : null;
}

async function firstVisible(locator: Locator): Promise<Locator | null> {
  const index = await locator
    .evaluateAll((elements) => {
      const limit = Math.min(elements.length, 30);
      for (let current = 0; current < limit; current += 1) {
        const element = elements[current];
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0) {
          return current;
        }
      }
      return -1;
    })
    .catch(() => -1);
  return index >= 0 ? locator.nth(index) : null;
}

async function firstVisibleLoadedCaptchaGraphic(locator: Locator): Promise<Locator | null> {
  const index = await locator
    .evaluateAll((elements) => {
      const limit = Math.min(elements.length, 30);
      for (let current = 0; current < limit; current += 1) {
        const element = elements[current];
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
          continue;
        }
        if (element instanceof HTMLImageElement &&
          (!element.complete || element.naturalWidth <= 0 || element.naturalHeight <= 0)) {
          continue;
        }
        if (element instanceof HTMLCanvasElement && (element.width <= 0 || element.height <= 0)) continue;
        return current;
      }
      return -1;
    })
    .catch(() => -1);
  return index >= 0 ? locator.nth(index) : null;
}

async function locateVietnamCaptchaImage(root: CaptchaRoot, input: Locator): Promise<Locator | null> {
  const direct = await firstVisibleLoadedCaptchaGraphic(root.locator(CAPTCHA_IMAGE_SELECTOR));
  if (direct) return direct;

  // The current official review dialog renders an id-less challenge image and
  // a nearby Ant `sync` SVG. The former fallback inspected every image through
  // separate Playwright calls and could select the small refresh icon because
  // it was physically closest to the input. Rank all candidates in one browser
  // evaluation, reject controls/icons, and strongly prefer CAPTCHA-shaped
  // raster images or canvases.
  const candidates = root.locator("img, canvas, svg");
  const bestIndex = await input
    .evaluate((currentInput) => {
      const inputRect = currentInput.getBoundingClientRect();
      const elements = Array.from(document.querySelectorAll("img, canvas, svg")).slice(0, 50);
      let selectedIndex = -1;
      let selectedScore = Number.POSITIVE_INFINITY;
      for (let index = 0; index < elements.length; index += 1) {
        const element = elements[index];
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          rect.width < 40 ||
          rect.height < 20
        ) {
          continue;
        }
        if (element instanceof HTMLImageElement &&
          (!element.complete || element.naturalWidth <= 0 || element.naturalHeight <= 0)) {
          continue;
        }
        if (element instanceof HTMLCanvasElement && (element.width <= 0 || element.height <= 0)) continue;
        const metadata = `${element.getAttribute("src") ?? ""} ${element.getAttribute("alt") ?? ""} ` +
          `${element.getAttribute("class") ?? ""} ${element.getAttribute("id") ?? ""} ` +
          `${element.getAttribute("data-icon") ?? ""}`;
        const control = element.closest("button, [role='button'], a");
        const controlMetadata = control
          ? `${control.textContent ?? ""} ${control.getAttribute("aria-label") ?? ""} ` +
            `${control.getAttribute("title") ?? ""} ${control.getAttribute("class") ?? ""}`
          : "";
        if (/refresh|reload|sync|redo|rotate|anticon/i.test(`${metadata} ${controlMetadata}`)) continue;
        if (control && element.tagName.toLowerCase() === "svg") continue;

        const tagName = element.tagName.toLowerCase();
        const aspectRatio = rect.width / Math.max(rect.height, 1);
        const plausibleChallenge = rect.width >= 70 && rect.height >= 28 && aspectRatio >= 1.4 && aspectRatio <= 12;
        if (tagName === "svg" && !plausibleChallenge && !/captcha|security|code|xác nhận/i.test(metadata)) {
          continue;
        }
        const dx = Math.abs(rect.x + rect.width / 2 - (inputRect.x + inputRect.width / 2));
        const dy = Math.abs(rect.y + rect.height / 2 - (inputRect.y + inputRect.height / 2));
        const metadataBonus = /captcha|security|code|xác nhận/i.test(metadata) ? -1_000 : 0;
        const shapeBonus = plausibleChallenge ? -500 : 0;
        const rasterBonus = tagName === "img" || tagName === "canvas" ? -250 : 0;
        const score = dx + dy * 2 + metadataBonus + shapeBonus + rasterBonus;
        if (score < selectedScore) {
          selectedIndex = index;
          selectedScore = score;
        }
      }
      return selectedIndex;
    })
    .catch(() => -1);
  return bestIndex >= 0 ? candidates.nth(bestIndex) : null;
}

async function rootHasVisibleCaptchaDialog(root: CaptchaRoot): Promise<boolean> {
  const dialogs = root.locator("[role='dialog'], .MuiDialog-root, .MuiModal-root");
  const count = Math.min(await dialogs.count().catch(() => 0), 20);
  for (let index = 0; index < count; index += 1) {
    const dialog = dialogs.nth(index);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    const text = await dialog.innerText({ timeout: 1_000 }).catch(() => "");
    if (/captcha verification|enter captcha|captcha/i.test(text)) return true;
  }
  return false;
}

async function locateVietnamCaptchaControls(page: Page, waitMs: number): Promise<VietnamCaptchaControls | null> {
  const deadline = Date.now() + waitMs;
  do {
    for (const root of [page, ...page.frames().filter((frame) => frame !== page.mainFrame())]) {
      const exactInput = await firstUsableInput(root.locator(CAPTCHA_INPUT_SELECTOR));
      if (exactInput) {
        const image = await locateVietnamCaptchaImage(root, exactInput);
        if (image) return { root, input: exactInput, image };
      }

      const challengeVisible =
        Boolean(await firstVisible(root.locator(CAPTCHA_IMAGE_SELECTOR))) ||
        await rootHasVisibleCaptchaDialog(root);
      if (!challengeVisible) continue;

      const genericInput = await firstUsableInput(
        root.locator("input:not([type]), input[type='text'], input[type='search'], textarea"),
      );
      if (!genericInput) continue;
      const image = await locateVietnamCaptchaImage(root, genericInput);
      if (image) return { root, input: genericInput, image };
    }
    if (Date.now() < deadline) await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return null;
}

async function locateVietnamCaptchaInputControls(
  page: Page,
  waitMs: number,
): Promise<VietnamCaptchaInputControls | null> {
  const deadline = Date.now() + waitMs;
  do {
    for (const root of [page, ...page.frames().filter((frame) => frame !== page.mainFrame())]) {
      const exactInput = await firstUsableInput(root.locator(CAPTCHA_INPUT_SELECTOR));
      if (exactInput) return { root, input: exactInput };

      // The review checkpoint currently renders an inline generic text input:
      // it has no captcha-related name/id/placeholder and is not inside a
      // dialog. The solve path can find it from the adjacent CAPTCHA image,
      // but the old submit path could not re-resolve it after filling, so every
      // otherwise-successful 2captcha answer was discarded without a click.
      const challengeVisible =
        Boolean(await firstVisible(root.locator(CAPTCHA_IMAGE_SELECTOR))) ||
        await rootHasVisibleCaptchaDialog(root);
      if (!challengeVisible) continue;
      const genericInput = await firstUsableInput(
        root.locator("input:not([type]), input[type='text'], input[type='search'], textarea"),
      );
      if (!genericInput) continue;
      const image = await locateVietnamCaptchaImage(root, genericInput);
      if (image) return { root, input: genericInput };
    }
    if (Date.now() < deadline) await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return null;
}

export async function hasVisibleVietnamCaptchaChallenge(page: Page): Promise<boolean> {
  return Boolean(await locateVietnamCaptchaControls(page, 1_000));
}

async function describeVietnamCaptchaDom(page: Page): Promise<string> {
  const frames = [];
  for (const frame of page.frames()) {
    const inputs = frame.locator("input, textarea");
    const count = Math.min(await inputs.count().catch(() => 0), 20);
    const descriptors = [];
    for (let index = 0; index < count; index += 1) {
      const input = inputs.nth(index);
      const metadata = await input.evaluate((element) => ({
        type: element.getAttribute("type") ?? "",
        name: element.getAttribute("name") ?? "",
        id: element.getAttribute("id") ?? "",
        placeholder: element.getAttribute("placeholder") ?? "",
        role: element.getAttribute("role") ?? "",
      })).catch(() => null);
      if (!metadata) continue;
      descriptors.push({
        ...metadata,
        visible: await input.isVisible().catch(() => false),
        editable: await input.isEditable().catch(() => false),
      });
    }
    const frameUrl = (() => {
      try {
        const url = new URL(frame.url());
        return `${url.origin}${url.pathname}`;
      } catch {
        return frame.url().slice(0, 160);
      }
    })();
    frames.push({
      url: frameUrl,
      dialogs: await frame.locator("[role='dialog'], .MuiDialog-root, .MuiModal-root").count().catch(() => 0),
      captchaImages: await frame.locator(CAPTCHA_IMAGE_SELECTOR).count().catch(() => 0),
      inputs: descriptors,
    });
  }
  const pageUrl = (() => {
    try {
      const url = new URL(page.url());
      return `${url.origin}${url.pathname}`;
    } catch {
      return page.url().split("?")[0].slice(0, 160);
    }
  })();
  return `captchaDom=${JSON.stringify({ pageUrl, frames }).slice(0, 4_000)}`;
}

async function refreshVietnamCaptcha(input: Locator): Promise<void> {
  const clicked = await input.evaluate((currentInput) => {
    const visible = (element: Element | null): element is HTMLElement | SVGElement => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
    };
    const inputRect = currentInput.getBoundingClientRect();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement | SVGElement>("button, .anticon, svg, img, a"),
    )
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""} ${element.getAttribute("class") ?? ""}`;
        const isRefresh = /reload|refresh|sync|redo|captcha|anticon-sync/i.test(text);
        const dx = Math.abs(rect.left - inputRect.right);
        const dy = Math.abs(rect.top + rect.height / 2 - (inputRect.top + inputRect.height / 2));
        return { element, score: dx + dy * 2 + (isRefresh ? -200 : 0) };
      })
      .sort((left, right) => left.score - right.score);
    const target = candidates[0]?.element;
    if (!target) return false;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    return true;
  });
  if (!clicked) await input.press("Tab").catch(() => undefined);
}
