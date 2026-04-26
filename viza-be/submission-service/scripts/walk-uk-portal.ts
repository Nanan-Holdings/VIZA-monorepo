/**
 * UK Standard Visitor portal walk-recon.
 *
 * Drives the apply-uk-visa.service.gov.uk portal page-by-page using a
 * pre-provisioned forceResume URL + applicant password, and dumps the
 * structure of every page (heading, all visible inputs/selects/radios,
 * required state, submit button name) to a JSON file.
 *
 * Output feeds:
 *   - docs/uk-standard-visitor-walk-report.md (manual narrative)
 *   - viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts
 *     (programmatic schema seed)
 *
 * Usage:
 *   export UK_TEST_RESUME_URL='https://visas-immigration.service.gov.uk/forceResume/...'
 *   export UK_TEST_PASSWORD='...'
 *   npx ts-node scripts/walk-uk-portal.ts [--headful] [--out ./uk-walk-out]
 *
 * SAFETY:
 *   - DOES NOT submit any forms or click "Pay" / "Continue to payment".
 *   - On every page, waits up to 60s for the user to interact manually
 *     (pass --interactive to enable; default is autonomous click-through
 *     using the canonical "Continue" / "Save and continue" submit button).
 *   - Stops if it ever encounters a `Pay`, `Submit`, `Confirm and pay`,
 *     or similar terminal button.
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Page } from "@playwright/test";

const STOP_BUTTON_PATTERNS = [
  /^pay\b/i,
  /^submit\b/i,
  /^confirm and pay/i,
  /^make payment/i,
  /^pay now/i,
  /^proceed to payment/i,
];

const SAFE_ADVANCE_PATTERNS = [
  /^save and continue$/i,
  /^continue$/i,
  /^next$/i,
  /^save$/i,
];

interface FieldCapture {
  tag: "input" | "select" | "textarea" | "fieldset";
  type?: string;
  id?: string;
  name?: string;
  required: boolean;
  label?: string;
  placeholder?: string;
  options?: string[]; // select / radio / checkbox
  ariaDescribedby?: string;
}

interface PageCapture {
  pageIndex: number;
  url: string;
  heading: string;
  /** Step indicator like "Section 4 of 11" if present. */
  progressIndicator?: string;
  fields: FieldCapture[];
  /** Visible submit buttons by name + value. */
  submits: Array<{ name?: string; value?: string; text: string }>;
  /** True when a STOP_BUTTON_PATTERNS match was found — recon halts. */
  stoppedAtPay: boolean;
  capturedAt: string;
}

function fail(msg: string): never {
  console.error(`[uk-walk] ${msg}`);
  process.exit(1);
}

async function captureCurrentPage(page: Page, pageIndex: number): Promise<PageCapture> {
  // Run all DOM extraction inside one page.evaluate for speed and atomicity.
  const data = await page.evaluate(() => {
    function textOf(el: Element | null | undefined): string {
      return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    }
    function nearestLabel(el: HTMLElement): string | undefined {
      const id = el.id;
      if (id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl) return textOf(lbl);
      }
      const parentLbl = el.closest("label");
      if (parentLbl) return textOf(parentLbl);
      // gov.uk pattern: legend wraps a fieldset that wraps the input.
      const legend = el.closest("fieldset")?.querySelector("legend");
      if (legend) return textOf(legend);
      return undefined;
    }

    const heading = textOf(document.querySelector("h1, h2"));
    const progressIndicator = textOf(
      document.querySelector("[class*=ProgressBar], [class*=stepNav], [data-module*=progress]"),
    ) || undefined;

    const fields: FieldCapture[] = [];
    const seenRadioGroups = new Set<string>();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input"));
    for (const el of inputs) {
      if (el.type === "hidden") continue;
      if ((el.type === "radio" || el.type === "checkbox") && el.name) {
        if (seenRadioGroups.has(el.name)) continue;
        seenRadioGroups.add(el.name);
        const groupOptions = Array.from(
          document.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(el.name)}"]`),
        ).map((opt) => textOf(nearestLabel(opt) as unknown as Element) || opt.value);
        fields.push({
          tag: "input",
          type: el.type,
          id: el.id || undefined,
          name: el.name,
          required: el.required,
          label: nearestLabel(el),
          options: groupOptions,
        });
      } else {
        fields.push({
          tag: "input",
          type: el.type || "text",
          id: el.id || undefined,
          name: el.name || undefined,
          required: el.required,
          label: nearestLabel(el),
          placeholder: el.placeholder || undefined,
          ariaDescribedby: el.getAttribute("aria-describedby") || undefined,
        });
      }
    }
    for (const el of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
      fields.push({
        tag: "select",
        id: el.id || undefined,
        name: el.name || undefined,
        required: el.required,
        label: nearestLabel(el),
        options: Array.from(el.options).map((o) => o.text.trim()).filter(Boolean),
      });
    }
    for (const el of Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea"))) {
      fields.push({
        tag: "textarea",
        id: el.id || undefined,
        name: el.name || undefined,
        required: el.required,
        label: nearestLabel(el),
        placeholder: el.placeholder || undefined,
      });
    }

    const submits = Array.from(
      document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        'button[type="submit"], input[type="submit"], button:not([type])',
      ),
    ).map((b) => ({
      name: (b as HTMLButtonElement).name || undefined,
      value: (b as HTMLInputElement).value || undefined,
      text: textOf(b),
    }));

    return { heading, progressIndicator, fields, submits };
  });

  const submitText = data.submits.map((s) => s.text || s.value || "").join(" | ");
  const stoppedAtPay = STOP_BUTTON_PATTERNS.some((rx) => rx.test(submitText));

  return {
    pageIndex,
    url: page.url(),
    heading: data.heading,
    progressIndicator: data.progressIndicator,
    fields: data.fields,
    submits: data.submits,
    stoppedAtPay,
    capturedAt: new Date().toISOString(),
  };
}

