import "dotenv/config";
import * as fs from "node:fs";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";

type AppointmentStage = "public_entry" | "login" | "slots" | "unknown";

interface PageObservation {
  status: number | null;
  finalUrl: string;
  title: string;
  bodySample: string;
  botChallenge: boolean;
  enteredActualAppointmentSystem: boolean;
  appointmentStage: AppointmentStage;
}

const BOT_CHALLENGE_PATTERN = /access denied|attention required|checking your browser|captcha|cloudflare|human verification|security verification|turnstile|unusual traffic|verify you are human|web page blocked|request rejected/i;

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "[UNAVAILABLE]";
  }
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/wss?:\/\/\S+/gi, "[redacted-browser-endpoint]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]");
}

function classifyAppointmentPage(finalUrl: string, title: string, bodySample: string): Pick<
  PageObservation,
  "botChallenge" | "enteredActualAppointmentSystem" | "appointmentStage"
> {
  const evidence = `${finalUrl}\n${title}\n${bodySample}`;
  const botChallenge = BOT_CHALLENGE_PATTERN.test(evidence);
  let enteredActualAppointmentSystem = false;
  let appointmentStage: AppointmentStage = "unknown";
  try {
    const url = new URL(finalUrl);
    const isVfsKorea = /^visa\.vfsglobal\.com$/i.test(url.hostname)
      && /^\/chn\/en\/kor(?:\/|$)/i.test(url.pathname);
    enteredActualAppointmentSystem = isVfsKorea;
    if (!isVfsKorea) {
      appointmentStage = "public_entry";
    } else if (/\/login(?:\/|$)/i.test(url.pathname) || /sign in|email and password/i.test(evidence)) {
      appointmentStage = "login";
    } else if (/appointment|calendar|slot|schedule/i.test(`${url.pathname}\n${evidence}`)) {
      appointmentStage = "slots";
    } else {
      appointmentStage = "unknown";
    }
  } catch {
    appointmentStage = "unknown";
  }
  return { botChallenge, enteredActualAppointmentSystem, appointmentStage };
}

async function observePage(
  page: Awaited<ReturnType<typeof connectBrowserbaseCloudBrowser>>["page"],
  status: number | null,
): Promise<PageObservation> {
  const finalUrl = safeUrl(page.url());
  const title = await page.title().catch(() => "");
  const bodySample = (await page.locator("body").innerText().catch(() => ""))
    .replace(/\s+/g, " ")
    .slice(0, 800);
  return {
    status,
    finalUrl,
    title,
    bodySample,
    ...classifyAppointmentPage(finalUrl, title, bodySample),
  };
}

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
      const officialPage = await observePage(cloud.page, response?.status() ?? null);
      const applyNow = cloud.page.getByRole("link", { name: /apply now/i }).first();
      const applyNowUrl = await applyNow.getAttribute("href").catch(() => null);
      let bookingEntry: PageObservation | null = null;
      if (applyNowUrl) {
        checkpoint("opening_vfs_booking_entry");
        const bookingResponse = await cloud.page.goto(new URL(applyNowUrl, cloud.page.url()).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        await cloud.page.waitForTimeout(5_000);
        bookingEntry = await observePage(cloud.page, bookingResponse?.status() ?? null);
      }
      writeReport({
        provider: "browserbase",
        proxyCountry: cloud.proxiesEnabled
          ? process.env.KR_KVAC_SHENYANG_BROWSERBASE_COUNTRY?.trim().toUpperCase() ?? null
          : null,
        proxiesEnabled: cloud.proxiesEnabled,
        ...officialPage,
        replayAvailable: Boolean(cloud.replayUrl),
        bookingEntry,
      });
    } finally {
      await cloud.browser.close().catch(() => undefined);
    }
  } catch (error) {
    writeReport({
      provider: "browserbase",
      proxyCountry: process.env.KR_KVAC_SHENYANG_BROWSERBASE_PROXIES?.trim().toLowerCase() === "false"
        ? null
        : process.env.KR_KVAC_SHENYANG_BROWSERBASE_COUNTRY?.trim().toUpperCase() ?? null,
      error: safeErrorMessage(error),
    });
    process.exitCode = 1;
  }
}

void main();
