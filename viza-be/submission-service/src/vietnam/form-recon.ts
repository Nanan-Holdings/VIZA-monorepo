/// <reference lib="dom" />
/**
 * Vietnam E-Visa form recon — QA helper for the VN_E_VISA schema.
 *
 * Navigates to evisa.gov.vn with a stealth-patched Chromium, walks as far
 * as it can into the multi-step form (landing → disclaimer → form), and
 * dumps every visible Ant Design form field (label, required, type,
 * placeholder, options) to JSON + screenshots.
 *
 * The output feeds a schema diff against scripts/seed-vn-e-visa-form-fields.ts
 * so we can tell whether the 81 seeded fields match what the live form
 * actually asks.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx tsx src/vietnam/form-recon.ts
 *
 * Output:
 *   vn-recon-out/page-01-landing.png, page-02-disclaimer.png, ...
 *   vn-recon-out/fields-step-*.json
 *   vn-recon-out/summary.json
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";

const OUT_DIR = path.resolve(__dirname, "../../vn-recon-out");
const ENTRY_URL = "https://evisa.gov.vn/";
const FORM_URL = "https://evisa.gov.vn/e-visa/foreigners";
const HEADLESS = process.env.VN_RECON_HEADFUL !== "1";
const NAV_TIMEOUT = 60_000;

interface FieldCapture {
  step: number;
  index: number;
  field_id?: string;
  field_name?: string;
  label: string;
  field_type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(page: Page, name: string): Promise<void> {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  screenshot → ${path.relative(process.cwd(), file)}`);
}

async function dumpHtml(page: Page, name: string): Promise<void> {
  const file = path.join(OUT_DIR, `${name}.html`);
  const html = await page.content();
  await fs.writeFile(file, html, "utf8");
  console.log(`  html       → ${path.relative(process.cwd(), file)} (${html.length} bytes)`);
}

/** Extract all Ant Design form fields visible on the current page. */
async function extractFields(page: Page, step: number): Promise<FieldCapture[]> {
  return await page.evaluate((stepNumber: number) => {
    // tsx injects `__name` around function declarations; stub it for the browser context.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f: unknown) => f;
    const findSection = (el: Element): string => {
      let cur: Element | null = el;
      while (cur) {
        const prev: Element | null = cur.previousElementSibling;
        if (prev) {
          const text = (prev.textContent || "").trim();
          if (/^\d+\.\s+[A-Z]/.test(text) && text.length < 60) return text;
          cur = prev;
        } else {
          cur = cur.parentElement;
        }
        if (!cur || cur === document.body) break;
      }
      return "";
    };

    const items = Array.from(document.querySelectorAll<HTMLElement>(".ant-form-item"));
    const captures: Array<{
      step: number;
      index: number;
      section?: string;
      field_id?: string;
      field_name?: string;
      label: string;
      nearby_text?: string;
      field_type: string;
      required: boolean;
      placeholder?: string;
      options?: string[];
    }> = [];

    items.forEach((item, idx) => {
      const labelEl = item.querySelector(".ant-form-item-label label");
      const label = (labelEl?.textContent || "").trim();
      const required = !!item.querySelector(".ant-form-item-required") ||
        !!labelEl?.classList.contains("ant-form-item-required");
      const section = findSection(item);

      // If no ant-form-item-label, try to find the first bold/paragraph text near the control.
      let nearby_text: string | undefined;
      if (!label) {
        const parent = item.parentElement;
        if (parent) {
          const nearbyCandidates = parent.querySelectorAll("p, span, div, label");
          for (const el of Array.from(nearbyCandidates).slice(0, 4)) {
            const t = (el.textContent || "").trim();
            if (t && t.length < 200 && !t.includes("ant-form-item")) {
              nearby_text = t;
              break;
            }
          }
        }
      }

      const control = item.querySelector<HTMLElement>(".ant-form-item-control");
      if (!control) return;

      const input = control.querySelector<HTMLInputElement>("input");
      const textarea = control.querySelector<HTMLTextAreaElement>("textarea");
      const select = control.querySelector<HTMLElement>(".ant-select");
      const picker = control.querySelector<HTMLElement>(".ant-picker");
      const radioGroup = control.querySelector<HTMLElement>(".ant-radio-group");
      const checkboxGroup = control.querySelector<HTMLElement>(".ant-checkbox-group");
      const checkbox = control.querySelector<HTMLElement>(".ant-checkbox");
      const uploadEl = control.querySelector<HTMLElement>(".ant-upload");

      let field_type = "unknown";
      let placeholder: string | undefined;
      let options: string[] | undefined;
      let field_id: string | undefined;
      let field_name: string | undefined;

      if (picker) {
        field_type = "date";
        const pickerInput = picker.querySelector<HTMLInputElement>("input");
        placeholder = pickerInput?.placeholder || undefined;
        field_id = pickerInput?.id || undefined;
        field_name = pickerInput?.name || undefined;
      } else if (uploadEl) {
        field_type = "upload";
        const fileInput = uploadEl.querySelector<HTMLInputElement>('input[type="file"]');
        field_id = fileInput?.id || undefined;
        field_name = fileInput?.name || undefined;
      } else if (select) {
        field_type = "select";
        const selectInput = select.querySelector<HTMLInputElement>("input");
        field_id = selectInput?.id || undefined;
        field_name = selectInput?.name || undefined;
        placeholder = select.querySelector<HTMLElement>(".ant-select-selection-placeholder")?.textContent?.trim() || undefined;
      } else if (textarea) {
        field_type = "textarea";
        placeholder = textarea.placeholder || undefined;
        field_id = textarea.id || undefined;
        field_name = textarea.name || undefined;
      } else if (radioGroup) {
        field_type = "radio";
        options = Array.from(radioGroup.querySelectorAll<HTMLElement>(".ant-radio-wrapper, label.ant-radio-button-wrapper"))
          .map((el) => (el.textContent || "").trim())
          .filter(Boolean);
      } else if (checkboxGroup) {
        field_type = "checkbox_group";
        options = Array.from(checkboxGroup.querySelectorAll<HTMLElement>(".ant-checkbox-wrapper"))
          .map((el) => (el.textContent || "").trim())
          .filter(Boolean);
      } else if (checkbox) {
        field_type = "checkbox";
      } else if (input) {
        field_type = input.type === "email" ? "email" : input.type === "tel" ? "tel" : input.type === "number" ? "number" : "text";
        placeholder = input.placeholder || undefined;
        field_id = input.id || undefined;
        field_name = input.name || undefined;
      }

      captures.push({
        step: stepNumber,
        index: idx,
        section,
        field_id,
        field_name,
        label,
        nearby_text,
        field_type,
        required,
        placeholder,
        options,
      });
    });

    return captures;
  }, step);
}

