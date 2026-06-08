import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getCountrySubmissionProvider,
  listCountrySubmissionProviders,
  runDryRunSubmission,
} from "../index";
import type { CountrySubmissionApplication } from "../types";

function baseApplication(
  overrides: Partial<CountrySubmissionApplication> = {},
): CountrySubmissionApplication {
  return {
    applicationId: "11111111-2222-4333-8444-555555555555",
    userId: "test-user",
    applicantId: "test-applicant",
    countryCode: "canada",
    visaType: "CA_TRV",
    profile: {
      fullName: "Alex Tan",
      dateOfBirth: "1999-01-15",
      gender: "Male",
      nationality: "Singapore",
      passportNumber: "TEST123456",
      passportIssueDate: "2023-01-01",
      passportExpiryDate: "2033-01-01",
      passportIssuingCountry: "Singapore",
      email: "test.viza.user@example.com",
      phone: "+6591234567",
      address: "1 Test Street, Singapore 000001",
      occupation: "Student",
      employerOrSchool: "National University of Singapore",
    },
    trip: {
      destinationCountry: "Canada",
      destinationCity: "Toronto",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-10",
      purpose: "Tourism",
      accommodationName: "Test Hotel",
      accommodationAddress: "1 Test Hotel Road",
      funding: "Self-funded",
      budget: "Medium",
    },
    answers: {
      has_criminal_record: "No",
      overstay_history: "No",
    },
    metadata: { test: true },
    ...overrides,
  };
}

function vietnamAnswers(): Record<string, string> {
  return {
    surname: "TAN",
    given_name: "ALEX",
    date_of_birth: "1999-01-15",
    sex: "male",
    nationality: "Singapore",
    email_address: "test.viza.user@example.com",
    re_enter_email_address: "test.viza.user@example.com",
    religion: "None",
    place_of_birth: "Singapore",
    has_multiple_nationalities: "no",
    has_violated_vietnam_laws: "no",
    visa_type_requested: "single",
    visa_valid_from: "2026-10-01",
    visa_valid_to: "2026-10-30",
    passport_number: "TEST123456",
    passport_type: "ordinary_passport",
    passport_issue_date: "2023-01-01",
    passport_expiry_date: "2033-01-01",
    permanent_residential_address: "1 Test Street, Singapore 000001",
    contact_address: "1 Test Street, Singapore 000001",
    telephone_number: "+6591234567",
    emergency_contact_full_name: "Jamie Tan",
    emergency_contact_current_address: "2 Test Street, Singapore 000002",
    emergency_contact_telephone: "+6597654321",
    emergency_contact_relationship: "Sibling",
    purpose_of_entry: "tourist",
    intended_date_of_entry: "2026-10-01",
    intended_length_of_stay: "10",
    residential_address_in_vietnam: "1 Nguyen Hue Street, Ho Chi Minh City",
    intended_province_city: "ho_chi_minh_city",
    intended_ward_commune: "Ben Thanh",
    intended_border_gate_of_entry: "tan_son_nhat_int_airport_ho_chi_minh_city",
    intended_border_gate_of_exit: "tan_son_nhat_int_airport_ho_chi_minh_city",
    declaration_temporary_residence: "true",
    visited_vietnam_in_last_year: "no",
    has_relatives_in_vietnam: "no",
    final_declaration: "true",
  };
}

test("registry: every provider declares implementation and dry-run metadata", () => {
  const providers = listCountrySubmissionProviders();
  assert.ok(providers.length >= 20);
  for (const provider of providers) {
    assert.ok(provider.countryCode);
    assert.ok(provider.displayName);
    assert.ok(provider.supportedVisaTypes.length > 0);
    assert.ok(provider.schemaVersion);
    assert.ok(provider.implementationStatus);
    assert.equal(typeof provider.dryRunAvailable, "boolean");
    assert.equal(typeof provider.sandboxAvailable, "boolean");
    assert.equal(typeof provider.realSubmitAvailable, "boolean");
    assert.ok(provider.requiredFields.some((field) => field.required));
  }
});

test("registry: resolves by country and visa type", () => {
  assert.equal(getCountrySubmissionProvider("canada", "CA_TRV")?.countryCode, "CA");
  assert.equal(getCountrySubmissionProvider("germany", "EU_SCHENGEN_C_SHORT_STAY")?.countryCode, "SCHENGEN");
  assert.equal(getCountrySubmissionProvider("unknownland", "NOPE"), null);
});

test("registry: valid base profile dry-runs with a mock confirmation", async () => {
  const result = await runDryRunSubmission(baseApplication());
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.targetCountry, "CA");
  assert.match(result.confirmationNumber ?? "", /^MOCK-CA-/);
});

test("registry: Vietnam provider retains seeded answers in dry-run payload", () => {
  const provider = getCountrySubmissionProvider("vietnam", "VN_E_VISA");
  assert.ok(provider);
  const payload = provider.mapToSubmissionPayload(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
        destinationCity: "Ho Chi Minh City",
      },
      answers: vietnamAnswers(),
    }),
  );

  assert.equal(payload.countryCode, "VN");
  assert.equal(payload.countrySpecific.surname, "TAN");
  assert.equal(payload.countrySpecific.intended_border_gate_of_entry, "tan_son_nhat_int_airport_ho_chi_minh_city");
  assert.equal(payload.countrySpecific.final_declaration, "true");
});

test("registry: Vietnam dry-run uses deterministic Vietnam confirmation", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
        destinationCity: "Ho Chi Minh City",
      },
      answers: vietnamAnswers(),
    }),
  );
  assert.equal(result.status, "submitted_mock");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.targetCountry, "VN");
  assert.match(result.confirmationNumber ?? "", /^DRYRUN-VIETNAM-111111112222$/);
});

test("registry: missing required fields fail validation cleanly", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      profile: {
        ...baseApplication().profile,
        passportNumber: "",
      },
    }),
  );
  assert.equal(result.status, "unsupported");
  assert.match(result.message, /profile\.passportNumber/);
});

test("registry: Vietnam missing required schema answers fail validation cleanly", async () => {
  const answers = vietnamAnswers();
  delete answers.passport_number;
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
      },
      answers,
    }),
  );
  assert.equal(result.status, "unsupported");
  assert.match(result.message, /answers\.passport_number/);
});

test("registry: Vietnam conditional schema answers are enforced only when gated on", async () => {
  const answers = {
    ...vietnamAnswers(),
    has_relatives_in_vietnam: "yes",
  };
  delete answers.relative_full_name_in_vn;

  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "vietnam",
      visaType: "VN_E_VISA",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Vietnam",
      },
      answers,
    }),
  );

  assert.equal(result.status, "unsupported");
  assert.match(result.message, /answers\.relative_full_name_in_vn/);
});

test("registry: unsupported countries return a controlled unsupported result", async () => {
  const result = await runDryRunSubmission(
    baseApplication({
      countryCode: "atlantis",
      visaType: "ATLANTIS_VISITOR",
      trip: {
        ...baseApplication().trip,
        destinationCountry: "Atlantis",
      },
    }),
  );
  assert.equal(result.status, "unsupported");
  assert.equal(result.message, "Submission for this country is not implemented yet.");
});
