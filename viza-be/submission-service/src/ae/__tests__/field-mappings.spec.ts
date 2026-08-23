import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  AE_REQUIRED_ANSWER_KEYS,
  AE_DOCUMENT_EVIDENCE_RULES,
  aeDocumentEvidenceReviewBlockers,
  aeMissingRequired,
  missingAeDocuments,
  normalizeAeAnswers,
  requiredAeDocumentKeys,
} from "../field-mappings.js";
import {
  AE_EVIDENCE_REVIEW_COMMAND,
  AE_EVIDENCE_REVIEW_SCHEMA,
  hashAeEvidenceState,
  hashAeStorageLocator,
  parseAeAuthoritativeEvidenceReview,
  selectLatestAeDecisiveDocumentAudit,
  type AeEvidenceAuditRow,
  type AeEvidenceDocumentRow,
} from "../document-evidence.js";
import {
  AE_PUBLIC_FEE_SCHEDULE_AED,
  AE_PUBLIC_LISTED_TOTAL_AED,
  aeAuthorizedCdpConnectionError,
  classifyAePortalState,
  isOfficialAePortalUrl,
  isCompleteAeFeeCheckpoint,
  parseAeFeeComponents,
  validateAeLiveConfig,
} from "../live-flow.js";

const AE_SEED_SOURCE = readFileSync(
  path.join(process.cwd(), "../agent-backend/scripts/seed-ae-tourist-visa-form-fields.ts"),
  "utf8",
);
const AE_RUNNER_SOURCE = readFileSync(path.join(process.cwd(), "src/ae/runner.ts"), "utf8");
const DOCUMENT_ACTIONS_SOURCE = readFileSync(
  path.join(process.cwd(), "../../viza-fe/internal-website/app/client/documents/actions.ts"),
  "utf8",
);
const ADMIN_DOCUMENT_ACTIONS_SOURCE = readFileSync(
  path.join(process.cwd(), "../../viza-fe/internal-website/app/actions/admin-documents.ts"),
  "utf8",
);
const REVIEW_INTEGRITY_MIGRATION_SOURCE = readFileSync(
  path.join(process.cwd(), "../agent-backend/drizzle/0164_application_document_review_integrity.sql"),
  "utf8",
);

const COMPLETE: Record<string, string> = {
  full_name: "EDWARD ZHANG",
  current_nationality: "China",
  profession: "Engineer",
  gender: "male",
  date_of_birth: "1990-04-15",
  country_of_birth: "China",
  place_of_birth: "Shanghai",
  religion: "None",
  marital_status: "Single",
  education_level: "University",
  passport_number: "E12345678",
  passport_type: "Regular",
  passport_issue_place: "Shanghai",
  passport_issuing_country: "China",
  passport_issue_date: "2020-01-01",
  passport_expiry_date: "2030-01-01",
  email_address: "example@example.com",
  residence_country: "Singapore",
  residential_address_outside_uae: "Example address",
  phone_outside_uae: "+6581234567",
  uae_emirate: "Dubai",
  uae_city: "Dubai",
  uae_area: "Downtown",
  uae_detailed_address: "Example UAE address",
  has_uae_mobile: "no",
  transaction_reason: "Tourism",
};

const AE_REVIEWED_AT = "2026-08-18T10:00:00.000Z";
const AE_DOCUMENT_BYTES = "current-reviewed-bank-statement";
const AE_DOCUMENT_HASH = `sha256:${createHash("sha256").update(AE_DOCUMENT_BYTES).digest("hex")}`;
const AE_BANK_EVIDENCE_STATE = {
  kind: "six_month_bank_statement" as const,
  statement_months: 6,
  minimum_monthly_balance_usd_equivalent: 4_000,
  official: true,
  stamped: true,
  signed: true,
  colored: true,
};

