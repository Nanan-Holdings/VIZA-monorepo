import type { Page } from "@playwright/test";
import {
  solveImageCaptcha,
  TwoCaptchaConfigError,
  TwoCaptchaZeroBalanceError,
  type CaptchaSolveResult,
} from "../captcha/two-captcha";

const CAPTCHA_IMAGE_SELECTOR = "img.captcha[alt='驗證碼']";
const CAPTCHA_INPUT_SELECTOR = "input[name='captchaToken']";
const DEFAULT_TW_CAPTCHA_TIMEOUT_MS = 180_000;

export interface TaiwanCaptchaSolveOutcome {
  solved: boolean;
  reason?: string;
  telemetry?: { solveId: string; durationMs: number };
}

function positiveEnvInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getTaiwanCaptchaTimeoutMs(timeoutMs?: number): number {
  const configured = positiveEnvInt("TW_ENTRY_PERMIT_CAPTCHA_TIMEOUT_MS", DEFAULT_TW_CAPTCHA_TIMEOUT_MS);
  return Number.isFinite(timeoutMs) && (timeoutMs ?? 0) > 0 ? Math.max(timeoutMs!, configured) : configured;
}

function describeError(error: unknown): string {
  if (error instanceof TwoCaptchaConfigError) return "TWOCAPTCHA_API_KEY is missing; cannot solve the Taiwan NIA CAPTCHA.";
  if (error instanceof TwoCaptchaZeroBalanceError) return "2captcha account has zero balance; cannot solve the Taiwan NIA CAPTCHA.";
  return error instanceof Error ? error.message : String(error);
}

/** Solves only the image CAPTCHA shown on NIA's email-verification page. */
export async function solveTaiwanNiaImageCaptcha(
  page: Page,
  timeoutMs?: number,
  solver: (image: Buffer, timeout: number) => Promise<CaptchaSolveResult> = solveImageCaptcha,
): Promise<TaiwanCaptchaSolveOutcome> {
  const budget = getTaiwanCaptchaTimeoutMs(timeoutMs);
  const input = page.locator(CAPTCHA_INPUT_SELECTOR);
  const image = page.locator(CAPTCHA_IMAGE_SELECTOR);
  if (!(await input.isVisible().catch(() => false)) || !(await image.isVisible().catch(() => false))) {
    return { solved: false, reason: "Taiwan NIA CAPTCHA controls were not found on the email-verification page." };
  }
  let lastReason = "Taiwan NIA CAPTCHA could not be solved.";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await solver(await image.screenshot({ timeout: Math.min(budget, 30_000) }), budget);
      await input.fill(result.text, { timeout: 10_000 });
      return { solved: true, telemetry: { solveId: result.solveId, durationMs: result.durationMs } };
    } catch (error) {
      lastReason = describeError(error);
      if (!/ERROR_CAPTCHA_UNSOLVABLE|unsolvable/i.test(lastReason) || attempt === 3) break;
      await page.locator("img[alt='換下一組']").click({ timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }
  return { solved: false, reason: lastReason };
}
