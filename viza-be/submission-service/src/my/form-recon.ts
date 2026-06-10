import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";
import { discoverFields, withRetry } from "../runners/standard-evisa.js";

/**
 * Malaysia eVISA/MDAC form recon (RUN-MY-001 / RUN-MY-002 / DATA-001).
 *
 *   npx ts-node src/my/form-recon.ts
 *
 * Uses the shared recon retry/backoff + field-discovery helpers
 * (RUN-CORE-001). Read-only. MY_RECON_HEADFUL=1 to watch.
 */
export type { ReconField } from "../runners/standard-evisa.js";

const BASE_URL = process.env.MY_PORTAL_URL ?? "https://malaysiavisa.imi.gov.my";
const OUT_DIR = path.join(process.cwd(), "recon-out", "my");

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
