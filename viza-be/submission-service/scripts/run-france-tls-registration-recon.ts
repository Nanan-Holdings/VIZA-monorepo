import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { redactOfficialUrl } from "../src/appointment-free-smoke";
import {
  classifyFranceTlsBrowserState,
  createFranceTlsBrowserSession,
  readFranceTlsBrowserState,
  waitForFranceTlsCloudflareClearance,
} from "../src/france-tls/browser-api";
import { resolveFranceTlsCenter } from "../src/france-tls/center-registry";

interface CaptchaEvents {
  startedCount: number;
  finishedCount: number;
  snapshot(): { startedCount: number; finishedCount: number };
  waitAfter(snapshot: { startedCount: number; finishedCount: number }): Promise<void>;
}

function readArg(name: string): string | null {
  const marker = `--${name}=`;
  return process.argv.find((value) => value.startsWith(marker))?.slice(marker.length) ?? null;
}

function artifactPath(name: string): string {
  const directory = path.resolve("artifacts/france-tls-registration-recon");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `${name}-${Date.now()}.png`);
}

function observeBrowserbaseCaptcha(page: Page): CaptchaEvents {
  let startedCount = 0;
  let finishedCount = 0;
  page.on("console", (message) => {
    if (message.text() === "browserbase-solving-started") startedCount += 1;
    if (message.text() === "browserbase-solving-finished") {
      finishedCount += 1;
    }
  });
  return {
    get startedCount() { return startedCount; },
    get finishedCount() { return finishedCount; },
    snapshot() { return { startedCount, finishedCount }; },
    async waitAfter(snapshot) {
      const detectionDeadline = Date.now() + 5_000;
      while (Date.now() < detectionDeadline && startedCount <= snapshot.startedCount) {
        await page.waitForTimeout(250);
      }
      const finishDeadline = Date.now() + 35_000;
      while (Date.now() < finishDeadline && finishedCount < startedCount) {
        await page.waitForTimeout(500);
      }
    },
  };
}

async function settleOfficialPage(
  page: Page,
  captcha: CaptchaEvents,
  snapshot: { startedCount: number; finishedCount: number },
): Promise<void> {
  await captcha.waitAfter(snapshot);
  await waitForFranceTlsCloudflareClearance(page, {
    timeoutMs: 90_000,
    solveProviderCaptcha: true,
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
}

async function clickFirstVisible(candidates: Locator[]): Promise<boolean> {
  for (const candidate of candidates) {
    const locator = candidate.first();
    if (await locator.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await locator.scrollIntoViewIfNeeded().catch(() => undefined);
      const clicked = await locator.click({ timeout: 10_000 }).then(() => true).catch(() => false);
      if (clicked) return true;
      const domClicked = await locator.evaluate((element) => {
        (element as HTMLElement).click();
        return true;
      }).catch(() => false);
      if (domClicked) return true;
    }
  }
  return false;
}

async function dismissCookies(page: Page): Promise<void> {
  await clickFirstVisible([
    page.getByRole("button", { name: /reject all/i }),
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /close this dialog/i }),
  ]).catch(() => false);
}

async function collectEmptyFormStructure(page: Page) {
  return page.locator("input, select, textarea, button, a").evaluateAll((elements) =>
    elements.slice(0, 120).map((element) => {
      const html = element as HTMLInputElement;
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
      return {
        tag: element.tagName.toLowerCase(),
        type: html.type || null,
        name: html.name || null,
        id: html.id || null,
        autocomplete: html.autocomplete || null,
        text: text || null,
      };
    }).filter((item) => item.name || item.id || item.text),
  ).catch(() => []);
}

async function hasOfficialGenericError(page: Page): Promise<boolean> {
  const state = classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
  return state.checkpoint === "site_policy_review" && /generic center error/i.test(state.message);
}

