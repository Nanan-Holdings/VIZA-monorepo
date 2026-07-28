import "dotenv/config";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "../src/secret-cipher";
import {
  classifyFranceTlsBrowserState,
  readFranceTlsBrowserState,
} from "../src/france-tls/browser-api";
import { solveVisibleRecaptchaGridChallenge } from "../src/france-tls/recaptcha-grid";

function readApplicationId(): string {
  const marker = "--application-id=";
  const value = process.argv.find((item) => item.startsWith(marker))?.slice(marker.length).trim();
  if (!value) throw new Error("--application-id is required");
  return value;
}

function artifactPath(name: string): string {
  const dir = path.join(os.tmpdir(), "viza-submission-artifacts", "france-tls-local-login");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}-${Date.now()}.png`);
}

async function maskedScreenshot(page: import("playwright").Page, name: string): Promise<string> {
  const output = artifactPath(name);
  await page.screenshot({
    path: output,
    fullPage: false,
    mask: [page.locator("input, textarea, [contenteditable='true']")],
  });
  return output;
}

async function maybeSolveGrid(page: import("playwright").Page): Promise<{ status: string; reason?: string | null; solveCount: number } | null> {
  if (!page.frames().some((frame) => /recaptcha\/api2\/bframe/i.test(frame.url()))) return null;
  const result = await solveVisibleRecaptchaGridChallenge(page, { maxRounds: 3, timeoutMs: 180_000 }).catch((error: unknown) => ({
    status: "failed" as const,
    reason: error instanceof Error ? error.message : String(error),
    solves: [],
  }));
  return {
    status: result.status,
    reason: "reason" in result ? result.reason : null,
    solveCount: "solves" in result ? result.solves.length : 0,
  };
}

async function loadAccount(applicationId: string): Promise<{ email: string; password: string }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase service env is missing");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("appointment_accounts")
    .select("account_email,encrypted_account_password,email_verified")
    .eq("application_id", applicationId)
    .eq("portal", "tlscontact_cn_fr")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  if (!data) throw new Error("No France/TLS account candidate found");
  if (!data.email_verified) throw new Error("The France/TLS account email is not verified");
  if (!data.encrypted_account_password) throw new Error("The France/TLS account password is missing");

  return {
    email: data.account_email,
    password: decryptSecret(data.encrypted_account_password),
  };
}

async function main(): Promise<void> {
  const applicationId = readApplicationId();
  const account = await loadAccount(applicationId);
  const browser = await chromium.launch({ headless: false, channel: process.env.FRANCE_TLS_LOCAL_BROWSER_CHANNEL || "chrome" })
    .catch(() => chromium.launch({ headless: false }));
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto("https://visas-fr.tlscontact.com/en-us/country/cn/vac/cnBJS2fr", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(15_000);
    const gridAtLanding = await maybeSolveGrid(page);

    await page.getByRole("button", { name: "Close this dialog" }).click({ timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(`(() => {
      const login = Array.from(document.querySelectorAll("a"))
        .find((anchor) => (anchor.textContent || "").trim() === "LOG IN");
      if (login) login.click();
    })()`);
    await page.waitForTimeout(12_000);
    const gridAtLogin = await maybeSolveGrid(page);

    const setResult = await page.evaluate(`(({ email, password }) => {
      const setValue = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        el.focus();
        el.value = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };
      return {
        email: setValue('input[type="email"], input[name="username"], input[name="email"]', email),
        password: setValue('input[type="password"]', password),
      };
    })`, account);

    const before = await maskedScreenshot(page, "france-tls-local-before-login");

    await page.evaluate(`(() => {
      const submit = Array.from(document.querySelectorAll("button,input"))
        .find((el) => /login|sign in/i.test(el.textContent || el.value || "") || el.type === "submit");
      if (submit) submit.click();
    })()`);
    await page.waitForTimeout(20_000);
    const gridAfterSubmit = await maybeSolveGrid(page);
    if (gridAfterSubmit) await page.waitForTimeout(10_000);

    const stateInput = await readFranceTlsBrowserState(page);
    const state = classifyFranceTlsBrowserState(stateInput);
    const hasEmailField = await page.locator('input[type="email"], input[name="username"], input[name="email"]')
      .first().isVisible().catch(() => false);
    const hasPasswordField = await page.locator('input[type="password"]')
      .first().isVisible().catch(() => false);
    const after = await maskedScreenshot(page, "france-tls-local-after-login");

    console.log(JSON.stringify({
      provider: "local-visible-chromium",
      setResult,
      before,
      after,
      grids: [gridAtLanding, gridAtLogin, gridAfterSubmit].filter(Boolean),
      final: {
        url: stateInput.url,
        title: stateInput.title,
        checkpoint: state.checkpoint,
        message: state.message,
        hasEmailField,
        hasPasswordField,
        hasCaptcha: state.hasRecaptchaGrid || state.hasRecaptchaAnchor,
      },
    }, null, 2));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message.replace(/password[^,\n]*/gi, "password <redacted>") : String(error),
  }, null, 2));
  process.exit(1);
});