function authoritativeBankReviewFixture(): {
  document: AeEvidenceDocumentRow;
  audit: AeEvidenceAuditRow;
} {
  const document: AeEvidenceDocumentRow = {
    id: "document-1",
    application_id: "application-1",
    document_type: "bank_statement",
    requirement_key: "six_month_bank_statement",
    storage_path: "applicant/application-1/bank.pdf",
    status: "validated",
    reviewed_at: AE_REVIEWED_AT,
    reviewed_by: "reviewer-1",
    updated_at: AE_REVIEWED_AT,
    document_hash: AE_DOCUMENT_HASH,
  };
  const audit: AeEvidenceAuditRow = {
    id: "audit-1",
    actor_user_id: "reviewer-1",
    command: AE_EVIDENCE_REVIEW_COMMAND,
    target_type: "application_documents",
    target_id: document.id,
    created_at: AE_REVIEWED_AT,
    after_state: {
      schema_version: AE_EVIDENCE_REVIEW_SCHEMA,
      audit_event_id: "audit-1",
      application_id: document.application_id,
      document_id: document.id,
      document_type: document.document_type,
      requirement_key: document.requirement_key,
      status: "validated",
      reviewed_at: AE_REVIEWED_AT,
      reviewed_by: "reviewer-1",
      document_updated_at: AE_REVIEWED_AT,
      document_hash: AE_DOCUMENT_HASH,
      storage_locator_hash: hashAeStorageLocator(document.storage_path as string),
      evidence_state: AE_BANK_EVIDENCE_STATE,
      evidence_state_hash: hashAeEvidenceState(AE_BANK_EVIDENCE_STATE),
    },
  };
  return { document, audit };
}

test("ae transaction-783 contract normalizes established profile aliases", () => {
  const normalized = normalizeAeAnswers({ nationality: "China", city_of_birth: "Shanghai", email: "a@example.com" });
  assert.equal(normalized.current_nationality, "China");
  assert.equal(normalized.place_of_birth, "Shanghai");
  assert.equal(normalized.email_address, "a@example.com");
});

test("ae answer and conditional mobile contracts fail closed", () => {
  assert.deepEqual(aeMissingRequired(COMPLETE), []);
  assert.ok(aeMissingRequired({ ...COMPLETE, has_uae_mobile: "yes" }).includes("uae_mobile_number"));
  assert.ok(aeMissingRequired({}).includes("transaction_reason"));
});

test("ae public service-card documents exclude optional IDs and conditionally requested accommodation", () => {
  assert.equal(requiredAeDocumentKeys("China").includes("national_identity_copy"), false);
  assert.equal(requiredAeDocumentKeys("Iran").includes("national_identity_copy"), false);
  assert.equal(
    requiredAeDocumentKeys("Iran", ["national_identity_copy"]).includes("national_identity_copy"),
    true,
  );
  assert.equal(requiredAeDocumentKeys("China").includes("uae_accommodation_evidence"), false);
  assert.equal(
    requiredAeDocumentKeys("China", ["uae_accommodation_evidence"]).includes("uae_accommodation_evidence"),
    true,
  );
  assert.deepEqual(missingAeDocuments(requiredAeDocumentKeys("China"), "China"), []);
  assert.deepEqual(
    missingAeDocuments(requiredAeDocumentKeys("China"), "China", ["uae_accommodation_evidence"]),
    ["uae_accommodation_evidence"],
  );
});

test("ae evidence review enforces the exact bank and UAE insurance content rules", () => {
  const reviewedAt = "2026-08-18T10:00:00.000Z";
  const facts = {
    sixMonthBankStatement: {
      status: "validated",
      reviewedAt,
      documentUpdatedAt: reviewedAt,
      monthsCovered: 6,
      minimumMonthlyBalanceUsdEquivalent: 4_000,
      official: true,
      stamped: true,
      signed: true,
      colored: true,
    },
    uaeHealthCoverageEvidence: {
      status: "validated",
      reviewedAt,
      documentUpdatedAt: reviewedAt,
      issuerCountry: "United Arab Emirates",
      validityDays: 180,
    },
  };
  assert.deepEqual(aeDocumentEvidenceReviewBlockers(facts), []);
  assert.equal(AE_DOCUMENT_EVIDENCE_RULES.six_month_bank_statement.monthsCovered, 6);
  assert.equal(
    AE_DOCUMENT_EVIDENCE_RULES.uae_health_coverage_evidence.minimumValidityDays,
    180,
  );

  const blockers = aeDocumentEvidenceReviewBlockers({
    ...facts,
    sixMonthBankStatement: {
      ...facts.sixMonthBankStatement,
      status: "uploaded",
      monthsCovered: 5,
      minimumMonthlyBalanceUsdEquivalent: 3_999,
      stamped: false,
    },
    uaeHealthCoverageEvidence: {
      ...facts.uaeHealthCoverageEvidence,
      issuerCountry: "Singapore",
      validityDays: 179,
    },
  });
  assert.ok(blockers.includes("six_month_bank_statement:validated_status"));
  assert.ok(blockers.includes("six_month_bank_statement:months_covered"));
  assert.ok(blockers.includes("six_month_bank_statement:minimum_monthly_balance"));
  assert.ok(blockers.includes("six_month_bank_statement:stamped"));
  assert.ok(blockers.includes("uae_health_coverage_evidence:issuer_country"));
  assert.ok(blockers.includes("uae_health_coverage_evidence:validity_days"));
});

