/// <reference lib="dom" />
/**
 * Shared portal recon walker.
 *
 * Per-country `form-recon.ts` modules declare a list of pages (URL or
 * click-through) and call `runPortalRecon`. The walker launches a stealth
 * Chromium, visits each page, captures a screenshot + HTML + parsed form
 * fields, and writes a JSON summary keyed by page slug.
 *
 * Phase A scope: read-only navigation only. No registration, no submits.
 * The walker is deliberately portal-agnostic — country quirks (auth,
 * captcha, multi-step gates) belong in the country module's own
 * orchestrator once recon has established the page surface.
 *
 * Output layout under `outDir`:
 *   <slug>.png        full-page screenshot
 *   <slug>.html       raw HTML
 *   summary.json      array of PageWalk entries with field counts
 *   fields.json       flattened FieldCapture[] across every walked page
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";

export type PageStatus = "ok" | "blocked" | "not_found" | "error";

export interface PageWalk {
  slug: string;
  url: string;
  title: string;
  status: PageStatus;
  fields: number;
  notes?: string;
}

export interface FieldCapture {
  page: string;
  index: number;
  field_id?: string;
  field_name?: string;
  label: string;
  field_type: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; text: string }>;
}

export interface ReconPageStep {
  /** File-system-safe identifier — becomes the filename prefix. */
  slug: string;
  /** Human-readable description for log lines. */
  description: string;
  /** Drive the page to the target surface — goto, click, fill, etc. */
  navigate: (page: Page) => Promise<void>;
}

export interface RunPortalReconOptions {
  countryCode: string;
  baseUrl: string;
  outDir: string;
  pages: ReconPageStep[];
  headless?: boolean;
  navTimeoutMs?: number;
  /** Extra wait after each navigation for SPA hydration. Default 2500ms. */
  postNavSettleMs?: number;
}

export interface RunPortalReconResult {
  walks: PageWalk[];
  totalFields: number;
  outDir: string;
}

