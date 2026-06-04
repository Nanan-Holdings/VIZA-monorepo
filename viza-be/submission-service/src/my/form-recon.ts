import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Page } from "@playwright/test";

/**
 * Malaysia eVISA/MDAC form recon (RUN-MY-001 / RUN-MY-002 / DATA-001).
 *
 *   npx ts-node src/my/form-recon.ts
 *
 * Field discovery with retry/backoff (local stopgap until RUN-CORE-001
 * consolidates a shared helper). Read-only. MY_RECON_HEADFUL=1 to watch.
 */

const BASE_URL = process.env.MY_PORTAL_URL ?? "https://malaysiavisa.imi.gov.my";
const OUT_DIR = path.join(process.cwd(), "recon-out", "my");

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
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
  const browser = await chromium.launch({ headless: process.env.MY_RECON_HEADFUL !== "1" });
  const page = await browser.newPage();
  try {
    await withRetry(() => page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }));
    await page.screenshot({ path: path.join(OUT_DIR, "landing.png"), fullPage: true });
    const fields = await discoverFields(page);
    fs.writeFileSync(path.join(OUT_DIR, "fields.json"), JSON.stringify(fields, null, 2));
    console.log(`[my-recon] dumped ${fields.length} fields → ${OUT_DIR}/fields.json`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("form-recon.ts")) {
  main().catch((err) => {
    console.error("[my-recon] error:", err);
    process.exit(1);
  });
}
