import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";
import { discoverFields, withRetry } from "../runners/standard-evisa.js";

/**
 * Canada eTA/TRV form recon (RUN-CA-001 / RUN-CA-002 / DATA-001).
 *   npx ts-node src/ca/form-recon.ts
 * Field discovery with shared retry/backoff. Read-only. CA_RECON_HEADFUL=1 to watch.
 */
const BASE_URL = process.env.CA_PORTAL_URL ?? "https://onlineservices-servicesenligne.cic.gc.ca/eta";
const OUT_DIR = path.join(process.cwd(), "recon-out", "ca");

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.CA_RECON_HEADFUL !== "1" });
  const page = await browser.newPage();
  try {
    await withRetry(() => page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }));
    await page.screenshot({ path: path.join(OUT_DIR, "landing.png"), fullPage: true });
    const fields = await discoverFields(page);
    fs.writeFileSync(path.join(OUT_DIR, "fields.json"), JSON.stringify(fields, null, 2));
    console.log(`[ca-recon] dumped ${fields.length} fields → ${OUT_DIR}/fields.json`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("form-recon.ts")) {
  main().catch((err) => {
    console.error("[ca-recon] error:", err);
    process.exit(1);
  });
}
