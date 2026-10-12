import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { CEAC_URLS } from "../selectors";
import { hasVerifiedPostCaptchaSurface } from "../smoke";
import {
  solveStartPageCaptcha,
  solveStartPageCaptchaWithRetry,
  submitStartPageAction,
} from "../start-page-captcha";

const CAPTCHA_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("recovery clicks Retrieve without creating a new application", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <a href="#" id="lnkNew" onclick="document.body.dataset.created = 'yes'; return false">Start</a>
      <a href="#" id="lnkRetrieve" onclick="document.body.dataset.retrieved = 'yes'; return false">Retrieve</a>
    `);
    await submitStartPageAction(page, "retrieve");
    assert.equal(await page.locator("body").getAttribute("data-retrieved"), "yes");
    assert.equal(await page.locator("body").getAttribute("data-created"), null);
  } finally {
    await browser.close();
  }
});

function startPageHtml(initialLocation: string, includeCaptcha = true): string {
  return `
    <h2>Welcome</h2>
    <select id="ucLocation_ddlLocation">
      <option value="">Choose a location</option>
      <option value="BEJ"${initialLocation === "BEJ" ? " selected" : ""}>Beijing</option>
      <option value="NSS"${initialLocation === "NSS" ? " selected" : ""}>Nassau</option>
    </select>
    <a id="ucPostMessage_lnkClose" href="#" onclick="this.hidden = true; return false">Close</a>
    ${includeCaptcha ? `<img id="IdentifyCaptcha1_CaptchaImage" width="8" height="8" src="data:image/png;base64,${CAPTCHA_PNG}">
    <input id="IdentifyCaptcha1_txtCodeTextBox" type="text">` : ""}
  `;
}

test("preserves an explicit BEJ selection even when the environment says NSS", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const previousLocationCode = process.env.CEAC_LOCATION_CODE;
  const previousApiKey = process.env.TWOCAPTCHA_API_KEY;
  process.env.CEAC_LOCATION_CODE = "NSS";
  delete process.env.TWOCAPTCHA_API_KEY;
  try {
    await page.setContent(startPageHtml("NSS"));

    const outcome = await solveStartPageCaptcha(page, { startLocationCode: "BEJ" });

    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
      assert.match(outcome.reason, /2captcha solve failed/i);
    }
    assert.equal(await page.locator("#ucLocation_ddlLocation").inputValue(), "BEJ");
  } finally {
    if (previousLocationCode === undefined) delete process.env.CEAC_LOCATION_CODE;
    else process.env.CEAC_LOCATION_CODE = previousLocationCode;
    if (previousApiKey === undefined) delete process.env.TWOCAPTCHA_API_KEY;
    else process.env.TWOCAPTCHA_API_KEY = previousApiKey;
    await browser.close();
  }
});

test("fails closed when the start page has no selected consular post", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(startPageHtml("", false));

    const outcome = await solveStartPageCaptcha(page);

    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
      assert.match(outcome.reason, /location selection is blank/i);
    }
  } finally {
    await browser.close();
  }
});

test("requires a successful solve and a recognized post-CAPTCHA page", () => {
  const solve = { text: "AB12", solveId: "local", durationMs: 1 };

  assert.equal(hasVerifiedPostCaptchaSurface({ status: "no_captcha" }, "start"), false);
  assert.equal(hasVerifiedPostCaptchaSurface({ status: "no_captcha" }, "unknown"), false);
  assert.equal(hasVerifiedPostCaptchaSurface({ status: "no_captcha" }, "session_expired"), false);
  assert.equal(hasVerifiedPostCaptchaSurface({ status: "no_captcha" }, "confirm_application"), true);
  assert.equal(hasVerifiedPostCaptchaSurface({ status: "solved", solve }, "start"), false);
  assert.equal(hasVerifiedPostCaptchaSurface({ status: "solved", solve }, "personal_information_1"), true);
  assert.equal(
    hasVerifiedPostCaptchaSurface({ status: "failed", reason: "solver failed" }, "personal_information_1"),
    false,
  );
  assert.equal(
    hasVerifiedPostCaptchaSurface({ status: "wrong_answer", solve, validationHint: "wrong" }, "confirmation"),
    false,
  );
});

test("freezes BEJ across a start-page reload during CAPTCHA retry", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let loads = 0;
  const previousApiKey = process.env.TWOCAPTCHA_API_KEY;
  delete process.env.TWOCAPTCHA_API_KEY;
  try {
    await page.route(CEAC_URLS.START, async (route) => {
      loads += 1;
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: startPageHtml(loads === 1 ? "BEJ" : "NSS"),
      });
    });
    await page.goto(CEAC_URLS.START, { waitUntil: "commit" });

    await assert.rejects(
      () => solveStartPageCaptchaWithRetry(page, 2),
      /CAPTCHA solve failed after 2 attempts/i,
    );

    assert.equal(loads, 2);
    assert.equal(await page.locator("#ucLocation_ddlLocation").inputValue(), "BEJ");
  } finally {
    if (previousApiKey === undefined) delete process.env.TWOCAPTCHA_API_KEY;
    else process.env.TWOCAPTCHA_API_KEY = previousApiKey;
    await browser.close();
  }
});
