import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRunnerHandoff,
  isEligibleUSAppointmentJob,
  loadUSAppointmentRunnerConfig,
  validateUSAppointmentRunnerStart,
  type USAppointmentJobRow,
} from "../runner";

const baseJob: USAppointmentJobRow = {
  id: "11111111-1111-4111-8111-111111111111",
  application_id: "22222222-2222-4222-8222-222222222222",
  user_id: "33333333-3333-4333-8333-333333333333",
  appointment_account_id: null,
  applying_country_code: "CN",
  applying_post_city: "Beijing",
  scheduling_provider: "usvisascheduling",
  status: "appointment_consent_received",
  mode: "assisted_live",
  user_preferences_json: { timePreference: "morning" },
  requires_user_action: false,
  current_manual_action: null,
  updated_at: "2026-06-11T00:00:00.000Z",
};

test("US appointment runner config is disabled by default", () => {
  const config = loadUSAppointmentRunnerConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.captchaSolvingEnabled, false);
  assert.equal(config.twoCaptchaConfigured, false);
  assert.deepEqual(config.providerAllowlist, ["usvisascheduling"]);
  assert.deepEqual(config.supportedCountries, ["CN"]);
});

test("US appointment runner blocks 2captcha mode without TWOCAPTCHA_API_KEY", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    US_APPOINTMENT_CAPTCHA_SOLVING_ENABLED: "true",
  });
  assert.equal(config.captchaSolvingEnabled, true);
  assert.equal(config.twoCaptchaConfigured, false);
  assert.match(validateUSAppointmentRunnerStart(config) ?? "", /TWOCAPTCHA_API_KEY/);
});

test("US appointment runner exposes 2captcha handoff metadata when configured", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    US_APPOINTMENT_CAPTCHA_SOLVING_ENABLED: "true",
    TWOCAPTCHA_API_KEY: "test-key",
  });
  assert.equal(validateUSAppointmentRunnerStart(config), null);
  const handoff = buildRunnerHandoff(baseJob, config);
  assert.equal(handoff.metadata.captcha_solver_enabled, true);
  assert.equal(handoff.metadata.captcha_solver_provider, "2captcha");
});

test("US appointment runner only accepts enabled China usvisascheduling assisted-live jobs", () => {
  const config = loadUSAppointmentRunnerConfig({
    US_APPOINTMENT_ASSISTED_LIVE_ENABLED: "true",
    US_APPOINTMENT_PROVIDER_ALLOWLIST: "usvisascheduling",
    US_APPOINTMENT_SUPPORTED_COUNTRIES: "CN",
  });
  assert.equal(isEligibleUSAppointmentJob(baseJob, config), true);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, mode: "dry_run" }, config), false);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, applying_country_code: "SG" }, config), false);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, scheduling_provider: "ais_usvisa_info" }, config), false);
  assert.equal(isEligibleUSAppointmentJob({ ...baseJob, requires_user_action: true }, config), false);
});

test("US appointment runner handoff pauses at manual login without final booking", () => {
  const handoff = buildRunnerHandoff(baseJob);
  assert.equal(handoff.jobStatus, "appointment_login_required");
  assert.equal(handoff.actionType, "login");
  assert.match(handoff.instruction, /official-site login/i);
  assert.equal(handoff.metadata.captcha_solver_enabled, false);
  assert.equal(handoff.metadata.no_final_confirmation_click, true);
});
