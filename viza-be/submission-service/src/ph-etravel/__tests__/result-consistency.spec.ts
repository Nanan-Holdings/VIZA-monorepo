import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelRecoverableResult,
  classifyPhEtravelStoredResult,
  hasCompletePhEtravelStoredSubmissionResult,
  hasCompletePhEtravelSubmissionEvidence,
  PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT,
  phEtravelOfficialReference,
  planPhEtravelConsistencyCompensation,
} from "../result-consistency";
import {
  gatePhEtravelAuthoritativeResult,
  type PhEtravelAuthoritativeRegistrationRead,
  type PhEtravelDerivedQrRenderMetadata,
} from "../result-evidence";
import {
  PH_ETRAVEL_SAFE_FALLBACK_ERROR_CODE,
  safePhEtravelErrorSummary,
  safePhEtravelServiceLog,
} from "../error-safety";
import { PH_ETRAVEL_FINAL_SUBMIT_ENABLED, sanitizePhEtravelLogs } from "../runner";

const reference = "F00TEST12345";

const authoritativeRead: PhEtravelAuthoritativeRegistrationRead = {
  source: "official_registration_result_read",
  postSubmitRead: true,
  referenceNumber: reference,
  stableReference: true,
};

const qrRender: PhEtravelDerivedQrRenderMetadata = {
  renderer: "official_client_reference_qr",
  renderedForReference: reference,
  rendered: true,
  referenceValueValidated: true,
};

function storedSubmittedResult(overrides: Record<string, unknown> = {}) {
  return {
    country: "PH",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    status: "submitted",
    provider: "philippines_etravel_live",
    submitted: true,
    confirmationNumber: null,
    referenceNumber: reference,
    resultEvidence: { authoritativeRead, qrRender },
    artifacts: { qrCodes: ["rendered-reference.png"], pdfs: ["confirmation.pdf"], screenshots: ["result.png"] },
    ...overrides,
  };
}

test("PH submitted candidate requires an authoritative result read and matching reference-derived QR render", () => {
  const base = {
    submitted: true,
    referenceNumber: reference,
    portalUrl: "https://etravel.gov.ph",
    portalResponseSummary: "safe",
    authoritativeRead,
    qrRender,
  };

  assert.equal(hasCompletePhEtravelSubmissionEvidence({ portalResult: base }), true);
  assert.equal(hasCompletePhEtravelSubmissionEvidence({
    portalResult: { ...base, authoritativeRead: undefined },
  }), false);
  assert.equal(hasCompletePhEtravelSubmissionEvidence({
    portalResult: { ...base, qrRender: { ...qrRender, renderedForReference: "OTHER" } },
  }), false);
  assert.equal(hasCompletePhEtravelSubmissionEvidence({
    portalResult: { ...base, submitted: false },
  }), false);
});

test("PH result evidence ignores HTTP navigation, Summary, local references, and local QR visuals", () => {
  assert.equal(PH_ETRAVEL_FINAL_SUBMIT_ENABLED, false);
  assert.deepEqual(gatePhEtravelAuthoritativeResult({
    finalPostObservation: "http_200_navigation",
  }), {
    status: "recovery_required",
    code: "ph_etravel_final_post_http_200_unverified",
    officialResubmitAllowed: false,
  });
  assert.deepEqual(gatePhEtravelAuthoritativeResult({
    finalPostObservation: "network_interrupted",
  }), {
    status: "recovery_required",
    code: "ph_etravel_final_post_ambiguous_recovery_required",
    officialResubmitAllowed: false,
  });
  assert.deepEqual(gatePhEtravelAuthoritativeResult({
    authoritativeRead: undefined,
    qrRender,
  }), {
    status: "recovery_required",
    code: "ph_etravel_authoritative_result_read_required",
    officialResubmitAllowed: false,
  });
  assert.deepEqual(gatePhEtravelAuthoritativeResult({
    authoritativeRead,
    qrRender: { ...qrRender, renderedForReference: "LOCAL-REFERENCE" },
  }), {
    status: "recovery_required",
    code: "ph_etravel_authoritative_result_read_required",
    officialResubmitAllowed: false,
  });
});

test("PH DB/RPC submission state sync contract is explicit and fail-closed", () => {
  assert.equal(PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.name, "sync_ph_etravel_submission_state");
  assert.equal(PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.version, 2);
  const applicationAdapterInputs: readonly string[] = PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.applicationAdapterInputs;
  for (const input of [
    "application_id",
    "queue_id",
    "expected_prior_state",
    "target_status",
    "official_reference",
    "authoritative_result_read",
    "qr_render_metadata",
    "idempotency_key",
    "safe_reason_code",
  ]) {
    assert.ok(applicationAdapterInputs.includes(input));
  }
  assert.equal(applicationAdapterInputs.includes("qr_artifact_metadata"), false);
  assert.ok(PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.allowedCompensationStates.includes("recover_authoritative_result"));
  assert.match(PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.idempotencyRule, /must never trigger another official final Submit/);
  assert.match(PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.submittedEvidenceRule, /authoritative.*reference.*QR render/i);
  assert.match(PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.safeErrorRule, /raw official page text.*prohibited/i);
});

test("PH stored result only completes with authoritative read and matching rendered reference", () => {
  const completeResult = storedSubmittedResult();
  assert.equal(hasCompletePhEtravelStoredSubmissionResult(completeResult), true);
  assert.deepEqual(classifyPhEtravelStoredResult(completeResult), {
    action: "submitted_complete",
    evidence: {
      officialReference: reference,
      referenceNumber: reference,
      authoritativeRead,
      qrRender,
      pdfArtifacts: ["confirmation.pdf"],
      screenshotArtifacts: ["result.png"],
    },
  });
  assert.equal(hasCompletePhEtravelStoredSubmissionResult(storedSubmittedResult({
    resultEvidence: { authoritativeRead, qrRender: { ...qrRender, renderedForReference: "OTHER" } },
  })), false);
});

