import assert from "node:assert/strict";
import test from "node:test";
import type { SubmissionPayload } from "../../country-submissions/types";
import { evaluateVietnamPrearrivalSubmissionWindow } from "../date-window";
import {
  VnPrearrivalPortalValidationError,
  normalizeVnPrearrivalPortalPayload,
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
      visa_number: "EV123456",
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
