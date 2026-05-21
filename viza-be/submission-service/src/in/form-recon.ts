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
    slug: "02-registration",
    description: "Apply Here for e-Visa (click from landing — Referer-gated)",
    navigate: async (page) => {
      // Direct goto to /evisa/Registration server-side redirects back
      // to tvoa.html when the Referer header is missing. Clicking the
      // landing-page link preserves the session + Referer so the
      // Registration page actually renders.
      const link = page
        .locator('a[href="Registration"], a[title="e-Visa Application"]')
        .first();
      await link.waitFor({ state: "visible", timeout: 15_000 });
      await link.click({ timeout: 10_000 });
      await page.waitForLoadState("domcontentloaded");
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
