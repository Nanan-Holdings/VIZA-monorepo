import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatTrPreflightFailure,
  validateTrSubmissionPreflight,
} from "../preflight.js";

const COMPLETE_TR_ANSWERS: Record<string, string> = {
  travel_document_country: "CHN",
  travel_document_type: "UMP",
  intended_arrival_date: "20/10/2026",
  given_names: "TEST",
  surname: "APPLICANT",
  date_of_birth: "01/01/1990",
  place_of_birth: "BEIJING",
  travel_document_number: "E00000000",
  travel_document_issue_date: "01/01/2024",
  travel_document_expiry_date: "01/01/2034",
  email_address: "personal@example.test",
  phone_number: "+8613800000000",
  residence_address: "TEST ADDRESS",
  supporting_document_type: "none",
  confirm_passport_covers_stay: "yes",
  confirm_return_ticket_accommodation_funds: "yes",
  confirm_tourism_or_business: "yes",
  confirm_all_official_prerequisites: "yes",
};

test("TR preflight forces official correspondence to the VIZA alias", () => {
  const result = validateTrSubmissionPreflight({
    answers: COMPLETE_TR_ANSWERS,
    managedEmailAlias: "Appl-Test@Viza.It.Com",
    documents: [
      { documentType: "passport_copy", storagePath: "profiles/test/passport.pdf", status: "uploaded" },
    ],
    captchaConfigured: true,
  });

  assert.equal(result.ready, true);
  assert.equal(result.normalizedAnswers.email_address, "appl-test@viza.it.com");
  assert.notEqual(result.normalizedAnswers.email_address, COMPLETE_TR_ANSWERS.email_address);
});

test("TR preflight reports only field/document/credential keys, never answer values", () => {
  const result = validateTrSubmissionPreflight({
    answers: { ...COMPLETE_TR_ANSWERS, residence_address: "", supporting_document_type: "visa" },
    managedEmailAlias: null,
    documents: [],
    captchaConfigured: false,
  });
  const message = formatTrPreflightFailure(result);

  assert.deepEqual(result.missingAnswers, [
    "email_address",
    "residence_address",
    "supporting_visa_issued_by",
    "supporting_document_number",
    "supporting_visa_expiry_date",
    "confirm_supporting_document_valid",
  ]);
  assert.deepEqual(result.missingDocuments, ["passport_copy"]);
  assert.deepEqual(result.missingCredentials, ["viza_inbox_alias", "TWOCAPTCHA_API_KEY"]);
  assert.doesNotMatch(message, /TEST ADDRESS|E00000000|personal@example/);
});

test("TR preflight can establish eligibility before downstream intake is complete", () => {
  const result = validateTrSubmissionPreflight({
    answers: {
      travel_document_country: "CHN",
      travel_document_type: "UMP",
      intended_arrival_date: "22/12/2026",
    },
    managedEmailAlias: "applicant@viza.example",
    documents: [],
    captchaConfigured: true,
  });

  assert.equal(result.readyForEligibility, true);
  assert.equal(result.ready, false);
  assert.deepEqual(result.eligibilityMissingAnswers, []);
  assert.ok(result.missingAnswers.includes("given_names"));
  assert.deepEqual(result.missingDocuments, ["passport_copy"]);
});

test("TR preflight rejects documents without an explicit usable status", () => {
  for (const status of [null, "", "unknown", "missing", "processing", "quarantined", "rejected"]) {
    const result = validateTrSubmissionPreflight({
      answers: COMPLETE_TR_ANSWERS,
      managedEmailAlias: "appl-test@viza.it.com",
      documents: [{
        documentType: "passport_copy",
        storagePath: "profiles/test/passport.pdf",
        status,
      }],
      captchaConfigured: true,
    });
    assert.deepEqual(result.missingDocuments, ["passport_copy"], String(status));
    assert.equal(result.ready, false, String(status));
  }
});
