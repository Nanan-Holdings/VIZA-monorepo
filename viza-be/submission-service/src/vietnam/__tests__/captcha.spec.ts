import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeVietnamCaptchaError,
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
