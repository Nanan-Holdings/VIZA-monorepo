import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadDs160SubmissionConfig,
  validateDs160LiveStart,
} from "../ds160-live-config";

test("ds160 live config: dry-run is the default mode", () => {
  const config = loadDs160SubmissionConfig({});

  assert.equal(config.mode, "dry_run");
  assert.equal(config.liveSubmissionEnabled, false);
  assert.match(validateDs160LiveStart(config) ?? "", /dry_run/);
});

test("ds160 live config: live mode is blocked without explicit enable flag", () => {
  const config = loadDs160SubmissionConfig({
    DS160_SUBMISSION_MODE: "live_assisted",
    SUBMISSION_RESULT_SECRET_KEY: "0123456789abcdef",
  });

  assert.equal(config.mode, "live_assisted");
  assert.match(validateDs160LiveStart(config) ?? "", /DS160_LIVE_SUBMISSION_ENABLED/);
});

test("ds160 live config: compliant live assisted config passes startup validation", () => {
  const config = loadDs160SubmissionConfig({
    DS160_SUBMISSION_MODE: "live_assisted",
    DS160_LIVE_SUBMISSION_ENABLED: "true",
    DS160_LIVE_ASSISTED_ONLY: "true",
    DS160_REQUIRE_FINAL_USER_CONFIRMATION: "true",
    DS160_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS: "true",
    DS160_CEAC_BASE_URL: "https://ceac.state.gov/genniv/",
    DS160_LIVE_MAX_DURATION_SECONDS: "1800",
    SUBMISSION_RESULT_SECRET_KEY: "0123456789abcdef",
  });

  assert.equal(validateDs160LiveStart(config), null);
});

test("ds160 live config: unsafe final automation flags are refused", () => {
  const config = loadDs160SubmissionConfig({
    DS160_SUBMISSION_MODE: "live_assisted",
    DS160_LIVE_SUBMISSION_ENABLED: "true",
    DS160_LIVE_ASSISTED_ONLY: "false",
    DS160_REQUIRE_FINAL_USER_CONFIRMATION: "true",
    DS160_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS: "true",
    SUBMISSION_RESULT_SECRET_KEY: "0123456789abcdef",
  });

  assert.match(validateDs160LiveStart(config) ?? "", /LIVE_ASSISTED_ONLY/);
});

