/**
 * Read-only DS-160 retry planning.
 *
 * A retry must decide what kind of CEAC work is safe before a browser is
 * opened.  In particular, an empty queue row created by the frontend may be
 * preceded by an older row containing the only encrypted Retrieve checkpoint.
 * This module resolves that history without creating jobs, changing fences, or
 * exposing decrypted values in diagnostics.
 */

import {
  validateCapturedDs160Resume,
  type CapturedDs160ResumeCheckpoint,
  type CapturedDs160ResumeRejection,
} from "./captured-resume";

const APPLICATION_ID_PATTERN = /^AA[A-Z0-9]{8,10}$/i;
const CEAC_CAPTURE_RECOVERY_STATUSES = new Set([
  "application_captured",
  "final_submission_recovery_required",
  "proof_pending",
]);

export type Ds160RetryRecoveryReason =
  | "application_read_failed"
  | "final_fence_read_failed"
  | "queue_history_read_failed"
  | "current_queue_application_mismatch"
  | "final_submission_fence_present"
  | "official_submission_already_recorded"
  | "historical_official_submission_detected"
  | "application_id_invalid"
  | "checkpoint_missing"
  | "checkpoint_incomplete"
  | "checkpoint_decryption_failed"
  | "application_id_mismatch";

export type Ds160RetryPlan =
  | {
      kind: "fresh";
      reason: "no_prior_official_application";
    }
  | {
      kind: "resume";
      reason: "captured_application_checkpoint";
      checkpoint: CapturedDs160ResumeCheckpoint;
    }
  | {
      kind: "recover";
      reason: Ds160RetryRecoveryReason;
    };

export type Ds160RetryFailureDisposition = "blocked" | "retry" | "failed";

const NON_RETRYABLE_FAILURE_CODES = new Set([
  "VALIDATION_FAILED",
  "DS160_PHOTO_INVALID",
  "DS160_REVIEW_UNVERIFIED",
  "DS160_REVIEW_MISMATCH",
  "GATE_DETECTED",
  "MANUAL_ACTION_REQUIRED",
]);

export interface Ds160RetryQueueSnapshot {
  id?: unknown;
  application_id?: unknown;
  status?: unknown;
  current_stage?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  official_application_id_encrypted?: unknown;
  official_security_question_encrypted?: unknown;
  official_security_answer_encrypted?: unknown;
  official_confirmation_number_encrypted?: unknown;
  official_confirmation_page_url?: unknown;
  live_submitted_at?: unknown;
  official_status?: unknown;
  ceac_result_payload?: unknown;
}

interface Ds160RetryApplicationSnapshot {
  ds160_application_id?: unknown;
  submission_result?: unknown;
  submission_result_status?: unknown;
  confirmation_number?: unknown;
  submitted_at?: unknown;
  // This is deliberately read for auditability only. A saved .dat artifact is
  // a recovery aid and is never treated as official submission evidence.
  ds160_dat_storage_path?: unknown;
}

interface Ds160RetryFinalFenceSnapshot {
  id?: unknown;
  state?: unknown;
}

interface Ds160RetryDbError {
  message?: string | null;
}

interface Ds160RetryDbResponse {
  data: unknown;
  error: Ds160RetryDbError | null;
}

interface Ds160RetryReadQuery extends PromiseLike<Ds160RetryDbResponse> {
  eq(column: string, value: string): Ds160RetryReadQuery;
  limit(count: number): Ds160RetryReadQuery;
  maybeSingle(): PromiseLike<Ds160RetryDbResponse>;
}

interface Ds160RetryTableQuery {
  select(columns: string): Ds160RetryReadQuery;
}

export interface Ds160RetryReadClient {
  from(table: string): unknown;
}

export type Ds160RetrySecretDecrypt = (ciphertext: string) => string;

/**
 * Keep applicant-data and official-gate failures out of the transient retry
 * loop. `error` may be either a live Error-like object or the serialized
 * result.error payload emitted by the CEAC orchestrator.
 */
