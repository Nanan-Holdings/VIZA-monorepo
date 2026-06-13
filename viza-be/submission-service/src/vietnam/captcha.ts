import type { Page } from "@playwright/test";
import {
  solveImageCaptcha,
  TwoCaptchaConfigError,
  TwoCaptchaZeroBalanceError,
  type CaptchaSolveResult,
} from "../captcha/two-captcha.js";

export interface VietnamCaptchaSolveOutcome {
  solved: boolean;
  reason?: string;
  telemetry?: {
    solveId: string;
    durationMs: number;
  };
}

const CAPTCHA_IMAGE_SELECTOR = [
  "img[src*='captcha' i]",
  "img[id*='captcha' i]",
  "img[class*='captcha' i]",
  ".captcha img",
].join(", ");

const CAPTCHA_INPUT_SELECTOR = [
  "input[name*='captcha' i]",
  "input[id*='captcha' i]",
  "input[class*='captcha' i]",
  "input[placeholder*='captcha' i]",
  "input[placeholder*='security code' i]",
  "input[placeholder*='mã xác nhận' i]",
  "input[placeholder*='ma xac nhan' i]",
].join(", ");

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

export async function solveVietnamImageCaptcha(
  page: Page,
  timeoutMs: number,
  solver: (image: Buffer, timeoutMs: number) => Promise<CaptchaSolveResult> = solveImageCaptcha,
): Promise<VietnamCaptchaSolveOutcome> {
  if (!shouldSolveVietnamCaptcha()) {
    return { solved: false, reason: "Vietnam CAPTCHA solving is disabled by VN_CAPTCHA_SOLVING_ENABLED=false." };
  }

  const image = page.locator(CAPTCHA_IMAGE_SELECTOR).first();
  const input = page.locator(CAPTCHA_INPUT_SELECTOR).first();
  const imageCount = await image.count().catch(() => 0);
  const inputCount = await input.count().catch(() => 0);
  if (imageCount < 1 || inputCount < 1) {
    return {
      solved: false,
      reason: "Could not locate a visible Vietnam CAPTCHA image/input pair on the official portal.",
    };
  }

  try {
    const imageBuffer = await image.screenshot({ timeout: Math.min(timeoutMs, 30_000) });
    const result = await solver(imageBuffer, timeoutMs);
    await input.fill(result.text, { timeout: 10_000 });
    return {
      solved: true,
      telemetry: {
        solveId: result.solveId,
        durationMs: result.durationMs,
      },
    };
  } catch (error) {
    return {
      solved: false,
      reason: describeVietnamCaptchaError(error),
    };
  }
}
