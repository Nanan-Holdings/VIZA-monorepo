import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { BrowserContext, Page } from "@playwright/test";
import { twClickButtonOrLink, type TwFieldVerificationEntry } from "./fillers";
import { TW_URLS, startTwSession, type TwSession } from "./session";
import { acceptTermsModal } from "./terms-modal";
import { dismissTwPhotoSpecModalIfPresent } from "./photo-spec-modal";
import { fillTwDeliveryLocationTabStrict } from "./delivery-location";
import { TwUnexpectedPageError } from "./errors";

const TW_ALLOWED_HOST = "coa.immigration.gov.tw";
const TW_ALLOWED_PATHS = new Set([
  "/coa-frontend/overseas-foreign-china",
  "/coa-frontend/overseas-foreign-china/apply",
  "/coa-frontend/overseas-foreign-china/apply/verify",
]);

export interface TwSmokePageGuard {
  assertStable(phase: string): Promise<void>;
  dispose(): void;
}

export interface TwControlledFirstStepSmokeOptions {
  answers: Record<string, string>;
  headless?: boolean;
  runId?: string;
  navigationTimeoutMs?: number;
  waitForHuman?: (reason: string, page: Page) => Promise<void>;
  waitForInspection?: (result: TwControlledFirstStepSmokeResult, page: Page) => Promise<void>;
  sessionFactory?: typeof startTwSession;
}

export interface TwControlledFirstStepSmokeResult {
  status: "stopped_at_second_step";
  url: string;
  fieldAudit: TwFieldVerificationEntry[];
}

export function isTwControlledSmokeAllowedUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.hostname === TW_ALLOWED_HOST && TW_ALLOWED_PATHS.has(url.pathname);
}

export async function assertTwControlledSmokeUrl(page: Page, phase: string): Promise<void> {
  const url = page.url();
  if (!isTwControlledSmokeAllowedUrl(url)) {
    throw new TwUnexpectedPageError(`Taiwan controlled smoke left the allowed official URL set during ${phase}`, {
      url,
      details: { phase },
    });
  }
}

export function installTwSmokePageGuard(context: BrowserContext, page: Page): TwSmokePageGuard {
  let popupUrl: string | null = null;
  const onPage = (newPage: Page) => {
    if (newPage !== page) {
      popupUrl = newPage.url();
      void newPage.close().catch(() => undefined);
    }
  };
  context.on("page", onPage);

  return {
    async assertStable(phase: string) {
      if (popupUrl) {
        throw new TwUnexpectedPageError(`Taiwan controlled smoke opened an unexpected popup/tab during ${phase}`, {
          url: page.url(),
          details: { phase, popupUrl },
        });
      }
      const pages = context.pages().filter((candidate) => !candidate.isClosed());
      if (pages.length !== 1 || pages[0] !== page) {
        throw new TwUnexpectedPageError(`Taiwan controlled smoke lost its single-page invariant during ${phase}`, {
          url: page.url(),
          details: { phase, pageCount: pages.length },
        });
      }
      await assertTwControlledSmokeUrl(page, phase);
    },
    dispose() {
      context.off("page", onPage);
    },
  };
}

async function defaultWaitForHuman(reason: string, page: Page): Promise<void> {
  const rl = readline.createInterface({ input, output });
  try {
    console.log(`Taiwan controlled smoke paused: ${reason}`);
    console.log("Please complete the required official-site step in the dedicated Playwright window, then press Enter here.");
    console.log(`Current URL: ${page.url()}`);
    await rl.question("");
  } finally {
    rl.close();
  }
}

export async function waitForTwControlledSmokeInspection(
  result: TwControlledFirstStepSmokeResult,
  page: Page,
): Promise<void> {
  const rl = readline.createInterface({ input, output });
  try {
    console.log("Taiwan controlled smoke stopped at the second step; waiting for user inspection.");
    console.log(
      JSON.stringify(
        {
          status: result.status,
          url: result.url,
          filledFields: result.fieldAudit.map((entry) => entry.fieldName),
        },
        null,
        2,
      ),
    );
    console.log("The dedicated Playwright window will stay open. Reply that it can be closed, then press Enter here.");
    console.log(`Current URL: ${page.url()}`);
    await rl.question("");
  } finally {
    rl.close();
  }
}

async function hasVisibleEnabledMatch(locator: ReturnType<Page["locator"]>): Promise<boolean> {
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const candidate = locator.nth(i);
    if ((await candidate.isVisible().catch(() => false)) && (await candidate.isEnabled().catch(() => false))) {
      return true;
    }
  }
  return false;
}

async function hasVisibleEnabledLoginOrOtpInput(page: Page): Promise<boolean> {
  const candidates = page.locator('input:not([type="hidden"])');
  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const input = candidates.nth(i);
    if (!(await input.isVisible().catch(() => false)) || !(await input.isEnabled().catch(() => false))) continue;
    const signature = await input
      .evaluate((el) => {
        const inputEl = el as HTMLInputElement;
        return [
          inputEl.type,
          inputEl.name,
          inputEl.id,
          inputEl.placeholder,
          inputEl.getAttribute("aria-label") ?? "",
          inputEl.closest("label")?.textContent ?? "",
        ].join(" ");
      })
      .catch(() => "");
    if (/password|otp|登入|登录|密碼|密码|驗證碼|验证码/i.test(signature)) return true;
  }
  return false;
}