export function classifyDs160RetryFailure(
  error: unknown,
  attempts: number,
  maxAttempts: number,
): Ds160RetryFailureDisposition {
  const direct = record(error);
  const nested = record(direct?.error);
  const code = text(direct?.code) ?? text(nested?.code);
  if (code && NON_RETRYABLE_FAILURE_CODES.has(code.toUpperCase()))
    return "blocked";
  return attempts + 1 >= Math.max(1, maxAttempts) ? "failed" : "retry";
}

const APPLICATION_COLUMNS =
  "ds160_application_id,submission_result,submission_result_status,confirmation_number,submitted_at,ds160_dat_storage_path";
const QUEUE_COLUMNS =
  "id,application_id,status,current_stage,created_at,updated_at,official_application_id_encrypted,official_security_question_encrypted,official_security_answer_encrypted,official_confirmation_number_encrypted,official_confirmation_page_url,live_submitted_at,official_status,ceac_result_payload";

function selectQuery(
  client: Ds160RetryReadClient,
  table: string,
  columns: string,
): Ds160RetryReadQuery {
  return (client.from(table) as Ds160RetryTableQuery).select(columns);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeApplicationId(value: unknown): string | null {
  const normalized = text(value)?.toUpperCase() ?? null;
  return normalized && APPLICATION_ID_PATTERN.test(normalized)
    ? normalized
    : null;
}

function normalizeStatus(value: unknown): string {
  return text(value)?.toLowerCase() ?? "";
}

function queueHasOfficialSuccess(row: Ds160RetryQueueSnapshot): boolean {
  const status = normalizeStatus(row.status);
  const officialStatus = normalizeStatus(row.official_status);
  const result = record(row.ceac_result_payload);
  const resultStatus = normalizeStatus(result?.status);
  return (
    status === "ds160_submitted" ||
    status === "submitted" ||
    officialStatus === "submitted" ||
    resultStatus === "submitted" ||
    Boolean(text(row.live_submitted_at)) ||
    Boolean(text(row.official_confirmation_number_encrypted)) ||
    Boolean(text(row.official_confirmation_page_url))
  );
}

function queueHasMalformedMetadata(row: Ds160RetryQueueSnapshot): boolean {
  const result = row.ceac_result_payload;
  if (result !== null && result !== undefined && record(result) === null)
    return true;
  const resultRecord = record(result);
  const recovery = resultRecord?.recovery;
  if (
    recovery !== null &&
    recovery !== undefined &&
    record(recovery) === null
  ) {
    return true;
  }
  if (recovery !== null && recovery !== undefined) {
    const recoveryRecord = record(recovery);
    const recoveryStatus = normalizeStatus(recoveryRecord?.status);
    if (
      !recoveryRecord ||
      !CEAC_CAPTURE_RECOVERY_STATUSES.has(recoveryStatus)
    ) {
      return true;
    }
  }
  const resultApplicationId = resultRecord?.applicationId;
  const resultCountry = normalizeStatus(resultRecord?.country);
  if (
    applicationFieldPresent(resultApplicationId) &&
    resultCountry !== "generic" &&
    (typeof resultApplicationId !== "string" ||
      !normalizeApplicationId(resultApplicationId))
  ) {
    return true;
  }
  for (const value of [
    row.official_application_id_encrypted,
    row.official_security_question_encrypted,
    row.official_security_answer_encrypted,
    row.official_confirmation_number_encrypted,
    row.official_confirmation_page_url,
    row.live_submitted_at,
    row.official_status,
  ]) {
    if (value !== null && value !== undefined && typeof value !== "string")
      return true;
  }
  return false;
}

function applicationHasOfficialSuccess(
  row: Ds160RetryApplicationSnapshot,
): boolean {
  const result = record(row.submission_result);
  return (
    normalizeStatus(row.submission_result_status) === "submitted" ||
    (normalizeStatus(result?.country) === "us" &&
      normalizeStatus(result?.status) === "submitted") ||
    Boolean(text(row.confirmation_number))
  );
}

function applicationHasFinalRecoveryMetadata(
  row: Ds160RetryApplicationSnapshot,
): boolean {
  const result = record(row.submission_result);
  return normalizeStatus(result?.actionType) === "final_submission_recovery";
}

function applicationFieldPresent(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function applicationHasMalformedIdentity(
  row: Ds160RetryApplicationSnapshot,
): boolean {
  if (
    applicationFieldPresent(row.ds160_application_id) &&
    (typeof row.ds160_application_id !== "string" ||
      !text(row.ds160_application_id))
  ) {
    return true;
  }
  if (
    applicationFieldPresent(row.confirmation_number) &&
    (typeof row.confirmation_number !== "string" ||
      !text(row.confirmation_number))
  ) {
    return true;
  }
  if (
    applicationFieldPresent(row.ds160_dat_storage_path) &&
    (typeof row.ds160_dat_storage_path !== "string" ||
      (row.ds160_dat_storage_path.length > 0 &&
        !text(row.ds160_dat_storage_path)))
  ) {
    return true;
  }
  const result = record(row.submission_result);
  if (
    applicationFieldPresent(result?.actionType) &&
    typeof result?.actionType !== "string"
  ) {
    return true;
  }
  if (
    normalizeStatus(result?.country) === "us" &&
    (!applicationFieldPresent(result?.applicationId) ||
      typeof result?.applicationId !== "string" ||
      !text(result.applicationId))
  ) {
    return true;
  }
  return false;
}

function queueHasFinalRecoveryMetadata(row: Ds160RetryQueueSnapshot): boolean {
  if (
    normalizeStatus(row.current_stage) === "final_submission_recovery_required"
  ) {
    return true;
  }
  const result = record(row.ceac_result_payload);
  const recovery = record(result?.recovery);
  const recoveryStatus = normalizeStatus(recovery?.status);
  return CEAC_CAPTURE_RECOVERY_STATUSES.has(recoveryStatus);
}

function queuePayloadHasOfficialIdentity(
  row: Ds160RetryQueueSnapshot,
): boolean {
  const result = record(row.ceac_result_payload);
  return Boolean(normalizeApplicationId(result?.applicationId));
}

function queueHasPriorMetadata(row: Ds160RetryQueueSnapshot): boolean {
  return (
    queueHasFinalRecoveryMetadata(row) ||
    queuePayloadHasOfficialIdentity(row) ||
    checkpointFieldsPresent(row)
  );
}

function checkpointFieldsPresent(row: Ds160RetryQueueSnapshot): boolean {
  return Boolean(
    (row.official_application_id_encrypted !== null &&
      row.official_application_id_encrypted !== undefined) ||
    (row.official_security_question_encrypted !== null &&
      row.official_security_question_encrypted !== undefined) ||
    (row.official_security_answer_encrypted !== null &&
      row.official_security_answer_encrypted !== undefined),
  );
}

function queueRowId(row: Ds160RetryQueueSnapshot): string | null {
  return text(row.id);
}

function mergeQueueRows(
  currentQueue: Ds160RetryQueueSnapshot | null | undefined,
  historicalRows: Ds160RetryQueueSnapshot[],
): Ds160RetryQueueSnapshot[] {
  const currentId = currentQueue ? queueRowId(currentQueue) : null;
  const rows = currentId
    ? [
        currentQueue!,
        ...historicalRows.filter((row) => queueRowId(row) !== currentId),
      ]
    : currentQueue
      ? [currentQueue, ...historicalRows]
      : historicalRows;
  return rows.sort((left, right) => {
    const leftTime =
      Date.parse(text(left.updated_at) ?? text(left.created_at) ?? "") || 0;
    const rightTime =
      Date.parse(text(right.updated_at) ?? text(right.created_at) ?? "") || 0;
    return rightTime - leftTime;
  });
}

function recover(reason: Ds160RetryRecoveryReason): Ds160RetryPlan {
  return { kind: "recover", reason };
}

function mapCheckpointRejection(
  reason: CapturedDs160ResumeRejection,
): Ds160RetryRecoveryReason {
  switch (reason) {
    case "checkpoint_incomplete":
      return "checkpoint_incomplete";
    case "checkpoint_decryption_failed":
      return "checkpoint_decryption_failed";
    case "application_id_invalid":
      return "application_id_invalid";
    case "application_id_mismatch":
      return "application_id_mismatch";
    case "final_submission_already_recorded":
      return "official_submission_already_recorded";
    case "final_submission_fence_blocked":
    case "final_submission_fence_unreadable":
      return "final_submission_fence_present";
    case "resume_job_mismatch":
      return "checkpoint_missing";
  }
}

function readRows(value: unknown): Ds160RetryQueueSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Ds160RetryQueueSnapshot => record(row) !== null,
  );
}

