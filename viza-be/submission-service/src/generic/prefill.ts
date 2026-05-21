import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";

/**
 * Shared generic prefill-runner harness used by Tier-3 country runners
 * (AUTO-T3-*). Each per-country file passes a config: BASE_URL, locale,
 * country code prefix (artefact paths), an `applyOpener` selector list,
 * and a `fillForm(page, answers)` callback.
 *
 * Halts before payment/signature; uploads per-step PNG + post-run HAR.
 */

export interface GenericRunInput<A> {
  jobId: string;
  applicationId: string;
  answers: A;
  headless?: boolean;
}

export interface GenericRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

export interface GenericRunnerConfig<A> {
  /** Country code used in artefact filenames (e.g. "id", "eg"). */
  cc: string;
  baseUrl: string;
  locale?: string;
  applyOpener?: string[];
  /** Returns the reached step label string. */
  fillForm: (page: Page, answers: A) => Promise<string>;
}

export async function runGenericPrefill<A>(
  cfg: GenericRunnerConfig<A>,
  input: GenericRunInput<A>,
): Promise<GenericRunResult> {
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), `${cfg.cc}-har-`));
  const harPath = path.join(tempHar, `${cfg.cc}-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: cfg.locale ?? "en-US",
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await ctx.newPage();

  const artefactPaths: string[] = [];
  let attemptCount = 0;
  const captureStep = async (name: string): Promise<void> => {
    attemptCount += 1;
    const idx = String(attemptCount).padStart(2, "0");
    try {
      const png = await page.screenshot({ fullPage: true });
      const ref = await artifact.put(input.jobId, `${cfg.cc}-step-${idx}-${name}.png`, png, {
        contentType: "image/png",
        upsert: true,
      });
      artefactPaths.push(ref.path);
    } catch (err) {
      console.error(`[${cfg.cc}] screenshot ${name} failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  const result: GenericRunResult = {
    status: "blocked",
    reason: "runner did not reach checkpoint",
    reachedStep: "init",
    artefacts: [],
  };

  try {
    await page.goto(cfg.baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await captureStep("landing");
    result.reachedStep = "landing";

    // Anti-bot gate detection
    const title = (await page.title()).toLowerCase();
    if (title.includes("just a moment")) {
      result.status = "anti_bot_gate";
      result.reason = "anti-bot interstitial blocked the runner";
      return result;
    }

    if (cfg.applyOpener && cfg.applyOpener.length > 0) {
      let opened = false;
      for (const sel of cfg.applyOpener) {
        try {
          await page.click(sel, { timeout: 5_000 });
          opened = true;
          break;
        } catch {
          // try next
        }
      }
      if (!opened) {
        // Fall back to base URL — many portals already serve the form there.
      }
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await captureStep("apply");
      result.reachedStep = "apply";
    }

    const reached = await cfg.fillForm(page, input.answers);
    await captureStep(reached);
    result.reachedStep = reached;

    result.status = "stopped_before_pay";
    result.reason = "runner halted at the checkpoint before payment";
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Timeout/i.test(msg)) {
      result.status = "blocked";
      result.reason = `timeout: ${msg}`;
    } else {
      result.reason = msg;
    }
    await captureStep("error");
    return result;
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
    try {
      const harBytes = fs.readFileSync(harPath);
      const ref = await artifact.put(input.jobId, `${cfg.cc}-network.har`, harBytes, {
        contentType: "application/json",
        upsert: true,
      });
      artefactPaths.push(ref.path);
    } catch {
      // HAR may not exist
    }
    fs.rmSync(tempHar, { recursive: true, force: true });
    result.artefacts = artefactPaths;
  }
}

/** Helper: fill an input by selector, swallowing miss errors. */
export async function gFill(
  page: Page,
  selector: string,
  value: string | undefined,
): Promise<void> {
  if (!value) return;
  try {
    await page.fill(selector, value, { timeout: 5_000 });
  } catch {
    // selector miss — caller can layer alternates
  }
}

/** Helper: click first matching selector; returns true if any clicked. */
export async function gClick(page: Page, selectors: string[]): Promise<boolean> {
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 5_000 });
      return true;
    } catch {
      // try next
    }
  }
  return false;
}
