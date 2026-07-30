import { createHash } from "node:crypto";
import type { ElementHandle, Frame, Locator, Page } from "@playwright/test";
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
    imageFingerprint: string;
  };
}

const CAPTCHA_IMAGE_SELECTOR = [
  "img[src*='captcha' i]:visible",
  "img[alt*='captcha' i]:visible",
  "img[id*='captcha' i]:visible",
  "img[class*='captcha' i]:visible",
  "canvas[id*='captcha' i]:visible",
  "canvas[class*='captcha' i]:visible",
  ".captcha img:visible",
  ".captcha canvas:visible",
].join(", ");

const CAPTCHA_INPUT_SELECTOR = [
  "input[name*='captcha' i]:visible",
  "input[id*='captcha' i]:visible",
  "input[class*='captcha' i]:visible",
  "input[placeholder*='captcha' i]:visible",
  "input[placeholder*='security code' i]:visible",
  "input[placeholder*='verification code' i]:visible",
  "input[placeholder*='mã xác nhận' i]:visible",
  "input[placeholder*='ma xac nhan' i]:visible",
  "input[aria-label*='captcha' i]:visible",
  "input[aria-label*='security code' i]:visible",
  "input[aria-label*='verification code' i]:visible",
].join(", ");

const CAPTCHA_ACCESSIBLE_NAME =
  /enter captcha|captcha|security code|verification code|mã xác nhận|ma xac nhan/i;

const DEFAULT_VN_CAPTCHA_TIMEOUT_MS = 180_000;
const CAPTCHA_REFRESH_WAIT_MS = 8_000;
const CAPTCHA_INPUT_WAIT_MS = 15_000;
const CAPTCHA_INPUT_POLL_MS = 250;

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

export function normalizeVietnamCaptchaAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, "");
}

export function fingerprintVietnamCaptchaImage(image: Buffer): string {
  return createHash("sha256").update(image).digest("hex");
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

  const input = await locateVietnamCaptchaInput(page);
  if (!input) {
    return {
      solved: false,
      reason: "Could not locate a visible Vietnam CAPTCHA input on the official portal.",
    };
  }

  let lastReason = "unknown CAPTCHA error";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const inputHandle = (await input.elementHandle({
        timeout: Math.min(solveTimeoutMs, 10_000),
      })) as ElementHandle<HTMLInputElement> | null;
      const imageHandle = inputHandle ? await locateVietnamCaptchaImage(page, inputHandle) : null;
      if (!imageHandle) {
        return {
          solved: false,
          reason: "Could not locate a visible Vietnam CAPTCHA image near the official portal security-code input.",
        };
      }
      const imageBuffer = await imageHandle.screenshot({ timeout: Math.min(solveTimeoutMs, 30_000) });
      const imageFingerprint = fingerprintVietnamCaptchaImage(imageBuffer);
      const result = await solver(imageBuffer, solveTimeoutMs);
      const answer = normalizeVietnamCaptchaAnswer(result.text);
      if (!answer) {
        throw new Error("2captcha returned an empty Vietnam CAPTCHA answer.");
      }
      await fillAndVerifyVietnamCaptchaInput(input, answer);
      return {
        solved: true,
        telemetry: {
          solveId: result.solveId,
          durationMs: result.durationMs,
          imageFingerprint,
        },
      };
    } catch (error) {
      lastReason = describeVietnamCaptchaError(error);
      if (!/ERROR_CAPTCHA_UNSOLVABLE|unsolvable/i.test(lastReason) || attempt === 3) {
        break;
      }
      await refreshVietnamCaptchaChallenge(page).catch(() => false);
    }
  }
  return {
    solved: false,
    reason: lastReason,
  };
}

type VietnamCaptchaLocatorRoot = Page | Frame;

