import assert from "node:assert/strict";
import test from "node:test";
import { MdacPortalValidationError, normalizeMdacPortalPayload } from "../normalize";
import type { SubmissionPayload } from "../../country-submissions/types";

function fixture(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  return {
    payloadVersion: "offline-fixture", countryCode: "MY", visaType: "MY_MDAC_ARRIVAL_CARD",
    applicationId: "offline-mdac-fixture", dryRun: true, idempotencyKey: "offline-mdac-fixture",
    personal: { fullName: "TEST TRAVELLER", passportNumber: "T12345678", passportExpiryDate: "2031-01-01", nationality: "CHINA", dateOfBirth: "1990-01-01", gender: "MALE", email: "test@example.invalid", phone: "15550000000" },
    trip: { arrivalDate: "2026-08-10", departureDate: "2026-08-12", destinationCountry: "Malaysia" },
    countrySpecific: { place_of_birth: "CHINA", mobile_country_code: "+86", mode_of_travel: "AIR", transport_number: "TEST123", last_embarkation_country: "SINGAPORE", purpose_of_visit: "HOLIDAY", accommodation_type: "HOTEL", address_in_malaysia: "TEST HOTEL", city: "KUALA LUMPUR", state: "WILAYAH PERSEKUTUAN KUALA LUMPUR", postcode: "50088" }, metadata: {}, ...overrides,
  };
}

test("offline MDAC fixture maps without a portal or database", () => {
  const result = normalizeMdacPortalPayload(fixture());
  assert.equal(result.fullName, "TEST TRAVELLER");
  assert.equal(result.arrivalDate, "2026-08-10");
  assert.equal(result.postcode, "50088");
});

test("offline MDAC fixture stops before automation when a required answer is absent", () => {
  const input = fixture({ countrySpecific: { ...fixture().countrySpecific, transport_number: "" } });
  assert.throws(() => normalizeMdacPortalPayload(input), (error: unknown) => {
    assert.ok(error instanceof MdacPortalValidationError);
    assert.deepEqual(error.missingFields, ["transport_number"]);
    return true;
  });
});

test("offline MDAC fixture rejects malformed postcodes before any portal access", () => {
  const input = fixture({ countrySpecific: { ...fixture().countrySpecific, postcode: "ABCDE" } });
  assert.throws(() => normalizeMdacPortalPayload(input), MdacPortalValidationError);
});
