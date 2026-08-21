import assert from "node:assert/strict";
import test from "node:test";
import { normalizeJpVjwPortalPayload, JpVjwPortalValidationError } from "../normalize";
import type { SubmissionPayload } from "../../country-submissions/types";

function payload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "JP",
    visaType: "JP_VISIT_JAPAN_WEB",
    applicationId: "jp-app-1",
    dryRun: false,
    idempotencyKey: "jp-key-1",
    personal: {
      fullName: "ZHANG SAN",
      dateOfBirth: "1990-01-02",
      gender: "MALE",
      nationality: "CHN",
      passportNumber: "E12345678",
      passportExpiryDate: "2030-01-02",
      email: "appl-test@viza.it.com",
    },
    trip: {
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-20",
      purpose: "Tourism",
      accommodationName: "Tokyo Hotel",
      accommodationAddress: "1 Tokyo Street",
    },
    countrySpecific: {
      passport_type: "Ordinary passport",
      surname: "ZHANG",
      given_names: "SAN",
      nationality: "China",
      sex: "Male",
      passport_issuing_country: "China",
      email_address: "appl-test@viza.it.com",
      phone_number: "+8613800000000",
      residence_country: "China",
      arrival_date: "2026-09-10",
      arrival_airport: "NARITA",
      flight_number: "NH900",
      last_embarkation_country: "China",
      departure_city_or_port: "Shanghai",
      purpose_of_visit: "Tourism",
      planned_stay_days: "11",
      accommodation_name: "Tokyo Hotel",
      accommodation_address: "1 Tokyo Street",
      accommodation_postal_code: "100-0001",
      accommodation_phone: "+81312345678",
      has_been_deported: "no",
      has_criminal_record: "no",
      has_controlled_substances_or_weapons: "no",
      has_prohibited_or_restricted_goods: "no",
      has_dutiable_goods: "no",
      has_commercial_goods: "no",
      has_goods_for_other_person: "no",
      has_unaccompanied_baggage: "no",
      has_cash_or_valuables_over_threshold: "no",
      customs_declaration_confirmed: "yes",
      immigration_declaration: "yes",
    },
    metadata: {},
    ...overrides,
  };
}

test("normalizes Visit Japan Web payload and preserves official answers", () => {
  const result = normalizeJpVjwPortalPayload(payload());
  assert.equal(result.emailAddress, "appl-test@viza.it.com");
  assert.equal(result.customsDeclaration, "no");
  assert.equal(result.finalDeclaration, "yes");
  assert.equal(result.portOfEntry, "NARITA");
  assert.equal(result.customsAnswers.hasDutiableGoods, "no");
  assert.equal(result.immigrationAnswers.hasCriminalRecord, "no");
  assert.equal(result.departureCityOrPort, "Shanghai");
});

test("accepts planned stay days without an optional departure date", () => {
  const input = payload();
  delete input.trip.departureDate;

  const result = normalizeJpVjwPortalPayload(input);

  assert.equal(result.departureDate, undefined);
  assert.equal(result.plannedStayDays, 11);
});

test("rejects wrong country/visa type and missing canonical immigration confirmation", () => {
  assert.throws(
    () => normalizeJpVjwPortalPayload(payload({ countryCode: "KE" })),
    JpVjwPortalValidationError,
  );
  const invalid = payload();
  delete invalid.countrySpecific.immigration_declaration;
  assert.throws(
    () => normalizeJpVjwPortalPayload(invalid),
    /immigration_declaration/,
  );
});
