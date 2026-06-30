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
      passportIssueDate: "2020-01-01",
      passportNumber: "E12345678",
      passportIssuingCountry: "China",
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
      registration_for: "FOR_ME",
      travel_type: "ARRIVAL",
      transport_type: "AIR",
      first_name: "TEST",
      last_name: "USER",
      passport_issuing_authority: "China",
      residence_address_line1: "Hunan",
      purpose_of_travel: "HOLIDAY",
      traveller_type: "AIRCRAFT_PASSENGER",
      airline_name: "PHILIPPINE_AIRLINES",
      flight_number: "PR101",
      airport_of_origin: "Singapore Changi Airport",
      flight_departure_date: "2026-06-13",
      flight_arrival_date: "2026-06-13",
      port_of_entry: "NINOY AQUINO INTERNATIONAL AIRPORT",
      country_of_birth: "CHINA",
      country_of_residence: "CHINA",
      occupation: "STUDENT_MINOR",
      destination_type: "HOTEL_RESORT",
      destination_hotel_name: "Test Hotel",
      destination_hotel_address: "Test Hotel, Manila",
      has_recent_travel_history_30d: "no",
      has_exposure_to_sick_person_30d: "no",
      has_been_sick_30d: "no",
      has_accompanied_family_members: "no",
      checked_baggage_count: "1",
      handcarry_baggage_count: "1",
      first_time_visiting_philippines: "no",
      customs_information_acknowledgement: "yes",
      has_baggage_or_currency_to_declare: "no",
      has_dutiable_goods: "no",
      has_currency_over_threshold: "no",
      customs_signature_file: "submission-artifacts/ph-signature.png",
      customs_signature_declaration: "yes",
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
  assert.equal(payload.travellerType, "AIRCRAFT_PASSENGER");
  assert.equal(payload.airlineOrVesselName, "PHILIPPINE_AIRLINES");
  assert.equal(payload.airportOfOrigin, "Singapore Changi Airport");
  assert.equal(payload.portOfEntry, "NINOY AQUINO INTERNATIONAL AIRPORT");
  assert.equal(payload.hasHealthSymptoms, false);
  assert.equal(payload.customs.hasCheckedBaggage, true);
  assert.equal(payload.customs.checkedBaggageCount, "1");
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
          countrySpecific: {
            ...basePayload().countrySpecific,
            flight_arrival_date: "",
          },
        }),
        { now: new Date("2026-06-12T08:00:00+08:00") },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelPortalValidationError);
      assert.deepEqual(error.missingFields, ["flight_arrival_date"]);
      assert.match(error.message, /72 hours/);
      return true;
    },
  );
});

test("normalizePhEtravelPortalPayload normalizes slash dates to ISO dates", () => {
  const payload = normalizePhEtravelPortalPayload(
    basePayload({
      personal: {
        ...basePayload().personal,
        phone: "0086 13800138000",
      },
      trip: {
        ...basePayload().trip,
        arrivalDate: "06/20/2026",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        flight_arrival_date: "",
      },
    }),
    { now: new Date("2026-06-20T08:00:00+08:00") },
  );

  assert.equal(payload.arrivalDate, "2026-06-20");
});

test("normalizePhEtravelPortalPayload derives mobile code and number from personal phone", () => {
  const payload = normalizePhEtravelPortalPayload(
    basePayload({
      personal: {
        ...basePayload().personal,
        phone: "+86 13800138000",
      },
      countrySpecific: {
        ...basePayload().countrySpecific,
        mobile_country_code: "",
        mobile_number: "",
      },
    }),
    { now: new Date("2026-06-12T08:00:00+08:00") },
  );

  assert.equal(payload.mobileCountryCode, "+86");
  assert.equal(payload.mobileNumber, "13800138000");
});
