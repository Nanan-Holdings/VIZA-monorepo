import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSgacPortalPayload, SgacPortalValidationError } from "../normalize";
import type { SubmissionPayload } from "../../country-submissions/types";

function basePayload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "SG",
    visaType: "SG_ARRIVAL_CARD",
    applicationId: "app_sgac_test",
    dryRun: false,
    idempotencyKey: "sgac-test",
    personal: {
      fullName: "TEST USER",
      dateOfBirth: "1990-01-01",
      gender: "male",
      nationality: "China",
      passportNumber: "E12345678",
      passportExpiryDate: "2030-12-31",
      email: "test@example.com",
      phone: "+86 13800138000",
    },
    trip: {
      destinationCountry: "Singapore",
      arrivalDate: "2026-06-13",
      departureDate: "2026-06-14",
      purpose: "holiday",
      accommodationAddress: "Transit",
    },
    countrySpecific: {
      purpose_of_travel: "holiday",
      mode_of_travel: "air",
      transport_number: "SQ317",
      place_of_birth_country: "China",
      place_of_residence: "CHINA, BEIJING, BEIJING",
      last_city_or_port_before_singapore: "Kuala Lumpur",
      next_city_or_port_after_singapore: "Bangkok",
      accommodation_type: "others",
      accommodation_other_type: "transit",
      recent_country_visit_history: "none",
      has_health_symptoms: "no",
      has_used_different_name_to_enter_singapore: "no",
      final_declaration: "yes",
    },
    metadata: {},
    ...overrides,
  };
}

test("normalizeSgacPortalPayload maps purpose_of_travel and transport number into ICA fields", () => {
  const payload = normalizeSgacPortalPayload(basePayload(), {
    now: new Date("2026-06-12T08:00:00+08:00"),
  });

  assert.equal(payload.purposeOfTravelLabel, "Holiday/Sightseeing/Leisure");
  assert.equal(payload.transport.mode, "air");
  assert.equal(payload.transport.airTransportType, "commercial");
  assert.equal(payload.transport.carrierCodeQuery, "SQ");
  assert.equal(payload.transport.flightNo, "317");
  assert.equal(payload.nationalityLabel, "CHINESE");
  assert.equal(payload.placeOfBirthLabel, "CHINA");
  assert.equal(payload.residenceCityQuery, "CHINA, BEIJING, BEIJING");
  assert.equal(payload.phoneCountryCode, "86");
  assert.equal(payload.phoneNumber, "13800138000");
});

test("normalizeSgacPortalPayload prefers mobile_number and splits it for ICA phone fields", () => {
  const payload = normalizeSgacPortalPayload(
    basePayload({
      personal: {
        ...basePayload().personal,
        phone: "+86 13312345678",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        mobile_country_code: "86",
        mobile_number: "19974911995",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.equal(payload.phoneCountryCode, "86");
  assert.equal(payload.phoneNumber, "19974911995");
});

test("normalizeSgacPortalPayload rejects missing purpose_of_travel with a specific field error", () => {
  const input = basePayload({
    trip: { ...basePayload().trip, purpose: null },
    countrySpecific: {
      ...basePayload().countrySpecific,
      purpose_of_travel: "",
    },
  });

  assert.throws(
    () => normalizeSgacPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof SgacPortalValidationError);
      assert.deepEqual(error.missingFields, ["purpose_of_travel"]);
      assert.match(error.message, /Purpose of travel/);
      return true;
    },
  );
});

test("normalizeSgacPortalPayload rejects arrival dates outside the ICA three-day SGAC window", () => {
  const input = basePayload({
    trip: {
      ...basePayload().trip,
      arrivalDate: "2026-06-20",
    },
  });

  assert.throws(
    () => normalizeSgacPortalPayload(input, { now: new Date("2026-06-12T08:00:00+08:00") }),
    (error: unknown) => {
      assert.ok(error instanceof SgacPortalValidationError);
      assert.deepEqual(error.missingFields, ["arrival_date"]);
      assert.match(error.message, /within three days/);
      return true;
    },
  );
});
