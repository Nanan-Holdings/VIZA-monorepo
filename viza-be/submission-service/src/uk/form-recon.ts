/// <reference lib="dom" />
/**
 * UK Standard Visitor visa form reconnaissance.
 *
 * Purpose: the ~50 post-auth pages / 222 fields of the UKVI form are
 * gated behind an email-verified account. Rather than hand-mapping
 * selectors blind, this script runs a **headful** browser, parks at the
 * UK portal, and auto-dumps every form page as the human drives through
 * the flow. One JSON file per page lands in `uk-recon-out/`.
 *
 * Usage:
 *   npx ts-node src/uk/form-recon.ts
 *   # OR with a starting URL:
 *   npx ts-node src/uk/form-recon.ts https://visas-immigration.service.gov.uk/some-page
 *
 * What you do:
 *   1. The browser opens at the UKVI language page (or your start URL).
 *   2. Drive the form manually: pick language, country, create an
 *      account, verify email, continue filling pages.
 *   3. Every time the form.action or URL changes, the script captures
 *      the current page to `uk-recon-out/page-{N}-{slug}.json`.
 *   4. Ctrl+C when done. Summary `canonical.json` is also written.
 *
 * The JSON files feed into UK_PAGE_SELECTORS in selectors.ts — one
 * page's fields become one entry under the matching UkPageId.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";
import { UK_URLS } from "./selectors";

const OUT_DIR = path.resolve(__dirname, "../../uk-recon-out");
const POLL_MS = 800;

interface FieldCapture {
  tag: "input" | "select" | "textarea";
  type: string | null;
  id: string | null;
  name: string | null;
  label: string | null;
  required: boolean;
  placeholder: string | null;
  /** For radios/checkboxes: the value attribute. */
  value?: string | null;
  /** For selects: option values + texts. */
  options?: Array<{ value: string; text: string }>;
}

interface RadioGroupCapture {
  name: string;
  label: string | null;
  options: Array<{ value: string; id: string; label: string | null }>;
}

interface PageCapture {
  seq: number;
  capturedAt: string;
  url: string;
  title: string;
  h1: string | null;
  formAction: string | null;
  formMethod: string | null;
  fields: FieldCapture[];
  radioGroups: RadioGroupCapture[];
  hiddenInputs: Array<{ name: string; value: string | null }>;
  submitButtons: Array<{ id: string | null; name: string | null; value: string | null; text: string }>;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "page";
}

async function capturePage(page: Page, seq: number): Promise<PageCapture> {
  const raw = await page.evaluate(() => {
    const h1 = document.querySelector<HTMLElement>("h1")?.innerText?.trim() ?? null;
    const form = document.querySelector<HTMLFormElement>("form");
    const formAction = form?.getAttribute("action") ?? null;
    const formMethod = form?.getAttribute("method") ?? null;

    const labelFor = (el: HTMLElement): string | null => {
      if ("labels" in el && (el as HTMLInputElement).labels?.[0]) {
        return (el as HTMLInputElement).labels![0].innerText.trim().slice(0, 200);
      }
      return null;
    };

    const fields: FieldCapture[] = [];
    const hiddenInputs: Array<{ name: string; value: string | null }> = [];
    const radioMap = new Map<string, RadioGroupCapture>();

    for (const el of Array.from(document.querySelectorAll<HTMLInputElement>("input"))) {
      const type = el.type;
      const name = el.name || null;
      const id = el.id || null;
      const label = labelFor(el);
      const required = el.required;
      const placeholder = el.placeholder || null;
      const value = el.value;

      if (type === "hidden") {
        if (name) hiddenInputs.push({ name, value: value || null });
        continue;
      }
      if (type === "submit" || type === "button") continue;

      if (type === "radio" && name) {
        let group = radioMap.get(name);
        if (!group) {
          group = { name, label, options: [] };
          radioMap.set(name, group);
        }
        group.options.push({ value, id: id ?? "", label });
        continue;
      }

      fields.push({
        tag: "input",
        type,
        id,
        name,
        label,
        required,
        placeholder,
        value: type === "checkbox" ? value : null,
      });
    }

    for (const el of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
      const options = Array.from(el.options).map((o) => ({ value: o.value, text: o.text.trim() }));
      fields.push({
        tag: "select",
        type: null,
        id: el.id || null,
        name: el.name || null,
        label: labelFor(el),
        required: el.required,
        placeholder: null,
        options,
      });
    }

    for (const el of Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea"))) {
      fields.push({
        tag: "textarea",
        type: null,
        id: el.id || null,
        name: el.name || null,
        label: labelFor(el),
        required: el.required,
        placeholder: el.placeholder || null,
      });
    }

    const submitButtons: PageCapture["submitButtons"] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLButtonElement>("button, input[type=submit]"))) {
      submitButtons.push({
        id: el.id || null,
        name: el.getAttribute("name"),
        value: el.getAttribute("value"),
        text: (el.innerText || "").trim().slice(0, 80),
      });
    }

    return {
      url: location.href,
      title: document.title,
      h1,
      formAction,
      formMethod,
      fields,
      radioGroups: Array.from(radioMap.values()),
      hiddenInputs,
      submitButtons,
    };
  });

  return { seq, capturedAt: new Date().toISOString(), ...raw };
}

