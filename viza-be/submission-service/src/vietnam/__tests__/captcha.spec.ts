import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import {
  describeVietnamCaptchaError,
  fingerprintVietnamCaptchaImage,
  getVietnamCaptchaTimeoutMs,
  isVietnamCaptchaFailureRetryable,
  isVietnamCaptchaSolveCurrent,
  normalizeVietnamCaptchaAnswer,
  reportRejectedVietnamCaptcha,
  shouldSolveVietnamCaptcha,
  solveVietnamImageCaptcha,
  submitVietnamCaptchaAnswer,
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

test("vn.captcha: caller deadline caps the configurable solve timeout", () => {
  const previous = process.env.VN_CAPTCHA_TIMEOUT_MS;
  delete process.env.VN_CAPTCHA_TIMEOUT_MS;
  assert.equal(getVietnamCaptchaTimeoutMs(60_000), 60_000);
  assert.equal(getVietnamCaptchaTimeoutMs(), 180_000);

  process.env.VN_CAPTCHA_TIMEOUT_MS = "240000";
  assert.equal(getVietnamCaptchaTimeoutMs(60_000), 60_000);
  assert.equal(getVietnamCaptchaTimeoutMs(300_000), 240_000);

  if (previous === undefined) {
    delete process.env.VN_CAPTCHA_TIMEOUT_MS;
  } else {
    process.env.VN_CAPTCHA_TIMEOUT_MS = previous;
  }
});

test("vn.captcha: fingerprints distinguish refreshed challenges", () => {
  const first = fingerprintVietnamCaptchaImage(Buffer.from("captcha-one"));
  const same = fingerprintVietnamCaptchaImage(Buffer.from("captcha-one"));
  const refreshed = fingerprintVietnamCaptchaImage(Buffer.from("captcha-two"));

  assert.equal(first, same);
  assert.notEqual(first, refreshed);
  assert.equal(isVietnamCaptchaSolveCurrent(first, same), true);
  assert.equal(isVietnamCaptchaSolveCurrent(first, refreshed), false);
  assert.equal(isVietnamCaptchaSolveCurrent(first, null), false);
});

test("vn.captcha: normalizes whitespace and distinguishes terminal solver failures", () => {
  assert.equal(normalizeVietnamCaptchaAnswer(" A 1 b 2 \n"), "A1b2");
  assert.equal(isVietnamCaptchaFailureRetryable("2captcha network error: reset"), true);
  assert.equal(isVietnamCaptchaFailureRetryable("Vietnam CAPTCHA changed while solving"), true);
  assert.equal(
    isVietnamCaptchaFailureRetryable("TWOCAPTCHA_API_KEY is missing; cannot solve the official portal CAPTCHA."),
    false,
  );
  assert.equal(isVietnamCaptchaFailureRetryable("2captcha account has zero balance"), false);
});

test("vn.captcha: provider retries are not multiplied inside one portal attempt", async () => {
  const previous = process.env.VN_CAPTCHA_SOLVER_ATTEMPTS;
  delete process.env.VN_CAPTCHA_SOLVER_ATTEMPTS;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let calls = 0;
  try {
    await page.setContent(`
      <img class="captcha-image" style="display:block;width:120px;height:40px" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Ctext x='10' y='25'%3EAB12%3C/text%3E%3C/svg%3E" />
      <input type="text" />
    `);
    const outcome = await solveVietnamImageCaptcha(page, 1_000, async () => {
      calls += 1;
      throw new Error("2captcha network error: reset");
    });

    assert.equal(outcome.solved, false);
    assert.equal(calls, 1);
  } finally {
    await browser.close();
    if (previous === undefined) {
      delete process.env.VN_CAPTCHA_SOLVER_ATTEMPTS;
    } else {
      process.env.VN_CAPTCHA_SOLVER_ATTEMPTS = previous;
    }
  }
});

test("vn.captcha: submits a localized verification button near the CAPTCHA", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <form id="captcha-form">
        <img id="captcha-image" style="display:block;width:120px;height:40px" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Ctext x='10' y='25'%3EAB12%3C/text%3E%3C/svg%3E" />
        <input id="security-captcha" name="captcha" value="AB12" />
        <button type="button" id="unrelated">Back</button>
        <button type="button" id="verify" onclick="document.body.dataset.captchaSubmitted='yes'">Xác nhận</button>
      </form>
    `);

    await page.locator("#captcha-image").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#verify").evaluate((element) => /xác nhận/i.test(element.textContent ?? "")),
      true,
    );
    assert.equal(await submitVietnamCaptchaAnswer(page, 100), true);
    assert.equal(await page.locator("body").getAttribute("data-captcha-submitted"), "yes");
  } finally {
    await browser.close();
  }
});

test("vn.captcha: submits after the official dialog redraw hides the solved CAPTCHA image", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <div role="dialog">
        <img id="captcha-image" style="display:block;width:120px;height:40px" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Ctext x='10' y='25'%3EAB12%3C/text%3E%3C/svg%3E" />
        <input id="security-captcha" name="captcha" value="AB12" />
        <button type="button" id="verify" onclick="document.body.dataset.captchaSubmitted='yes'">Kiểm tra</button>
      </div>
    `);
    await page.locator("#captcha-image").evaluate((element) => {
      (element as HTMLElement).style.display = "none";
    });

    assert.equal(await submitVietnamCaptchaAnswer(page, 100), true);
    assert.equal(await page.locator("body").getAttribute("data-captcha-submitted"), "yes");
  } finally {
    await browser.close();
  }
});

