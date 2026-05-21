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

// `evisa.gov.za` does not resolve and `ehome.dha.gov.za` returns 403/404
// for public paths (DNS + curl probed 2026-04-30 — that host is the
// internal Home Affairs portal). The real public application route for
// the South Africa Visitor's Visa is VFS Global at
// `visa.vfsglobal.com/zaf/en/dha`. Override via ZA_RECON_BASE_URL.
const BASE_URL = process.env.ZA_RECON_BASE_URL || "https://visa.vfsglobal.com/zaf/en/dha";
const OUT_DIR = path.resolve(__dirname, "../../recon-out/za");

const PAGES: ReconPageStep[] = [
  {
    slug: "01-landing",
    description: "VFS Global ZA-DHA landing",
    navigate: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    slug: "02-attend-centre",
    description: "Attend a VFS centre — visa-type chooser",
    navigate: async (page) => {
      await page.goto(`${BASE_URL}/attend-centre`, { waitUntil: "domcontentloaded" });
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
