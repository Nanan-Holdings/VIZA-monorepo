import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createFranceTlsBrowserSession,
  readFranceTlsBrowserState,
  waitForFranceTlsCloudflareClearance,
} from "../src/france-tls/browser-api";
import { solveVisibleRecaptchaGridChallenge } from "../src/france-tls/recaptcha-grid";

interface SmokeResult {
  provider: string;
  source: string;
  url: string;
  title: string;
  checkpoint: string;
  message: string;
  screenshot: string;
  afterScreenshot?: string;
  bodySample: string;
  grid?: {
    status: string;
    reason?: string | null;
    solveCount: number;
  };
}

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function artifactPath(prefix: string): string {
  const dir = path.resolve("artifacts");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${prefix}-${Date.now()}.png`);
}

async function main(): Promise<void> {
  const targetUrl = readArg("url") || "https://visas-fr.tlscontact.com/en-us/login";
  const session = await createFranceTlsBrowserSession();
  try {
    await session.page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const stateAfterClearance = await waitForFranceTlsCloudflareClearance(session.page, {
      timeoutMs: Number.parseInt(process.env.FRANCE_TLS_CLOUDFLARE_WAIT_MS ?? "120000", 10),
      solveProviderCaptcha: true,
    });

    let grid: SmokeResult["grid"];
    if (stateAfterClearance.checkpoint === "captcha_grid") {
      const outcome = await solveVisibleRecaptchaGridChallenge(session.page, {
        maxRounds: Number.parseInt(process.env.FRANCE_TLS_RECAPTCHA_GRID_MAX_ROUNDS ?? "3", 10),
        timeoutMs: Number.parseInt(process.env.FRANCE_TLS_RECAPTCHA_GRID_TIMEOUT_MS ?? "180000", 10),
      });
      grid = {
        status: outcome.status,
        reason: "reason" in outcome ? outcome.reason : null,
        solveCount: "solves" in outcome ? outcome.solves.length : 0,
      };
    }

    const finalStateInput = await readFranceTlsBrowserState(session.page);
    const screenshot = artifactPath("france-tls-live-browser-smoke");
    await session.page.screenshot({ path: screenshot, fullPage: false, timeout: 30_000 }).catch(() => undefined);

    const result: SmokeResult = {
      provider: session.provider,
      source: session.source,
      url: finalStateInput.url,
      title: finalStateInput.title,
      checkpoint: stateAfterClearance.checkpoint,
      message: stateAfterClearance.message,
      screenshot,
      bodySample: finalStateInput.bodyText.replace(/\s+/g, " ").slice(0, 900),
      grid,
    };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await session.browser.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    checkpoint: "france_tls_live_smoke_failed",
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