test("vn.captcha: submits the current inline generic CAPTCHA input", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <section id="review-checkpoint">
        <img class="captcha-image" style="display:block;width:120px;height:40px" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Ctext x='10' y='25'%3EAB12%3C/text%3E%3C/svg%3E" />
        <input type="text" value="AB12" />
        <button type="button" id="verify" onclick="document.body.dataset.captchaSubmitted='yes'">Verify</button>
      </section>
    `);

    assert.equal(await submitVietnamCaptchaAnswer(page, 100), true);
    assert.equal(await page.locator("body").getAttribute("data-captcha-submitted"), "yes");
  } finally {
    await browser.close();
  }
});

test("vn.captcha: re-resolves a localized verification control after an Ant dialog redraw", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <div role="dialog">
        <img id="captcha-image" style="display:block;width:120px;height:40px" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Ctext x='10' y='25'%3EAB12%3C/text%3E%3C/svg%3E" />
        <input id="security-captcha" name="captcha" value="AB12" />
        <button type="button">Quay lại</button>
        <button type="button" id="verify" onclick="document.body.dataset.captchaSubmitted='yes'">Duyệt</button>
      </div>
    `);

    assert.equal(await submitVietnamCaptchaAnswer(page, 100), true);
    assert.equal(await page.locator("body").getAttribute("data-captcha-submitted"), "yes");
  } finally {
    await browser.close();
  }
});

test("vn.captcha: reports only a rejected solved task", async () => {
  const reported: string[] = [];
  const reporter = async (solveId: string) => {
    reported.push(solveId);
  };

  assert.equal(await reportRejectedVietnamCaptcha({ solved: false }, reporter), false);
  assert.equal(
    await reportRejectedVietnamCaptcha(
      {
        solved: true,
        telemetry: {
          solveId: "task-123",
          durationMs: 500,
          challengeFingerprint: "fingerprint",
        },
      },
      reporter,
    ),
    true,
  );
  assert.deepEqual(reported, ["task-123"]);
});

test("vn.captcha: reporting failures do not fail the submission flow", async () => {
  const reported = await reportRejectedVietnamCaptcha(
    {
      solved: true,
      telemetry: {
        solveId: "task-456",
        durationMs: 500,
        challengeFingerprint: "fingerprint",
      },
    },
    async () => {
      throw new Error("2captcha reporting unavailable");
    },
  );

  assert.equal(reported, false);
});
