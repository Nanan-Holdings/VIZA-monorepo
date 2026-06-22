import type { ElementHandle, Page } from "@playwright/test";
import {
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

  const input = page.locator(CAPTCHA_INPUT_SELECTOR).first();
  const inputCount = await input.count().catch(() => 0);
  if (inputCount < 1) {
    return {
      solved: false,
      reason: "Could not locate a visible Vietnam CAPTCHA input on the official portal.",
    };
  }

  try {
    const inputHandle = (await input.elementHandle({
      timeout: Math.min(timeoutMs, 10_000),
    })) as ElementHandle<HTMLInputElement> | null;
    const imageHandle = inputHandle ? await locateVietnamCaptchaImage(page, inputHandle) : null;
    if (!imageHandle) {
      return {
        solved: false,
        reason: "Could not locate a visible Vietnam CAPTCHA image near the official portal security-code input.",
      };
    }
    const imageBuffer = await imageHandle.screenshot({ timeout: Math.min(timeoutMs, 30_000) });
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

async function locateVietnamCaptchaImage(
  page: Page,
  inputHandle: ElementHandle<HTMLInputElement>,
): Promise<ElementHandle<HTMLElement | SVGElement> | null> {
  const direct = page.locator(CAPTCHA_IMAGE_SELECTOR).first();
  if ((await direct.count().catch(() => 0)) > 0 && (await direct.isVisible().catch(() => false))) {
    return (await direct.elementHandle()) as ElementHandle<HTMLElement | SVGElement> | null;
  }
  const handle = await page.evaluateHandle((input) => {
    const visible = (element: Element | null): element is HTMLElement | SVGElement => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 10 && rect.height > 10;
    };
    const inputRect = input.getBoundingClientRect();
    const candidates = Array.from(document.querySelectorAll<HTMLElement | SVGElement>("img, canvas, svg"))
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const dx = Math.abs(rect.left - inputRect.right);
        const dy = Math.abs(rect.top + rect.height / 2 - (inputRect.top + inputRect.height / 2));
        const labelBonus = /captcha|security|code|xác nhận/i.test(
          `${element.getAttribute("src") ?? ""} ${element.getAttribute("alt") ?? ""} ${element.getAttribute("class") ?? ""}`,
        )
          ? -100
          : 0;
        return { element, score: dx + dy * 2 + labelBonus };
      })
      .sort((left, right) => left.score - right.score);
    return candidates[0]?.element ?? null;
  }, inputHandle);
  return handle.asElement() as ElementHandle<HTMLElement | SVGElement> | null;
}
