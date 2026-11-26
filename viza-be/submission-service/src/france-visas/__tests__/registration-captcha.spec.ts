import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { solveRegistrationCaptcha } from "../registration-captcha";

// 1x1 PNG, enough for a loaded <img> with a natural size.
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function launch(t: test.TestContext): Promise<Browser | null> {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    t.skip("Playwright Chromium is not installed here");
    return null;
  }
}

test("a CAPTCHA injected after the form renders is still solved, not skipped", async (t) => {
  const browser = await launch(t);
  if (!browser) return;
  const previousKey = process.env.TWOCAPTCHA_API_KEY;
  // No key: the solver stops at the 2Captcha config check, after it has
  // found and loaded the image, without any network call.
  delete process.env.TWOCAPTCHA_API_KEY;
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <form><input name="captchaFormulaireExtInput"></form>
      <script>
        setTimeout(() => {
          const img = document.createElement("img");
          img.id = "captchaImage";
          img.width = 120;
          img.height = 40;
          img.src = ${JSON.stringify(PIXEL)};
          document.querySelector("form").prepend(img);
        }, 1200);
      </script>`);

    const outcome = await solveRegistrationCaptcha(page);

    assert.equal(outcome.status, "failed");
    assert.match(outcome.status === "failed" ? outcome.reason : "", /2captcha solve failed: TWOCAPTCHA_API_KEY/);
  } finally {
    if (previousKey === undefined) delete process.env.TWOCAPTCHA_API_KEY;
    else process.env.TWOCAPTCHA_API_KEY = previousKey;
    await browser.close();
  }
});
