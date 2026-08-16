import assert from "node:assert/strict";
import test from "node:test";

import {
  canResendPhEtravelEmailOtp,
  PH_ETRAVEL_EMAIL_OTP_MIN_WAIT_MS,
  phEtravelEmailOtpWaitMs,
  phEtravelCitizenshipLabel,
  phEtravelCountryNameLabel,
  phEtravelOtpInputPlan,
  phEtravelPersonalInformationPlan,
  phEtravelPasswordFieldValues,
} from "../runner.js";

test("PH eTravel plans a six-digit OTP across six independent visible inputs", () => {
  const plan = phEtravelOtpInputPlan("123456", [4, 5, 6, 7, 8, 9]);
  assert.deepEqual(plan, {
    mode: "six_individual_inputs",
    indexes: [4, 5, 6, 7, 8, 9],
    digits: ["1", "2", "3", "4", "5", "6"],
  });
});

test("PH eTravel waits at least the official three-minute email OTP window", () => {
  assert.equal(PH_ETRAVEL_EMAIL_OTP_MIN_WAIT_MS, 180_000);
  assert.equal(phEtravelEmailOtpWaitMs(30_000), PH_ETRAVEL_EMAIL_OTP_MIN_WAIT_MS);
  assert.equal(phEtravelEmailOtpWaitMs(undefined, { PH_ETRAVEL_EMAIL_VERIFICATION_TIMEOUT_MS: "240000" }), 240_000);
});

test("PH eTravel never resends while the official resend countdown is visible", () => {
  assert.equal(canResendPhEtravelEmailOtp({
    visible: true,
    enabled: true,
    pageText: "Resend email code in 00:42",
  }), false);
  assert.equal(canResendPhEtravelEmailOtp({
    visible: true,
    enabled: true,
    pageText: "Resend email code",
  }), true);
});

test("PH eTravel uses the same managed value for Password and Password Confirmation", () => {
  const fields = phEtravelPasswordFieldValues("Synthetic-PH-Password9!");
  assert.equal(fields.password, fields.confirmation);
});

test("PH eTravel onboarding uses distinct name fields and keeps citizenship separate from country labels", () => {
  const plan = phEtravelPersonalInformationPlan({
    firstName: "GIVEN",
    middleName: "MIDDLE",
    lastName: null,
    suffix: "SUFFIX",
    nationality: "PH",
    countryOfBirth: "PH",
    passportIssuingAuthority: "PH",
  } as Parameters<typeof phEtravelPersonalInformationPlan>[0]);

  assert.deepEqual(
    { firstName: plan.firstName, middleName: plan.middleName, lastName: plan.lastName, suffix: plan.suffix },
    { firstName: "GIVEN", middleName: "MIDDLE", lastName: null, suffix: "SUFFIX" },
  );
  assert.equal(plan.citizenshipLabel, "Filipino");
  assert.equal(plan.countryOfBirthLabel, "Philippines");
  assert.equal(plan.passportIssuingAuthorityLabel, "Philippines");
  assert.notEqual(phEtravelCitizenshipLabel("PH"), phEtravelCountryNameLabel("PH"));
});
