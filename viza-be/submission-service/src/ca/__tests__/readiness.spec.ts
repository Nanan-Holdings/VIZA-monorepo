import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CANADA_PORTAL_SECRET_KEYS,
  assessCanadaTrvReadiness,
  canAdvanceCanadaPurposePageSafely,
  evaluateCanadaShowIf,
  isTrustedCanadaApplicationUrl,
  isTrustedCanadaBrowserUrl,
  isTrustedCanadaCognitoUrl,
  isTrustedCanadaPortalUrl,
  type CanadaReadinessInput,
} from "../readiness.js";

test("CA destination trust requires exact HTTPS origins without credentials or ports", () => {
  assert.equal(
    isTrustedCanadaPortalUrl("https://portal-portail.apps.cic.gc.ca/signin"),
    true,
  );
  assert.equal(
    isTrustedCanadaApplicationUrl("https://tr-rt.apps.cic.gc.ca/purpose"),
    true,
  );
  assert.equal(
    isTrustedCanadaBrowserUrl("https://tr-rt.apps.cic.gc.ca/representative"),
    true,
  );
  assert.equal(
    isTrustedCanadaCognitoUrl(
      "https://cognito-idp.ca-central-1.amazonaws.com/",
    ),
    true,
  );

  for (const untrusted of [
    "http://portal-portail.apps.cic.gc.ca/signin",
    "https://portal-portail.apps.cic.gc.ca.evil.example/signin",
    "https://user:password@portal-portail.apps.cic.gc.ca/signin",
    "https://portal-portail.apps.cic.gc.ca:444/signin",
    "https://evil.example/?next=https://portal-portail.apps.cic.gc.ca/signin",
  ]) {
    assert.equal(isTrustedCanadaPortalUrl(untrusted), false, untrusted);
    assert.equal(isTrustedCanadaBrowserUrl(untrusted), false, untrusted);
  }
  assert.equal(
    isTrustedCanadaCognitoUrl(
      "http://cognito-idp.ca-central-1.amazonaws.com/",
    ),
    false,
  );
  assert.equal(
    isTrustedCanadaCognitoUrl(
      "https://cognito-idp.ca-central-1.amazonaws.com.evil.example/",
    ),
    false,
  );
});

function readyInput(): CanadaReadinessInput {
  return {
    country: "canada",
    visaType: "CA_TRV",
    applicationStatus: "draft",
    applicationConsentPresent: true,
    applicationSignaturePresent: true,
    managedAliasPresent: true,
    aliasForwardingConsent: true,
    portalTermsConsentPresent: true,
    portalSecretKeys: [
      CANADA_PORTAL_SECRET_KEYS.email,
      CANADA_PORTAL_SECRET_KEYS.password,
    ],
    answers: {
      service_language: "english",
      has_other_names_used: "no",
      marital_status: "single",
    },
    fields: [
      { field_name: "service_language", required: true },
      { field_name: "has_other_names_used", required: true },
      {
        field_name: "other_family_name",
        required: true,
        conditional_logic: { showIf: "has_other_names_used === yes" },
      },
      {
        field_name: "current_partner_family_name",
        required: true,
        conditional_logic: {
          showIf: "marital_status === married || marital_status === common_law",
        },
      },
    ],
    documentRequirements: [
      {
        requirement_key: "passport_copy",
        required: true,
        metadata: { document_type: "passport_copy" },
      },
      {
        requirement_key: "photo",
        required: true,
        metadata: { document_type: "photo" },
      },
    ],
    documents: [
      {
        requirement_key: "passport_copy",
        document_type: "passport_copy",
        storage_path: "safe/passport.pdf",
        status: "validated",
      },
      {
        requirement_key: "photo",
        document_type: "photo",
        storage_path: "safe/photo.jpg",
        status: "approved",
      },
    ],
  };
}

test("CA conditional evaluator supports the seed's AND/OR equality grammar", () => {
  assert.equal(
    evaluateCanadaShowIf(
      "country_of_citizenship === China && china_first_trip_outside_china === no",
      {
        country_of_citizenship: "China",
        china_first_trip_outside_china: "no",
      },
    ),
    true,
  );
  assert.equal(
    evaluateCanadaShowIf(
      "marital_status === married || marital_status === common_law",
      { marital_status: "single" },
    ),
    false,
  );
});

test("CA readiness ignores required conditional fields when their branch is inactive", () => {
  const result = assessCanadaTrvReadiness(readyInput());
  assert.equal(result.readyForPortalLogin, true);
  assert.equal(result.readyForTermsAcceptance, true);
  assert.equal(result.readyForFullForm, true);
  assert.deepEqual(result.blockers, []);
});

