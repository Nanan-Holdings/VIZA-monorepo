import "dotenv/config";
import * as fs from "node:fs";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";

async function main() {
  const reportPath = process.env.KR_KVAC_SHENYANG_REPORT_PATH?.trim();
  const checkpoint = (stage: string) => {
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ stage }, null, 2), "utf8");
  };
  const writeReport = (value: unknown) => {
    const text = JSON.stringify(value, null, 2);
    if (reportPath) fs.writeFileSync(reportPath, text, "utf8");
    process.stdout.write(text);
  };
  try {
    checkpoint("creating_browserbase_session");
    const cloud = await connectBrowserbaseCloudBrowser({ prefix: "KR_KVAC_SHENYANG" });
    try {
      checkpoint("browserbase_connected");
      const response = await cloud.page.goto("https://visaforkorea-sy030.com/en/schedule-an-appointment.html", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      checkpoint("official_page_loaded");
      await cloud.page.waitForTimeout(3_000);
      const applyNow = cloud.page.getByRole("link", { name: /apply now/i }).first();
      const applyNowUrl = await applyNow.getAttribute("href").catch(() => null);
      let bookingEntry: Record<string, unknown> | null = null;
      if (applyNowUrl) {
        checkpoint("opening_vfs_booking_entry");
        const bookingResponse = await cloud.page.goto(new URL(applyNowUrl, cloud.page.url()).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        await cloud.page.waitForTimeout(5_000);
        bookingEntry = {
          status: bookingResponse?.status() ?? null,
          finalUrl: cloud.page.url(),
          title: await cloud.page.title(),
          bodySample: (await cloud.page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 800),
        };
      }
      writeReport({
        provider: "browserbase",
        status: response?.status() ?? null,
        finalUrl: cloud.page.url(),
        title: await cloud.page.title(),
        bodySample: (await cloud.page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 800),
        replayAvailable: Boolean(cloud.replayUrl),
        bookingEntry,
      });
    } finally {
      await cloud.browser.close().catch(() => undefined);
    }
  } catch (error) {
    writeReport({
      provider: "browserbase",
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

void main();
