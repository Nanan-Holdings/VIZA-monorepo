import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateInPortalServiceEligibility,
  formatInPreflightFailure,
  IN_UNCONDITIONAL_REQUIRED_FIELDS,
  validateInSubmissionPreflight,
} from "../preflight.js";

function completeIndiaAnswers(): Record<string, string> {
  const answers = Object.fromEntries(
    IN_UNCONDITIONAL_REQUIRED_FIELDS.map((field) => [field, "no"]),
  );
  return {
    ...answers,
    nationality: "CHN",
    passport_type: "1",
    port_of_arrival: "I004",
    date_of_birth: "01/01/1990",
    tourist_validity: "1_year",
    tourist_purpose: "recreation_sightseeing",
    expected_arrival_date: "20/10/2026",
    surname: "APPLICANT",
    given_names: "TEST",
    gender: "male",
    birth_town_city: "BEIJING",
    birth_country: "CHN",
    national_id_number: "NA",
    religion: "buddhism",
    visible_identification_marks: "NA",
    educational_qualification: "graduate",
    nationality_acquisition: "birth",
    passport_number: "E00000000",
    passport_place_of_issue: "BEIJING",
    passport_issue_date: "01/01/2024",
    passport_expiry_date: "01/01/2034",
    present_house_street: "TEST STREET",
    present_village_town_city: "BEIJING",
    present_country: "CHN",
    present_state_province_district: "BEIJING",
    present_postal_code: "100000",
    phone_number: "+8613800000000",
    permanent_address_same_as_present: "yes",
    father_name: "TEST FATHER",
    father_nationality: "CHN",
    father_place_of_birth: "BEIJING",
    father_country_of_birth: "CHN",
    mother_name: "TEST MOTHER",
    mother_nationality: "CHN",
    mother_place_of_birth: "BEIJING",
    mother_country_of_birth: "CHN",
    marital_status: "single",
    place_to_visit_1: "DELHI",
    expected_port_of_exit: "I004",
    india_reference_name: "TEST REFERENCE",
    india_reference_address: "TEST INDIA ADDRESS",
    india_reference_phone: "+911100000000",
    home_country_reference_name: "TEST HOME REFERENCE",
    home_country_reference_address: "TEST HOME ADDRESS",
    home_country_reference_phone: "+8613800000000",
    final_declaration: "yes",
  };
}

