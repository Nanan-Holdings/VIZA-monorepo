import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { connectBrowserbaseCloudBrowser } from "./browserbase-session";
import { CEAC_URLS } from "./ceac/selectors";
import { FV_URLS } from "./france-visas/selectors";
import {
  INDONESIA_B1_EVOA_PORTAL_URL,
  INDONESIA_C1_PORTAL_URL,
} from "./indonesia";
import { SGAC_OFFICIAL_PORTAL_URL } from "./sgac/runner";
import { TDAC_OFFICIAL_PORTAL_URL } from "./tdac/normalize";

type PortalProvider = "local" | "browserbase";

interface PortalTarget {
  id: string;
  prefix: string;
  url: string;
  expected: RegExp;
}

const targets: readonly PortalTarget[] = [
  { id: "indonesia-b1", prefix: "INDONESIA", url: INDONESIA_B1_EVOA_PORTAL_URL, expected: /e-?visa|immigration|visa/i },
  { id: "indonesia-c1", prefix: "INDONESIA", url: INDONESIA_C1_PORTAL_URL, expected: /e-?visa|immigration|visa/i },
  { id: "vietnam-evisa", prefix: "VN", url: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/", expected: /e-?visa|immigration|foreigners/i },
  { id: "singapore-sgac", prefix: "SGAC", url: SGAC_OFFICIAL_PORTAL_URL, expected: /arrival card|sgac|foreign visitor|ica/i },
  { id: "thailand-tdac", prefix: "TDAC", url: TDAC_OFFICIAL_PORTAL_URL, expected: /arrival card|tdac|immigration|thailand/i },
  { id: "united-states-ds160", prefix: "CEAC", url: CEAC_URLS.START, expected: /nonimmigrant visa|ds-?160|start an application|ceac|human visitor|support id/i },
  { id: "france-visas", prefix: "FRANCE_VISAS", url: FV_URLS.ACCUEIL, expected: /france-visas|visa application|connectez|sign in|log in/i },
];

const blockedPattern = /access denied|attention required|checking your browser|web page blocked|request rejected|error\s*(?:403|1020)/i;
const captchaPattern = /captcha|human visitor|what code is in the image|verify you are human/i;

function readProvider(): PortalProvider {
  return process.env.PORTAL_CONNECTIVITY_PROVIDER?.trim().toLowerCase() === "browserbase"
    ? "browserbase"
    : "local";
}

async function runTarget(target: PortalTarget, provider: PortalProvider, artifactDir: string) {
  let browser: Browser | null = null;
  let replayUrl: string | undefined;
  try {
    let page;
    if (provider === "browserbase") {
      const cloud = await connectBrowserbaseCloudBrowser({ prefix: target.prefix });
      browser = cloud.browser;
      page = cloud.page;
      replayUrl = cloud.replayUrl;
    } else {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      page = await context.newPage();
    }
    const response = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3_000);
    const title = await page.title().catch(() => "");
    const body = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const evidenceText = `${title}\n${body.slice(0, 20_000)}`;
    const blocked = blockedPattern.test(evidenceText);
    const captchaDetected = captchaPattern.test(evidenceText);
    const markerFound = target.expected.test(evidenceText);
    fs.mkdirSync(artifactDir, { recursive: true });
    const screenshotPath = path.join(artifactDir, `${provider}-${target.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    return {
      id: target.id,
      provider,
      ok: !blocked && markerFound && (response?.status() ?? 200) < 400,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      title,
      blocked,
      captchaDetected,
      markerFound,
      screenshotPath,
      ...(replayUrl ? { replayUrl } : {}),
    };
  } catch (error) {
    return {
      id: target.id,
      provider,
      ok: false,
      error: error instanceof Error ? error.message.split("\n")[0] : String(error),
      ...(replayUrl ? { replayUrl } : {}),
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const provider = readProvider();
  const artifactDir = path.resolve(process.env.PORTAL_CONNECTIVITY_ARTIFACT_DIR ?? "artifacts/portal-connectivity");
  const requestedTargets = new Set(
    (process.env.PORTAL_CONNECTIVITY_TARGETS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const selectedTargets = requestedTargets.size > 0
    ? targets.filter((target) => requestedTargets.has(target.id))
    : targets;
  const results = [];
  for (const target of selectedTargets) {
    results.push(await runTarget(target, provider, artifactDir));
  }
  const passed = results.filter((result) => result.ok).length;
  console.log(JSON.stringify({ provider, passed, total: selectedTargets.length, results }, null, 2));
  if (passed !== results.length) process.exitCode = 1;
}

void main();
