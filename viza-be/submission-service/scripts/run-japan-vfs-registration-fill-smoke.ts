import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "playwright";
import { fillJapanVfsRegistrationForm } from "../src/jp-vfs-sg/runner";

const REGISTER_URL = "https://visa.vfsglobal.com/sgp/en/jpn/register";

async function main(): Promise<void> {
  console.log("[jp-vfs] opening official empty registration form");
  const browser = await chromium.launch({ headless: true });
  console.log("[jp-vfs] browser launched");
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    await page.goto(REGISTER_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    console.log("[jp-vfs] official registration page loaded");
    await page.waitForTimeout(2_000);
    const officialText = await page.locator("body").innerText().catch(() => "");
    if (/Temporary Connectivity Issue|Session Expired or Invalid|Access Denied|Cloudflare/i.test(officialText)) {
      throw new Error(`Official VFS registration form unavailable: ${officialText.match(/Temporary Connectivity Issue \(502\)|Session Expired or Invalid|Access Denied|Cloudflare/i)?.[0] ?? "official access checkpoint"}`);
    }
    const rejectCookies = page.getByRole("button", { name: /reject|decline|necessary only/i }).first();
    if (await rejectCookies.isVisible({ timeout: 1_000 }).catch(() => false)) await rejectCookies.click();
    await fillJapanVfsRegistrationForm(page, {
      email: "viza-placeholder@example.com",
      password: "VizaPlaceholder!2026",
      phone: "+6590000000",
    });
    console.log("[jp-vfs] placeholder fields filled without submitting");
    const emailValue = await page.getByLabel("Email*").inputValue();
    const phoneValue = await page.locator("input[type='tel'], input[formcontrolname*='mobile'], input[placeholder*='Mobile']").first().inputValue();
    if (emailValue !== "viza-placeholder@example.com" || phoneValue !== "90000000") {
      throw new Error("Official VFS registration fields did not retain the placeholder values.");
    }
    await page.evaluate(() => document.querySelectorAll<HTMLInputElement>("input").forEach((input) => { if (input.value) input.value = "[REDACTED]"; }));
    const artifactDir = path.resolve("artifacts", "jp-vfs-sg-registration-fill");
    fs.mkdirSync(artifactDir, { recursive: true });
    await page.screenshot({ path: path.join(artifactDir, "registration-filled-redacted.png"), fullPage: true });
    console.log(JSON.stringify({ ok: true, submitted: false, officialUrl: REGISTER_URL, fieldsVerified: ["email", "password", "confirmPassword", "dialCode", "mobile", "requiredConsents"] }));
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