/** Click the first matching element from a list of selectors/text patterns. */
async function clickFirst(page: Page, options: Array<{ selector?: string; text?: RegExp; role?: "button" | "link" }>): Promise<boolean> {
  for (const opt of options) {
    try {
      if (opt.selector) {
        const loc = page.locator(opt.selector).first();
        if (await loc.count()) {
          await loc.click({ timeout: 5000 });
          console.log(`  clicked selector=${opt.selector}`);
          return true;
        }
      }
      if (opt.text && opt.role) {
        const loc = page.getByRole(opt.role, { name: opt.text }).first();
        if (await loc.count()) {
          await loc.click({ timeout: 5000 });
          console.log(`  clicked role=${opt.role} text=${opt.text}`);
          return true;
        }
      }
    } catch {
      // try next
    }
  }
  return false;
}

/** Dismiss any modal popover ("Language" / "Notice" / etc.) by clicking Confirm/Close. */
async function dismissModals(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const btn = page.locator('.ant-modal-wrap:visible, [role="dialog"]:visible').locator('button:visible').filter({ hasText: /^(Confirm|Close|OK|Accept)$/i }).first();
    if (!(await btn.count())) break;
    try {
      await btn.click({ timeout: 2000 });
      await sleep(600);
      console.log(`  dismissed modal ${i + 1}`);
    } catch { break; }
  }
}

