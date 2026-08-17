import type { DigitalArrivalCardSubmissionResult } from "../submission-result";
import {
  gatePhEtravelAuthoritativeResult,
  type PhEtravelAuthoritativeRegistrationRead,
  type PhEtravelDerivedQrRenderMetadata,
  type PhEtravelFinalPostObservation,
} from "./result-evidence";
import { safePhEtravelDiagnosticLogs, safePhEtravelErrorSummary } from "./error-safety";

export interface PhEtravelPortalResultLike {
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  authoritativeRead?: PhEtravelAuthoritativeRegistrationRead | null;
  qrRender?: PhEtravelDerivedQrRenderMetadata | null;
  logs?: string[];
}

export function phEtravelOfficialReference(input: { referenceNumber?: string | null }): string | null {
  return input.referenceNumber?.trim() || null;
}

export function hasCompletePhEtravelSubmissionEvidence(input: {
  portalResult: PhEtravelPortalResultLike;
}): boolean {
  return input.portalResult.submitted === true &&
    gatePhEtravelAuthoritativeResult({
      authoritativeRead: input.portalResult.authoritativeRead,
      qrRender: input.portalResult.qrRender,
    }).status === "recoverable_submitted_candidate";
}

export interface PhEtravelStoredSubmissionEvidence {
  officialReference: string;
  referenceNumber: string;
  authoritativeRead: PhEtravelAuthoritativeRegistrationRead;
  qrRender: PhEtravelDerivedQrRenderMetadata;
  pdfArtifacts: string[];
  screenshotArtifacts: string[];
}

export type PhEtravelStoredResultDisposition =
  | { action: "run_official_submission" }
  | { action: "submitted_complete"; evidence: PhEtravelStoredSubmissionEvidence }
  | { action: "submitted_pending_sync"; evidence: PhEtravelStoredSubmissionEvidence }
  | { action: "recover_authoritative_result"; code: string }
  | { action: "submitted_evidence_incomplete"; code: string | null }
  | { action: "action_required_not_submitted"; code: string | null };

export type PhEtravelConsistencyCompensationPlan =
  | { action: "run_official_submission" }
  | {
    action: "sync_internal_submitted";
    evidence: PhEtravelStoredSubmissionEvidence;
    source: "stored_complete_result" | "stored_pending_sync_result";
  }
  | { action: "recover_authoritative_result"; code: string }
  | { action: "block_incomplete_submitted_evidence"; code: string | null }
  | { action: "keep_action_required"; code: string | null };

export const PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT = {
  name: "sync_ph_etravel_submission_state",
  version: 2,
  requiredInputs: ["application_id", "queue_id", "idempotency_key", "result_json", "application_patch", "queue_patch"],
  applicationAdapterInputs: [
    "application_id",
    "queue_id",
    "expected_prior_state",
    "target_status",
    "official_reference",
    "authoritative_result_read",
    "qr_render_metadata",
    "idempotency_key",
    "safe_reason_code",
  ],
  requiredResponse: ["outcome", "application_id", "queue_id", "idempotency_key", "target_status", "application_status", "queue_status", "submission_result_status"],
  responseOutcomes: ["applied", "idempotent_replay", "expected_prior_state_mismatch"],
  lockedTables: ["applications", "submission_queue"],
  atomicApplicationFields: ["submission_result", "submission_result_status", "submission_result_updated_at", "status", "confirmation_number", "external_reference", "submitted_at", "updated_at"],
  atomicQueueFields: ["status", "attempts", "last_error", "error_code", "error_message", "current_stage", "official_status", "manual_action_status", "official_portal_url", "official_confirmation_number_encrypted", "official_confirmation_pdf_url", "live_submitted_at", "live_screenshot_url", "updated_at"],
  allowedCompensationStates: ["sync_internal_submitted", "recover_authoritative_result", "block_incomplete_submitted_evidence", "keep_action_required"],
  idempotencyRule: "Replaying the same idempotency_key must return the original outcome and must never trigger another official final Submit.",
  submittedEvidenceRule: "A submitted candidate requires an authoritative post-submit registration read with a stable reference and a validated QR render derived from that same reference.",
  safeErrorRule: "Only allowlisted PH error codes and safe summaries may be persisted; raw official page text, email, OTP, token, cookie, and passport values are prohibited.",
} as const;

