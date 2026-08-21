import assert from "node:assert/strict";
import test from "node:test";
import {
  KE_ETA_EXPEDITED_FEE_USD,
  KE_ETA_REQUIRED_ANSWER_KEYS,
  normalizeKeEtaPortalPayload,
  KeEtaPortalValidationError,
} from "../normalize";
import type { SubmissionPayload } from "../../country-submissions/types";

function payload(metadata: Record<string, unknown> = {}): SubmissionPayload {
  return {
    payloadVersion: "test",
    countryCode: "KE",
    visaType: "KE_ETA",
    applicationId: "ke-app-1",
    dryRun: false,
    idempotencyKey: "ke-key-1",
    personal: {
      fullName: "ZHANG SAN",
      dateOfBirth: "1990-01-02",
      gender: "Male",
      nationality: "China",
      passportNumber: "E12345678",
      passportIssueDate: "2020-01-02",
      passportExpiryDate: "2030-01-02",
      passportIssuingCountry: "China",
      phone: "+8613800000000",
      email: "appl-test@viza.it.com",
      address: "Shanghai, China",
    },
    trip: {
      arrivalDate: "2026-09-10",
      departureDate: "2026-09-20",
      purpose: "Tourism",
      accommodationName: "Nairobi Hotel",
      accommodationAddress: "1 Nairobi Street",
    },
    countrySpecific: {
      surname: "ZHANG",
      given_names: "SAN",
      date_of_birth: "1990-01-02",
      sex: "Male",
      nationality: "China",
      passport_number: "E12345678",
      passport_issue_date: "2020-01-02",
      passport_expiry_date: "2030-01-02",
      passport_issuing_country: "China",
      email_address: "appl-test@viza.it.com",
      phone_number: "+8613800000000",
      residential_address: "Shanghai, China",
      country_of_residence: "China",
      arrival_date: "2026-09-10",
      departure_date: "2026-09-20",
      entry_point: "Jomo Kenyatta International Airport",
      flight_number: "KQ861",
      purpose_of_travel: "Tourism",
      accommodation_name: "Nairobi Hotel",
      accommodation_address: "1 Nairobi Street",
      accommodation_phone: "+254700000000",
      processing_speed: "Standard",
      has_currency_over_usd_10000: "no",
      declaration_confirmed: "yes",
    },
    metadata,
  };
}

test("normalizes Kenya eTA canonical seed answers without reading document paths from answers", () => {
  const result = normalizeKeEtaPortalPayload(payload({
    attachments: {
      passportBioPage: "/tmp/passport.jpg",
      passportPhoto: "/tmp/photo.jpg",
    },
  }));
  assert.equal(result.surname, "ZHANG");
  assert.equal(result.entryPoint, "Jomo Kenyatta International Airport");
  assert.equal(result.officialFeeAmount, 30);
  assert.equal(result.attachments?.passportBioPage, "/tmp/passport.jpg");
});

test("required runner keys stay in parity with the canonical Kenya seed answer contract", () => {
  assert.deepEqual([...KE_ETA_REQUIRED_ANSWER_KEYS], [
    "surname",
    "given_names",
    "date_of_birth",
    "sex",
    "nationality",
    "passport_number",
    "passport_issue_date",
    "passport_expiry_date",
    "passport_issuing_country",
    "email_address",
    "phone_number",
    "residential_address",
    "country_of_residence",
    "arrival_date",
    "departure_date",
    "entry_point",
    "flight_number",
    "purpose_of_travel",
    "accommodation_name",
    "accommodation_address",
    "accommodation_phone",
    "processing_speed",
    "has_currency_over_usd_10000",
    "declaration_confirmed",
  ]);
});

test("rejects Kenya eTA payload when a canonical declaration answer is absent", () => {
  const invalid = payload();
  delete invalid.countrySpecific.declaration_confirmed;
  assert.throws(
    () => normalizeKeEtaPortalPayload(invalid),
    (error: unknown) => error instanceof KeEtaPortalValidationError
      && error.missingFields.includes("declaration_confirmed"),
  );
});

test("does not treat answer file paths as Kenya eTA documents", () => {
  const invalid = payload();
  invalid.countrySpecific.passport_bio_page = "/tmp/passport.jpg";
  invalid.countrySpecific.passport_photo = "/tmp/photo.jpg";
  const result = normalizeKeEtaPortalPayload(invalid);
  assert.equal(result.attachments, undefined);
});

test("requires the canonical USD 130 total for expedited Kenya eTA", () => {
  const expedited = payload({ officialFeeAmount: KE_ETA_EXPEDITED_FEE_USD });
  expedited.countrySpecific.processing_speed = "Expedited";
  assert.equal(normalizeKeEtaPortalPayload(expedited).officialFeeAmount, 130);

  const underfunded = payload({ officialFeeAmount: 30 });
  underfunded.countrySpecific.processing_speed = "Expedited";
  assert.throws(
    () => normalizeKeEtaPortalPayload(underfunded),
    (error: unknown) => error instanceof KeEtaPortalValidationError
      && error.missingFields.includes("officialFeeAmount"),
  );
});

test("does not let answers override the application-scoped official-fee intent", () => {
  const answerOverride = payload();
  answerOverride.countrySpecific.official_fee_amount = "130";
  assert.equal(normalizeKeEtaPortalPayload(answerOverride).officialFeeAmount, 30);
});
