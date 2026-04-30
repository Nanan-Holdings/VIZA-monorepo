/**
 * Sri Lanka ETA public-portal recon.
 *
 * Walks eta.gov.lk — public, account-less. Phase A read-only.
 * Outputs to `recon-out/lk/` + `docs/sri-lanka-visa-recon-<date>.json`.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node src/lk/form-recon.ts
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runPortalRecon, type ReconPageStep } from "../recon/walker";

const BASE_URL = process.env.LK_RECON_BASE_URL || "https://www.eta.gov.lk";
const OUT_DIR = path.resolve(__dirname, "../../recon-out/lk");

const PAGES: ReconPageStep[] = [
  {
    slug: "01-landing",
    description: "Public landing page",
    navigate: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    slug: "02-apply-individual",
    description: "Apply (individual)",
    navigate: async (page) => {
      const link = page.locator('a:has-text("Apply"), a:has-text("Individual"), a[href*="apply"]').first();
      if ((await link.count()) > 0) {
        await link.click({ timeout: 10_000 });
      } else {
        await page.goto(`${BASE_URL}/slvisa/visainfo/center.jsp`, { waitUntil: "domcontentloaded" });
      }
    },
  },
];

async function main() {
  const result = await runPortalRecon({
    countryCode: "lk",
    baseUrl: BASE_URL,
    outDir: OUT_DIR,
    pages: PAGES,
  });

  const reportPath = path.resolve(
    __dirname,
    `../../../../docs/sri-lanka-visa-recon-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await fs.writeFile(
    reportPath,
    JSON.stringify({ countryCode: "lk", baseUrl: BASE_URL, walks: result.walks }, null, 2),
    "utf8",
  );
  console.log(`[recon:lk] copied summary → ${reportPath}`);
}

main().catch((err) => {
  console.error("[recon:lk] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