async function refreshOfficialGenericError(input: {
  page: Page;
  captcha: CaptchaEvents;
  maxRetries: number;
  evidence: string[];
}): Promise<{ attempts: number; recovered: boolean }> {
  if (!await hasOfficialGenericError(input.page)) return { attempts: 0, recovered: true };
  for (let attempt = 1; attempt <= input.maxRetries; attempt += 1) {
    await input.page.waitForTimeout(attempt * 4_000);
    const beforeReload = input.captcha.snapshot();
    await input.page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await settleOfficialPage(input.page, input.captcha, beforeReload);
    const screenshot = artifactPath(`02-center-refresh-${attempt}`);
    await input.page.screenshot({ path: screenshot, fullPage: true, timeout: 30_000 });
    input.evidence.push(screenshot);
    if (!await hasOfficialGenericError(input.page)) {
      return { attempts: attempt, recovered: true };
    }
  }
  return { attempts: input.maxRetries, recovered: false };
}

async function enterChinaCenterThroughUi(
  page: Page,
  captcha: CaptchaEvents,
  centerPath: string,
): Promise<string[]> {
  const steps: string[] = [];
  await clickFirstVisible([
    page.getByRole("button", { name: /book an appointment/i }),
    page.getByRole("link", { name: /book an appointment/i }),
  ]).then((clicked) => { if (clicked) steps.push("book_appointment_clicked"); });

  const nativeCountrySelect = page.locator("select#select-country, select[name='select-country']").first();
  const hasNativeCountrySelect = await nativeCountrySelect.isVisible({ timeout: 3_000 }).catch(() => false);
  const residenceOpened = hasNativeCountrySelect || await clickFirstVisible([
    page.getByRole("combobox"),
    page.getByText(/^choose from$/i),
    page.locator("[role='combobox'], [class*='select' i]").filter({ hasText: /choose from/i }),
  ]);
  if (!residenceOpened) return steps;
  steps.push("residence_selector_opened");

  const chinaSelected = hasNativeCountrySelect
    ? await nativeCountrySelect.selectOption({ label: "China" }).then((values) => values.length > 0).catch(() => false)
    : await clickFirstVisible([
        page.getByRole("option", { name: /^china$/i }),
        page.getByText(/^china$/i),
        page.locator("li,button,div").filter({ hasText: /^china$/i }),
      ]);
  if (!chinaSelected) return steps;
  steps.push("china_selected");

  const beforeConfirm = captcha.snapshot();
  const confirmed = await clickFirstVisible([
    page.locator("#btn-confirm-country"),
    page.getByRole("link", { name: /^confirm$/i }),
    page.getByRole("button", { name: /^confirm$/i }),
    page.locator("button").filter({ hasText: /^confirm$/i }),
  ]);
  if (!confirmed) return steps;
  steps.push("residence_confirmed");
  const modalConfirmed = await clickFirstVisible([
    page.locator("#btn-yes"),
    page.getByRole("button", { name: /^yes$/i }),
  ]);
  if (modalConfirmed) steps.push("residence_modal_confirmed");
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await settleOfficialPage(page, captcha, beforeConfirm);

  const centerLink = page.locator(`a[href*="${centerPath}"]`).first();
  if (!await centerLink.isVisible({ timeout: 10_000 }).catch(() => false)) return steps;
  const beforeCenter = captcha.snapshot();
  await centerLink.click({ timeout: 15_000 });
  steps.push("center_clicked");
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await settleOfficialPage(page, captcha, beforeCenter);
  return steps;
}