function readFenceRows(value: unknown): Ds160RetryFinalFenceSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Ds160RetryFinalFenceSnapshot => record(row) !== null,
  );
}

/**
 * Load the persisted state needed to choose a DS-160 retry action.
 *
 * This function is intentionally read-only. It never enqueues, mutates a
 * final-submission fence, opens a browser, or returns decrypted values except
 * in the `resume` plan consumed by the already-gated runner.
 */
export async function loadDs160RetryPlan(
  client: Ds160RetryReadClient,
  applicationId: string,
  currentQueue: Ds160RetryQueueSnapshot | null | undefined,
  decrypt: Ds160RetrySecretDecrypt,
): Promise<Ds160RetryPlan> {
  const normalizedApplicationId = text(applicationId);
  if (!normalizedApplicationId) return recover("application_read_failed");

  if (currentQueue) {
    if (record(currentQueue) === null)
      return recover("current_queue_application_mismatch");
    const queueApplicationId = text(currentQueue.application_id);
    if (!queueApplicationId || queueApplicationId !== normalizedApplicationId) {
      return recover("current_queue_application_mismatch");
    }
  }

  let application: Ds160RetryApplicationSnapshot | null;
  try {
    const response = await selectQuery(
      client,
      "applications",
      APPLICATION_COLUMNS,
    )
      .eq("id", normalizedApplicationId)
      .maybeSingle();
    if (response.error || !record(response.data))
      return recover("application_read_failed");
    application = response.data as Ds160RetryApplicationSnapshot;
  } catch {
    return recover("application_read_failed");
  }

  let finalFenceRows: Ds160RetryFinalFenceSnapshot[];
  try {
    const response = await selectQuery(
      client,
      "ds160_final_submission_attempts",
      "id,state",
    ).eq("application_id", normalizedApplicationId);
    if (response.error) return recover("final_fence_read_failed");
    if (!Array.isArray(response.data))
      return recover("final_fence_read_failed");
    finalFenceRows = readFenceRows(response.data);
    if (finalFenceRows.length !== response.data.length) {
      return recover("final_fence_read_failed");
    }
  } catch {
    return recover("final_fence_read_failed");
  }

  const finalFenceStates = finalFenceRows.map((row) => row.state);
  if (finalFenceRows.length > 0)
    return recover("final_submission_fence_present");

  let historicalRows: Ds160RetryQueueSnapshot[];
  try {
    const response = await selectQuery(
      client,
      "submission_queue",
      QUEUE_COLUMNS,
    )
      .eq("application_id", normalizedApplicationId)
      .limit(1000);
    if (response.error) return recover("queue_history_read_failed");
    if (!Array.isArray(response.data) || response.data.length >= 1000) {
      return recover("queue_history_read_failed");
    }
    historicalRows = readRows(response.data);
    if (historicalRows.length !== response.data.length) {
      return recover("queue_history_read_failed");
    }
    if (
      historicalRows.some(
        (row) => text(row.application_id) !== normalizedApplicationId,
      )
    ) {
      return recover("queue_history_read_failed");
    }
  } catch {
    return recover("queue_history_read_failed");
  }

  const rows = mergeQueueRows(currentQueue, historicalRows);
  if (applicationHasOfficialSuccess(application)) {
    return recover("official_submission_already_recorded");
  }
  if (rows.some(queueHasMalformedMetadata)) {
    return recover("queue_history_read_failed");
  }
  if (rows.some(queueHasOfficialSuccess)) {
    return recover("historical_official_submission_detected");
  }

  const applicationIdFromRow = text(application.ds160_application_id);
  const result = record(application.submission_result);
  if (
    application.submission_result !== null &&
    application.submission_result !== undefined &&
    !result
  ) {
    return recover("application_id_invalid");
  }
  if (applicationHasMalformedIdentity(application)) {
    return recover("application_id_invalid");
  }
  const resultApplicationId =
    normalizeStatus(result?.country) === "us"
      ? text(result?.applicationId)
      : null;
  const normalizedApplicationIdFromRow =
    normalizeApplicationId(applicationIdFromRow);
  const normalizedResultApplicationId =
    normalizeApplicationId(resultApplicationId);
  if (
    (applicationIdFromRow && !normalizedApplicationIdFromRow) ||
    (resultApplicationId && !normalizedResultApplicationId)
  ) {
    return recover("application_id_invalid");
  }
  if (
    normalizedApplicationIdFromRow &&
    normalizedResultApplicationId &&
    normalizedApplicationIdFromRow !== normalizedResultApplicationId
  ) {
    return recover("application_id_mismatch");
  }
  const normalizedOfficialApplicationId =
    normalizedApplicationIdFromRow ?? normalizedResultApplicationId;
  const hasPriorIdentity =
    Boolean(applicationIdFromRow) ||
    Boolean(resultApplicationId) ||
    Boolean(text(application.ds160_dat_storage_path)) ||
    applicationHasFinalRecoveryMetadata(application) ||
    rows.some(
      (row) => checkpointFieldsPresent(row) || queueHasPriorMetadata(row),
    );
  if (!hasPriorIdentity) {
    return { kind: "fresh", reason: "no_prior_official_application" };
  }
  if (!normalizedOfficialApplicationId)
    return recover("application_id_invalid");

  const currentHasCheckpoint = Boolean(
    currentQueue && checkpointFieldsPresent(currentQueue),
  );
  if (currentHasCheckpoint && currentQueue) {
    const decision = validateCapturedDs160Resume({
      applicationId: normalizedOfficialApplicationId,
      officialApplicationIdEncrypted:
        currentQueue.official_application_id_encrypted,
      officialSecurityQuestionEncrypted:
        currentQueue.official_security_question_encrypted,
      officialSecurityAnswerEncrypted:
        currentQueue.official_security_answer_encrypted,
      decryptSecret: decrypt,
      finalFenceStates,
    });
    if (!decision.ok) return recover(mapCheckpointRejection(decision.reason));
    return {
      kind: "resume",
      reason: "captured_application_checkpoint",
      checkpoint: decision.checkpoint,
    };
  }

  let firstRejection: Ds160RetryRecoveryReason = "checkpoint_missing";
  for (const row of rows) {
    if (!checkpointFieldsPresent(row)) continue;
    const decision = validateCapturedDs160Resume({
      applicationId: normalizedOfficialApplicationId,
      officialApplicationIdEncrypted: row.official_application_id_encrypted,
      officialSecurityQuestionEncrypted:
        row.official_security_question_encrypted,
      officialSecurityAnswerEncrypted: row.official_security_answer_encrypted,
      decryptSecret: decrypt,
      finalFenceStates,
    });
    if (decision.ok) {
      return {
        kind: "resume",
        reason: "captured_application_checkpoint",
        checkpoint: decision.checkpoint,
      };
    }
    const rejection = mapCheckpointRejection(decision.reason);
    if (firstRejection === "checkpoint_missing") firstRejection = rejection;
  }

  return recover(firstRejection);
}
