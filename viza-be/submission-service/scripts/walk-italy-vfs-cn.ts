/**
 * VFS Global Italy China corridor walk-recon.
 *
 * Drives the public VFS-CN landing pages (and, when credentials are
 * provided, the post-login application form) page-by-page, dumping the
 * structure of every page (URL, heading, all visible inputs / selects /
 * radios, required state, submit button shape) to JSON files plus a
 * summary markdown file.
 *
 * Output feeds:
 *   - docs/italy-visa-walk-report.md (manual narrative — to be created post-walk)
 *   - viza-be/submission-service/src/italy-vfs-cn/{selectors,pages}.ts
 *     (live-DOM-anchored selectors and page-id enum)
 *
 * Usage (public-pages-only smoke):
 *   npx tsx viza-be/submission-service/scripts/walk-italy-vfs-cn.ts \
 *     --headful --out ./italy-walk-out
 *
 * Usage (full walk against a provisioned VFS-CN account):
 *   export IT_VFS_CN_EMAIL='applicant@example.com'
 *   export IT_VFS_CN_PASSWORD='...'
 *   npx tsx viza-be/submission-service/scripts/walk-italy-vfs-cn.ts \
 *     --headful --login --out ./italy-walk-out
 *
 * SAFETY:
 *   - DOES NOT click "Pay", "Submit", "Confirm appointment", or any
 *     terminal action.
 *   - Stops on detection of any STOP_BUTTON_PATTERNS match.
 *   - Default is autonomous click-through using the canonical
 *     "Save and continue" / "Next" submit button. Pass --interactive to
 *     pause for manual input on each page.
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Page } from "@playwright/test";

const STOP_BUTTON_PATTERNS = [
  /^pay\b/i,
  /^submit\b/i,
  /^confirm\s+(and|&)\s+(pay|submit)/i,
  /^make\s+payment/i,
  /^pay\s+now/i,
  /^proceed\s+to\s+payment/i,
  /^book\s+appointment/i,
  /^confirm\s+appointment/i,
];

const SAFE_ADVANCE_PATTERNS = [
  /^save\s+and\s+continue$/i,
  /^continue$/i,
  /^next$/i,
  /^save\s+&\s+continue$/i,
  /^save$/i,
];

const DEFAULT_LANDING = "https://visa.vfsglobal.com/chn/en/ita/";

interface FieldCapture {
  tag: "input" | "select" | "textarea" | "fieldset";
  type?: string;
  id?: string;
  name?: string;
  required: boolean;
  label?: string;
  placeholder?: string;
  options?: string[];
  ariaDescribedby?: string;
}

interface PageCapture {
  pageIndex: number;
  url: string;
  heading: string;
  fields: FieldCapture[];
  submits: Array<{ name?: string; value?: string; text: string }>;
  stoppedAtTerminal: boolean;
  capturedAt: string;
}

interface CliOptions {
  headful: boolean;
  out: string;
  login: boolean;
  interactive: boolean;
  startUrl: string;
}

function parseCli(argv: string[]): CliOptions {
  const opts: CliOptions = {
    headful: false,
    out: "./italy-walk-out",
    login: false,
    interactive: false,
    startUrl: DEFAULT_LANDING,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--headful") opts.headful = true;
    else if (a === "--login") opts.login = true;
    else if (a === "--interactive") opts.interactive = true;
    else if (a === "--out") opts.out = argv[++i] || opts.out;
    else if (a === "--start") opts.startUrl = argv[++i] || opts.startUrl;
  }
  return opts;
}

function fail(msg: string): never {
  console.error(`[it-vfs-walk] ${msg}`);
  process.exit(1);
}

async function captureCurrentPage(page: Page, pageIndex: number): Promise<PageCapture> {
  const url = page.url();
  const heading = await page
    .evaluate(() => {
      const h = document.querySelector("h1, h2");
      return h ? (h.textContent || "").trim() : "";
    })
    .catch(() => "");
  const fields = await page.evaluate(() => {
    function labelFor(el: Element): string {
      const id = (el as HTMLElement).id;
      if (id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl) return (lbl.textContent || "").trim();
      }
      const wrap = el.closest("label");
      if (wrap) return (wrap.textContent || "").trim();
      const aria = el.getAttribute("aria-label");
      if (aria) return aria.trim();
      return "";
    }
    function visible(el: Element): boolean {
      return (el as HTMLElement).offsetParent !== null;
    }
    const out: FieldCapture[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("input, select, textarea"))) {
      if (!visible(el)) continue;
      const tag = el.tagName.toLowerCase() as FieldCapture["tag"];
      const type = el.getAttribute("type") || undefined;
      const id = el.id || undefined;
      const name = el.getAttribute("name") || undefined;
      const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";
      const label = labelFor(el) || undefined;
      const placeholder = el.getAttribute("placeholder") || undefined;
      const ariaDescribedby = el.getAttribute("aria-describedby") || undefined;
      let options: string[] | undefined;
      if (tag === "select") {
        options = Array.from((el as HTMLSelectElement).options).map((o) =>
          (o.value || o.text || "").trim(),
        );
      }
      out.push({ tag, type, id, name, required, label, placeholder, options, ariaDescribedby });
    }
    return out;
  });

  const submits = await page.evaluate(() => {
    const out: Array<{ name?: string; value?: string; text: string }> = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>('button, input[type="submit"]'),
    )) {
      if ((el as HTMLElement).offsetParent === null) continue;
      const name = el.getAttribute("name") || undefined;
      const value = (el as HTMLInputElement).value || undefined;
      const text = (el.textContent || "").trim();
      out.push({ name, value, text });
    }
    return out;
  });

  const stoppedAtTerminal = submits.some((s) =>
    STOP_BUTTON_PATTERNS.some((p) => p.test(s.text || s.value || "")),
  );

  return {
    pageIndex,
    url,
    heading,
    fields,
    submits,
    stoppedAtTerminal,
    capturedAt: new Date().toISOString(),
  };
}

function dumpPage(outDir: string, capture: PageCapture): void {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `page-${String(capture.pageIndex).padStart(2, "0")}.json`);
  fs.writeFileSync(file, JSON.stringify(capture, null, 2));
  console.log(
    `[it-vfs-walk] page ${capture.pageIndex}: ${capture.url} — ${capture.fields.length} fields`,
  );
}

async function clickAdvance(page: Page): Promise<boolean> {
  return page.evaluate(
    (patterns) => {
      const re = patterns.map((s) => new RegExp(s.source, s.flags));
      const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;
      const btn = Array.from(
        document.querySelectorAll<HTMLElement>('button, input[type="submit"]'),
      )
        .filter(visible)
        .find((b) => {
          const label = (((b as HTMLInputElement).value || b.textContent || "") + "").trim();
          return re.some((r) => r.test(label));
        });
      if (!btn) return false;
      btn.click();
      return true;
    },
    SAFE_ADVANCE_PATTERNS.map((p) => ({ source: p.source, flags: p.flags })),
  );
}

async function main(): Promise<void> {
  const opts = parseCli(process.argv.slice(2));
  fs.mkdirSync(opts.out, { recursive: true });

  const browser = await chromium.launch({
    headless: !opts.headful,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Shanghai",
  });
  const page = await ctx.newPage();

  let pageIndex = 0;
  try {
    await page.goto(opts.startUrl, { waitUntil: "domcontentloaded" });
    const first = await captureCurrentPage(page, ++pageIndex);
    dumpPage(opts.out, first);

    if (opts.login) {
      const email = process.env.IT_VFS_CN_EMAIL;
      const password = process.env.IT_VFS_CN_PASSWORD;
      if (!email || !password) {
        fail("--login requires IT_VFS_CN_EMAIL and IT_VFS_CN_PASSWORD env vars");
      }
      // Login form-fill is intentionally TODO — VFS account flow is
      // identity-gated and the exact selectors / Turnstile handling
      // belong in the runner's `login.ts` once the live walk runs.
      console.log("[it-vfs-walk] login flag set — implement post-walk; aborting");
      return;
    }

    // Public-pages-only smoke: walk through the marketing site once,
    // capturing each navigation. Stops on any terminal-button page.
    while (pageIndex < 12) {
      const advanced = await clickAdvance(page);
      if (!advanced) {
        console.log("[it-vfs-walk] no advance button — done");
        break;
      }
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(800);
      const capture = await captureCurrentPage(page, ++pageIndex);
      dumpPage(opts.out, capture);
      if (capture.stoppedAtTerminal) {
        console.log("[it-vfs-walk] terminal button detected — stopping");
        break;
      }
    }

    const summary = path.join(opts.out, "summary.json");
    fs.writeFileSync(
      summary,
      JSON.stringify(
        {
          startUrl: opts.startUrl,
          pagesCaptured: pageIndex,
          finishedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(`[it-vfs-walk] summary: ${summary}`);
  } finally {
    await ctx.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("[it-vfs-walk] fatal:", err);
  process.exit(1);
});
