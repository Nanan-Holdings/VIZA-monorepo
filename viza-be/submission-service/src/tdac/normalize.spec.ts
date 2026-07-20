import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTdacPortalPayload, normalizeTdacPurpose } from "./normalize";
import type { SubmissionPayload } from "../country-submissions/types";

test("TDAC purpose aliases match the current official dropdown", () => {
  const expected = new Map([
    ["holiday", "holiday"],
    ["meeting", "meeting"],
    ["sports", "sports"],
    ["business", "business"],
    ["incentive", "incentive"],
    ["medical", "medical_wellness"],
    ["medical_wellness", "medical_wellness"],
    ["education", "education"],
    ["convention", "convention"],
    ["employment", "employment"],
    ["exhibition", "exhibition"],
    ["others", "others"],
  ]);

  for (const [input, purpose] of expected) {
    assert.deepEqual(normalizeTdacPurpose(input), {
      purpose,
      purposeOther: undefined,
      valid: true,
    });
  }
});

test("legacy transit purpose uses official Others while preserving transit semantics", () => {
  assert.deepEqual(normalizeTdacPurpose("transit"), {
    purpose: "others",
    purposeOther: "TRANSIT",
    valid: true,
  });
});

test("TDAC payload rejects a purpose that is not in the official dropdown", () => {
  const payload: SubmissionPayload = {
    payloadVersion: "1",
    countryCode: "TH",
    visaType: "TH_TDAC_ARRIVAL_CARD",
    applicationId: "purpose-validation",
    dryRun: false,
    idempotencyKey: "purpose-validation",
    personal: {},
    trip: {},
    metadata: {},
    countrySpecific: {
      family_name: "TEST",
      first_name: "TRAVELLER",
      passport_number: "TEST123",
      nationality: "CHN",
      date_of_birth: "1990-01-01",
      gender: "male",
      occupation: "TESTER",
      country_territory_of_residence: "CHN",
      city_state_of_residence: "BEIJING",
      phone_country_code: "86",
      phone_number: "10000000000",
      email_address: "test@example.com",
      arrival_date: "2026-07-22",
      departure_date: "2026-07-22",
      country_boarded: "CHN",
      purpose_of_travel: "not_an_official_purpose",
      arrival_mode_of_travel: "air",
      arrival_mode_of_transport: "commercial_flight",
      arrival_transport_number: "TEST1",
      departure_mode_of_travel: "air",
      departure_mode_of_transport: "commercial_flight",
      departure_transport_number: "TEST2",
      countries_visited_last_14_days: "CHN",
    },
  };

  assert.throws(
    () => normalizeTdacPortalPayload(payload),
    /answers\.purpose_of_travel\(official_option\)/,
  );
});
