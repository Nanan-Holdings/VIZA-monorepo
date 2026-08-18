import assert from "node:assert/strict";
import test from "node:test";
import type { SubmissionPayload } from "../../country-submissions/types.js";
import {
  KrEArrivalPortalValidationError,
  normalizeKrEArrivalPortalPayload,
} from "../normalize.js";

function payload(overrides: Record<string, string> = {}): SubmissionPayload {
  return {
    payloadVersion: "kr-e-arrival-v1",
    countryCode: "KR",
    visaType: "KR_E_ARRIVAL_CARD",
    applicationId: "app-kr-eac-test",
    dryRun: false,
    idempotencyKey: "test",
    personal: {
      fullName: "ZHANG SAN",
      dateOfBirth: "1995-02-03",
      gender: "M",
      nationality: "CHN",
      passportNumber: "E12345678",
      passportExpiryDate: "2030-01-01",
      email: "applicant@example.com",
    },
    trip: { arrivalDate: "2026-09-01", departureDate: "2026-09-05" },
    countrySpecific: {
      surname: "ZHANG",
      given_name: "SAN",
      date_of_birth: "1995-02-03",
      gender: "M",
      nationality: "CHN",
      passport_number: "E12345678",
      passport_expiry_date: "2030-01-01",
      arrival_mode: "air",
      arrival_date: "2026-09-01",
      arrival_flight_number: "KE123",
      departure_mode: "air",
      departure_date: "2026-09-05",
      departure_flight_number: "KE124",
      purpose_code: "01",
      address_korean: "서울특별시 중구 세종대로 1",
      address_english: "1 Sejong-daero, Jung-gu, Seoul",
      address_detail: "Hotel room",
      postal_code: "04524",
      korea_contact_number: "0212345678",
      occupation_code: "03",
      alias_email_address: "appl-test@viza.it.com",
      declaration_confirmed: "true",
      ...overrides,
    },
    metadata: {},
  };
}

test("normalizes Korea e-Arrival payload with official codes", () => {
  const result = normalizeKrEArrivalPortalPayload(payload());
  assert.equal(result.arrivalMode, "air");
  assert.equal(result.arrivalFlightNumber, "KE123");
  assert.equal(result.gender, "M");
  assert.equal(result.purposeCode, "01");
  assert.equal(result.occupationCode, "03");
  assert.equal(result.emailAddress, "appl-test@viza.it.com");
});

test("accepts sea arrival and Other branches", () => {
  const result = normalizeKrEArrivalPortalPayload(payload({
    arrival_mode: "sea",
    arrival_flight_number: "",
    arrival_ship_name: "BLUE OCEAN",
    purpose_code: "99",
    purpose_other: "Conference",
    occupation_code: "99",
    occupation_other: "Researcher",
  }));
  assert.equal(result.arrivalMode, "sea");
  assert.equal(result.arrivalShipName, "BLUE OCEAN");
  assert.equal(result.purposeOther, "Conference");
  assert.equal(result.occupationOther, "Researcher");
});

test("normalizes the saved canonical form keys end to end", () => {
  const result = normalizeKrEArrivalPortalPayload({
    ...payload(),
    personal: {
      fullName: "ZHANG SAN",
      dateOfBirth: "1995-02-03",
      gender: null,
      nationality: "CHN",
      passportNumber: "E12345678",
      passportExpiryDate: "2030-01-01",
      email: "applicant@example.com",
    },
    countrySpecific: {
      sex: "Male",
      nationality: "CHN",
      passport_number: "E12345678",
      passport_expiry_date: "2030-01-01",
      date_of_birth: "1995-02-03",
      arrival_mode: "air",
      arrival_date: "2026-09-01",
      arrival_flight_or_ship: "KE123",
      departure_mode: "air",
      departure_date: "2026-09-05",
      departure_flight_or_ship: "KE124",
      next_destination: "TOKYO",
      purpose_of_entry: "Tourism (individual)",
      occupation: "Student",
      stay_address_en: "1 Sejong-daero, Jung-gu, Seoul",
      stay_postal_code: "04524",
      stay_contact_phone: "0212345678",
      alias_email_address: "appl-test@viza.it.com",
      declaration_confirmed: "true",
    },
  });

  assert.deepEqual(
    {
      gender: result.gender,
      arrivalFlightNumber: result.arrivalFlightNumber,
      departureFlightNumber: result.departureFlightNumber,
      nextDestinationCity: result.nextDestinationCity,
      addressEnglish: result.addressEnglish,
      addressKorean: result.addressKorean,
      postalCode: result.postalCode,
      koreaContactNumber: result.koreaContactNumber,
      purposeCode: result.purposeCode,
      occupationCode: result.occupationCode,
    },
    {
      gender: "M",
      arrivalFlightNumber: "KE123",
      departureFlightNumber: "KE124",
      nextDestinationCity: "TOKYO",
      addressEnglish: "1 Sejong-daero, Jung-gu, Seoul",
      addressKorean: "1 Sejong-daero, Jung-gu, Seoul",
      postalCode: "04524",
      koreaContactNumber: "0212345678",
      purposeCode: "01",
      occupationCode: "03",
    },
  );
});

test("rejects a wrong package and stale official option", () => {
  assert.throws(
    () => normalizeKrEArrivalPortalPayload({ ...payload(), countryCode: "MY" }),
    KrEArrivalPortalValidationError,
  );
  assert.throws(
    () => normalizeKrEArrivalPortalPayload(payload({ purpose_code: "17" })),
    KrEArrivalPortalValidationError,
  );
  assert.throws(
    () => normalizeKrEArrivalPortalPayload(payload({ declaration_confirmed: "false" })),
    KrEArrivalPortalValidationError,
  );
  assert.throws(
    () => normalizeKrEArrivalPortalPayload(payload({ official_unreviewed_question: "answer" })),
    KrEArrivalPortalValidationError,
  );
});

test("requires passport expiry after arrival and complete stay address", () => {
  assert.throws(
    () => normalizeKrEArrivalPortalPayload(payload({ passport_expiry_date: "2026-08-01" })),
    KrEArrivalPortalValidationError,
  );
  assert.throws(
    () => normalizeKrEArrivalPortalPayload(payload({ address_english: "", address_korean: "" })),
    KrEArrivalPortalValidationError,
  );
});

test("rejects applicant email when a VIZA-managed alias is missing", () => {
  assert.throws(
    () => normalizeKrEArrivalPortalPayload(payload({
      alias_email_address: "",
      email_address: "applicant@example.com",
    })),
    (error: unknown) => error instanceof KrEArrivalPortalValidationError
      && error.missingFields.includes("answers.alias_email_address"),
  );
});
