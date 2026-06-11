import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadFranceSubmissionConfig,
  validateFranceLiveStart,
} from "../france-live-config";

describe("France live assisted config", () => {
  it("defaults to dry-run with live disabled", () => {
    const config = loadFranceSubmissionConfig({});

    assert.equal(config.mode, "dry_run");
    assert.equal(config.liveSubmissionEnabled, false);
    assert.equal(config.liveAssistedOnly, true);
    assert.equal(config.playwrightHeadless, false);
    assert.equal(validateFranceLiveStart(config), "France live assisted is blocked: FRANCE_SUBMISSION_MODE must be live_assisted.");
  });

  it("accepts the safe live-assisted flag set", () => {
    const config = loadFranceSubmissionConfig({
      FRANCE_SUBMISSION_MODE: "live_assisted",
      FRANCE_LIVE_SUBMISSION_ENABLED: "true",
      FRANCE_LIVE_ASSISTED_ONLY: "true",
      FRANCE_REQUIRE_FINAL_USER_CONFIRMATION: "true",
      FRANCE_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS: "true",
      FRANCE_PAYMENT_LIVE_ENABLED: "false",
      FRANCE_APPOINTMENT_LIVE_ENABLED: "false",
      SUBMISSION_RESULT_SECRET_KEY: "1234567890abcdef",
    });

    assert.equal(config.mode, "live_assisted");
    assert.equal(config.accountRegistrationEnabled, false);
    assert.equal(validateFranceLiveStart(config), null);
  });

  it("accepts explicit account registration with 2captcha configured", () => {
    const config = loadFranceSubmissionConfig({
      FRANCE_SUBMISSION_MODE: "live_assisted",
      FRANCE_LIVE_SUBMISSION_ENABLED: "true",
      FRANCE_ACCOUNT_REGISTRATION_ENABLED: "true",
      FRANCE_REGISTRATION_2CAPTCHA_ENABLED: "true",
      FRANCE_REGISTRATION_MAX_CAPTCHA_ATTEMPTS: "4",
      FRANCE_REGISTRATION_EMAIL_TIMEOUT_MS: "240000",
      TWOCAPTCHA_API_KEY: "test-key",
      SUBMISSION_RESULT_SECRET_KEY: "1234567890abcdef",
    });

    assert.equal(config.accountRegistrationEnabled, true);
    assert.equal(config.registrationTwoCaptchaEnabled, true);
    assert.equal(config.registrationMaxCaptchaAttempts, 4);
    assert.equal(config.registrationEmailTimeoutMs, 240000);
    assert.equal(validateFranceLiveStart(config), null);
  });

  it("blocks account registration when 2captcha is not configured", () => {
    const config = loadFranceSubmissionConfig({
      FRANCE_SUBMISSION_MODE: "live_assisted",
      FRANCE_LIVE_SUBMISSION_ENABLED: "true",
      FRANCE_ACCOUNT_REGISTRATION_ENABLED: "true",
      FRANCE_REGISTRATION_2CAPTCHA_ENABLED: "true",
      SUBMISSION_RESULT_SECRET_KEY: "1234567890abcdef",
    });

    assert.match(validateFranceLiveStart(config) ?? "", /TWOCAPTCHA_API_KEY/);
  });

  it("blocks live mode when payment or appointment automation is enabled", () => {
    const base = {
      FRANCE_SUBMISSION_MODE: "live_assisted",
      FRANCE_LIVE_SUBMISSION_ENABLED: "true",
      SUBMISSION_RESULT_SECRET_KEY: "1234567890abcdef",
    };

    assert.match(
      validateFranceLiveStart(loadFranceSubmissionConfig({
        ...base,
        FRANCE_PAYMENT_LIVE_ENABLED: "true",
      })) ?? "",
      /FRANCE_PAYMENT_LIVE_ENABLED/,
    );
    assert.match(
      validateFranceLiveStart(loadFranceSubmissionConfig({
        ...base,
        FRANCE_APPOINTMENT_LIVE_ENABLED: "true",
      })) ?? "",
      /FRANCE_APPOINTMENT_LIVE_ENABLED/,
    );
  });
});
