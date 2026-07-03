import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "../src/secret-cipher";
import {
  classifyFranceTlsBrowserState,
  readFranceTlsBrowserState,
} from "../src/france-tls/browser-api";
import { solveVisibleRecaptchaGridChallenge } from "../src/france-tls/recaptcha-grid";

const APPLICATION_ID = "ab34b27a-8af1-43a9-9764-d99859900bb9";

function artifactPath(name: string): string {
  const dir = path.resolve("artifacts");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}-${Date.now()}.png`);
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

async function loadAccount(): Promise<{ email: string; password: string }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase service env is missing");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("fv_accounts")
    .select("*")
    .eq("application_id", APPLICATION_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  if (!data) throw new Error("No France/TLS account candidate found");

  return {
    email: data.official_account_email_encrypted ? decryptSecret(data.official_account_email_encrypted) : data.email,
    password: data.official_account_password_encrypted
      ? decryptSecret(data.official_account_password_encrypted)
      : decryptSecret(data.password_encrypted),
  };
}

async function main(): Promise<void> {
  const account = await loadAccount();
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

    const before = artifactPath("france-tls-local-before-login");
    await page.screenshot({ path: before, fullPage: false }).catch(() => undefined);

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
    const after = artifactPath("france-tls-local-after-login");
    await page.screenshot({ path: after, fullPage: false }).catch(() => undefined);

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
        bodySample: stateInput.bodyText.replace(/\s+/g, " ").slice(0, 1600),
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
