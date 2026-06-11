import type { Page } from "@playwright/test";
import {
  reportBadCaptcha,
  solveImageCaptcha,
  type CaptchaSolveResult,
  type CaptchaSolveTelemetry,
} from "../captcha";
import type { USAppointmentRunnerConfig } from "./runner";

const DEFAULT_IMAGE_SELECTOR =
  'img[id*="captcha" i], img[src*="captcha" i], canvas[id*="captcha" i]';
const DEFAULT_INPUT_SELECTOR =
  'input[id*="captcha" i], input[name*="captcha" i], input[autocomplete="one-time-code"]';

export type USAppointmentCaptchaOutcome =
  | { status: "solved"; solve: CaptchaSolveResult }
  | { status: "wrong_answer"; solve: CaptchaSolveResult; validationHint: string }
  | { status: "disabled" }
  | { status: "no_captcha" }
  | { status: "failed"; reason: string };

export interface USAppointmentCaptchaOptions {
  imageSelector?: string;
  inputSelector?: string;
  validationSelector?: string;
  timeoutMs?: number;
}

export interface USAppointmentCaptchaSolveWithTelemetry {
  solve: CaptchaSolveResult;
  telemetry: CaptchaSolveTelemetry[];
}

async function screenshotCaptcha(
  page: Page,
  selector: string,
): Promise<Buffer | null> {
  const captcha = page.locator(selector).first();
  try {
    await captcha.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    return null;
  }
  try {
    return await captcha.screenshot({ timeout: 10_000 });
  } catch (err) {
    throw new Error(
      `Could not screenshot US appointment CAPTCHA: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function solveUSAppointmentCaptchaOnce(
  page: Page,
  config: USAppointmentRunnerConfig,
  options: USAppointmentCaptchaOptions = {},
): Promise<USAppointmentCaptchaOutcome> {
  if (!config.captchaSolvingEnabled) return { status: "disabled" };
  if (!config.twoCaptchaConfigured) {
    return { status: "failed", reason: "TWOCAPTCHA_API_KEY is not configured" };
  }

  const imageSelector = options.imageSelector ?? DEFAULT_IMAGE_SELECTOR;
  const inputSelector = options.inputSelector ?? DEFAULT_INPUT_SELECTOR;
  const captchaImage = await screenshotCaptcha(page, imageSelector);
  if (!captchaImage) return { status: "no_captcha" };

  let solve: CaptchaSolveResult;
  try {
    solve = await solveImageCaptcha(captchaImage, options.timeoutMs);
  } catch (err) {
    return {
      status: "failed",
      reason: `2captcha solve failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const input = page.locator(inputSelector).first();
  if ((await input.count()) === 0) {
    return {
      status: "failed",
      reason: "CAPTCHA image found but no matching input was present",
    };
  }
  await input.fill(solve.text.trim());

  if (options.validationSelector) {
    const validation = page.locator(options.validationSelector).first();
    const hint = await validation.innerText({ timeout: 1_000 }).catch(() => "");
    if (hint.trim()) {
      await reportBadCaptcha(solve.solveId).catch(() => undefined);
      return {
        status: "wrong_answer",
        solve,
        validationHint: hint.trim(),
      };
    }
  }

  return { status: "solved", solve };
}

export async function solveUSAppointmentCaptchaWithRetry(
  page: Page,
  config: USAppointmentRunnerConfig,
  options: USAppointmentCaptchaOptions = {},
): Promise<USAppointmentCaptchaSolveWithTelemetry | null> {
  if (!config.captchaSolvingEnabled) return null;

  const telemetry: CaptchaSolveTelemetry[] = [];
  const maxAttempts = Math.max(1, config.captchaMaxAttempts);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outcome = await solveUSAppointmentCaptchaOnce(page, config, options);
    if (outcome.status === "solved") {
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
      continue;
    }
    if (outcome.status === "disabled" || outcome.status === "no_captcha") {
      return null;
    }
    telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
  }

  throw new Error(`US appointment CAPTCHA solve failed after ${maxAttempts} attempts`);
}