async function main(): Promise<void> {
  const center = resolveFranceTlsCenter(readArg("center") ?? "shanghai");
  if (!center) throw new Error("Unsupported TLScontact China center.");
  const requestedRefreshRetries = Number.parseInt(readArg("refresh-retries") ?? "2", 10);
  const refreshRetries = Number.isFinite(requestedRefreshRetries)
    ? Math.min(2, Math.max(0, requestedRefreshRetries))
    : 2;

  const session = await createFranceTlsBrowserSession();
  const captcha = observeBrowserbaseCaptcha(session.page);
  const evidence: string[] = [];
  try {
    const beforeLanding = captcha.snapshot();
    await session.page.goto("https://visas-fr.tlscontact.com/en-us", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await settleOfficialPage(session.page, captcha, beforeLanding);
    await dismissCookies(session.page);
    const landing = artifactPath("01-landing");
    await session.page.screenshot({ path: landing, fullPage: true, timeout: 30_000 });
    evidence.push(landing);

    const centerPath = new URL(center.bookingUrl).pathname;
    const navigationSteps = await enterChinaCenterThroughUi(
      session.page,
      captcha,
      centerPath,
    );
    await dismissCookies(session.page);
    const centerPage = artifactPath("02-center");
    await session.page.screenshot({ path: centerPage, fullPage: true, timeout: 30_000 });
    evidence.push(centerPage);

    const refresh = await refreshOfficialGenericError({
      page: session.page,
      captcha,
      maxRetries: refreshRetries,
      evidence,
    });
    const portalErrorRemaining = await hasOfficialGenericError(session.page);

    let registrationNavigationSnapshot = captcha.snapshot();
    let registrationClicked = !portalErrorRemaining && await clickFirstVisible([
      session.page.getByRole("link", { name: /register|create account|new user/i }),
      session.page.getByRole("button", { name: /register|create account|new user/i }),
      session.page.locator("a,button").filter({ hasText: /register|create account|new user/i }),
    ]);

    if (!portalErrorRemaining && !registrationClicked) {
      const beforeLogin = captcha.snapshot();
      const loginClicked = await clickFirstVisible([
        session.page.getByRole("link", { name: /log in|sign in/i }),
        session.page.getByRole("button", { name: /log in|sign in/i }),
        session.page.locator("a,button").filter({ hasText: /log in|sign in/i }),
      ]);
      if (loginClicked) {
        await session.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
        await settleOfficialPage(session.page, captcha, beforeLogin);
        registrationNavigationSnapshot = captcha.snapshot();
        registrationClicked = await clickFirstVisible([
          session.page.getByRole("link", { name: /register|create account|new user/i }),
          session.page.getByRole("button", { name: /register|create account|new user/i }),
          session.page.locator("a,button").filter({ hasText: /register|create account|new user/i }),
        ]);
      }
    }

    if (registrationClicked) {
      await session.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await settleOfficialPage(session.page, captcha, registrationNavigationSnapshot);
    }

    const finalState = await readFranceTlsBrowserState(session.page);
    const controls = await collectEmptyFormStructure(session.page);
    const finalScreenshot = artifactPath("03-registration-entry");
    await session.page.screenshot({ path: finalScreenshot, fullPage: true, timeout: 30_000 });
    evidence.push(finalScreenshot);
    const hasEmail = controls.some((control) => control.type === "email" || /email|username/i.test(`${control.name} ${control.id}`));
    const hasPassword = controls.some((control) => control.type === "password");

    console.log(JSON.stringify({
      status: portalErrorRemaining
        ? "official_portal_error"
        : registrationClicked && hasEmail
          ? "registration_form_reached"
          : "registration_entry_not_verified",
      provider: session.provider,
      source: session.source,
      center: { code: center.code, city: center.cityEn },
      finalUrl: redactOfficialUrl(finalState.url),
      title: finalState.title,
      browserbaseCaptcha: {
        startedCount: captcha.startedCount,
        finishedCount: captcha.finishedCount,
      },
      navigationSteps,
      refresh,
      portalErrorRemaining,
      registrationClicked,
      formReadiness: { hasEmail, hasPassword, controlCount: controls.length },
      controls,
      evidence,
      stopPoint: "No account data was entered and no registration, email verification, slot selection, payment, or booking was submitted.",
    }, null, 2));
  } finally {
    await session.browser.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    status: "france_tls_registration_recon_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }));
  process.exit(1);
});