/** Try to accept a disclaimer/agree gate if present. */
async function tryAcceptDisclaimer(page: Page): Promise<void> {
  await dismissModals(page);

  // Scroll the disclaimer body to the bottom (some gates need this).
  await page.evaluate(() => {
    const scrollables = Array.from(document.querySelectorAll("*")).filter((el) => {
      const s = getComputedStyle(el as Element);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight;
    }) as HTMLElement[];
    for (const el of scrollables) el.scrollTop = el.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  });
  await sleep(1000);

  // Click every Ant Design checkbox WRAPPER (not the hidden input) so Vue reacts.
  const wrappers = await page.locator(".ant-checkbox-wrapper").all();
  let ticked = 0;
  for (const w of wrappers) {
    try {
      if (!(await w.isVisible({ timeout: 200 }))) continue;
      // Skip already-checked wrappers
      const isChecked = await w.locator(".ant-checkbox-checked").count();
      if (isChecked) continue;
      await w.click({ timeout: 2000 });
      ticked++;
      await sleep(150);
    } catch { /* skip */ }
  }
  console.log(`  ticked ${ticked} checkbox wrapper(s) (of ${wrappers.length} visible)`);

  await dismissModals(page);
  await sleep(800);

  // Click Next (prefer enabled button, match Ant primary button class)
  const clicked = await clickFirst(page, [
    { selector: 'button.ant-btn-primary:has-text("Next"):not([disabled])' },
    { selector: 'button:has-text("Next"):not([disabled])' },
    { text: /^(Next|Continue|Agree|I Agree|Proceed)$/i, role: "button" },
  ]);
  if (!clicked) console.log(`  (Next not clickable — may be disabled)`);
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`VN form recon — output: ${OUT_DIR}`);
  console.log(`Headless: ${HEADLESS}  (VN_RECON_HEADFUL=1 to disable)`);

  const { browser, context, page } = await launchStealthBrowser({ headless: HEADLESS });
  const captures: Record<string, FieldCapture[]> = {};
  const navLog: Array<{ step: string; url: string; title: string; fields: number }> = [];

  try {
    // Wait for the SPA's #app div to hydrate past a size threshold.
    const waitForHydration = async (label: string) => {
      try {
        await page.waitForFunction(
          () => {
            const app = document.getElementById("app");
            return !!app && app.innerHTML.length > 2000;
          },
          null,
          { timeout: 30_000 },
        );
      } catch {
        console.log(`  ⚠ ${label}: SPA did not hydrate in 30s`);
      }
    };

    // ── Landing ─────────────────────────────────────────────────────────────
    console.log(`\n→ Navigate ${ENTRY_URL}`);
    await page.goto(ENTRY_URL, { waitUntil: "load", timeout: NAV_TIMEOUT });
    await waitForHydration("landing");
    await sleep(2500);
    await shot(page, "01-landing");
    await dumpHtml(page, "01-landing");

    // ── In-SPA navigate to the form via Vue router (link click) ────────────
    console.log(`\n→ Click "E-visa for foreigners" link`);
    const linkClicked = await clickFirst(page, [
      { selector: 'a[href="/e-visa/foreigners"]' },
      { selector: 'a[href*="/e-visa/foreigners"]' },
      { text: /E-visa.*[Ff]oreigners?/, role: "link" },
    ]);
    if (!linkClicked) {
      // Fall back to full nav if the SPA link isn't present.
      console.log(`  (fallback) goto ${FORM_URL}`);
      await page.goto(FORM_URL, { waitUntil: "load", timeout: NAV_TIMEOUT });
    }
    await waitForHydration("form");
    try {
      await page.waitForFunction(
        () => !!document.querySelector(".ant-form, .ant-form-item, button.ant-btn, .ant-checkbox"),
        null,
        { timeout: 25_000 },
      );
    } catch {
      console.log("  ⚠ Form page did not expose Ant Design skeleton in 25s; continuing");
    }
    await sleep(3000);
    await shot(page, "02-form-landing");
    await dumpHtml(page, "02-form-landing");
    navLog.push({ step: "form-landing", url: page.url(), title: await page.title(), fields: 0 });

    // ── Disclaimer ──────────────────────────────────────────────────────────
    console.log(`\n→ Attempt disclaimer`);
    await tryAcceptDisclaimer(page);
    await sleep(3000);
    await shot(page, "03-after-disclaimer");
    await dumpHtml(page, "03-after-disclaimer");
    navLog.push({ step: "after-disclaimer", url: page.url(), title: await page.title(), fields: 0 });

    // Some flows have a second disclaimer + account-creation gate; retry.
    await tryAcceptDisclaimer(page);
    await sleep(2500);
    await shot(page, "04-after-disclaimer-retry");
    navLog.push({ step: "after-disclaimer-retry", url: page.url(), title: await page.title(), fields: 0 });

    // ── Form walk (single-page — scroll to load lazy sections, extract once) ─
    console.log(`\n→ Scrolling form to trigger lazy renders`);
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        const step = 400;
        let y = 0;
        const max = document.body.scrollHeight;
        const iv = setInterval(() => {
          window.scrollTo(0, y);
          y += step;
          if (y > max + 2000) {
            clearInterval(iv);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 120);
      });
    });
    await sleep(1500);
    await shot(page, "05-after-scroll");

    const fields = await extractFields(page, 1);
    console.log(`\n→ Captured ${fields.length} fields (single-page form)`);
    captures["page-1"] = fields;
    await fs.writeFile(
      path.join(OUT_DIR, "fields-all.json"),
      JSON.stringify(fields, null, 2),
      "utf8",
    );
    navLog.push({ step: "form-extracted", url: page.url(), title: await page.title(), fields: fields.length });

    // ── Summary ─────────────────────────────────────────────────────────────
    const summary = {
      entry_url: ENTRY_URL,
      final_url: page.url(),
      final_title: await page.title(),
      steps_captured: Object.keys(captures).length,
      total_fields: Object.values(captures).reduce((a, b) => a + b.length, 0),
      nav_log: navLog,
      fields_by_step: captures,
    };
    await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
    console.log(`\n✔ Summary: ${summary.steps_captured} step(s), ${summary.total_fields} fields captured`);
    console.log(`  Output: ${OUT_DIR}`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("form-recon failed:", err);
  process.exit(1);
});