function pageKey(cap: Pick<PageCapture, "url" | "formAction" | "h1">): string {
  return `${cap.url}|${cap.formAction ?? ""}|${cap.h1 ?? ""}`;
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const startUrl = process.argv[2] ?? UK_URLS.LANGUAGE_SELECTION;

  console.log(`[recon] starting headful browser at ${startUrl}`);
  console.log(`[recon] dumping each new page to ${OUT_DIR}`);
  console.log(`[recon] Ctrl+C to stop.\n`);

  const { browser, context, page } = await launchStealthBrowser({ headless: false });

  const pages: PageCapture[] = [];
  let lastKey: string | null = null;
  let seq = 0;
  let stopped = false;

  const stop = async (signal: string): Promise<void> => {
    if (stopped) return;
    stopped = true;
    console.log(`\n[recon] ${signal} — writing canonical.json and closing.`);
    await fs.writeFile(
      path.join(OUT_DIR, "canonical.json"),
      JSON.stringify({ capturedAt: new Date().toISOString(), pages }, null, 2),
      "utf8",
    );
    try { await context.close(); } catch { /* ignore */ }
    try { await browser.close(); } catch { /* ignore */ }
    process.exit(0);
  };

  process.on("SIGINT", () => { void stop("SIGINT"); });
  process.on("SIGTERM", () => { void stop("SIGTERM"); });

  try {
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (err) {
    console.error(`[recon] initial navigation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Poll loop: every POLL_MS, snapshot the current page. Emit a file
  // whenever (url + formAction + h1) changes from the prior capture.
  while (!stopped) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      // Skip capture if page is mid-navigation
      if (page.isClosed()) { await stop("page-closed"); break; }
      const cap = await capturePage(page, seq + 1);
      const key = pageKey(cap);
      if (key === lastKey) continue;
      lastKey = key;
      seq += 1;
      cap.seq = seq;
      pages.push(cap);
      const slug = slugify(cap.h1 ?? cap.title ?? "page");
      const file = path.join(OUT_DIR, `page-${String(seq).padStart(3, "0")}-${slug}.json`);
      await fs.writeFile(file, JSON.stringify(cap, null, 2), "utf8");
      const fieldCount = cap.fields.length + cap.radioGroups.length;
      console.log(`[recon] #${seq}  ${cap.h1 ?? cap.title}  (${fieldCount} fields, action=${cap.formAction ?? "∅"})  → ${path.basename(file)}`);
    } catch (err) {
      // Transient failures while navigation happens — just keep polling.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Target page .* has been closed/i.test(msg)) {
        // Only log non-closed errors to reduce noise during redirects
        if (process.env.DEBUG_RECON) console.error(`[recon] capture error: ${msg}`);
      }
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