async function rootHasVisibleVietnamCaptchaChallenge(
  root: VietnamCaptchaLocatorRoot,
): Promise<boolean> {
  const dialogs = root
    .getByRole("dialog")
    .filter({ hasText: CAPTCHA_ACCESSIBLE_NAME });
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let index = 0; index < dialogCount; index += 1) {
    if (await dialogs.nth(index).isVisible().catch(() => false)) return true;
  }

  const images = root.locator(CAPTCHA_IMAGE_SELECTOR);
  const imageCount = await images.count().catch(() => 0);
  for (let index = 0; index < imageCount; index += 1) {
    if (await images.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

export async function hasVisibleVietnamCaptchaChallenge(page: Page): Promise<boolean> {
  const roots: VietnamCaptchaLocatorRoot[] = [
    page,
    ...page.frames().filter((frame) => frame !== page.mainFrame()),
  ];
  for (const root of roots) {
    if (await rootHasVisibleVietnamCaptchaChallenge(root)) return true;
  }
  return false;
}

async function firstUsableVietnamCaptchaInput(candidates: Locator): Promise<Locator | null> {
  const count = await candidates.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const usable = await candidate
      .evaluate((input) => {
        if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
          return false;
        }
        const element = input;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          !element.disabled &&
          !element.readOnly &&
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      })
      .catch(() => false);
    if (usable) return candidate;
  }
  return null;
}

async function locateVietnamCaptchaInputInRoot(
  root: VietnamCaptchaLocatorRoot,
): Promise<Locator | null> {
  const captchaDialogInputs = root
    .getByRole("dialog")
    .filter({ hasText: CAPTCHA_ACCESSIBLE_NAME })
    .locator("input:not([type='hidden']), textarea, [contenteditable='true']");
  const candidateGroups = [
    captchaDialogInputs,
    root.getByRole("textbox", { name: CAPTCHA_ACCESSIBLE_NAME }),
    root.getByLabel(CAPTCHA_ACCESSIBLE_NAME),
    root.locator(CAPTCHA_INPUT_SELECTOR),
  ];
  for (const candidates of candidateGroups) {
    const candidate = await firstUsableVietnamCaptchaInput(candidates);
    if (candidate) return candidate;
  }

  const nearbyCandidates = root.locator("input[type='text'], input:not([type])");
  const nearbyCount = await nearbyCandidates.count().catch(() => 0);
  for (let index = 0; index < nearbyCount; index += 1) {
    const candidate = nearbyCandidates.nth(index);
    const isCaptchaInput = await candidate
      .evaluate((input) => {
        const element = input as HTMLInputElement;
        if (element.disabled || element.readOnly) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
          return false;
        }

        const labels = element.labels
          ? Array.from(element.labels).map((label) => label.textContent ?? "").join(" ")
          : "";
        const container = element.closest(
          "[role='dialog'], [aria-modal='true'], .MuiDialog-root, .MuiModal-root, form, fieldset",
        );
        let ancestorText = "";
        let ancestor: HTMLElement | null = element.parentElement;
        for (let depth = 0; ancestor && depth < 5; depth += 1) {
          ancestorText += ` ${ancestor.textContent ?? ""}`;
          ancestor = ancestor.parentElement;
        }
        const context = `${labels} ${container?.textContent ?? ""} ${ancestorText}`;
        return /enter captcha|captcha verification|captcha|security code|verification code|mã xác nhận|ma xac nhan/i.test(
          context,
        );
      })
      .catch(() => false);
    if (isCaptchaInput) return candidate;
  }

  const visibleCaptchaText = await root
    .getByText(CAPTCHA_ACCESSIBLE_NAME)
    .first()
    .isVisible()
    .catch(() => false);
  if (visibleCaptchaText) {
    const genericCandidates = root.locator(
      "input:not([type='hidden']), textarea, [contenteditable='true']",
    );
    const usableCandidates: Locator[] = [];
    const genericCount = await genericCandidates.count().catch(() => 0);
    for (let index = 0; index < genericCount; index += 1) {
      const candidate = await firstUsableVietnamCaptchaInput(genericCandidates.nth(index));
      if (candidate) usableCandidates.push(candidate);
    }
    if (usableCandidates.length === 1) return usableCandidates[0] ?? null;
  }
  return null;
}

