#!/usr/bin/env npx tsx
/**
 * Opens the France-Visas application entry page in the same Browserbase
 * session the worker uses, waits for it to render the way sign-in does, and
 * reports what it shows (URL, title, visible text length, recognized state). It never signs in and sends
 * no applicant data.
 *
 *   npx tsx scripts/probe-france-visas-entry.ts
 */
import "dotenv/config";
import { classifyFranceVisasBrowserState, launchFvBrowser } from "../src/france-visas/browser";
import { FV_URLS } from "../src/france-visas/selectors";
import { ENTRY_RENDER_TIMEOUT_MS, waitForRenderedPage } from "../src/france-visas/sign-in";

async function main(): Promise<void> {
  const handles = await launchFvBrowser({ headless: true, acceptDownloads: false });
  const { page, browser } = handles;
  const startedAt = Date.now();
  try {
    await page.goto(FV_URLS.ACCUEIL.replace(/\/accueil\.xhtml$/, "/"), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // Same wait the worker uses before judging the page.
    await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
    {
      const title = await page.title().catch(() => "");
      const bodyText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
      const state = classifyFranceVisasBrowserState({ url: page.url(), title, bodyText });
      console.log(JSON.stringify({
        t: Date.now() - startedAt,
        url: page.url().replace(/[?#].*$/, ""),
        title,
        bodyLength: bodyText.trim().length,
        checkpoint: state.checkpoint,
      }));
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
