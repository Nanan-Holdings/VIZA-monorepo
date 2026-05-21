/**
 * Indonesia eVisa portal walk-recon (evisa.imigrasi.go.id).
 *
 * Drives the public eVisa pages (and, when credentials are provided, the
 * post-login C1 application form) page-by-page, dumping every page's
 * structure (URL, heading, all visible inputs / selects / radios,
 * required state, submit button shape) to JSON files plus a summary.
 *
 * Output feeds:
 *   - docs/indonesia-visa-walk-report.md (manual narrative — write
 *     post-walk)
 *   - viza-be/agent-backend/scripts/seed-id-c1-tourist-form-fields.ts
 *     (any field-label / option / required drift gets patched here)
 *
 * Usage (public-pages-only smoke):
 *   npx tsx viza-be/submission-service/scripts/walk-id-evisa.ts \
 *     --headful --out ./id-evisa-walk-out
 *
 * Usage (full walk against a provisioned WNA account):
 *   export ID_EVISA_EMAIL='applicant@example.com'
 *   export ID_EVISA_PASSWORD='...'
 *   npx tsx viza-be/submission-service/scripts/walk-id-evisa.ts \
 *     --headful --login --out ./id-evisa-walk-out
 *
 * SAFETY:
 *   - DOES NOT click "Pay", "Submit Application", "Confirm", "Pay Now",
 *     or any terminal action.
 *   - Stops on detection of any STOP_BUTTON_PATTERNS match.
 *   - Default is autonomous click-through using "Next" / "Continue" /
 *     "Save and continue". Pass --interactive to pause for manual input
 *     on each page.
 *   - Login is opt-in via --login; without it the script only walks
 *     public pages (landing, info pages, registration form preview).
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Page } from "@playwright/test";

const STOP_BUTTON_PATTERNS = [
  /^pay\b/i,
  /^submit\b/i,
  /\bsubmit\s+application\b/i,
  /^confirm\s+(and|&)\s+(pay|submit)/i,
  /^make\s+payment/i,
  /^pay\s+now/i,
  /^proceed\s+to\s+payment/i,
  /^proceed\s+to\s+pay/i,
  /^confirm\s+payment/i,
  /^bayar/i,
  /^kirim\s+aplikasi/i,
];

const SAFE_ADVANCE_PATTERNS = [
  /^save\s+and\s+continue$/i,
  /^continue$/i,
  /^next$/i,
  /^save\s+&\s+continue$/i,
  /^lanjut$/i,
  /^lanjutkan$/i,
  /^selanjutnya$/i,
];

const DEFAULT_LANDING = "https://evisa.imigrasi.go.id/";

const PUBLIC_RECON_URLS = [
  "https://evisa.imigrasi.go.id/",
  "https://evisa.imigrasi.go.id/front/info/evoa",
  "https://evisa.imigrasi.go.id/front/register/wna",
  "https://evisa.imigrasi.go.id/front/register/guarantor-register",
  "https://evisa.imigrasi.go.id/front/faq/aff9642b-0b57-443f-8de1-a51601de0ebb",
  "https://evisa.imigrasi.go.id/front/faq/dd5c2220-28a7-4024-9a10-82f30a09e0d2",
];

interface FieldCapture {
  tag: "input" | "select" | "textarea" | "fieldset";
  type?: string;
  id?: string;
  name?: string;
  required: boolean;
  label?: string;
  placeholder?: string;
  options?: Array<{ value: string; text: string }>;
  ariaDescribedby?: string;
  visible: boolean;
}

interface PageCapture {
  pageIndex: number;
  url: string;
  heading: string;
  title: string;
  fields: FieldCapture[];
  submits: Array<{ name?: string; value?: string; text: string }>;
  fieldsetLegends: string[];
  stoppedAtTerminal: boolean;
  capturedAt: string;
}

interface CliOptions {
  headful: boolean;
  out: string;
  login: boolean;
  interactive: boolean;
  startUrl: string;
  staticOnly: boolean;
}

function parseCli(argv: string[]): CliOptions {
  const opts: CliOptions = {
    headful: false,
    out: "./id-evisa-walk-out",
    login: false,
    interactive: false,
    startUrl: DEFAULT_LANDING,
    staticOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--headful") opts.headful = true;
    else if (a === "--login") opts.login = true;
    else if (a === "--interactive") opts.interactive = true;
    else if (a === "--static-only") opts.staticOnly = true;
    else if (a === "--out") opts.out = argv[++i] || opts.out;
    else if (a === "--start") opts.startUrl = argv[++i] || opts.startUrl;
  }
  return opts;
}

function fail(msg: string): never {
  console.error(`[id-evisa-walk] ${msg}`);
  process.exit(1);
}

async function captureCurrentPage(page: Page, pageIndex: number): Promise<PageCapture> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const heading = ((await page
    .evaluate(`
      (() => {
        const h = document.querySelector('h1, h2');
        return h ? (h.textContent || '').trim() : '';
      })()
    `)
    .catch(() => "")) as string) || "";

  const FIELD_SCRIPT = `
    (() => {
      const labelFor = (el) => {
        const id = el.id;
        if (id) {
          const lbl = document.querySelector('label[for="' + CSS.escape(id) + '"]');
          if (lbl) return (lbl.textContent || '').trim();
        }
        const wrap = el.closest('label');
        if (wrap) return (wrap.textContent || '').trim();
        const aria = el.getAttribute('aria-label');
        if (aria) return aria.trim();
        const ph = el.getAttribute('placeholder');
        if (ph) return '(placeholder) ' + ph;
        return '';
      };
      const visible = (el) => el.offsetParent !== null;
      const out = [];
      const els = document.querySelectorAll('input, select, textarea');
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type') || undefined;
        const id = el.id || undefined;
        const name = el.getAttribute('name') || undefined;
        const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
        const label = labelFor(el) || undefined;
        const placeholder = el.getAttribute('placeholder') || undefined;
        const ariaDescribedby = el.getAttribute('aria-describedby') || undefined;
        let options;
        if (tag === 'select') {
          options = Array.from(el.options).map((o) => ({
            value: (o.value || '').trim(),
            text: (o.text || '').trim(),
          }));
        }
        out.push({ tag, type, id, name, required, label, placeholder, options, ariaDescribedby, visible: visible(el) });
      }
      return out;
    })()
  `;
  const fields = (await page.evaluate(FIELD_SCRIPT)) as FieldCapture[];

  const SUBMIT_SCRIPT = `
    (() => {
      const out = [];
      const els = document.querySelectorAll('button, input[type="submit"], a.btn, [role="button"]');
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (el.offsetParent === null) continue;
        const name = el.getAttribute('name') || undefined;
        const value = el.value || undefined;
        const text = (el.textContent || '').trim();
        if (!text && !value && !name) continue;
        out.push({ name, value, text });
      }
      return out;
    })()
  `;
  const submits = (await page.evaluate(SUBMIT_SCRIPT)) as Array<{ name?: string; value?: string; text: string }>;

  const LEGEND_SCRIPT = `
    (() => {
      const out = [];
      const els = document.querySelectorAll('fieldset, section, .card-header, .step-title');
      for (let i = 0; i < els.length; i++) {
        const fs = els[i];
        const lg = fs.querySelector('legend, h3, h4, .title');
        const t = ((lg && lg.textContent) || (fs.firstElementChild && fs.firstElementChild.textContent) || '').trim();
        if (t && t.length < 200) out.push(t);
      }
      return out;
    })()
  `;
  const fieldsetLegends = (await page.evaluate(LEGEND_SCRIPT)) as string[];

  const stoppedAtTerminal = submits.some((s) =>
    STOP_BUTTON_PATTERNS.some((p) => p.test(s.text || s.value || "")),
  );

  return {
    pageIndex,
    url,
    title,
    heading,
    fields,
    submits,
    fieldsetLegends,
    stoppedAtTerminal,
    capturedAt: new Date().toISOString(),
  };
}

function dumpPage(outDir: string, capture: PageCapture): void {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `page-${String(capture.pageIndex).padStart(2, "0")}.json`);
  fs.writeFileSync(file, JSON.stringify(capture, null, 2));
  console.log(
    `[id-evisa-walk] page ${capture.pageIndex}: ${capture.url} — ${capture.fields.length} fields, heading="${capture.heading}"`,
  );
}

async function dumpScreenshot(page: Page, outDir: string, pageIndex: number): Promise<void> {
  const file = path.join(outDir, `page-${String(pageIndex).padStart(2, "0")}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
}

async function clickAdvance(page: Page): Promise<boolean> {
  const patterns = SAFE_ADVANCE_PATTERNS.map((p) => ({ source: p.source, flags: p.flags }));
  const script = `
    (() => {
      const patterns = ${JSON.stringify(patterns)};
      const re = patterns.map((s) => new RegExp(s.source, s.flags));
      const els = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
      const visibleEls = els.filter((el) => el.offsetParent !== null);
      const btn = visibleEls.find((b) => {
        const label = ((b.value || b.textContent || '') + '').trim();
        return re.some((r) => r.test(label));
      });
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `;
  return (await page.evaluate(script)) as boolean;
}

async function walkPublicPages(page: Page, outDir: string): Promise<number> {
  let pageIndex = 0;
  for (const url of PUBLIC_RECON_URLS) {
    pageIndex++;
    try {
      console.log(`[id-evisa-walk] visiting ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const capture = await captureCurrentPage(page, pageIndex);
      dumpPage(outDir, capture);
      await dumpScreenshot(page, outDir, pageIndex);
    } catch (err) {
      console.error(`[id-evisa-walk] failed on ${url}: ${(err as Error).message}`);
      const capture: PageCapture = {
        pageIndex,
        url,
        title: "",
        heading: "",
        fields: [],
        submits: [],
        fieldsetLegends: [],
        stoppedAtTerminal: false,
        capturedAt: new Date().toISOString(),
      };
      dumpPage(outDir, capture);
    }
  }
  return pageIndex;
}

async function loginAndWalk(
  page: Page,
  outDir: string,
  startIndex: number,
  email: string,
  password: string,
  interactive: boolean,
): Promise<number> {
  let pageIndex = startIndex;

  console.log("[id-evisa-walk] navigating to login");
  await page.goto("https://evisa.imigrasi.go.id/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

  const loginClicked = (await page.evaluate(`
    (() => {
      const els = Array.from(document.querySelectorAll('a, button, [role="link"]'));
      const visibleEls = els.filter((el) => el.offsetParent !== null);
      const btn = visibleEls.find((b) => /^(sign\\s*in|log\\s*in|masuk)/i.test((b.textContent || '').trim()));
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `)) as boolean;
  if (!loginClicked) {
    console.warn("[id-evisa-walk] could not find Login link — capturing current page only");
    pageIndex++;
    const cap = await captureCurrentPage(page, pageIndex);
    dumpPage(outDir, cap);
    await dumpScreenshot(page, outDir, pageIndex);
    return pageIndex;
  }
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(1500);

  pageIndex++;
  const loginCap = await captureCurrentPage(page, pageIndex);
  dumpPage(outDir, loginCap);
  await dumpScreenshot(page, outDir, pageIndex);

  const emailInput = await page.$('input[type="email"], input[name*="email" i], input#email');
  const pwInput = await page.$('input[type="password"], input[name*="password" i]');
  if (!emailInput || !pwInput) {
    console.warn("[id-evisa-walk] login fields not found — stopping at login page");
    return pageIndex;
  }
  await emailInput.fill(email);
  await pwInput.fill(password);

  if (interactive) {
    console.log("[id-evisa-walk] interactive: solve any CAPTCHA / 2FA in the browser, press ENTER here when on dashboard");
    await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));
  } else {
    console.log("[id-evisa-walk] non-interactive login — submitting; if portal has CAPTCHA this will stall");
    const submitted = (await page.evaluate(`
      (() => {
        const els = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button'));
        const visibleEls = els.filter((el) => el.offsetParent !== null);
        const btn = visibleEls.find((b) => /^(sign\\s*in|log\\s*in|masuk|submit)/i.test((b.textContent || b.value || '').trim()));
        if (!btn) return false;
        btn.click();
        return true;
      })()
    `)) as boolean;
    if (!submitted) {
      console.warn("[id-evisa-walk] submit button not found");
      return pageIndex;
    }
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);
  }

  await page.waitForTimeout(2500);
  pageIndex++;
  const dashCap = await captureCurrentPage(page, pageIndex);
  dumpPage(outDir, dashCap);
  await dumpScreenshot(page, outDir, pageIndex);

  while (pageIndex < startIndex + 40) {
    const advanced = await clickAdvance(page);
    if (!advanced) {
      console.log("[id-evisa-walk] no advance button — done with autonomous walk");
      break;
    }
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(1500);
    pageIndex++;
    const cap = await captureCurrentPage(page, pageIndex);
    dumpPage(outDir, cap);
    await dumpScreenshot(page, outDir, pageIndex);
    if (cap.stoppedAtTerminal) {
      console.log("[id-evisa-walk] terminal button detected — stopping");
      break;
    }
  }

  return pageIndex;
}

async function main(): Promise<void> {
  const opts = parseCli(process.argv.slice(2));
  fs.mkdirSync(opts.out, { recursive: true });

  const browser = await chromium.launch({
    headless: !opts.headful,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-default-browser-check",
      "--no-first-run",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Jakarta",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await ctx.newPage();
  let pageIndex = 0;

  try {
    pageIndex = await walkPublicPages(page, opts.out);

    if (opts.login && !opts.staticOnly) {
      const email = process.env.ID_EVISA_EMAIL;
      const password = process.env.ID_EVISA_PASSWORD;
      if (!email || !password) {
        fail("--login requires ID_EVISA_EMAIL and ID_EVISA_PASSWORD env vars");
      }
      pageIndex = await loginAndWalk(page, opts.out, pageIndex, email, password, opts.interactive);
    }

    const summary = path.join(opts.out, "summary.json");
    fs.writeFileSync(
      summary,
      JSON.stringify(
        {
          startUrl: opts.startUrl,
          publicUrls: PUBLIC_RECON_URLS,
          loginAttempted: opts.login,
          pagesCaptured: pageIndex,
          finishedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(`[id-evisa-walk] summary: ${summary}`);
  } finally {
    await ctx.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("[id-evisa-walk] fatal:", err);
  process.exit(1);
});