const PH_ETRAVEL_RECOVERABLE_SUBMITTED_CODES = new Set(["phetravel_result_consistency_sync_failed"]);
const PH_ETRAVEL_AMBIGUOUS_FINAL_POST_CODES = new Set([
  "ph_etravel_final_post_http_200_unverified",
  "ph_etravel_final_post_ambiguous_recovery_required",
  "ph_etravel_authoritative_result_read_required",
]);
const PH_ETRAVEL_ACTION_REQUIRED_NON_SUBMITTED_CODES = new Set([
  "ph_etravel_stopped_before_submit",
  "ph_etravel_final_submit_disabled",
  "ph_etravel_final_submit_authorization_required",
  "ph_etravel_final_submit_authorization_consumed",
  "ph_etravel_signature_required",
  "ph_etravel_family_member_action_required",
  "ph_etravel_family_companion_confirmation",
  "ph_etravel_structured_customs_action_required",
  "ph_etravel_wizard_route_unverified",
  "ph_etravel_wizard_route_sequence_unverified",
  "ph_etravel_post_signature_live_evidence_required",
  "sea_electronic_positive_post_signature_evidence_pending",
  "ph_etravel_arrival_diverted_unsupported",
  "ph_etravel_arrival_for_other_action_required",
  "ph_etravel_launch_profile_persona_review_required",
  "ph_etravel_launch_residence_review_required",
  "ph_etravel_launch_air_travel_review_required",
  "ph_etravel_launch_air_special_flight_review_required",
  "ph_etravel_launch_health_positive_review_required",
  "ph_etravel_launch_sea_disembarking_review_required",
  "ph_etravel_launch_sea_customs_flow_review_required",
  "ph_etravel_launch_sea_electronic_positive_review_required",
  "ph_etravel_launch_currency_positive_review_required",
  "ph_etravel_launch_goods_amount_checklist_required",
  "ph_etravel_launch_attachment_review_required",
  "ph_etravel_launch_customs_signature_review_required",
  "ph_etravel_launch_final_result_recovery_required",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readAuthoritativeRead(value: unknown): PhEtravelAuthoritativeRegistrationRead | null {
  if (!isRecord(value) || value.source !== "official_registration_result_read" || value.postSubmitRead !== true || value.stableReference !== true) return null;
  const referenceNumber = readString(value.referenceNumber);
  return referenceNumber ? { source: "official_registration_result_read", postSubmitRead: true, referenceNumber, stableReference: true } : null;
}

function readQrRender(value: unknown): PhEtravelDerivedQrRenderMetadata | null {
  if (!isRecord(value) || value.renderer !== "official_client_reference_qr" || value.rendered !== true || value.referenceValueValidated !== true) return null;
  const renderedForReference = readString(value.renderedForReference);
  return renderedForReference
    ? { renderer: "official_client_reference_qr", renderedForReference, rendered: true, referenceValueValidated: true }
    : null;
}

function storedEvidenceFromResult(result: Record<string, unknown>): PhEtravelStoredSubmissionEvidence | null {
  if (result.country !== "PH" || result.provider !== "philippines_etravel_live") return null;
  const resultEvidence = isRecord(result.resultEvidence) ? result.resultEvidence : {};
  const authoritativeRead = readAuthoritativeRead(resultEvidence.authoritativeRead);
  const qrRender = readQrRender(resultEvidence.qrRender);
  const resultGate = gatePhEtravelAuthoritativeResult({ authoritativeRead, qrRender });
  if (resultGate.status !== "recoverable_submitted_candidate" || !authoritativeRead || !qrRender) return null;
  const artifacts = isRecord(result.artifacts) ? result.artifacts : {};
  return {
    officialReference: resultGate.officialReference,
    referenceNumber: resultGate.officialReference,
    authoritativeRead,
    qrRender,
    pdfArtifacts: readStringArray(artifacts.pdfs),
    screenshotArtifacts: readStringArray(artifacts.screenshots),
  };
}

export function extractCompletePhEtravelStoredSubmissionEvidence(result: unknown): PhEtravelStoredSubmissionEvidence | null {
  if (!isRecord(result) || result.status !== "submitted" || result.submitted !== true) return null;
  return storedEvidenceFromResult(result);
}

export function hasCompletePhEtravelStoredSubmissionResult(result: unknown): boolean {
  return extractCompletePhEtravelStoredSubmissionEvidence(result) !== null;
}

function resultRecoveryCode(result: Record<string, unknown>, errorCode: string | null): string {
  const resultEvidence = isRecord(result.resultEvidence) ? result.resultEvidence : {};
  const observation = resultEvidence.finalPostObservation as PhEtravelFinalPostObservation | undefined;
  const gate = gatePhEtravelAuthoritativeResult({
    authoritativeRead: readAuthoritativeRead(resultEvidence.authoritativeRead),
    qrRender: readQrRender(resultEvidence.qrRender),
    finalPostObservation: observation,
  });
  return gate.status === "recovery_required"
    ? gate.code
    : errorCode ?? "ph_etravel_authoritative_result_read_required";
}

export function classifyPhEtravelStoredResult(result: unknown): PhEtravelStoredResultDisposition {
  if (!isRecord(result) || result.country !== "PH" || result.provider !== "philippines_etravel_live") {
    return { action: "run_official_submission" };
  }
  const completeEvidence = extractCompletePhEtravelStoredSubmissionEvidence(result);
  if (completeEvidence) return { action: "submitted_complete", evidence: completeEvidence };

  const errorCode = isRecord(result.errorDetails) ? readString(result.errorDetails.code) : null;
  const recoverableEvidence = errorCode && PH_ETRAVEL_RECOVERABLE_SUBMITTED_CODES.has(errorCode)
    ? storedEvidenceFromResult(result)
    : null;
  if (recoverableEvidence) return { action: "submitted_pending_sync", evidence: recoverableEvidence };
  if (errorCode && PH_ETRAVEL_ACTION_REQUIRED_NON_SUBMITTED_CODES.has(errorCode)) {
    return { action: "action_required_not_submitted", code: errorCode };
  }

  const claimsSubmitted = result.submitted === true || result.status === "submitted";
  const localReference = phEtravelOfficialReference({ referenceNumber: readString(result.referenceNumber) });
  if (claimsSubmitted || localReference || (errorCode && PH_ETRAVEL_AMBIGUOUS_FINAL_POST_CODES.has(errorCode))) {
    return { action: "recover_authoritative_result", code: resultRecoveryCode(result, errorCode) };
  }
  return { action: "run_official_submission" };
}

export function planPhEtravelConsistencyCompensation(result: unknown): PhEtravelConsistencyCompensationPlan {
  const disposition = classifyPhEtravelStoredResult(result);
  switch (disposition.action) {
    case "submitted_complete": return { action: "sync_internal_submitted", evidence: disposition.evidence, source: "stored_complete_result" };
    case "submitted_pending_sync": return { action: "sync_internal_submitted", evidence: disposition.evidence, source: "stored_pending_sync_result" };
    case "recover_authoritative_result": return disposition;
    case "submitted_evidence_incomplete": return { action: "block_incomplete_submitted_evidence", code: disposition.code };
    case "action_required_not_submitted": return { action: "keep_action_required", code: disposition.code };
    case "run_official_submission": return disposition;
  }
}

export function buildPhEtravelRecoverableResult(input: {
  applicationId: string;
  visaType: DigitalArrivalCardSubmissionResult["visaType"];
  portalUrl: string;
  portalSummary: string;
  code: string;
  message: string;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  screenshots?: string[];
  qrCodes?: string[];
  pdfs?: string[];
  logs?: string[];
  payloadSummary?: DigitalArrivalCardSubmissionResult["payloadSummary"];
}): DigitalArrivalCardSubmissionResult {
  const safeError = safePhEtravelErrorSummary({ code: input.code });
  return {
    country: "PH", visaType: input.visaType, status: "official_portal_error", mode: "live_assisted",
    provider: "philippines_etravel_live", applicationId: input.applicationId, submitted: false,
    confirmationNumber: input.confirmationNumber ?? null, referenceNumber: input.referenceNumber ?? null,
    portalUrl: input.portalUrl, portalResponseSummary: safeError.portalSummary,
    confirmationPdfStoragePath: input.pdfs?.[0] ?? null,
    errorDetails: { code: safeError.code, message: safeError.message },
    artifacts: { screenshots: input.screenshots ?? [], qrCodes: input.qrCodes ?? [], pdfs: input.pdfs ?? [], logs: safePhEtravelDiagnosticLogs(input.logs ?? []), traces: [] },
    payloadSummary: input.payloadSummary,
  };
}
