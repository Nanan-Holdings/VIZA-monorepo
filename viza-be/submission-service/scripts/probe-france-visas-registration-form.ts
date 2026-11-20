#!/usr/bin/env npx tsx
/**
 * Opens the France-Visas registration form in the worker's Browserbase
 * session and lists its form controls (tag, type, name, id, label). It types
 * nothing and submits nothing; use it when registration selectors stop
 * matching.
 *
 *   npx tsx scripts/probe-france-visas-registration-form.ts
 */
import "dotenv/config";
import { launchFvBrowser } from "../src/france-visas/browser";
import { ENTRY_RENDER_TIMEOUT_MS, waitForRenderedPage } from "../src/france-visas/gates";
import { FV_URLS } from "../src/france-visas/selectors";

async function main(): Promise<void> {
  const { page, browser } = await launchFvBrowser({ headless: true, acceptDownloads: false });
  try {
    await page.goto(FV_URLS.ACCUEIL.replace(/\/accueil\.xhtml$/, "/"), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
    const create = page
      .locator('button:has-text("Create an account"), a:has-text("Create an account"), button:has-text("Créer un compte"), a:has-text("Créer un compte")')
      .first();
    await create.waitFor({ state: "visible", timeout: 30_000 });
    await create.click();
    await page.waitForURL(/login-actions\/registration/i, { timeout: 30_000 }).catch(() => undefined);
    await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
    await page.waitForTimeout(2_000);

    const controls = await page.evaluate(`(() => Array.from(document.querySelectorAll("input, select, textarea, button")).map((el) => {
      const id = el.getAttribute("id") || "";
      const label = id ? (document.querySelector('label[for="' + id + '"]')?.textContent || "").trim() : "";
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        name: el.getAttribute("name") || "",
        id,
        label: label.slice(0, 60),
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      };
    }))()`);
    console.log(JSON.stringify({ url: page.url().replace(/[?#].*$/, ""), title: await page.title(), controls }, null, 1));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
