import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import {
  describeVietnamCaptchaError,
  fingerprintVietnamCaptchaImage,
  getVietnamCaptchaTimeoutMs,
  hasVisibleVietnamCaptchaChallenge,
  normalizeVietnamCaptchaAnswer,
  refreshVietnamCaptchaChallenge,
  solveVietnamImageCaptcha,
  submitVietnamCaptchaChallenge,
  shouldSolveVietnamCaptcha,
} from "../captcha.js";
import { TwoCaptchaConfigError, TwoCaptchaZeroBalanceError } from "../../captcha/two-captcha.js";

test("vn.captcha: solving is enabled unless explicitly disabled", () => {
  const previous = process.env.VN_CAPTCHA_SOLVING_ENABLED;
  delete process.env.VN_CAPTCHA_SOLVING_ENABLED;
  assert.equal(shouldSolveVietnamCaptcha(), true);
  process.env.VN_CAPTCHA_SOLVING_ENABLED = "false";
  assert.equal(shouldSolveVietnamCaptcha(), false);
  if (previous === undefined) {
    delete process.env.VN_CAPTCHA_SOLVING_ENABLED;
  } else {
    process.env.VN_CAPTCHA_SOLVING_ENABLED = previous;
  }
});

test("vn.captcha: config and balance failures become operator-readable reasons", () => {
  assert.match(describeVietnamCaptchaError(new TwoCaptchaConfigError()), /TWOCAPTCHA_API_KEY is missing/);
  assert.match(describeVietnamCaptchaError(new TwoCaptchaZeroBalanceError()), /zero balance/);
  assert.equal(describeVietnamCaptchaError(new Error("portal changed")), "portal changed");
});

test("vn.captcha: solver answers are trimmed and internal whitespace is removed", () => {
  assert.equal(normalizeVietnamCaptchaAnswer("  A 1 b 2 \n"), "A1b2");
  assert.equal(normalizeVietnamCaptchaAnswer("   "), "");
});

test("vn.captcha: image fingerprints are stable and change with the challenge", () => {
  const first = fingerprintVietnamCaptchaImage(Buffer.from("captcha-one"));
  assert.equal(first, fingerprintVietnamCaptchaImage(Buffer.from("captcha-one")));
  assert.notEqual(first, fingerprintVietnamCaptchaImage(Buffer.from("captcha-two")));
});

test("vn.captcha: browser smoke follows the official accessible label and verifies refresh", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <input id="unrelated" type="text" value="keep-me">
      <canvas aria-label="captcha" width="120" height="40"></canvas>
      <button id="refresh" type="button" aria-label="Refresh security image">Refresh</button>
      <label for=":official-random-id:">Enter CAPTCHA</label>
      <input id=":official-random-id:" type="text">
      <button id="submitCaptcha" type="button">Submit</button>
      <script>
        const canvas = document.querySelector("canvas");
        const context = canvas.getContext("2d");
        const draw = (color) => {
          context.fillStyle = color;
          context.fillRect(0, 0, canvas.width, canvas.height);
        };
        draw("red");
        document.querySelector("#refresh").addEventListener("click", () => draw("blue"));
        document.querySelector("#submitCaptcha").addEventListener("click", () => {
          document.body.dataset.captchaSubmitted = "true";
        });
      </script>
    `);

    const outcome = await solveVietnamImageCaptcha(
      page,
      1_000,
      async () => ({ text: " A 1 b 2 ", solveId: "smoke", durationMs: 1 }),
    );
    assert.equal(outcome.solved, true, outcome.reason);
    assert.equal(await page.getByRole("textbox", { name: "Enter CAPTCHA" }).inputValue(), "A1b2");
    assert.equal(await page.locator("#unrelated").inputValue(), "keep-me");
    assert.equal(await submitVietnamCaptchaChallenge(page), true);
    assert.equal(await page.locator("body").getAttribute("data-captcha-submitted"), "true");
    assert.equal(
      await refreshVietnamCaptchaChallenge(page, outcome.telemetry?.imageFingerprint),
      true,
    );
  } finally {
    await browser.close();
  }
});

test("vn.captcha: waits for the official dialog input to hydrate", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div role="dialog">
        <h2>CAPTCHA Verification</h2>
        <canvas aria-label="captcha" width="120" height="40"></canvas>
        <div id="captcha-slot"></div>
      </div>
      <script>
        const canvas = document.querySelector("canvas");
        const context = canvas.getContext("2d");
        context.fillStyle = "red";
        context.fillRect(0, 0, canvas.width, canvas.height);
        setTimeout(() => {
          document.querySelector("#captcha-slot").innerHTML =
            '<label for=":hydrated-id:">Enter CAPTCHA</label><input id=":hydrated-id:" type="text">';
        }, 350);
      </script>
    `);

    const outcome = await solveVietnamImageCaptcha(
      page,
      1_000,
      async () => ({ text: "A1B2", solveId: "delayed", durationMs: 1 }),
    );
    assert.equal(outcome.solved, true, outcome.reason);
    assert.equal(await page.getByRole("textbox", { name: "Enter CAPTCHA" }).inputValue(), "A1B2");
  } finally {
    await browser.close();
  }
});

test("vn.captcha: uses the sole editable input inside an unlabeled CAPTCHA dialog", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div role="dialog">
        <h2>CAPTCHA Verification</h2>
        <canvas aria-label="captcha" width="120" height="40"></canvas>
        <input id="official-random-id" type="text">
      </div>
      <script>
        const canvas = document.querySelector("canvas");
        const context = canvas.getContext("2d");
        context.fillStyle = "red";
        context.fillRect(0, 0, canvas.width, canvas.height);
      </script>
    `);

    const outcome = await solveVietnamImageCaptcha(
      page,
      1_000,
      async () => ({ text: "C3D4", solveId: "dialog", durationMs: 1 }),
    );
    assert.equal(outcome.solved, true, outcome.reason);
    assert.equal(await page.locator("#official-random-id").inputValue(), "C3D4");
  } finally {
    await browser.close();
  }
});

test("vn.captcha: ignores a CAPTCHA dialog after the official portal hides it", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div role="dialog" style="display: none">
        <h2>CAPTCHA Verification</h2>
        <img alt="captcha" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
        <label for="hidden-captcha">Enter CAPTCHA</label>
        <input id="hidden-captcha" type="text">
      </div>
      <h1>Passenger Information</h1>
      <label for="passport">Passport Number</label>
      <input id="passport" type="text">
    `);

    assert.equal(await hasVisibleVietnamCaptchaChallenge(page), false);
  } finally {
    await browser.close();
  }
});

test("vn.captcha: solve timeout has an independent configurable floor", () => {
  const previous = process.env.VN_CAPTCHA_TIMEOUT_MS;
  delete process.env.VN_CAPTCHA_TIMEOUT_MS;
  assert.equal(getVietnamCaptchaTimeoutMs(60_000), 180_000);

  process.env.VN_CAPTCHA_TIMEOUT_MS = "240000";
  assert.equal(getVietnamCaptchaTimeoutMs(60_000), 240_000);
  assert.equal(getVietnamCaptchaTimeoutMs(300_000), 300_000);

  if (previous === undefined) {
    delete process.env.VN_CAPTCHA_TIMEOUT_MS;
  } else {
    process.env.VN_CAPTCHA_TIMEOUT_MS = previous;
  }
});
