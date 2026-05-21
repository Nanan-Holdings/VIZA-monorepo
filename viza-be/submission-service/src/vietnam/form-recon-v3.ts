/// <reference lib="dom" />
/**
 * Vietnam E-Visa recon v3 — single clean pass.
 *
 * Flow: landing → tick NOTE-modal checkboxes → Next → wait for form route →
 * extract all ant-form-items with full section + field_id + required +
 * placeholder metadata → scrape every select's option panel by clicking
 * each and reading the .ant-select-dropdown → dump canonical.json.
 *
 * Succeeds on quiet-site days. On rate-limit days, landing may never
 * hydrate — we write the partial state to disk and exit cleanly so the
 * caller knows to retry later.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";

const OUT_DIR = path.resolve(__dirname, "../../vn-recon-out-v3");

interface FieldCapture {
  section?: string;
  field_id?: string;
  label: string;
  field_type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

async function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function extractFormItems(page: Page): Promise<FieldCapture[]> {
  return await page.evaluate(() => {
    (window as unknown as { __name: (f: unknown) => unknown }).__name = (f: unknown) => f;
    const findSection = (el: Element): string => {
      let cur: Element | null = el;
      while (cur) {
        const prev: Element | null = cur.previousElementSibling;
        if (prev) {
          const t = (prev.textContent || "").trim();
          if (/^\d+\.\s+[A-Z]/.test(t) && t.length < 80) return t;
          cur = prev;
        } else cur = cur.parentElement;
        if (!cur || cur === document.body) break;
      }
      return "";
    };
    const items = Array.from(document.querySelectorAll<HTMLElement>(".ant-form-item"));
    return items.map((item) => {
      const labelEl = item.querySelector(".ant-form-item-label label");
      const label = (labelEl?.textContent || "").trim();
      const required = !!item.querySelector(".ant-form-item-required") ||
        !!labelEl?.classList.contains("ant-form-item-required");
      const section = findSection(item);
      const control = item.querySelector<HTMLElement>(".ant-form-item-control");
      const input = control?.querySelector<HTMLInputElement>("input");
      const textarea = control?.querySelector<HTMLTextAreaElement>("textarea");
      const select = control?.querySelector<HTMLElement>(".ant-select");
      const picker = control?.querySelector<HTMLElement>(".ant-picker");
      const radioGroup = control?.querySelector<HTMLElement>(".ant-radio-group");
      const uploadEl = control?.querySelector<HTMLElement>(".ant-upload");

      let field_type = "unknown";
      let placeholder: string | undefined;
      let field_id: string | undefined;
      let options: string[] | undefined;

      if (picker) {
        field_type = "date";
        const pi = picker.querySelector<HTMLInputElement>("input");
        placeholder = pi?.placeholder || undefined;
        field_id = pi?.id || undefined;
      } else if (uploadEl) {
        field_type = "upload";
      } else if (select) {
        field_type = "select";
        const si = select.querySelector<HTMLInputElement>("input");
        field_id = si?.id || undefined;
        placeholder = select.querySelector<HTMLElement>(".ant-select-selection-placeholder")?.textContent?.trim() || undefined;
      } else if (textarea) {
        field_type = "textarea";
        placeholder = textarea.placeholder || undefined;
        field_id = textarea.id || undefined;
      } else if (radioGroup) {
        field_type = "radio";
        options = Array.from(radioGroup.querySelectorAll<HTMLElement>(".ant-radio-wrapper, label.ant-radio-button-wrapper"))
          .map((el) => (el.textContent || "").trim()).filter(Boolean);
      } else if (input) {
        field_type = input.type === "email" ? "email" : "text";
        placeholder = input.placeholder || undefined;
        field_id = input.id || undefined;
      }
      return { section, field_id, label, field_type, required, placeholder, options };
    });
  });
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const { browser, context, page } = await launchStealthBrowser({ headless: true });
  const captured: Record<string, unknown> = { step: "start" };

  try {
    console.log("→ goto landing");
    await page.goto("https://evisa.gov.vn/", { waitUntil: "load", timeout: 60_000 });
    await page.waitForFunction(() => {
      const app = document.getElementById("app");
      return !!app && app.innerHTML.length > 40_000;
    }, null, { timeout: 45_000 }).catch(() => {});
    await sleep(3000);
    await shot(page, "01-landing");

    // Click the /e-visa/foreigners router link (via evaluate to bypass any overlay).
    console.log("→ navigate to form via Vue router");
    await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>('a[href="/e-visa/foreigners"]');
      if (a) a.click();
    });
    // Wait for URL to change OR timeout
    await page.waitForURL(/\/e-visa\/foreigners/, { timeout: 15_000 }).catch(() => {});
    await page.waitForFunction(() => {
      const app = document.getElementById("app");
      return !!app && app.innerHTML.length > 40_000;
    }, null, { timeout: 30_000 }).catch(() => {});
    await sleep(2500);
    await shot(page, "02-after-nav");
    console.log(`  url=${page.url()}`);

    // Handle modal: tick checkboxes + click Next (repeat until form items appear).
    // After successfully leaving the landing, give the form page a generous hydration budget.
    let onFormPage = false;
    for (let iter = 1; iter <= 8; iter++) {
      const fiCount = await page.locator(".ant-form-item").count();
      const url = page.url();
      console.log(`[iter ${iter}] form-items=${fiCount} url=${url}`);
      if (fiCount >= 10) break;

      const nowOnForm = url.includes("/e-visa/foreigners");
      if (nowOnForm && !onFormPage) {
        onFormPage = true;
        console.log(`  → arrived on form URL, waiting 20s for SPA hydration`);
        await page.waitForFunction(() => document.querySelectorAll(".ant-form-item").length > 5, null, { timeout: 30_000 }).catch(() => {});
        await sleep(3000);
        continue;
      }
      if (onFormPage) {
        // Already on form, still nothing — give Vue more time before giving up
        await sleep(4000);
        continue;
      }

      // Still on landing — tick wrappers + click Next on the modal
      const wrappers = await page.locator(".ant-checkbox-wrapper").all();
      let ticked = 0;
      for (const w of wrappers) {
        if (!(await w.isVisible({ timeout: 200 }).catch(() => false))) continue;
        if (await w.locator(".ant-checkbox-checked").count()) continue;
        try { await w.click({ timeout: 1500, force: true }); ticked++; await sleep(200); }
        catch { /* ignore */ }
      }
      console.log(`  ticked=${ticked}`);

      const nextButtons = [
        page.locator('.ant-modal-wrap button.ant-btn-primary:has-text("Next"):not([disabled])').first(),
        page.locator('button.ant-btn-primary:has-text("Next"):not([disabled])').first(),
        page.locator('button:has-text("Next"):not([disabled])').first(),
      ];
      let clicked = false;
      for (const btn of nextButtons) {
        if (await btn.count()) {
          try { await btn.click({ timeout: 2000, force: true }); clicked = true; break; }
          catch { /* try next */ }
        }
      }
      console.log(`  next-clicked=${clicked}`);
      await sleep(3000);
    }

    await shot(page, "03-form");

    // Main extraction
    const formItems = await extractFormItems(page);
    console.log(`→ captured ${formItems.length} form_items`);
    captured.form_items = formItems;

    // Scrape select options — use aria-controls / aria-owns on the combobox
    // to find the dropdown that belongs to THIS select (not a stale one).
    console.log("→ scraping select options");
    const selectOpts: Record<string, string[]> = {};
    for (const f of formItems) {
      if (f.field_type !== "select" || !f.field_id) continue;
      // Hard-reset: click far away, Escape, give Vue time to unmount panels
      await page.mouse.click(5, 5).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(400);

      // Each select has its own dropdown instance linked by aria-controls on the combobox.
      const result = await page.evaluate((fieldId: string) => {
        (window as unknown as { __name: (f: unknown) => unknown }).__name = (f: unknown) => f;
        const input = document.getElementById(fieldId);
        if (!input) return { error: "no-input", fieldId };
        const select = input.closest(".ant-select") as HTMLElement | null;
        if (!select) return { error: "no-select-container", fieldId };
        // Find the selector, scroll into view, click it. Ant Select responds to mousedown.
        const selector = select.querySelector<HTMLElement>(".ant-select-selector");
        if (!selector) return { error: "no-selector", fieldId };
        selector.scrollIntoView({ block: "center" });
        selector.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        selector.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        selector.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        // aria-controls tells us the dropdown list's id
        const combobox = select.querySelector<HTMLElement>('[role="combobox"], input[role="combobox"]');
        const ariaControls = combobox?.getAttribute("aria-controls") || select.getAttribute("aria-controls");
        return { ariaControls, fieldId };
      }, f.field_id);
      if (!("ariaControls" in result) || !result.ariaControls) {
        // Can still try fallback below
      }
      // Wait for dropdown, then scroll the virtualized list until no new options appear.
      const opts = await page.evaluate(async (args: { ariaControls: string | null | undefined; fieldId: string }) => {
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
        const findPanel = (): HTMLElement | null => {
          if (args.ariaControls) {
            const listbox = document.getElementById(args.ariaControls);
            const p = listbox?.closest(".ant-select-dropdown") as HTMLElement | null;
            if (p && !p.classList.contains("ant-select-dropdown-hidden")) return p;
          }
          const panels = Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown:not(.ant-select-dropdown-hidden)"));
          return panels.find((p) => p.offsetHeight > 0 && p.querySelectorAll(".ant-select-item-option").length > 0) || null;
        };

        let panel: HTMLElement | null = null;
        for (let i = 0; i < 30; i++) {
          await sleep(120);
          panel = findPanel();
          if (panel) break;
        }
        if (!panel) return [] as string[];

        // The scroll container is .rc-virtual-list-holder (virtualized) or similar.
        const scroller = panel.querySelector<HTMLElement>(".rc-virtual-list-holder") ||
          panel.querySelector<HTMLElement>(".ant-select-item-option")?.parentElement as HTMLElement | null;

        // Order-preserving unique collector keyed on aria-posinset (virtualized lists
        // recycle DOM but preserve posinset). Falls back to label text if missing.
        const byPos = new Map<number, string>();
        const byText = new Map<string, number>();
        const readVisible = () => {
          const items = Array.from(panel!.querySelectorAll<HTMLElement>(".ant-select-item-option"));
          items.forEach((el, idx) => {
            const text = (el.textContent || "").trim();
            if (!text) return;
            const rawPos = el.getAttribute("aria-posinset");
            const pos = rawPos ? Number(rawPos) : NaN;
            if (!isNaN(pos) && pos > 0) {
              byPos.set(pos, text);
            } else if (!byText.has(text)) {
              // Use a very large synthetic key so posinset entries always sort first
              byText.set(text, 1_000_000 + byText.size + idx);
            }
          });
        };
        readVisible();

        if (scroller) {
          let stagnant = 0;
          let lastCount = byPos.size + byText.size;
          for (let step = 0; step < 300; step++) {
            scroller.scrollTop = scroller.scrollTop + 160;
            await sleep(50);
            readVisible();
            const size = byPos.size + byText.size;
            if (size === lastCount) {
              stagnant++;
              if (stagnant >= 6) break;
            } else { stagnant = 0; lastCount = size; }
            if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
              await sleep(60);
              readVisible();
              break;
            }
          }
        }

        const combined: Array<[number, string]> = [
          ...Array.from(byPos.entries()),
          ...Array.from(byText.entries()).map(([t, k]) => [k, t] as [number, string]),
        ];
        return combined.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      }, { ariaControls: ("ariaControls" in result ? result.ariaControls ?? null : null), fieldId: f.field_id });

      if (opts.length) {
        selectOpts[f.field_id] = opts;
        console.log(`  ${f.field_id}: ${opts.length} options`);
      } else {
        console.log(`  ${f.field_id}: (no options captured)`);
      }
      // Close any open dropdown before next iter
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(200);
    }
    captured.select_options = selectOpts;

    // Attach scraped options to fields
    for (const f of formItems) {
      if (f.field_type === "select" && f.field_id && selectOpts[f.field_id]) {
        f.options = selectOpts[f.field_id];
      }
    }

    // Accompanying children table structure
    const tables = await page.evaluate(() => {
      const out: Array<{ caption: string; headers: string[] }> = [];
      for (const t of Array.from(document.querySelectorAll<HTMLElement>(".ant-table, table"))) {
        const ths = Array.from(t.querySelectorAll<HTMLElement>("th")).map((th) => (th.textContent || "").trim()).filter(Boolean);
        if (!ths.length) continue;
        const caption = (t.querySelector("caption")?.textContent || "").trim();
        out.push({ caption, headers: ths });
      }
      return out;
    });
    captured.tables = tables;
    console.log(`→ ${tables.length} tables`);

    // Find any yes/no toggle pairs outside ant-form-item (sibling spans)
    const toggles = await page.evaluate(() => {
      const findSection = (el: Element): string => {
        let cur: Element | null = el;
        while (cur) {
          const prev: Element | null = cur.previousElementSibling;
          if (prev) {
            const t = (prev.textContent || "").trim();
            if (/^\d+\.\s+[A-Z]/.test(t) && t.length < 80) return t;
            cur = prev;
          } else cur = cur.parentElement;
          if (!cur || cur === document.body) break;
        }
        return "";
      };
      const out: Array<{ section: string; question: string }> = [];
      // Look for spans with text "Yes" immediately preceded by a ?-terminated text
      const containers = Array.from(document.querySelectorAll<HTMLElement>("div, li, tr"));
      const seen = new Set<string>();
      for (const el of containers) {
        const t = (el.textContent || "").trim();
        if (t.length > 300 || t.length < 10) continue;
        if (!/\?/.test(t)) continue;
        if (!/\bYes\b/.test(t) || !/\bNo\b/.test(t)) continue;
        if (el.querySelector(".ant-form-item")) continue;
        const question = t.replace(/\s+/g, " ").replace(/\s*(Yes|No)\s*(Yes|No)?\s*$/g, "").trim();
        if (question.length < 8 || !/\?/.test(question)) continue;
        const key = question.slice(0, 140);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ section: findSection(el), question: key });
      }
      return out;
    });
    captured.toggles = toggles;
    console.log(`→ ${toggles.length} yes/no toggles detected`);
  } catch (err) {
    console.error("recon error:", err);
    captured.error = String(err);
  } finally {
    await fs.writeFile(path.join(OUT_DIR, "canonical.json"), JSON.stringify(captured, null, 2), "utf8");
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log(`→ wrote ${OUT_DIR}/canonical.json`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