async function hasVisibleBlockingVerificationModal(page: Page): Promise<boolean> {
  const modals = page.locator('[role="dialog"], .modal-dialog, .modal-content, .modal');
  const count = await modals.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const modal = modals.nth(i);
    if (!(await modal.isVisible().catch(() => false))) continue;
    const text = await modal.innerText({ timeout: 1_000 }).catch(() => "");
    if (/OTP|登入|登录|密碼|密码|驗證碼|验证码/i.test(text)) return true;
  }
  return false;
}

export async function isTwOfficialLoginOrOtpBoundaryForSmoke(page: Page): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(page.url());
  } catch {
    return true;
  }

  if (url.pathname === "/coa-frontend/overseas-foreign-china/apply/verify") return true;
  if (url.pathname !== "/coa-frontend/overseas-foreign-china/apply") {
    return hasVisibleEnabledMatch(page.locator('input[type="password"]'));
  }

  const visibleLoginOrOtpInputs = page.locator(
    [
      'input[type="password"]',
      'input:not([type="hidden"])[name*="otp" i]',
      'input:not([type="hidden"])[name*="login" i]',
      'input:not([type="hidden"])[name*="password" i]',
      'input:not([type="hidden"])[placeholder*="OTP" i]',
      'input:not([type="hidden"])[placeholder*="驗證碼" i]',
      'input:not([type="hidden"])[placeholder*="验证码" i]',
      'input:not([type="hidden"])[placeholder*="登入" i]',
      'input:not([type="hidden"])[placeholder*="登录" i]',
      'input:not([type="hidden"])[placeholder*="密碼" i]',
      'input:not([type="hidden"])[placeholder*="密码" i]',
    ].join(","),
  );
  if (await hasVisibleEnabledMatch(visibleLoginOrOtpInputs)) return true;
  if (await hasVisibleEnabledLoginOrOtpInput(page)) return true;
  if (await hasVisibleBlockingVerificationModal(page)) return true;

  return false;
}

export async function completeTwControlledSmokeFirstStep(
  page: Page,
  answers: Record<string, string>,
): Promise<TwFieldVerificationEntry[]> {
  const fieldAudit: TwFieldVerificationEntry[] = [];
  await acceptTermsModal(page);
  await dismissTwPhotoSpecModalIfPresent(page);
  await fillTwDeliveryLocationTabStrict(page, answers, fieldAudit);
  return fieldAudit;
}

async function clickEntryIfNeeded(page: Page): Promise<void> {
  if (new URL(page.url()).pathname === "/coa-frontend/overseas-foreign-china/apply") return;
  const clicked = (await twClickButtonOrLink(page, "我要申請")) || (await twClickButtonOrLink(page, "I want to apply"));
  if (!clicked) {
    throw new TwUnexpectedPageError('Taiwan controlled smoke could not find the "我要申請"/"I want to apply" entry control', {
      url: page.url(),
    });
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
}

export async function runTwControlledFirstStepSmoke(
  options: TwControlledFirstStepSmokeOptions,
): Promise<TwControlledFirstStepSmokeResult> {
  let session: TwSession | null = null;
  let guard: TwSmokePageGuard | null = null;
  try {
    const startSession = options.sessionFactory ?? startTwSession;
    session = await startSession({
      headless: options.headless ?? false,
      runId: options.runId ?? "tw-controlled-first-step-smoke",
      navigationTimeoutMs: options.navigationTimeoutMs,
    });
    const { context, page } = session;
    guard = installTwSmokePageGuard(context, page);

    await guard.assertStable("start");
    await clickEntryIfNeeded(page);
    await guard.assertStable("entry");

    if (await isTwOfficialLoginOrOtpBoundaryForSmoke(page)) {
      await (options.waitForHuman ?? defaultWaitForHuman)("login/OTP/CAPTCHA boundary", page);
      await guard.assertStable("after-human-checkpoint");
      if (await isTwOfficialLoginOrOtpBoundaryForSmoke(page)) {
        throw new TwUnexpectedPageError("Taiwan controlled smoke is still at a manual login/OTP/CAPTCHA boundary", {
          url: page.url(),
        });
      }
    }

    const fieldAudit = await completeTwControlledSmokeFirstStep(page, options.answers);
    await guard.assertStable("after-delivery-location");

    const onApplicationStep =
      (await page.getByRole("tab", { name: "申請表" }).count().catch(() => 0)) > 0 ||
      (await page.locator('[name="traveller.email"]').count().catch(() => 0)) > 0 ||
      /申請表/.test(await page.locator("body").innerText({ timeout: 3_000 }).catch(() => ""));
    if (!onApplicationStep) {
      throw new TwUnexpectedPageError("Taiwan controlled smoke did not reach the second step after delivery location", {
        url: page.url(),
      });
    }

    const result: TwControlledFirstStepSmokeResult = {
      status: "stopped_at_second_step",
      url: page.url(),
      fieldAudit,
    };
    if (options.waitForInspection) {
      await options.waitForInspection(result, page);
    }
    return result;
  } finally {
    guard?.dispose();
    await session?.close().catch(() => undefined);
  }
}

export const TW_CONTROLLED_SMOKE_DEFAULT_ANSWERS = {
  continent: "A",
  embassy_office: "53",
} as const;
