#!/usr/bin/env npx tsx
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { redactOfficialUrl } from "../src/appointment-free-smoke";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";
import {
  reachUSVisaSchedulingRegistrationForm,
  US_VISA_SCHEDULING_SELECTORS,
} from "../src/us-appointment/usvisascheduling-portal";

interface CaptchaEvents {
  started: boolean;
  finished: boolean;
}

function artifactPath(name: string): string {
  const directory = path.resolve("artifacts/us-appointment-registration-recon");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `${name}-${Date.now()}.png`);
}

async function maskedScreenshot(page: Page, name: string): Promise<string> {
  const output = artifactPath(name);
  await page.screenshot({
    path: output,
    fullPage: true,
    mask: [page.locator("input, textarea")],
    timeout: 30_000,
  });
  return output;
}

async function waitForOfficialAuth(page: Page, timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [url, title, body] = await Promise.all([
      Promise.resolve(page.url()),
      page.title().catch(() => ""),
      page.locator("body").innerText({ timeout: 3_000 }).catch(() => ""),
    ]);
    if (/b2clogin|authorize|signin/i.test(url) && /user details|sign in|sign up/i.test(`${title} ${body}`)) {
      return true;
    }
    await page.waitForTimeout(1_000);
  }
  return false;
}

async function openOfficialAuth(page: Page, baseUrl: string): Promise<number> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (await waitForOfficialAuth(page)) return attempt;
    if (attempt < 2) await page.waitForTimeout(4_000);
  }
  throw new Error("USVisaScheduling official authentication page was not reached after one same-session retry.");
}

async function collectEmptyRegistrationStructure(page: Page): Promise<Array<Record<string, string | null>>> {
  return page.locator("input, select, button").evaluateAll((elements) => elements.slice(0, 100).map((element) => {
    const input = element as HTMLInputElement;
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      name: input.name || null,
      type: input.type || null,
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || null,
    };
  }).filter((item) => item.id || item.name || item.text));
}

async function main(): Promise<void> {
  if (!process.env.BROWSERBASE_API_KEY?.trim()) throw new Error("BROWSERBASE_API_KEY is required");
  process.env.BROWSERBASE_MAX_CONCURRENCY = "1";
  process.env.US_APPOINTMENT_BROWSERBASE_ENABLED = "true";
  process.env.US_APPOINTMENT_BROWSERBASE_PROXIES = "true";
  process.env.US_APPOINTMENT_BROWSERBASE_VERIFIED = "false";
  process.env.US_APPOINTMENT_BROWSERBASE_REGION ||= "us-east-1";
  process.env.US_APPOINTMENT_BROWSERBASE_COUNTRY ||= "US";

  const session = await connectBrowserbaseCloudBrowser({ prefix: "US_APPOINTMENT" });
  const captcha: CaptchaEvents = { started: false, finished: false };
  const evidence: string[] = [];
  session.page.on("console", (message) => {
    if (message.text() === "browserbase-solving-started") captcha.started = true;
    if (message.text() === "browserbase-solving-finished") captcha.finished = true;
  });
  try {
    await session.page.setViewportSize({ width: 1440, height: 1000 }).catch(() => undefined);
    const navigationAttempts = await openOfficialAuth(
      session.page,
      process.env.US_APPOINTMENT_BASE_URL ?? "https://www.usvisascheduling.com/",
    );
    evidence.push(await maskedScreenshot(session.page, "01-login-entry"));

    const entry = await reachUSVisaSchedulingRegistrationForm(session.page);
    const structure = entry.reached ? await collectEmptyRegistrationStructure(session.page) : [];
    evidence.push(await maskedScreenshot(session.page, "02-registration-form"));
    const hasUsername = await session.page
      .locator(US_VISA_SCHEDULING_SELECTORS.registrationUsernameInputs)
      .first().isVisible().catch(() => false);
    const hasNewPassword = await session.page
      .locator(US_VISA_SCHEDULING_SELECTORS.registrationNewPasswordInputs)
      .first().isVisible().catch(() => false);
    const hasEmail = await session.page
      .locator(US_VISA_SCHEDULING_SELECTORS.registrationEmailInputs)
      .first().isVisible().catch(() => false);

    console.log(JSON.stringify({
      status: entry.clicked && entry.reached && hasUsername && hasNewPassword && hasEmail
        ? "registration_button_clicked_and_form_reached"
        : "registration_entry_not_verified",
      provider: "browserbase-developer",
      maxConcurrency: 1,
      navigationAttempts,
      registrationButtonClicked: entry.clicked,
      registrationFormReached: entry.reached,
      finalUrl: redactOfficialUrl(session.page.url()),
      title: await session.page.title().catch(() => ""),
      browserbaseCaptcha: captcha,
      formReadiness: { hasUsername, hasNewPassword, hasEmail, controlCount: structure.length },
      controls: structure,
      evidence,
      stopPoint: "No account data was entered and no verification email or account creation was submitted.",
    }, null, 2));
  } finally {
    await session.browser.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    status: "us_appointment_registration_recon_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }));
  process.exit(1);
});
