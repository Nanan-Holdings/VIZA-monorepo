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