async function logVietnamCaptchaInputDiagnostics(page: Page): Promise<void> {
  const diagnostics = await Promise.all(
    page.frames().map(async (frame) => ({
      frameUrl: frame.url(),
      visibleText: (await frame.locator("body").innerText({ timeout: 2_000 }).catch(() => ""))
        .replace(/\s+/g, " ")
        .slice(0, 500),
      inputs: await frame
        .locator("input, textarea, [contenteditable='true']")
        .evaluateAll((elements) =>
          elements.slice(0, 20).map((element) => {
            const input = element as HTMLInputElement;
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              type: input.type ?? "",
              id: element.id,
              name: input.name ?? "",
              ariaLabel: element.getAttribute("aria-label") ?? "",
              placeholder: input.placeholder ?? "",
              disabled: input.disabled ?? false,
              readOnly: input.readOnly ?? false,
              visible: rect.width > 0 && rect.height > 0,
            };
          }),
        )
        .catch(() => []),
    })),
  );
  console.warn("[vn-prearrival] CAPTCHA input not found", JSON.stringify({
    pageUrl: page.url(),
    frames: diagnostics,
  }));
}

async function locateVietnamCaptchaInput(page: Page): Promise<Locator | null> {
  const deadline = Date.now() + CAPTCHA_INPUT_WAIT_MS;
  while (Date.now() < deadline) {
    const roots: VietnamCaptchaLocatorRoot[] = [
      page,
      ...page.frames().filter((frame) => frame !== page.mainFrame()),
    ];
    for (const root of roots) {
      const candidate = await locateVietnamCaptchaInputInRoot(root);
      if (candidate) return candidate;
    }
    await page.waitForTimeout(CAPTCHA_INPUT_POLL_MS);
  }
  await logVietnamCaptchaInputDiagnostics(page).catch(() => undefined);
  return null;
}

async function fillAndVerifyVietnamCaptchaInput(input: Locator, answer: string): Promise<void> {
  await input.fill(answer, { timeout: 10_000 });
  await input.evaluate((element, expected) => {
    const target = element as HTMLInputElement;
    if (target.value !== expected) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(target, expected);
      target.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        data: expected,
        inputType: "insertText",
      }));
    }
    target.dispatchEvent(new Event("change", { bubbles: true }));
    target.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }, answer);
  const actual = normalizeVietnamCaptchaAnswer(await input.inputValue({ timeout: 5_000 }));
  if (actual !== answer) {
    throw new Error("The Vietnam CAPTCHA answer did not remain in the official portal input.");
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
  const inputBox = await inputHandle.boundingBox();
  if (!inputBox) return null;
  const handles = await page.locator("img, canvas, svg").elementHandles();
  let best: { handle: ElementHandle<HTMLElement | SVGElement>; score: number } | null = null;
  for (const handle of handles as Array<ElementHandle<HTMLElement | SVGElement>>) {
    const box = await handle.boundingBox().catch(() => null);
    if (!box || box.width <= 10 || box.height <= 10) continue;
    const metadata = await handle.evaluate((element) =>
      `${element.getAttribute("src") ?? ""} ${element.getAttribute("alt") ?? ""} ${element.getAttribute("class") ?? ""}`,
    ).catch(() => "");
    const dx = Math.abs(box.x - (inputBox.x + inputBox.width));
    const dy = Math.abs(box.y + box.height / 2 - (inputBox.y + inputBox.height / 2));
    const labelBonus = /captcha|security|code|xác nhận/i.test(metadata) ? -100 : 0;
    const score = dx + dy * 2 + labelBonus;
    if (!best || score < best.score) best = { handle, score };
  }
  return best?.handle ?? null;
}

async function captureVietnamCaptchaFingerprint(
  page: Page,
  input: Locator,
): Promise<string | null> {
  const inputHandle = await input.elementHandle({ timeout: 5_000 }).catch(() => null) as ElementHandle<HTMLInputElement> | null;
  if (!inputHandle) return null;
  const imageHandle = await locateVietnamCaptchaImage(page, inputHandle);
  if (!imageHandle) return null;
  const image = await imageHandle.screenshot({ timeout: 10_000 }).catch(() => null);
  return image ? fingerprintVietnamCaptchaImage(image) : null;
}

