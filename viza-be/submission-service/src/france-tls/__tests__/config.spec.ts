import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadFranceSubmissionConfig, validateFranceTlsAppointmentStart } from "../../france-live-config";

describe("France TLS appointment config", () => {
  it("keeps TLS appointment and payment disabled by default", () => {
    const config = loadFranceSubmissionConfig({});

    assert.equal(config.tlsAppointmentEnabled, false);
    assert.equal(config.tlsPaymentEnabled, false);
    assert.equal(config.tlsSupportedCountries, "CN");
    assert.match(validateFranceTlsAppointmentStart(config) ?? "", /FRANCE_TLS_APPOINTMENT_ENABLED/u);
  });

  it("accepts explicit gated China TLS appointment configuration", () => {
    const config = loadFranceSubmissionConfig({
      FRANCE_SUBMISSION_MODE: "live_assisted",
      FRANCE_LIVE_SUBMISSION_ENABLED: "true",
      FRANCE_TLS_APPOINTMENT_ENABLED: "true",
      FRANCE_TLS_PAYMENT_ENABLED: "true",
      FRANCE_TLS_SUPPORTED_COUNTRIES: "CN",
      SUBMISSION_RESULT_SECRET_KEY: "1234567890123456",
      FRANCE_REQUIRE_FINAL_USER_CONFIRMATION: "true",
      FRANCE_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS: "true",
      FRANCE_LIVE_ASSISTED_ONLY: "true",
    });

    assert.equal(validateFranceTlsAppointmentStart(config), null);
  });
});
