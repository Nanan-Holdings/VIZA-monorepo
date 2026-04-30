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
    slug: "02-visainfo-center",
    description: "Visa info center (locale picker)",
    navigate: async (page) => {
      await page.goto(`${BASE_URL}/slvisa/visainfo/center.jsp?locale=en_US`, {
        waitUntil: "domcontentloaded",
      });
    },
  },
  {
    slug: "03-apply",
    description: "ETA application — Apply for Individual",
    navigate: async (page) => {
      // The visa-info center page links to `apply.jsp` for the Tourist
      // ETA flow. Direct goto bypasses the locale chooser.
      await page.goto(`${BASE_URL}/slvisa/visainfo/apply.jsp?locale=en_US`, {
        waitUntil: "domcontentloaded",
      });
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
