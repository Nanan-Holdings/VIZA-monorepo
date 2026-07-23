import assert from "node:assert/strict";
import test from "node:test";
import type { SubmissionPayload } from "../../country-submissions/types";
import { evaluateVietnamPrearrivalSubmissionWindow } from "../date-window";
import {
  VnPrearrivalPortalValidationError,
  normalizeVnPrearrivalPortalPayload,
  routeVnPrearrivalEmailAnswers,
} from "../normalize";

function payload(overrides: Record<string, string> = {}): SubmissionPayload {
  return {
    payloadVersion: "2026-07-06",
    countryCode: "VN",
    visaType: "VN_PREARRIVAL_DECLARATION",
    applicationId: "app_vn_prearrival",
    dryRun: false,
    idempotencyKey: "test",
    personal: {},
    trip: {},
    metadata: {},
    countrySpecific: {
      expected_arrival_date: "2026-07-08",
      passport_type: "P",
      surname: "NGUYEN",
      given_name: "VAN A",
      date_of_birth: "1990-01-02",
      gender: "male",
      nationality: "SINGAPORE",
      email_address: "traveller@example.com",
      alias_email_address: "alias-traveller@inbox.viza.test",
      real_email_address: "traveller@example.com",
      phone_country_code: "+65",
      phone_number: "91234567",
      passport_number: "E1234567",
      passport_expiry_date: "2034-01-01",
      visa_information_acknowledgement: "true",
      visa_type: "EV",
      visa_number: "106527303",
      visa_expiry_date: "2026-08-01",
      departure_country_before_arrival: "SINGAPORE",
      purpose_of_travel: "travel",
      mode_of_travel: "air",
      flight_number: "VN0650_SGN",
      border_gate_airport: "SGN",
      accommodation_type: "hotel",
      province_city_of_hotel: "Ho Chi Minh City",
      ward_commune_of_hotel: "Ben Nghe Ward",
      hotel_accommodation_address: "KSHCM_0001",
      final_declaration: "true",
      ...overrides,
    },
  };
}

test("normalizes Vietnam Pre-Arrival portal payload without fallback", () => {
  const normalized = normalizeVnPrearrivalPortalPayload(payload());
  assert.equal(normalized.emailAddress, "alias-traveller@inbox.viza.test");
  assert.equal(normalized.realEmailAddress, "traveller@example.com");
  assert.equal(normalized.flightNumber, "VN0650_SGN");
  assert.equal(normalized.borderGateAirport, "SGN");
  assert.equal(normalized.accommodationAddress, "KSHCM_0001");
  assert.equal(normalized.usesCustomHotelAccommodationAddress, false);
});

test("normalizes non-hotel Vietnam Pre-Arrival accommodation from free-text address", () => {
  const normalized = normalizeVnPrearrivalPortalPayload(payload({
    accommodation_type: "residential",
    province_city_of_hotel: "",
    ward_commune_of_hotel: "",
    hotel_accommodation_address: "",
    accommodation_address: "Friend apartment, Hanoi",
  }));

  assert.equal(normalized.accommodationAddress, "Friend apartment, Hanoi");
  assert.equal(normalized.usesCustomHotelAccommodationAddress, false);
});

test("normalizes the official Other hotel branch from the manual accommodation address", () => {
  const normalized = normalizeVnPrearrivalPortalPayload(payload({
    hotel_accommodation_address: "other",
    custom_hotel_accommodation_address: "Private guesthouse, 12 Test Street, Da Nang",
  }));

  assert.equal(normalized.usesCustomHotelAccommodationAddress, true);
  assert.equal(normalized.accommodationAddress, "Private guesthouse, 12 Test Street, Da Nang");
});

test("requires a manual accommodation address when the official Other hotel option is selected", () => {
  assert.throws(
    () => normalizeVnPrearrivalPortalPayload(payload({
      hotel_accommodation_address: "other",
      custom_hotel_accommodation_address: "",
    })),
    (error) => {
      assert.ok(error instanceof VnPrearrivalPortalValidationError);
      assert.ok(error.missingFields.includes("answers.custom_hotel_accommodation_address"));
      return true;
    },
  );
});

test("normalizes the official Other flight branch with a manual flight and airport", () => {
  const normalized = normalizeVnPrearrivalPortalPayload(payload({
    flight_number: "other",
    custom_flight_number: "SQ 186",
    border_gate_airport: "HAN",
  }));

  assert.equal(normalized.flightNumber, "other");
  assert.equal(normalized.customFlightNumber, "SQ 186");
  assert.equal(normalized.borderGateAirport, "HAN");
});

test("requires a manual flight number when the official Other option is selected", () => {
  assert.throws(
    () => normalizeVnPrearrivalPortalPayload(payload({
      flight_number: "other",
      custom_flight_number: "",
      border_gate_airport: "HAN",
    })),
    (error) => {
      assert.ok(error instanceof VnPrearrivalPortalValidationError);
      assert.ok(error.missingFields.includes("answers.custom_flight_number"));
      return true;
    },
  );
});

test("rejects unsupported or missing Vietnam Pre-Arrival values with field list", () => {
  assert.throws(
    () => normalizeVnPrearrivalPortalPayload(payload({
      flight_number: "",
      border_gate_airport: "HAN",
    })),
    (error) => {
      assert.ok(error instanceof VnPrearrivalPortalValidationError);
      assert.deepEqual([...error.missingFields].sort(), [
        "answers.flight_number",
        "answers.border_gate_airport(locked_by_flight_number)",
      ].sort());
      return true;
    },
  );
});

test("rejects an E-Visa number unless it is exactly nine numeric digits", () => {
  assert.throws(
    () => normalizeVnPrearrivalPortalPayload(payload({
      visa_number: "E260329CHNEC883721122",
    })),
    (error) => {
      assert.ok(error instanceof VnPrearrivalPortalValidationError);
      assert.ok(error.missingFields.includes("answers.visa_number(9_digit_numeric_evisa_number)"));
      return true;
    },
  );
});

test("requires alias email for OTP and keeps the real email for forwarding only", () => {
  assert.throws(
    () => normalizeVnPrearrivalPortalPayload(payload({ alias_email_address: "" })),
    (error) => {
      assert.ok(error instanceof VnPrearrivalPortalValidationError);
      assert.ok(error.missingFields.includes("answers.alias_email_address"));
      return true;
    },
  );
});

test("forces the managed alias into the official form and preserves the real email for forwarding", () => {
  const routed = routeVnPrearrivalEmailAnswers(
    {
      alias_email_address: "traveller@example.com",
      email_address: "traveller@example.com",
    },
    "APPL-TEST@HAGGSTORM.COM",
    "profile@example.com",
  );

  assert.equal(routed.alias_email_address, "appl-test@haggstorm.com");
  assert.equal(routed.real_email_address, "profile@example.com");
  assert.equal(routed.email_address, "traveller@example.com");
});

test("evaluates Vietnam Pre-Arrival 72-hour submission window", () => {
  const now = new Date("2026-07-06T03:00:00.000Z");
  assert.equal(
    evaluateVietnamPrearrivalSubmissionWindow("2026-07-08", now).status,
    "open",
  );
  assert.equal(
    evaluateVietnamPrearrivalSubmissionWindow("2026-07-09", now).status,
    "scheduled",
  );
  assert.equal(
    evaluateVietnamPrearrivalSubmissionWindow("2026-07-05", now).status,
    "past",
  );
});
