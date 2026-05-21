/**
 * Cambodia e-Visa public-portal recon.
 *
 * Walks evisa.gov.kh — the public, account-less Tourist e-Visa portal —
 * captures the landing page and the application start surface so we can
 * map fields without burning real-portal state.
 *
 * Phase A: read-only. No registration, no submission. Outputs go to
 * `recon-out/kh/` and `docs/cambodia-visa-recon-<date>.json`.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node src/kh/form-recon.ts
 *
 * Env knobs:
 *   RECON_HEADFUL=1   show the browser (default headless)
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runPortalRecon, type ReconPageStep } from "../recon/walker";

const BASE_URL = process.env.KH_RECON_BASE_URL || "https://www.evisa.gov.kh";
const OUT_DIR = path.resolve(__dirname, "../../recon-out/kh");

const PAGES: ReconPageStep[] = [
  {
    slug: "01-landing",
    description: "Public landing page",
    navigate: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    slug: "02-application-new",
    description: "New application form (Livewire SPA route)",
    navigate: async (page) => {
      await page.goto(`${BASE_URL}/application_new`, { waitUntil: "domcontentloaded" });
    },
  },
];

async function main() {
  const result = await runPortalRecon({
    countryCode: "kh",
    baseUrl: BASE_URL,
    outDir: OUT_DIR,
    pages: PAGES,
  });

  const reportPath = path.resolve(
    __dirname,
    `../../../../docs/cambodia-visa-recon-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await fs.writeFile(
    reportPath,
    JSON.stringify({ countryCode: "kh", baseUrl: BASE_URL, walks: result.walks }, null, 2),
    "utf8",
  );
  console.log(`[recon:kh] copied summary → ${reportPath}`);
}

main().catch((err) => {
  console.error("[recon:kh] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