test("ae evidence accepts only exact immutable staff proof bound to current bytes and reviewer", () => {
  const { document, audit } = authoritativeBankReviewFixture();
  const reviewer = { id: "reviewer-1", role: "staff", deleted_at: null };
  const parsed = parseAeAuthoritativeEvidenceReview({
    applicationId: "application-1",
    document,
    audit,
    reviewer,
    actualDocumentHash: AE_DOCUMENT_HASH,
  });
  assert.equal(parsed?.key, "six_month_bank_statement");
  assert.equal(
    parsed && "minimumMonthlyBalanceUsdEquivalent" in parsed.facts
      ? parsed.facts.minimumMonthlyBalanceUsdEquivalent
      : null,
    4_000,
  );

  // Applicant metadata/status alone and a generic audit never establish the
  // content-specific transaction-783 facts.
  assert.equal(parseAeAuthoritativeEvidenceReview({
    applicationId: "application-1",
    document: { ...document, metadata: { forged: true } } as AeEvidenceDocumentRow,
    audit: { ...audit, command: "application_document.validated" },
    reviewer,
    actualDocumentHash: AE_DOCUMENT_HASH,
  }), null);
  assert.equal(parseAeAuthoritativeEvidenceReview({
    applicationId: "application-1",
    document,
    audit,
    reviewer,
    actualDocumentHash: "sha256:stale-or-replaced-bytes",
  }), null);
  assert.equal(parseAeAuthoritativeEvidenceReview({
    applicationId: "application-1",
    document: { ...document, storage_path: "application-1/replaced.pdf" },
    audit,
    reviewer,
    actualDocumentHash: AE_DOCUMENT_HASH,
  }), null);
  assert.equal(parseAeAuthoritativeEvidenceReview({
    applicationId: "application-1",
    document,
    audit,
    reviewer: { ...reviewer, id: "another-reviewer" },
    actualDocumentHash: AE_DOCUMENT_HASH,
  }), null);
  assert.equal(parseAeAuthoritativeEvidenceReview({
    applicationId: "application-1",
    document,
    audit,
    reviewer: { ...reviewer, deleted_at: AE_REVIEWED_AT },
    actualDocumentHash: AE_DOCUMENT_HASH,
  }), null);
  assert.equal(parseAeAuthoritativeEvidenceReview({
    applicationId: "application-1",
    document,
    audit: {
      ...audit,
      after_state: {
        ...(audit.after_state as Record<string, unknown>),
        evidence_state: { ...AE_BANK_EVIDENCE_STATE, statement_months: 5 },
      },
    },
    reviewer,
    actualDocumentHash: AE_DOCUMENT_HASH,
  }), null);
  assert.equal(parseAeAuthoritativeEvidenceReview({
    applicationId: "another-application",
    document,
    audit,
    reviewer,
    actualDocumentHash: AE_DOCUMENT_HASH,
  }), null);
});

