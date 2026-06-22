import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeVietnamCaptchaError,
  getVietnamCaptchaTimeoutMs,
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