test("India preflight maps tourist validity/purpose IDs and forces VIZA email", () => {
  const result = validateInSubmissionPreflight({
    answers: completeIndiaAnswers(),
    managedEmailAlias: "appl-test@viza.it.com",
    documents: [
      { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
      { documentType: "passport_bio_page", storagePath: "profiles/test/passport.pdf", status: "uploaded" },
    ],
    captchaConfigured: true,
  });

  assert.equal(result.ready, true);
  assert.equal(result.registration.touristServiceId, "3");
  assert.equal(result.registration.touristPurposeId, "21");
  assert.equal(result.registration.arrivalPortId, "I004");
  assert.equal(result.registration.emailAddress, "appl-test@viza.it.com");
});

test("India preflight activates conditional answers/documents without inventing them", () => {
  const answers = completeIndiaAnswers();
  answers.has_changed_name = "yes";
  answers.tourist_purpose = "short_term_course";
  const result = validateInSubmissionPreflight({
    answers,
    managedEmailAlias: "appl-test@viza.it.com",
    documents: [
      { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
    ],
    captchaConfigured: false,
  });
  const message = formatInPreflightFailure(result);

  assert.ok(result.missingAnswers.includes("previous_name_details"));
  assert.deepEqual(result.missingDocuments, ["passport_bio_page", "short_course_letter"]);
  assert.deepEqual(result.missingCredentials, ["TWOCAPTCHA_API_KEY"]);
  assert.doesNotMatch(message, /TEST STREET|E00000000|appl-test@/);
});

test("India purpose IDs are validity-specific", () => {
  const answers = completeIndiaAnswers();
  answers.tourist_validity = "5_years";
  answers.tourist_purpose = "voluntary_work";
  const result = validateInSubmissionPreflight({
    answers,
    managedEmailAlias: "appl-test@viza.it.com",
    documents: [
      { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
      { documentType: "passport_copy", storagePath: "profiles/test/passport.pdf", status: "uploaded" },
      { documentType: "voluntary_work_letter", storagePath: "profiles/test/letter.pdf", status: "uploaded" },
    ],
    captchaConfigured: true,
  });

  assert.equal(result.registration.touristServiceId, "32");
  assert.equal(result.registration.touristPurposeId, "262");
  assert.equal(result.ready, true);
});

test("India preflight converts ISO dates to the official DD/MM/YYYY shape", () => {
  const answers = completeIndiaAnswers();
  answers.date_of_birth = "1990-01-02";
  answers.passport_issue_date = "2024-03-04";
  answers.passport_expiry_date = "2034-05-06";
  answers.expected_arrival_date = "2026-10-20";
  const result = validateInSubmissionPreflight({
    answers,
    managedEmailAlias: "appl-test@viza.it.com",
    documents: [
      { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
      { documentType: "passport_copy", storagePath: "profiles/test/passport.pdf", status: "uploaded" },
    ],
    captchaConfigured: true,
  });

  assert.equal(result.registration.dateOfBirth, "02/01/1990");
  assert.equal(result.registration.expectedArrivalDate, "20/10/2026");
  assert.equal(result.normalizedAnswers.passport_issue_date, "04/03/2024");
  assert.equal(result.normalizedAnswers.passport_expiry_date, "06/05/2034");
  assert.equal(result.ready, true);
});

test("India official service allowlist fails closed for an unavailable tourist service", () => {
  assert.deepEqual(
    evaluateInPortalServiceEligibility({
      allowedServiceIds: ["48"],
      requestedServiceId: "3",
    }),
    { allowed: false, reason: "requested_service_not_allowed" },
  );
  assert.deepEqual(
    evaluateInPortalServiceEligibility({
      allowedServiceIds: ["1", "3", "31", "32"],
      requestedServiceId: "3",
    }),
    { allowed: true },
  );
});

test("India preflight requires the real declaration to be affirmatively accepted", () => {
  const answers = completeIndiaAnswers();
  answers.final_declaration = "false";
  const result = validateInSubmissionPreflight({
    answers,
    managedEmailAlias: "appl-test@viza.it.com",
    documents: [
      { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
      { documentType: "passport_copy", storagePath: "profiles/test/passport.pdf", status: "uploaded" },
    ],
    captchaConfigured: true,
  });

  assert.ok(result.missingAnswers.includes("final_declaration"));
});

test("India live eligibility gate activates only its truthful conditional answers", () => {
  const answers = completeIndiaAnswers();
  answers.visited_drc_uganda_south_sudan_last_21_days = "yes";
  const waiting = validateInSubmissionPreflight({
    answers,
    managedEmailAlias: "appl-test@viza.it.com",
    documents: [
      { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
      { documentType: "passport_copy", storagePath: "profiles/test/passport.pdf", status: "uploaded" },
    ],
    captchaConfigured: true,
  });
  assert.ok(waiting.missingAnswers.includes("completed_21_days_after_exit"));
  assert.ok(!waiting.missingAnswers.includes("ebola_symptoms_last_21_days"));

  answers.completed_21_days_after_exit = "yes";
  answers.ebola_symptoms_last_21_days = "yes";
  const symptomatic = validateInSubmissionPreflight({
    answers,
    managedEmailAlias: "appl-test@viza.it.com",
    documents: [
      { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
      { documentType: "passport_copy", storagePath: "profiles/test/passport.pdf", status: "uploaded" },
    ],
    captchaConfigured: true,
  });
  assert.ok(symptomatic.missingAnswers.includes("ebola_symptom"));
});

test("India preflight rejects documents without an explicit usable status", () => {
  for (const status of [null, "", "unknown", "missing", "processing", "quarantined", "rejected"]) {
    const result = validateInSubmissionPreflight({
      answers: completeIndiaAnswers(),
      managedEmailAlias: "appl-test@viza.it.com",
      documents: [
        { documentType: "photo", storagePath: "profiles/test/photo.jpg", status: "uploaded" },
        { documentType: "passport_copy", storagePath: "profiles/test/passport.pdf", status },
      ],
      captchaConfigured: true,
    });
    assert.ok(result.missingDocuments.includes("passport_bio_page"), String(status));
    assert.equal(result.ready, false, String(status));
  }
});