test("ae latest staff document action invalidates replay after rejection", () => {
  const { audit } = authoritativeBankReviewFixture();
  const rejection: AeEvidenceAuditRow = {
    ...audit,
    id: "audit-2",
    command: "application_document.rejected",
    created_at: "2026-08-18T10:01:00.000Z",
    after_state: { status: "rejected" },
  };
  assert.equal(
    selectLatestAeDecisiveDocumentAudit("document-1", [audit, rejection])?.id,
    rejection.id,
  );
  assert.notEqual(
    selectLatestAeDecisiveDocumentAudit("document-1", [audit, rejection])?.command,
    AE_EVIDENCE_REVIEW_COMMAND,
  );
  assert.equal(selectLatestAeDecisiveDocumentAudit("document-1", [
    audit,
    { ...rejection, created_at: audit.created_at },
  ]), null);
});

test("ae evidence review is invalidated when a document is replaced after review", () => {
  const blockers = aeDocumentEvidenceReviewBlockers({
    sixMonthBankStatement: {
      status: "validated",
      reviewedAt: "2026-08-18T10:00:00.000Z",
      documentUpdatedAt: "2026-08-18T11:00:00.000Z",
      monthsCovered: 6,
      minimumMonthlyBalanceUsdEquivalent: 4_000,
      official: true,
      stamped: true,
      signed: true,
      colored: true,
    },
    uaeHealthCoverageEvidence: {
      status: "accepted",
      reviewedAt: "2026-08-18T10:00:00.000Z",
      documentUpdatedAt: "2026-08-18T11:00:00.000Z",
      issuerCountry: "United Arab Emirates",
      validityDays: 180,
    },
  });
  assert.ok(blockers.includes("six_month_bank_statement:current_document_review"));
  assert.ok(blockers.includes("uae_health_coverage_evidence:current_document_review"));
});

test("ae recoverable maintenance and payment states are distinct and payment requires full AED breakdown", () => {
  assert.equal(classifyAePortalState({
    url: "https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783",
    title: "ICP",
    bodyText: "We are coming back soon! سنعود بعد قليل!",
  }).checkpoint, "maintenance");
  assert.equal(classifyAePortalState({
    url: "https://smartservices.icp.gov.ae/payment",
    title: "Payment",
    bodyText: "Fees summary Pay now",
    hasPaymentControl: true,
    productVerified: true,
  }).checkpoint, "selector_drift");
  const payment = classifyAePortalState({
    url: "https://smartservices.icp.gov.ae/payment",
    title: "Payment",
    bodyText: [
      "Fees summary Pay now",
      "Request fee 100 AED",
      "Issuance fee 500 AED",
      "Security deposit 3,025 AED",
      "E-services fee 28 AED",
      "ICP fees 22 AED",
      "Smart Services 100 AED",
    ].join(" "),
    hasPaymentControl: true,
    productVerified: true,
  });
  assert.equal(payment.checkpoint, "payment");
  assert.equal(payment.observedCurrency, "AED");
  assert.equal(payment.observedAmount, "3775.00");
  assert.deepEqual(payment.observedComponents, Object.keys(AE_PUBLIC_FEE_SCHEDULE_AED));
  assert.equal(classifyAePortalState({
    url: "https://smartservices.icp.gov.ae/payment",
    title: "Payment",
    bodyText: "Fees summary AED 650.00 Pay now",
    hasPaymentControl: true,
    productVerified: false,
  }).checkpoint, "selector_drift");
});

test("ae public fee schedule is six AED components totaling the listed 3,775 AED", () => {
  const text = [
    "Request 100 AED",
    "Issue 500 AED",
    "Security deposit 3,025 AED",
    "e-services 28 AED",
    "ICP fees 22 AED",
    "Smart Services 100 AED",
  ].join(" ");
  const components = parseAeFeeComponents(text);
  assert.equal(isCompleteAeFeeCheckpoint(components), true);
  assert.equal(components.reduce((sum, component) => sum + component.amount, 0), AE_PUBLIC_LISTED_TOTAL_AED);
  assert.deepEqual(Object.fromEntries(components.map((component) => [component.key, component.amount])), AE_PUBLIC_FEE_SCHEDULE_AED);
  assert.equal(isCompleteAeFeeCheckpoint(components.slice(0, -1)), false);
});

