import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";
import { discoverFields, withRetry } from "../runners/standard-evisa.js";

/** Thailand eVisa form recon (RUN-TH-001/002 / DATA-001). npx ts-node src/th/form-recon.ts */
const BASE_URL = process.env.TH_PORTAL_URL ?? "https://www.thaievisa.go.th";
const OUT_DIR = path.join(process.cwd(), "recon-out", "th");

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.TH_RECON_HEADFUL !== "1" });
  const page = await browser.newPage();
  try {
    await withRetry(() => page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 }));
    await page.screenshot({ path: path.join(OUT_DIR, "landing.png"), fullPage: true });
    const fields = await discoverFields(page);
    fs.writeFileSync(path.join(OUT_DIR, "fields.json"), JSON.stringify(fields, null, 2));
    console.log(`[th-recon] dumped ${fields.length} fields → ${OUT_DIR}/fields.json`);
  } finally {
    await browser.close();
  }
}
if (process.argv[1] && process.argv[1].endsWith("form-recon.ts")) {
  main().catch((err) => { console.error("[th-recon] error:", err); process.exit(1); });
}
