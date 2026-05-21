/**
 * Laos Tourist e-Visa public-portal recon.
 *
 * Walks laoevisa.gov.la — public, account-less. Phase A read-only.
 * Outputs to `recon-out/la/` + `docs/laos-visa-recon-<date>.json`.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node src/la/form-recon.ts
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runPortalRecon, type ReconPageStep } from "../recon/walker";

const BASE_URL = process.env.LA_RECON_BASE_URL || "https://laoevisa.gov.la";
const OUT_DIR = path.resolve(__dirname, "../../recon-out/la");

const PAGES: ReconPageStep[] = [
  {
    slug: "01-landing",
    description: "Public landing page",
    navigate: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    slug: "02-apply",
    description: "Start application",
    navigate: async (page) => {
      const link = page.locator('a:has-text("Apply"), a[href*="/apply"], a[href*="/start"]').first();
      if ((await link.count()) > 0) {
        await link.click({ timeout: 10_000 });
      } else {
        await page.goto(`${BASE_URL}/apply`, { waitUntil: "domcontentloaded" });
      }
    },
  },
];

async function main() {
  const result = await runPortalRecon({
    countryCode: "la",
    baseUrl: BASE_URL,
    outDir: OUT_DIR,
    pages: PAGES,
  });

  const reportPath = path.resolve(
    __dirname,
    `../../../../docs/laos-visa-recon-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await fs.writeFile(
    reportPath,
    JSON.stringify({ countryCode: "la", baseUrl: BASE_URL, walks: result.walks }, null, 2),
    "utf8",
  );
  console.log(`[recon:la] copied summary → ${reportPath}`);
}

main().catch((err) => {
  console.error("[recon:la] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
