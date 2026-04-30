/**
 * South Africa eVisa public-portal recon.
 *
 * Walks evisa.gov.za — eVisa pilot for selected nationalities (CN, IN,
 * NG, …). Public + account-less for the application form (a Home Affairs
 * account is created during application). Phase A read-only.
 *
 * Outputs to `recon-out/za/` + `docs/south-africa-visa-recon-<date>.json`.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node src/za/form-recon.ts
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runPortalRecon, type ReconPageStep } from "../recon/walker";

const BASE_URL = process.env.ZA_RECON_BASE_URL || "https://www.evisa.gov.za";
const OUT_DIR = path.resolve(__dirname, "../../recon-out/za");

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
    description: "Start eVisa application",
    navigate: async (page) => {
      const link = page.locator('a:has-text("Apply"), a:has-text("Start"), a[href*="apply"]').first();
      if ((await link.count()) > 0) {
        await link.click({ timeout: 10_000 });
      } else {
        await page.goto(`${BASE_URL}/apply`, { waitUntil: "domcontentloaded" });
      }
    },
  },
  {
    slug: "03-register",
    description: "Account creation form (read-only — do NOT submit)",
    navigate: async (page) => {
      const link = page.locator('a:has-text("Register"), a:has-text("Sign Up"), a[href*="register"]').first();
      if ((await link.count()) > 0) {
        await link.click({ timeout: 10_000 });
      }
    },
  },
];

async function main() {
  const result = await runPortalRecon({
    countryCode: "za",
    baseUrl: BASE_URL,
    outDir: OUT_DIR,
    pages: PAGES,
  });

  const reportPath = path.resolve(
    __dirname,
    `../../../../docs/south-africa-visa-recon-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await fs.writeFile(
    reportPath,
    JSON.stringify({ countryCode: "za", baseUrl: BASE_URL, walks: result.walks }, null, 2),
    "utf8",
  );
  console.log(`[recon:za] copied summary → ${reportPath}`);
}

main().catch((err) => {
  console.error("[recon:za] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
