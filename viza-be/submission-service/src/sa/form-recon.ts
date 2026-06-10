import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";
import { discoverFields, withRetry } from "../runners/standard-evisa.js";

/**
 * Saudi e-Visa form recon (RUN-SA-001 / RUN-SA-002 / DATA-001).
 *
 *   npx ts-node src/sa/form-recon.ts
 *
 * Uses the shared recon retry/backoff + field-discovery helpers
 * (RUN-CORE-001). Read-only on the portal. SA_RECON_HEADFUL=1 to watch.
 */
export type { ReconField } from "../runners/standard-evisa.js";

const BASE_URL = process.env.SA_PORTAL_URL ?? "https://visa.visitsaudi.com";
const OUT_DIR = path.join(process.cwd(), "recon-out", "sa");

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
