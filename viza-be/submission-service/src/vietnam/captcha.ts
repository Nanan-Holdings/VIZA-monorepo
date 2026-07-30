import type { Frame, Locator, Page } from "@playwright/test";
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
  "input[placeholder*='enter code' i]",
  "input[placeholder*='mã xác nhận' i]",
  "input[placeholder*='ma xac nhan' i]",
].join(", ");

const DEFAULT_VN_CAPTCHA_TIMEOUT_MS = 180_000;
const CAPTCHA_INPUT_WAIT_MS = 15_000;

type CaptchaRoot = Page | Frame;

interface VietnamCaptchaControls {
  input: Locator;
  image: Locator;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getVietnamCaptchaTimeoutMs(timeoutMs?: number): number {
  const configured = readPositiveIntEnv("VN_CAPTCHA_TIMEOUT_MS", DEFAULT_VN_CAPTCHA_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs ?? NaN) || (timeoutMs ?? 0) <= 0) return configured;
  return Math.max(timeoutMs ?? configured, configured);
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

export async function solveVietnamImageCaptcha(
  page: Page,
  timeoutMs: number,
  solver: (image: Buffer, timeoutMs: number) => Promise<CaptchaSolveResult> = solveImageCaptcha,
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

  let lastReason = "unknown CAPTCHA error";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const imageBuffer = await image.screenshot({ timeout: Math.min(solveTimeoutMs, 30_000) });
      const result = await solver(imageBuffer, solveTimeoutMs);
      await input.fill(result.text, { timeout: 10_000 });
      return {
        solved: true,
        telemetry: {
          solveId: result.solveId,
          durationMs: result.durationMs,
        },
      };
    } catch (error) {
      lastReason = describeVietnamCaptchaError(error);
      if (!/ERROR_CAPTCHA_UNSOLVABLE|unsolvable/i.test(lastReason) || attempt === 3) {
        break;
      }
      await refreshVietnamCaptcha(input).catch(() => undefined);
      await page.waitForTimeout(1_000);
    }
  }
  return {
    solved: false,
    reason: lastReason,
  };
}

async function firstUsableInput(locator: Locator): Promise<Locator | null> {
  const count = Math.min(await locator.count().catch(() => 0), 30);
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const [visible, editable] = await Promise.all([
      candidate.isVisible().catch(() => false),
      candidate.isEditable().catch(() => false),
    ]);
    if (visible && editable) return candidate;
  }
  return null;
}

async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = Math.min(await locator.count().catch(() => 0), 30);
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function locateVietnamCaptchaImage(root: CaptchaRoot, input: Locator): Promise<Locator | null> {
  const direct = await firstVisible(root.locator(CAPTCHA_IMAGE_SELECTOR));
  if (direct) return direct;

  const inputBox = await input.boundingBox().catch(() => null);
  if (!inputBox) return null;
  const candidates = root.locator("img, canvas, svg");
  const count = Math.min(await candidates.count().catch(() => 0), 50);
  let best: { locator: Locator; score: number } | null = null;
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const box = await candidate.boundingBox().catch(() => null);
    if (!box || box.width <= 10 || box.height <= 10) continue;
    const metadata = await candidate.evaluate((element) =>
      `${element.getAttribute("src") ?? ""} ${element.getAttribute("alt") ?? ""} ${element.getAttribute("class") ?? ""}`,
    ).catch(() => "");
    const dx = Math.abs(box.x - (inputBox.x + inputBox.width));
    const dy = Math.abs(box.y + box.height / 2 - (inputBox.y + inputBox.height / 2));
    const labelBonus = /captcha|security|code|xác nhận/i.test(metadata) ? -100 : 0;
    const score = dx + dy * 2 + labelBonus;
    if (!best || score < best.score) best = { locator: candidate, score };
  }
  return best?.locator ?? null;
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
        if (image) return { input: exactInput, image };
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
      if (image) return { input: genericInput, image };
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
  return `captchaDom=${JSON.stringify({ pageUrl: page.url().slice(0, 200), frames }).slice(0, 4_000)}`;
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
