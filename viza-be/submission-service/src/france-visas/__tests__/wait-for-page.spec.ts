import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { waitForPage } from "../pages";
import { GateDetectedError } from "../errors";

const REGISTRATION_URL =
  "https://connect.france-visas.gouv.fr/realms/france-visas/login-actions/registration?tab_id=test";

async function launch(t: test.TestContext): Promise<Browser | null> {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    t.skip("Playwright Chromium is not installed here");
    return null;
  }
}

/** Serves an empty page at the registration URL; `script` may draw it later. */
async function openBlankRegistration(browser: Browser, script: string): Promise<Page> {
  const page = await browser.newPage();
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head></head><body><script>${script}</script></body></html>`,
    }),
  );
  await page.goto(REGISTRATION_URL);
  return page;
}

test("waitForPage waits out the blank render window of a France-Visas page", async (t) => {
  const browser = await launch(t);
  if (!browser) return;
  try {
    const page = await openBlankRegistration(
      browser,
      `setTimeout(() => {
        document.title = "France-Visas";
        document.body.insertAdjacentHTML("beforeend", "<h1>Create an account</h1>");
      }, 1200);`,
    );
    assert.equal(await waitForPage(page, "registration", { timeoutMs: 10_000, pollIntervalMs: 100 }), "registration");
  } finally {
    await browser.close();
  }
});

test("waitForPage reports a page that stays blank as a security checkpoint", async (t) => {
  const browser = await launch(t);
  if (!browser) return;
  try {
    const page = await openBlankRegistration(browser, "");
    await assert.rejects(
      waitForPage(page, "registration", { timeoutMs: 1_000, pollIntervalMs: 100 }),
      (error: unknown) =>
        error instanceof GateDetectedError && /security checkpoint detected \(blank\)/.test(error.message),
    );
  } finally {
    await browser.close();
  }
});
