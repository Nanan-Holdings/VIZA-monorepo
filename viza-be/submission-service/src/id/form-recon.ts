import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";

/**
 * Indonesia e-Visa form recon (RUN-ID-001 / DATA-001).
 *
 *   npx ts-node src/id/form-recon.ts
 *
 * Navigates evisa.imigrasi.go.id and dumps the form's input/select fields
 * (name, id, type, label) + a screenshot to recon-out/id/, so the
 * best-effort selectors in field-mappings.ts can be promoted to real ones.
 * Read-only on the portal (no submit). Set ID_RECON_HEADFUL=1 to watch.
 */

const BASE_URL = process.env.ID_PORTAL_URL ?? "https://evisa.imigrasi.go.id";
const OUT_DIR = path.join(process.cwd(), "recon-out", "id");

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.ID_RECON_HEADFUL !== "1" });
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.screenshot({ path: path.join(OUT_DIR, "landing.png"), fullPage: true });

    const fields = await page.$$eval("input, select, textarea", (els) =>
      els.map((el) => {
        const e = el as HTMLInputElement;
        return { tag: e.tagName.toLowerCase(), name: e.name, id: e.id, type: e.type, placeholder: e.placeholder };
      }),
    );
    fs.writeFileSync(path.join(OUT_DIR, "fields.json"), JSON.stringify(fields, null, 2));
    console.log(`[id-recon] dumped ${fields.length} fields → ${OUT_DIR}/fields.json`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[id-recon] error:", err);
  process.exit(1);
});