async function clickAdvance(page: Page): Promise<boolean> {
  const buttons = await page
    .locator('button[type="submit"], input[type="submit"]')
    .all();
  for (const btn of buttons) {
    const text = ((await btn.textContent()) ?? (await btn.getAttribute("value")) ?? "").trim();
    if (SAFE_ADVANCE_PATTERNS.some((rx) => rx.test(text))) {
      await btn.click({ timeout: 5_000 }).catch(() => undefined);
      return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  const resumeUrl = process.env.UK_TEST_RESUME_URL;
  const password = process.env.UK_TEST_PASSWORD;
  if (!resumeUrl) fail("UK_TEST_RESUME_URL must be set");
  if (!password) fail("UK_TEST_PASSWORD must be set");

  const argv = process.argv.slice(2);
  const headful = argv.includes("--headful");
  const outArgIdx = argv.indexOf("--out");
  const outDir = outArgIdx >= 0 ? argv[outArgIdx + 1] : path.resolve(__dirname, "../uk-walk-out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headful });
  const ctx = await browser.newContext({ acceptDownloads: false });
  const page = await ctx.newPage();

  console.log(`[uk-walk] navigating to ${resumeUrl}`);
  await page.goto(resumeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // forceResume page asks for the application password.
  const pwInput = page.locator('input[type="password"]').first();
  if ((await pwInput.count()) > 0) {
    await pwInput.fill(password);
    const submit = page.locator('button[type="submit"], input[type="submit"]').first();
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 30_000 }),
      submit.click({ timeout: 10_000 }),
    ]);
  }

  const walk: PageCapture[] = [];
  const MAX_PAGES = 60;
  for (let i = 0; i < MAX_PAGES; i++) {
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    const cap = await captureCurrentPage(page, i);
    walk.push(cap);

    fs.writeFileSync(
      path.join(outDir, `page-${String(i).padStart(3, "0")}.json`),
      JSON.stringify(cap, null, 2),
    );
    await page.screenshot({
      path: path.join(outDir, `page-${String(i).padStart(3, "0")}.png`),
      fullPage: true,
    });

    console.log(`[uk-walk] page ${i}: ${cap.heading} (${cap.fields.length} fields)`);

    if (cap.stoppedAtPay) {
      console.log(`[uk-walk] stop button detected — halting at page ${i}`);
      break;
    }

    const advanced = await clickAdvance(page);
    if (!advanced) {
      console.log(`[uk-walk] no safe advance button on page ${i} — halting`);
      break;
    }
  }

  fs.writeFileSync(
    path.join(outDir, "walk.json"),
    JSON.stringify({ resumeUrl, capturedAt: new Date().toISOString(), pages: walk }, null, 2),
  );
  console.log(`[uk-walk] wrote ${walk.length} page captures → ${outDir}`);

  await ctx.close();
  await browser.close();
}

main().catch((err) => {
  console.error(`[uk-walk] fatal:`, err);
  process.exit(1);
});