test("PH pending internal sync needs stored E16 evidence and never re-submits", () => {
  const result = {
    ...storedSubmittedResult({ status: "official_portal_error", submitted: false }),
    errorDetails: { code: "phetravel_result_consistency_sync_failed" },
  };
  const disposition = classifyPhEtravelStoredResult(result);
  assert.equal(disposition.action, "submitted_pending_sync");
  const plan = planPhEtravelConsistencyCompensation(result);
  assert.deepEqual(plan, {
    action: "sync_internal_submitted",
    source: "stored_pending_sync_result",
    evidence: {
      officialReference: reference,
      referenceNumber: reference,
      authoritativeRead,
      qrRender,
      pdfArtifacts: ["confirmation.pdf"],
      screenshotArtifacts: ["result.png"],
    },
  });
});

test("PH reference-only, local QR, and ambiguous final POST require authoritative recovery without re-submit", () => {
  const referenceOnly = buildPhEtravelRecoverableResult({
    applicationId: "app-test",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    portalUrl: "https://etravel.gov.ph",
    portalSummary: "ignored",
    code: "ph_etravel_authoritative_result_read_required",
    message: "ignored",
    referenceNumber: reference,
    qrCodes: ["local-render.png"],
    logs: [],
  });
  const ambiguousPost = {
    ...referenceOnly,
    resultEvidence: { finalPostObservation: "network_interrupted" },
    errorDetails: { code: "ph_etravel_final_post_ambiguous_recovery_required" },
  };
  for (const result of [referenceOnly, ambiguousPost, storedSubmittedResult({ resultEvidence: {}, artifacts: { qrCodes: ["local.png"] } })]) {
    const disposition = classifyPhEtravelStoredResult(result);
    assert.equal(disposition.action, "recover_authoritative_result");
    const plan = planPhEtravelConsistencyCompensation(result);
    assert.equal(plan.action, "recover_authoritative_result");
    assert.notEqual(plan.action, "run_official_submission");
  }
});

test("PH review, signature, family, and stopped states stay action-required and non-submitted", () => {
  for (const code of [
    "ph_etravel_stopped_before_submit",
    "ph_etravel_signature_required",
    "ph_etravel_family_member_action_required",
    "ph_etravel_family_companion_confirmation",
    "ph_etravel_structured_customs_action_required",
  ]) {
    const result = buildPhEtravelRecoverableResult({
      applicationId: "app-test",
      visaType: "PH_ETRAVEL_ARRIVAL_CARD",
      portalUrl: "https://etravel.gov.ph",
      portalSummary: "ignored",
      code,
      message: "ignored",
      logs: [],
    });
    assert.deepEqual(classifyPhEtravelStoredResult(result), { action: "action_required_not_submitted", code });
    assert.deepEqual(planPhEtravelConsistencyCompensation(result), { action: "keep_action_required", code });
    assert.equal(result.submitted, false);
  }
});

test("PH E17 launch-preflight results remain action-required across restart and never re-submit", () => {
  const result = buildPhEtravelRecoverableResult({
    applicationId: "app-test",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    portalUrl: "https://etravel.gov.ph",
    portalSummary: "ignored",
    code: "ph_etravel_launch_air_travel_review_required",
    message: "ignored",
    logs: [],
  });
  assert.deepEqual(classifyPhEtravelStoredResult(result), {
    action: "action_required_not_submitted",
    code: "ph_etravel_launch_air_travel_review_required",
  });
  assert.deepEqual(planPhEtravelConsistencyCompensation(result), {
    action: "keep_action_required",
    code: "ph_etravel_launch_air_travel_review_required",
  });
  assert.equal(result.submitted, false);
});

test("PH official reference only reads the authoritative reference field", () => {
  assert.equal(phEtravelOfficialReference({ referenceNumber: " REF " }), "REF");
  assert.equal(phEtravelOfficialReference({ referenceNumber: "" }), null);
});

test("PH logs and persisted errors redact local paths and sensitive values", () => {
  const logs = sanitizePhEtravelLogs([
    "ph_etravel_screenshot /tmp/viza-ph-etravel/a.png",
    "email=test@example.test otp=123456 token=abc Cookie=session=secret",
    "Authorization: Bearer abc.def.ghi /Users/example/private/file.html",
  ]);
  assert.match(logs.join("\n"), /\[local-artifact-redacted\]/);
  assert.doesNotMatch(logs.join("\n"), /test@example\.test|123456|abc\.def\.ghi|\/Users\/example/);

  const unsafeText = "Passport E12345678 email=test@example.test OTP=123456 token=secret official page text";
  const result = buildPhEtravelRecoverableResult({
    applicationId: "app-test",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    portalUrl: "https://etravel.gov.ph",
    portalSummary: unsafeText,
    code: "unknown_portal_layout_changed",
    message: unsafeText,
    logs: [unsafeText],
  });
  const persisted = JSON.stringify(result);
  assert.equal(result.errorDetails?.code, PH_ETRAVEL_SAFE_FALLBACK_ERROR_CODE);
  assert.doesNotMatch(persisted, /test@example\.test|123456|secret|E12345678|official page text/i);

  const safe = safePhEtravelErrorSummary({ code: "unknown_error" });
  const log = safePhEtravelServiceLog({ code: "unknown_error" });
  assert.doesNotMatch(`${safe.message}\n${safe.portalSummary}\n${log}`, /test@example\.test|123456|secret|official page text/i);
});
