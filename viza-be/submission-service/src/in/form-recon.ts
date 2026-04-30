/**
 * India e-Visa public-portal recon.
 *
 * Walks indianvisaonline.gov.in/evisa — Bureau of Immigration e-Visa for
 * Tourist / Business / Medical / Conference categories. Public, no
 * preregistered account required. Phase A read-only.
 *
 * Outputs to `recon-out/in/` + `docs/india-visa-recon-<date>.json`.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node src/in/form-recon.ts
 */
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runPortalRecon, type ReconPageStep } from "../recon/walker";

const BASE_URL =
  process.env.IN_RECON_BASE_URL || "https://indianvisaonline.gov.in/evisa/tvoa.html";
const OUT_DIR = path.resolve(__dirname, "../../recon-out/in");

const PAGES: ReconPageStep[] = [
  {
    slug: "01-landing",
    description: "Public e-Visa landing page",
    navigate: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    slug: "02-apply",
    description: "Apply / new application",
    navigate: async (page) => {
      const link = page.locator('a:has-text("Apply"), a:has-text("New"), a[href*="Registration"]').first();
      if ((await link.count()) > 0) {
        await link.click({ timeout: 10_000 });
      } else {
        await page.goto(
          "https://indianvisaonline.gov.in/evisa/Registration",
          { waitUntil: "domcontentloaded" },
        );
      }
    },
  },
];

async function main() {
  const result = await runPortalRecon({
    countryCode: "in",
    baseUrl: BASE_URL,
    outDir: OUT_DIR,
    pages: PAGES,
  });

  const reportPath = path.resolve(
    __dirname,
    `../../../../docs/india-visa-recon-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await fs.writeFile(
    reportPath,
    JSON.stringify({ countryCode: "in", baseUrl: BASE_URL, walks: result.walks }, null, 2),
    "utf8",
  );
  console.log(`[recon:in] copied summary → ${reportPath}`);
}

main().catch((err) => {
  console.error("[recon:in] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
