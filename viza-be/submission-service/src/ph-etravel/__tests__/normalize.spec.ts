import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePhEtravelPortalPayload,
  PhEtravelPortalValidationError,
} from "../normalize";
import type { SubmissionPayload } from "../../country-submissions/types";

function basePayload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "PH",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    applicationId: "app_ph_etravel_test",
    dryRun: false,
    idempotencyKey: "ph-etravel-test",
    personal: {
      fullName: "TEST USER",
      dateOfBirth: "1990-01-01",
      gender: "female",
      nationality: "China",
      passportNumber: "E12345678",
      passportExpiryDate: "2030-12-31",
      email: "test@example.com",
      phone: "+86 13800138000",
    },
    trip: {
      destinationCountry: "Philippines",
      arrivalDate: "2026-06-13",
      departureDate: "2026-06-18",
      purpose: "holiday",
      accommodationAddress: "Test Hotel, Manila",
    },
    countrySpecific: {
      travel_type: "ARRIVAL",
      transport_type: "AIR",
      flight_number: "PR101",
      port_of_entry: "NINOY AQUINO INTERNATIONAL AIRPORT",
      country_of_birth: "CHINA",
      country_of_residence: "CHINA",
      occupation: "Software Engineer",
      philippines_address: "Test Hotel, Manila",
      has_health_symptoms: "no",
      has_checked_baggage: "yes",
      has_dutiable_goods: "no",
      has_currency_over_threshold: "no",
      final_declaration: "yes",
    },
    metadata: {},
    ...overrides,
  };
}

test("normalizePhEtravelPortalPayload maps VIZA answers into official eTravel payload fields", () => {
  const payload = normalizePhEtravelPortalPayload(basePayload(), {
    now: new Date("2026-06-12T08:00:00+08:00"),
  });

  assert.equal(payload.visaType, "PH_ETRAVEL_ARRIVAL_CARD");
  assert.equal(payload.travelType, "ARRIVAL");
  assert.equal(payload.transportType, "AIR");
  assert.equal(payload.flightNumber, "PR101");
  assert.equal(payload.portOfEntry, "NINOY AQUINO INTERNATIONAL AIRPORT");
  assert.equal(payload.hasHealthSymptoms, false);
  assert.equal(payload.customs.hasCheckedBaggage, true);
  assert.equal(payload.customs.hasDutiableGoods, false);
  assert.equal(payload.customs.hasCurrencyOverThreshold, false);
});

test("normalizePhEtravelPortalPayload rejects wrong country or visa type", () => {
  assert.throws(
    () =>
      normalizePhEtravelPortalPayload(
        basePayload({
          countryCode: "PH",
          visaType: "PH_TEMPORARY_VISITOR_VISA",
        }),
        { now: new Date("2026-06-12T08:00:00+08:00") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["visaType"]);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload requires final declaration before live submission", () => {
  assert.throws(
    () =>
      normalizePhEtravelPortalPayload(
        basePayload({
          countrySpecific: {
            ...basePayload().countrySpecific,
            final_declaration: "no",
          },
        }),
        { now: new Date("2026-06-12T08:00:00+08:00") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["final_declaration"]);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload rejects arrivals outside the official 72-hour window", () => {
  assert.throws(
    () =>
      normalizePhEtravelPortalPayload(
        basePayload({
          trip: {
            ...basePayload().trip,
            arrivalDate: "2026-06-20",
          },
        }),
        { now: new Date("2026-06-12T08:00:00+08:00") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["arrival_date"]);
      assert.match(error.message, /72 hours/);
      return true;
    },
  );
});