export async function runPortalRecon(
  opts: RunPortalReconOptions,
): Promise<RunPortalReconResult> {
  const {
    countryCode,
    baseUrl,
    outDir,
    pages,
    headless = process.env.RECON_HEADFUL !== "1",
    navTimeoutMs = 60_000,
    postNavSettleMs = 2_500,
  } = opts;

  await fs.mkdir(outDir, { recursive: true });
  console.log(`[recon:${countryCode}] base=${baseUrl} out=${outDir} headless=${headless}`);

  const { browser, context, page } = await launchStealthBrowser({ headless });
  page.setDefaultNavigationTimeout(navTimeoutMs);

  const walks: PageWalk[] = [];
  const allFields: FieldCapture[] = [];

  try {
    for (const step of pages) {
      console.log(`\n→ [${step.slug}] ${step.description}`);
      const walk: PageWalk = {
        slug: step.slug,
        url: "",
        title: "",
        status: "error",
        fields: 0,
      };
      try {
        await step.navigate(page);
      } catch (err) {
        walk.notes = err instanceof Error ? err.message : String(err);
        console.log(`  navigation failed: ${walk.notes}`);
      }

      await sleep(postNavSettleMs);

      try {
        walk.url = page.url();
        walk.title = await safeTitle(page);
        walk.status = await classifyPage(page);
        await captureScreenshot(page, outDir, step.slug);
        await dumpHtml(page, outDir, step.slug);
        if (walk.status === "ok") {
          const fields = await extractFields(page, step.slug);
          walk.fields = fields.length;
          allFields.push(...fields);
        }
        console.log(
          `  status=${walk.status} title="${walk.title}" url=${walk.url} fields=${walk.fields}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        walk.notes = walk.notes ? `${walk.notes} | post: ${msg}` : msg;
        console.log(`  capture failed: ${msg}`);
      }
      walks.push(walk);
    }

    await fs.writeFile(
      path.join(outDir, "summary.json"),
      JSON.stringify({ countryCode, baseUrl, capturedAt: new Date().toISOString(), walks }, null, 2),
      "utf8",
    );
    await fs.writeFile(
      path.join(outDir, "fields.json"),
      JSON.stringify(allFields, null, 2),
      "utf8",
    );
    console.log(
      `\n[recon:${countryCode}] wrote summary.json + fields.json — ${walks.length} pages, ${allFields.length} fields`,
    );
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return { walks, totalFields: allFields.length, outDir };
}

async function captureScreenshot(page: Page, outDir: string, slug: string): Promise<void> {
  const file = path.join(outDir, `${slug}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true, timeout: 15_000 });
  } catch (err) {
    console.log(`  screenshot failed: ${(err as Error).message}`);
  }
}

async function dumpHtml(page: Page, outDir: string, slug: string): Promise<void> {
  const file = path.join(outDir, `${slug}.html`);
  try {
    const html = await page.content();
    await fs.writeFile(file, html, "utf8");
  } catch (err) {
    console.log(`  html dump failed: ${(err as Error).message}`);
  }
}

async function classifyPage(page: Page): Promise<PageStatus> {
  const html = (await page.content()).toLowerCase();
  if (
    html.includes("checking your browser") ||
    html.includes("just a moment") ||
    html.includes("cf-challenge") ||
    html.includes("attention required")
  ) {
    return "blocked";
  }
  if (
    html.includes("page not found") ||
    html.includes("404 — file or directory not found") ||
    html.includes("the resource cannot be found")
  ) {
    return "not_found";
  }
  if (html.includes("server error") || html.includes("runtime error")) {
    return "error";
  }
  return "ok";
}

async function extractFields(page: Page, slug: string): Promise<FieldCapture[]> {
  return await page.evaluate((pageSlug: string) => {
    const findLabel = (el: HTMLElement): string => {
      const id = el.id;
      if (id) {
        const lab = document.querySelector<HTMLLabelElement>(
          `label[for="${CSS.escape(id)}"]`,
        );
        if (lab) return (lab.textContent || "").trim();
      }
      let cur: HTMLElement | null = el.parentElement;
      while (cur && cur !== document.body) {
        const lab = cur.querySelector<HTMLLabelElement>("label");
        if (lab) {
          const t = (lab.textContent || "").trim();
          if (t) return t;
        }
        if (cur.classList.contains("form-group") || cur.classList.contains("row")) break;
        cur = cur.parentElement;
      }
      return el.getAttribute("aria-label") || (el as HTMLInputElement).placeholder || "";
    };

    const isRequired = (el: HTMLElement): boolean => {
      if ((el as HTMLInputElement).required) return true;
      if (el.getAttribute("aria-required") === "true") return true;
      if (el.getAttribute("data-val-required")) return true;
      const parent = el.parentElement;
      if (parent && parent.querySelector(".required, .req, .text-danger, .ant-form-item-required")) {
        return true;
      }
      return false;
    };

    const captures: FieldCapture[] = [];
    const seenRadioGroups = new Set<string>();

    const inputs = Array.from(
      document.querySelectorAll<HTMLElement>(
        "input:not([type=hidden]), select, textarea",
      ),
    );

    inputs.forEach((el, idx) => {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      let field_type = tag;

      if (tag === "input") {
        field_type =
          type === "checkbox" ? "checkbox"
          : type === "radio" ? "radio"
          : type === "email" ? "email"
          : type === "tel" ? "tel"
          : type === "number" ? "number"
          : type === "password" ? "password"
          : type === "date" ? "date"
          : type === "submit" || type === "button" ? "button"
          : type === "file" ? "file"
          : "text";
      }
      if (field_type === "button") return;

      let options: Array<{ value: string; text: string }> | undefined;
      if (tag === "select") {
        options = Array.from((el as HTMLSelectElement).options).map((o) => ({
          value: o.value,
          text: (o.textContent || "").trim(),
        }));
      }
      if (field_type === "radio" || field_type === "checkbox") {
        const name = (el as HTMLInputElement).name;
        if (name) {
          if (seenRadioGroups.has(name)) return;
          seenRadioGroups.add(name);
          const sibs = Array.from(
            document.querySelectorAll<HTMLInputElement>(
              `input[type=${field_type}][name="${CSS.escape(name)}"]`,
            ),
          );
          options = sibs.map((s) => ({
            value: s.value,
            text: (
              (s.id
                ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(s.id)}"]`)?.textContent
                : null) ||
              s.parentElement?.textContent ||
              s.value
            ).trim(),
          }));
        }
      }

      captures.push({
        page: pageSlug,
        index: idx,
        field_id: el.id || undefined,
        field_name: (el as HTMLInputElement).name || undefined,
        label: findLabel(el),
        field_type,
        required: isRequired(el),
        placeholder: (el as HTMLInputElement).placeholder || undefined,
        options,
      });
    });

    return captures;
  }, slug);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeTitle(page: Page): Promise<string> {
  for (let i = 0; i < 3; i += 1) {
    try {
      return await page.title();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Execution context was destroyed|Target closed|Navigation/.test(msg)) {
        await sleep(1_500);
        continue;
      }
      return "";
    }
  }
  return "";
}