test("ae current transaction-783 product page is a guest identity/session shell", () => {
  const state = classifyAePortalState({
    url: "https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783",
    title: "ICP Smart Services",
    bodyText: [
      "VISA - MULTIPLE ENTRY - LONG-TERM TOURISM (5 YEARS) FOR ALL NATIONALITIES - ISSUE NEW VISA",
      "Request Information Attachments Info Review Application Application Fees Sign In",
    ].join(" "),
    hasApplicantControl: false,
    hasDocumentInput: false,
    hasIdentityControl: true,
  });
  assert.equal(state.checkpoint, "guest_service_shell");
  assert.match(state.message, /authorized identity session/);
});

test("ae transaction-783 classifies session expiry and wrong-product routing", () => {
  assert.equal(classifyAePortalState({
    url: "https://smartservices.icp.gov.ae/echannels/web/client/default.html",
    title: "ICP",
    bodyText: "Your session has expired",
  }).checkpoint, "session_expired");
  assert.equal(classifyAePortalState({
    url: "https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/60",
    title: "ICP",
    bodyText: "Issue visa",
  }).checkpoint, "wrong_product");
});

test("ae accepts only the exact HTTPS ICP host even when a mirror copies trusted selectors", () => {
  assert.equal(isOfficialAePortalUrl(
    "https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783",
  ), true);
  for (const url of [
    "http://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783",
    "https://smartservices.icp.gov.ae.evil.test/issueVisa/request/783",
    "https://evil.test/smartservices.icp.gov.ae/issueVisa/request/783",
    "https://smartservices.icp.gov.ae:444/issueVisa/request/783",
    "https://user:secret@smartservices.icp.gov.ae/issueVisa/request/783",
  ]) {
    assert.equal(isOfficialAePortalUrl(url), false, url);
    assert.equal(classifyAePortalState({
      url,
      title: "ICP Smart Services",
      bodyText: "Beneficiary passport attachment payment request 100 AED",
      hasApplicantControl: true,
      hasDocumentInput: true,
      hasPaymentControl: true,
      productVerified: true,
    }).checkpoint, "selector_drift");
  }
});