export async function refreshVietnamCaptchaChallenge(
  page: Page,
  previousFingerprint?: string,
): Promise<boolean> {
  const input = await locateVietnamCaptchaInput(page);
  if (!input) return false;

  await input.fill("").catch(() => undefined);
  const currentFingerprint = await captureVietnamCaptchaFingerprint(page, input);
  if (previousFingerprint && currentFingerprint && currentFingerprint !== previousFingerprint) {
    return true;
  }

  const inputHandle = await input.elementHandle({ timeout: 5_000 }).catch(() => null) as ElementHandle<HTMLInputElement> | null;
  if (!inputHandle) return false;
  const imageHandle = await locateVietnamCaptchaImage(page, inputHandle);
  const clickedExplicitRefresh = await page.evaluate((captchaInput) => {
    const inputRect = captchaInput.getBoundingClientRect();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement | SVGElement>(
        "button, [role='button'], a, .anticon-sync, svg[class*='sync' i], img[class*='refresh' i]",
      ),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""} ${element.getAttribute("class") ?? ""}`;
        const isRefresh = /reload|refresh|sync|redo|anticon-sync/i.test(text);
        const dx = Math.abs(rect.left - inputRect.right);
        const dy = Math.abs(rect.top + rect.height / 2 - (inputRect.top + inputRect.height / 2));
        return { element, score: dx + dy * 2, isRefresh };
      })
      .filter((candidate) => candidate.isRefresh)
      .sort((left, right) => left.score - right.score);
    const target = candidates[0]?.element;
    if (!target) return false;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    return true;
  }, inputHandle);

  if (!clickedExplicitRefresh && imageHandle) {
    await imageHandle.click({ timeout: 5_000 }).catch(() => undefined);
  }
  if (!clickedExplicitRefresh && !imageHandle) return false;

  const baselineFingerprint = currentFingerprint ?? previousFingerprint;
  if (!baselineFingerprint) {
    await page.waitForTimeout(500);
    return true;
  }

  const deadline = Date.now() + CAPTCHA_REFRESH_WAIT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(250);
    const nextFingerprint = await captureVietnamCaptchaFingerprint(page, input);
    if (nextFingerprint && nextFingerprint !== baselineFingerprint) {
      return true;
    }
  }
  return false;
}

export async function submitVietnamCaptchaChallenge(page: Page): Promise<boolean> {
  const input = await locateVietnamCaptchaInput(page);
  if (!input) return false;

  const inputBox = await input.boundingBox().catch(() => null);
  const form = input.locator("xpath=ancestor::form[1]");
  const root: Page | Locator = (await form.count().catch(() => 0)) > 0 ? form : page;
  const candidates = root.locator(
    "button, a, [role='button'], input[type='button'], input[type='submit']",
  );
  const count = await candidates.count().catch(() => 0);
  let best: { locator: Locator; distance: number } | null = null;

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (!await candidate.isVisible().catch(() => false)) continue;
    const metadata = await candidate
      .evaluate((element) => {
        const control = element as HTMLButtonElement | HTMLInputElement;
        return {
          disabled: Boolean(control.disabled) || element.getAttribute("aria-disabled") === "true",
          labels: [
            element.textContent,
            "value" in control ? control.value : "",
            element.getAttribute("aria-label"),
          ]
            .filter(Boolean)
            .map((label) => String(label).replace(/\s+/g, " ").trim()),
        };
      })
      .catch(() => null);
    if (
      !metadata ||
      metadata.disabled ||
      !metadata.labels.some((label) => /^(next|continue|submit|tiếp tục|gửi)$/i.test(label))
    ) {
      continue;
    }
    const box = await candidate.boundingBox().catch(() => null);
    const distance = inputBox && box
      ? Math.abs(box.y - (inputBox.y + inputBox.height)) + Math.abs(box.x - inputBox.x)
      : index;
    if (!best || distance < best.distance) {
      best = { locator: candidate, distance };
    }
  }

  if (best) {
    await best.locator.click({ timeout: 10_000 });
    return true;
  }

  await input.press("Enter", { timeout: 5_000 }).catch(() => undefined);
  return true;
}
