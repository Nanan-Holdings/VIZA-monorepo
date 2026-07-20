import { chromium } from "playwright";
import dotenv from "dotenv";
import path from "node:path";
import { writeSync } from "node:fs";

dotenv.config({ path: path.resolve(process.cwd(), "../../.agents/local-test-credentials.env") });

const email = process.env.VIZA_TEST_CLIENT_EMAIL;
const password = process.env.VIZA_TEST_CLIENT_PASSWORD;
if (!email || !password) throw new Error("Local client smoke credentials are unavailable.");

const applicationId = "7054b323-b3bc-438a-9aea-a5f97b57494a";

async function main(): Promise<void> {
  writeSync(1, "tdac-health-smoke:start\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
  await page.goto("http://127.0.0.1:3000/client/login", { waitUntil: "domcontentloaded" });
  const loginResponse = await page.request.post("http://127.0.0.1:3000/api/client/auth", {
    data: { operation: "password", email, password },
  });
  const loginResult = await loginResponse.json() as { success?: boolean; error?: string };
  if (!loginResult.success) {
    throw new Error(`Local client login failed: ${loginResult.error ?? "unknown error"}`);
  }

  await page.goto(
    `http://127.0.0.1:3000/client/application/long-form?applicationId=${applicationId}&country=TH&visaType=TH_TDAC_ARRIVAL_CARD`,
    { waitUntil: "domcontentloaded" },
  );
  await page.getByText(/健康申报|Health Declaration/i).first().waitFor({ timeout: 30_000 }).catch(async () => {
    const pageText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1_000);
    throw new Error(`TDAC health step unavailable at ${page.url()}: ${pageText}`);
  });
  await page.getByText(/健康申报|Health Declaration/i).first().click();
  await page.getByText(/Yellow Fever Vaccination Certificate/i).first().waitFor({ timeout: 15_000 });
  writeSync(1, "tdac-health-smoke:health-visible\n");

  const bodyText = await page.locator("body").innerText();
  const hasVisitedCountries = /Countries\/Territories where you stayed within two weeks before arrival/i.test(bodyText);
  const hasCertificateQuestion = /Do you have a Yellow Fever Vaccination Certificate/i.test(bodyText);
  const hasSymptomsQuestion = /Symptoms during the last 14 days/i.test(bodyText);

  if (!hasVisitedCountries || !hasCertificateQuestion || !hasSymptomsQuestion) {
    throw new Error("TDAC dynamic health questions did not render for the stored AGO risk-country answer.");
  }

  writeSync(1, `${JSON.stringify({
    passed: true,
    route: new URL(page.url()).pathname,
    riskCountry: "AGO",
    hasVisitedCountries,
    hasCertificateQuestion,
    hasSymptomsQuestion,
  })}\n`);
  } finally {
    await browser.close();
  }
}

const keepAlive = setInterval(() => undefined, 1_000);
main().then(
  () => clearInterval(keepAlive),
  (error: unknown) => {
    clearInterval(keepAlive);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  },
);
