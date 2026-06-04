import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Page } from "@playwright/test";

/**
 * Saudi e-Visa form recon (RUN-SA-001 / RUN-SA-002 / DATA-001).
 *
 *   npx ts-node src/sa/form-recon.ts
 *
 * Field discovery with retry/backoff. Dumps input/select fields + screenshot
 * to recon-out/sa/ so the best-effort selectors in field-mappings.ts can be
 * promoted. Read-only on the portal. SA_RECON_HEADFUL=1 to watch.
 *
 * The withRetry helper here is a local stopgap; RUN-CORE-001 consolidates a
 * shared recon retry/backoff helper that this should adopt.
 */

const BASE_URL = process.env.SA_PORTAL_URL ?? "https://visa.visitsaudi.com";
const OUT_DIR = path.join(process.cwd(), "recon-out", "sa");

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const wait = baseMs * 2 ** i;
      console.warn(`[sa-recon] attempt ${i + 1}/${attempts} failed, backing off ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

export interface ReconField {
  tag: string;
  name: string;
  id: string;
  type: string;
  placeholder: string;
}

/** Parse the recon field inventory from a page. Exported for fixture tests. */
export async function discoverFields(page: Page): Promise<ReconField[]> {
  return page.$$eval("input, select, textarea", (els) =>
    els.map((el) => {
      const e = el as HTMLInputElement;
      return { tag: e.tagName.toLowerCase(), name: e.name, id: e.id, type: e.type, placeholder: e.placeholder };
    }),
  );
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.SA_RECON_HEADFUL !== "1" });
  const page = await browser.newPage();
  try {
    await withRetry(() => page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }));
    await page.screenshot({ path: path.join(OUT_DIR, "landing.png"), fullPage: true });
    const fields = await discoverFields(page);
    fs.writeFileSync(path.join(OUT_DIR, "fields.json"), JSON.stringify(fields, null, 2));
    console.log(`[sa-recon] dumped ${fields.length} fields → ${OUT_DIR}/fields.json`);
  } finally {
    await browser.close();
  }
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("form-recon.ts")) {
  main().catch((err) => {
    console.error("[sa-recon] error:", err);
    process.exit(1);
  });
}
