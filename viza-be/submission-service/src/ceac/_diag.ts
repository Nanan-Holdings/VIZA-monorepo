/**
 * Diagnostic probe: save the CAPTCHA PNG we send to 2captcha, the answer
 * we receive, and the URL we land on after submit — so we can inspect
 * why CEAC keeps rejecting our answers.
 *
 * Usage: npx tsx src/ceac/_diag.ts
 * Writes to ./diag-out/
 */
import { config } from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
config({ path: path.join(__dirname, "../../.env") });

import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "./stealth-browser";
import { solveImageCaptcha } from "./captcha-solver";
import { CEAC_URLS } from "./selectors";

const OUT_DIR = path.join(__dirname, "../../diag-out");

const LOCATION_SELECT_SELECTOR =
  'select[id*="ucLocation_ddlLocation"], select[name*="ucLocation$ddlLocation"]';
const CAPTCHA_IMAGE_SELECTOR = 'img[id*="Captcha"]';
const CAPTCHA_INPUT_SELECTOR =
  'input[id*="IdentifyCaptcha1_txtCodeTextBox"], input[id*="CaptchaCodeTextBox"], input[id*="captcha" i][type="text"]';
const POST_LOCATION_MODAL_CLOSE_SELECTOR =
  'a[id*="ucPostMessage"][id*="lnkClose"], a[id*="ucPost"][id*="lnkClose"]';
const SUBMIT_SELECTOR =
  'a[id*="lnkNew"], a[id*="lnkContinue"], input[id*="btnContinue"], input[type="submit"][value*="Continue"], input[type="submit"][value*="Start"]';

// tsx injects `__name` helper into transpiled closures that is NOT defined
// inside the browser context — using `Function("...")` evaluates the code
// as a plain string in the browser, bypassing the tsx transformation.
// This mirrors what production should do for evaluate callbacks too.
const RASTERIZE_JS = `
  (function() {
    var img = document.querySelector('img[id*="Captcha"]');
    if (!img) return "";
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return "";
    var canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    var ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  })()
`;

const IMG_READY_JS = `
  (function() {
    var img = document.querySelector('img[id*="Captcha"]');
    return !!(img && img.complete && img.naturalWidth > 0);
  })()
`;

async function waitImgReady(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = (await page.evaluate(IMG_READY_JS)) as boolean;
    if (ready) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function rasterize(page: Page): Promise<Buffer | null> {
  const ok = await waitImgReady(page, 10_000);
  if (!ok) return null;
  for (let i = 0; i < 3; i++) {
    const dataUrl = (await page.evaluate(RASTERIZE_JS)) as string;
    if (dataUrl && dataUrl.startsWith("data:image/png;base64,")) {
      return Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function attempt(page: Page, attemptIdx: number): Promise<{
  status: string;
  answer?: string;
  postUrl?: string;
  note?: string;
}> {
  const loc = page.locator(LOCATION_SELECT_SELECTOR).first();
  try {
    await loc.waitFor({ state: "attached", timeout: 10_000 });
  } catch {
    return { status: "no_location_selector", postUrl: page.url() };
  }

  const target = process.env.CEAC_LOCATION_CODE?.trim() || "NSS";
  let current = "";
  try { current = await loc.inputValue(); } catch { /* noop */ }
  if (current !== target) {
    await loc.selectOption(target);
    try { await page.waitForLoadState("networkidle", { timeout: 15_000 }); } catch { await page.waitForTimeout(1500); }
  }

  const close = page.locator(POST_LOCATION_MODAL_CLOSE_SELECTOR).first();
  if ((await close.count()) > 0) {
    try {
      await close.click({ force: true, timeout: 5_000 });
      try { await page.waitForLoadState("networkidle", { timeout: 10_000 }); } catch { await page.waitForTimeout(1000); }
    } catch { /* noop */ }
  }

  const buf = await rasterize(page);
  if (!buf) return { status: "rasterize_failed", postUrl: page.url() };

  const imgPath = path.join(OUT_DIR, `attempt-${attemptIdx}-captcha.png`);
  fs.writeFileSync(imgPath, buf);
  console.log(`[diag]   wrote ${imgPath} (${buf.length} bytes)`);

  const solve = await solveImageCaptcha(buf);
  const answer = solve.text;
  console.log(`[diag]   2captcha returned: "${answer}" (solveId=${solve.solveId}, ${solve.durationMs}ms)`);

  const input = page.locator(CAPTCHA_INPUT_SELECTOR).first();
  if ((await input.count()) === 0) return { status: "no_input", answer, postUrl: page.url() };
  // Submit 2captcha answer as-is (no case normalization) to test whether
  // CEAC is actually case-sensitive to the rendered case.
  const submitted = answer.trim();
  console.log(`[diag]   submitting: "${submitted}"`);
  await input.fill(submitted);

  const submit = page.locator(SUBMIT_SELECTOR).first();
  if ((await submit.count()) > 0) {
    try {
      await submit.click({ force: true });
    } catch {
      await submit.evaluate("el => el.click()");
    }
  } else {
    await input.press("Enter");
  }

  try { await page.waitForLoadState("networkidle", { timeout: 15_000 }); } catch { /* noop */ }

  const postUrl = page.url();
  const stillCaptcha = (await page.locator(CAPTCHA_IMAGE_SELECTOR).count()) > 0;

  try {
    await page.screenshot({ path: path.join(OUT_DIR, `attempt-${attemptIdx}-post-submit.png`), fullPage: true });
  } catch { /* noop */ }

  if (/SessionTimedOut/i.test(postUrl)) {
    return { status: "session_timed_out", answer, postUrl };
  }
  if (stillCaptcha) {
    let bodyText = "";
    try { bodyText = (await page.locator("body").innerText({ timeout: 2000 })).slice(0, 500); } catch { /* noop */ }
    fs.writeFileSync(path.join(OUT_DIR, `attempt-${attemptIdx}-body.txt`), bodyText);
    return { status: "wrong_answer", answer, postUrl, note: bodyText.slice(0, 200) };
  }
  return { status: "solved", answer, postUrl };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[diag] Writing to ${OUT_DIR}`);

  const { browser, page } = await launchStealthBrowser({ headless: true });
  try {
    await page.goto(CEAC_URLS.START, { waitUntil: "domcontentloaded", timeout: 60_000 });
    console.log(`[diag] Loaded start page: ${page.url()}`);

    for (let i = 1; i <= 3; i++) {
      console.log(`\n[diag] === Attempt ${i} ===`);
      const t0 = Date.now();
      const r = await attempt(page, i);
      const ms = Date.now() - t0;
      console.log(`[diag] Attempt ${i} in ${ms}ms:`, JSON.stringify(r, null, 2));

      if (r.status === "solved") {
        console.log(`[diag] SUCCESS — advanced past start page. url=${r.postUrl}`);
        break;
      }
      if (r.status === "wrong_answer") {
        try {
          await page.goto(CEAC_URLS.START, { waitUntil: "domcontentloaded", timeout: 30_000 });
        } catch { await page.waitForTimeout(1000); }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