test("CA login readiness is independent from later form, signature, and document gates", () => {
  const input = readyInput();
  input.answers = {};
  input.documents = [];
  input.applicationConsentPresent = false;
  input.applicationSignaturePresent = false;
  const result = assessCanadaTrvReadiness(input);

  assert.equal(result.readyForPortalLogin, true);
  assert.equal(result.readyForFullForm, false);
  assert.deepEqual(result.loginBlockers, []);
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing_required_answers"));
});

test("CA terms acceptance requires a versioned portal-specific consent event", () => {
  const input = readyInput();
  input.portalTermsConsentPresent = false;
  const result = assessCanadaTrvReadiness(input);

  assert.equal(result.readyForPortalLogin, true);
  assert.equal(result.readyForTermsAcceptance, false);
  assert.equal(result.readyForPurposePage, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing_portal_terms_consent"));
});

test("CA legal certification checkboxes require an affirmative value", () => {
  const input = readyInput();
  input.fields = [{
    field_name: "applicant_declaration",
    field_type: "checkbox",
    required: true,
  }];
  input.answers = { applicant_declaration: "no" };
  let result = assessCanadaTrvReadiness(input);
  assert.deepEqual(result.missingRequiredAnswers, ["applicant_declaration"]);

  input.answers.applicant_declaration = "yes";
  result = assessCanadaTrvReadiness(input);
  assert.deepEqual(result.missingRequiredAnswers, []);
});

test("CA readiness reports active conditional answers, uploads, consent and account blockers", () => {
  const input = readyInput();
  input.answers.has_other_names_used = "yes";
  input.documents = [];
  input.applicationConsentPresent = false;
  input.applicationSignaturePresent = false;
  input.portalSecretKeys = [];

  const result = assessCanadaTrvReadiness(input);
  assert.equal(result.readyForPortalLogin, false);
  assert.deepEqual(result.missingRequiredAnswers, ["other_family_name"]);
  assert.deepEqual(result.missingRequiredDocuments, ["passport_copy", "photo"]);
  assert.deepEqual(result.missingPortalSecretKeys, [
    CANADA_PORTAL_SECRET_KEYS.email,
    CANADA_PORTAL_SECRET_KEYS.password,
  ]);
  assert.deepEqual(
    result.blockers.map((blocker) => blocker.code),
    [
      "missing_required_answers",
      "missing_required_documents",
      "missing_application_consent",
      "missing_application_signature",
      "missing_portal_credentials",
      "missing_portal_invitation_code",
    ],
  );
});

test("CA readiness distinguishes uploaded files from reviewed files", () => {
  const input = readyInput();
  input.documents = input.documents.map((document) => ({
    ...document,
    status: "uploaded",
  }));
  const result = assessCanadaTrvReadiness(input);
  assert.deepEqual(result.missingRequiredDocuments, []);
  assert.deepEqual(result.documentsPendingReview, ["passport_copy", "photo"]);
  assert.equal(result.readyForPortalLogin, true);
  assert.equal(result.readyForFullForm, false);
});

test("CA readiness rejects legacy and unknown document statuses", () => {
  for (const status of ["verified", "ready", "review_complete", "unknown"]) {
    const input = readyInput();
    input.documents = input.documents.map((document) => ({
      ...document,
      status,
    }));
    const result = assessCanadaTrvReadiness(input);
    assert.deepEqual(
      result.missingRequiredDocuments,
      ["passport_copy", "photo"],
      status,
    );
    assert.deepEqual(result.documentsPendingReview, [], status);
    assert.equal(result.readyForFullForm, false, status);
  }
});

test("CA safe purpose advancement ignores final consent/signature but still requires purpose answers", () => {
  const input = readyInput();
  input.applicationConsentPresent = false;
  input.applicationSignaturePresent = false;
  Object.assign(input.answers, {
    visit_details: "Tourism in Vancouver and Banff.",
    intended_stay_from: "2026-10-10",
    intended_stay_to: "2026-10-20",
  });

  let readiness = assessCanadaTrvReadiness(input);
  assert.equal(readiness.readyForPurposePage, true);
  assert.equal(readiness.readyForFullForm, false);
  assert.equal(canAdvanceCanadaPurposePageSafely(readiness), true);

  delete input.answers.visit_details;
  readiness = assessCanadaTrvReadiness(input);
  assert.equal(readiness.readyForPurposePage, false);
  assert.equal(canAdvanceCanadaPurposePageSafely(readiness), false);
});