test("ae runner persists no authenticated full-page image evidence", () => {
  assert.doesNotMatch(AE_RUNNER_SOURCE, /\.screenshot\s*\(|artifact\.put|fullPage/);
  assert.match(AE_RUNNER_SOURCE, /capture authenticated page images/);
});

test("application-only uploads and reuse remain unreviewed and never auto-promote", () => {
  assert.match(DOCUMENT_ACTIONS_SOURCE, /if \(input\.scope === "universal_profile"\)/);
  assert.doesNotMatch(
    DOCUMENT_ACTIONS_SOURCE,
    /scope\s*===\s*["']universal_profile["']\s*\|\|/,
  );
  assert.match(
    DOCUMENT_ACTIONS_SOURCE,
    /REUSABLE_DOCUMENT_STATUSES\s*=\s*\["uploaded", "validated", "accepted", "approved"\]/,
  );
  assert.match(DOCUMENT_ACTIONS_SOURCE, /\.in\("status", \[\.\.\.REUSABLE_DOCUMENT_STATUSES\]\)/);
  assert.match(DOCUMENT_ACTIONS_SOURCE, /status:\s*"uploaded"/);
  assert.match(DOCUMENT_ACTIONS_SOURCE, /reviewed_at:\s*null/);
  assert.match(DOCUMENT_ACTIONS_SOURCE, /reviewed_by:\s*null/);
  assert.match(DOCUMENT_ACTIONS_SOURCE, /document_hash:\s*null/);
  assert.match(DOCUMENT_ACTIONS_SOURCE, /metadata:\s*null/);
});

test("generic CA and UAE document review fields are applicant-write protected", () => {
  assert.match(REVIEW_INTEGRITY_MIGRATION_SOURCE, /BEFORE INSERT OR UPDATE ON public\.application_documents/);
  assert.match(REVIEW_INTEGRITY_MIGRATION_SOURCE, /NEW\.status NOT IN \('uploaded', 'missing'\)/);
  for (const field of [
    "reviewed_at",
    "reviewed_by",
    "document_hash",
    "metadata",
    "review_notes",
    "rejection_reason",
  ]) {
    assert.match(REVIEW_INTEGRITY_MIGRATION_SOURCE, new RegExp(`NEW\\.${field} IS NOT NULL`));
  }
  assert.match(REVIEW_INTEGRITY_MIGRATION_SOURCE, /users\.role IN \('admin', 'staff'\)/);
  assert.match(
    REVIEW_INTEGRITY_MIGRATION_SOURCE,
    /WHERE lower\(trim\(status\)\) IN \('validated', 'accepted', 'approved', 'verified', 'ready'\)/,
  );
  assert.match(
    REVIEW_INTEGRITY_MIGRATION_SOURCE,
    /SET status = 'uploaded',[\s\S]*reviewed_at = NULL,[\s\S]*reviewed_by = NULL,[\s\S]*document_hash = NULL,[\s\S]*metadata = NULL/,
  );
  assert.match(ADMIN_DOCUMENT_ACTIONS_SOURCE, /application_document\.ae_transaction_783_evidence_review\.v1/);
  assert.match(ADMIN_DOCUMENT_ACTIONS_SOURCE, /document_hash:\s*documentHash/);
  assert.match(ADMIN_DOCUMENT_ACTIONS_SOURCE, /\.eq\("storage_path", before\.storage_path\)/);
});

test("ae live config requires an explicitly authorized CDP session", () => {
  assert.deepEqual(validateAeLiveConfig({
    preSubmitEnabled: true,
    authenticatedCdpEnabled: true,
    documentUploadEnabled: true,
    paymentCheckpointEnabled: true,
    sessionMode: "uae_pass",
    providerAccountEligibility: null,
  }, {}), ["AE_CDP_ENDPOINT"]);
});

test("ae payment observation requires the authenticated document-upload stage", () => {
  assert.deepEqual(validateAeLiveConfig({
    preSubmitEnabled: true,
    authenticatedCdpEnabled: true,
    documentUploadEnabled: false,
    paymentCheckpointEnabled: true,
    sessionMode: "uae_pass",
    providerAccountEligibility: null,
  }, { AE_CDP_ENDPOINT: "ws://authorized.invalid" }), ["AE_DOCUMENT_UPLOAD_ENABLED"]);
});

test("ae CDP connection failures never expose endpoint credentials", () => {
  const error = aeAuthorizedCdpConnectionError(
    new Error("connect ws://user:secret@127.0.0.1:1 failed"),
  );
  assert.equal(error.message, "UAE authorized CDP endpoint was not reachable");
  assert.doesNotMatch(error.message, /user|secret|127\.0\.0\.1/);
});

test("ae rejects ordinary foreign-tourist username registration as a session mode", () => {
  assert.deepEqual(validateAeLiveConfig({
    preSubmitEnabled: true,
    authenticatedCdpEnabled: true,
    documentUploadEnabled: false,
    paymentCheckpointEnabled: false,
    sessionMode: "username",
    providerAccountEligibility: "ordinary_foreign_tourist",
  }, { AE_CDP_ENDPOINT: "ws://authorized.invalid" }), ["AE_SESSION_MODE"]);
  assert.deepEqual(validateAeLiveConfig({
    preSubmitEnabled: true,
    authenticatedCdpEnabled: true,
    documentUploadEnabled: false,
    paymentCheckpointEnabled: false,
    sessionMode: "eligible_provider_account",
    providerAccountEligibility: "ordinary_foreign_tourist",
  }, { AE_CDP_ENDPOINT: "ws://authorized.invalid" }), ["AE_PROVIDER_ACCOUNT_ELIGIBILITY"]);
});

test("ae answer contract stays in parity with the seed and excludes runner-only gates", () => {
  for (const key of AE_REQUIRED_ANSWER_KEYS) {
    assert.match(AE_SEED_SOURCE, new RegExp(`field_name:\\s*"${key}"`));
  }
  assert.match(AE_SEED_SOURCE, /field_name:\s*"uae_mobile_number"/);
  for (const runnerOnly of [
    "uae_pass_username",
    "uae_pass_password",
    "official_session",
    "document_evidence_review",
    "security_deposit",
    "payment_authorization",
  ]) {
    assert.doesNotMatch(AE_SEED_SOURCE, new RegExp(`field_name:\\s*"${runnerOnly}"`));
  }
});
