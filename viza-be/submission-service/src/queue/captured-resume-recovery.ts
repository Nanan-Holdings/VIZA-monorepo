import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "../secret-cipher";
import {
  validateCapturedDs160Resume,
  type CapturedDs160ResumeCheckpoint,
} from "../ceac/captured-resume";

const APPLICATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DS160_MAX_ATTEMPTS = 3;

export const CAPTURED_RESUME_PENDING_STATUS = "ds160_live_assisted_pending";
export const CAPTURED_RESUME_BLOCKED_STATUS = "ds160_blocked";
export const CAPTURED_RESUME_BLOCKED_STAGE = "final_submission_recovery_required";
export const CAPTURED_RESUME_QUEUED_STAGE = "captured_resume_recovery_queued";

const TERMINAL_QUEUE_STATUSES = new Set([
  "done",
  "failed",
  "stalled",
  "retry_superseded",
  "cancelled",
  "action_required",
  "needs_manual_verification",
  "ds160_blocked",
  "fv_blocked",
  "uk_blocked",
  "vn_blocked",
  "sgac_blocked",
  "mdac_blocked",
  "tdac_blocked",
  "tw_blocked",
  "au_blocked",
]);

const ACTIVE_SUBMISSION_JOB_STATUSES = new Set([
  "pending",
  "queued",
  "scheduled",
  "processing",
  "running",
  "ds160_live_assisted_pending",
  "ds160_live_assisted_processing",
]);

type DbError = { message: string };

export interface CapturedResumeRecoveryArgs {
  applicationId: string;
  jobId: string;
  execute: boolean;
}

export interface CapturedResumeApplicationRow {
  id?: unknown;
  country?: unknown;
  visa_type?: unknown;
  status?: unknown;
  submitted_at?: unknown;
  confirmation_number?: unknown;
  ds160_application_id?: unknown;
  ds160_dat_storage_path?: unknown;
  submission_result_status?: unknown;
  submission_result?: unknown;
}

export interface CapturedResumeQueueRow {
  id?: unknown;
  application_id?: unknown;
  status?: unknown;
  current_stage?: unknown;
  mode?: unknown;
  provider?: unknown;
  attempts?: unknown;
  locked_by?: unknown;
  locked_at?: unknown;
  locked_until?: unknown;
  official_application_id_encrypted?: unknown;
  official_security_question_encrypted?: unknown;
  official_security_answer_encrypted?: unknown;
  official_confirmation_number_encrypted?: unknown;
  official_confirmation_page_url?: unknown;
  live_submitted_at?: unknown;
}

export interface CapturedResumeSubmissionJobRow {
  id?: unknown;
  status?: unknown;
  official_submitted_at?: unknown;
  official_confirmation_page_url?: unknown;
  official_confirmation_number_encrypted?: unknown;
}

export interface CapturedResumeFinalFenceRow {
  id?: unknown;
  state?: unknown;
}

export interface CapturedResumeRecoverySnapshot {
  application: CapturedResumeApplicationRow | null;
  queueRows: CapturedResumeQueueRow[];
  finalFenceRows: CapturedResumeFinalFenceRow[];
  submissionJobRows: CapturedResumeSubmissionJobRow[];
}

export interface CapturedResumeRecoveryReport {
  ok: boolean;
  blockers: string[];
  queue: {
    found: boolean;
    status: string | null;
    currentStage: string | null;
    checkpointComplete: boolean;
    finalFenceRows: number;
  };
  conflicts: {
    activeQueueRows: number;
    activeSubmissionJobs: number;
  };
}

export interface RecoveryUpdateBuilder {
  eq(column: string, value: string | number): RecoveryUpdateBuilder;
  is(column: string, value: null): RecoveryUpdateBuilder;
  select(columns: string): RecoveryUpdateBuilder;
  maybeSingle(): Promise<{ data: unknown; error: DbError | null }>;
}

export interface RecoveryMutationClient {
  from(table: string): {
    update(values: Record<string, unknown>): RecoveryUpdateBuilder;
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasValue(value: unknown): boolean {
  return text(value) !== null;
}

function normalizeCountry(value: unknown): string {
  return (text(value) ?? "").toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeVisaType(value: unknown): string {
  return (text(value) ?? "").toUpperCase().replace(/[\s_-]+/g, "");
}

function hasOfficialSuccess(application: CapturedResumeApplicationRow): boolean {
  const result = record(application.submission_result);
  const resultCountry = text(result?.country)?.toUpperCase();
  const resultStatus = text(result?.status)?.toLowerCase();
  return (
    resultCountry === "US" && resultStatus === "submitted" ||
    text(application.submission_result_status)?.toLowerCase() === "submitted" ||
    hasValue(application.confirmation_number) ||
    hasValue(application.ds160_dat_storage_path)
  );
}

function isActiveQueueRow(row: CapturedResumeQueueRow): boolean {
  const status = text(row.status)?.toLowerCase() ?? "";
  if (hasValue(row.locked_by) || hasValue(row.locked_at) || hasValue(row.locked_until)) return true;
  if (TERMINAL_QUEUE_STATUSES.has(status)) return false;
  return status.length > 0;
}

function isActiveSubmissionJob(row: CapturedResumeSubmissionJobRow): boolean {
  const status = text(row.status)?.toLowerCase() ?? "";
  return (
    ACTIVE_SUBMISSION_JOB_STATUSES.has(status) ||
    hasValue(row.official_submitted_at) ||
    hasValue(row.official_confirmation_page_url) ||
    hasValue(row.official_confirmation_number_encrypted)
  );
}

function checkpointDecision(
  application: CapturedResumeApplicationRow,
  queue: CapturedResumeQueueRow,
  fenceRows: CapturedResumeFinalFenceRow[],
  decrypt: (ciphertext: string) => string,
): { checkpoint: CapturedDs160ResumeCheckpoint | null; blocker: string | null } {
  const decision = validateCapturedDs160Resume({
    applicationId: application.ds160_application_id,
    officialApplicationIdEncrypted: queue.official_application_id_encrypted,
    officialSecurityQuestionEncrypted: queue.official_security_question_encrypted,
    officialSecurityAnswerEncrypted: queue.official_security_answer_encrypted,
    decryptSecret: decrypt,
    finalFenceStates: fenceRows.map((row) => row.state),
    // Official success is reported separately by the preflight so a report can
    // expose both an existing result and a final-fence blocker without
    // short-circuiting one safety check in the pure validator.
    submissionAlreadyRecorded: false,
  });
  return decision.ok
    ? { checkpoint: decision.checkpoint, blocker: null }
    : { checkpoint: null, blocker: `checkpoint_${decision.reason}` };
}

/**
 * Pure guard evaluation. It intentionally reports field-level blockers only;
 * decrypted CEAC identifiers and applicant values never leave this function.
 */
export function evaluateCapturedResumeRecovery(
  snapshot: CapturedResumeRecoverySnapshot,
  applicationId: string,
  jobId: string,
  decrypt: (ciphertext: string) => string = decryptSecret,
): CapturedResumeRecoveryReport {
  const blockers: string[] = [];
  const application = snapshot.application;
  const queue = snapshot.queueRows.find((row) => text(row.id) === jobId) ?? null;

  if (!application) blockers.push("application_not_found");
  if (application && text(application.id) !== applicationId) blockers.push("application_id_mismatch");
  if (application && normalizeCountry(application.country) !== "united_states") blockers.push("application_country");
  if (application && normalizeVisaType(application.visa_type) !== "DS160") blockers.push("application_visa_type");
  if (application && hasOfficialSuccess(application)) blockers.push("official_success_already_recorded");

  if (!queue) {
    blockers.push("queue_job_not_found");
  } else {
    if (text(queue.application_id) !== applicationId) blockers.push("queue_application_mismatch");
    if (text(queue.status) !== CAPTURED_RESUME_BLOCKED_STATUS) blockers.push("queue_status");
    if (text(queue.current_stage) !== CAPTURED_RESUME_BLOCKED_STAGE) blockers.push("queue_stage");
    if (text(queue.mode) !== "live_assisted") blockers.push("queue_mode");
    if (text(queue.provider) !== "ceac_live") blockers.push("queue_provider");
    const attempts = typeof queue.attempts === "number" ? queue.attempts : Number(queue.attempts);
    if (!Number.isInteger(attempts) || attempts < 0 || attempts >= DS160_MAX_ATTEMPTS) blockers.push("queue_attempts");
    if (hasValue(queue.locked_by) || hasValue(queue.locked_at) || hasValue(queue.locked_until)) blockers.push("queue_lease_present");
    if (
      hasValue(queue.official_confirmation_number_encrypted) ||
      hasValue(queue.official_confirmation_page_url) ||
      hasValue(queue.live_submitted_at)
    ) {
      blockers.push("queue_official_success");
    }
    if (application) {
      const decision = checkpointDecision(application, queue, snapshot.finalFenceRows, decrypt);
      if (decision.blocker) blockers.push(decision.blocker);
    }
  }

  const conflictingQueueRows = snapshot.queueRows.filter((row) => {
    if (text(row.id) === jobId) return false;
    return isActiveQueueRow(row) || hasValue(row.official_application_id_encrypted);
  });
  const conflictingSubmissionJobs = snapshot.submissionJobRows.filter(isActiveSubmissionJob);
  if (conflictingQueueRows.length > 0) blockers.push("conflicting_active_queue_job");
  if (conflictingSubmissionJobs.length > 0) blockers.push("conflicting_active_ds160_job");

  return {
    ok: blockers.length === 0,
    blockers: [...new Set(blockers)],
    queue: {
      found: Boolean(queue),
      status: text(queue?.status),
      currentStage: text(queue?.current_stage),
      checkpointComplete: Boolean(
        queue &&
        hasValue(queue.official_application_id_encrypted) &&
        hasValue(queue.official_security_question_encrypted) &&
        hasValue(queue.official_security_answer_encrypted),
      ),
      finalFenceRows: snapshot.finalFenceRows.length,
    },
    conflicts: {
      activeQueueRows: conflictingQueueRows.length,
      activeSubmissionJobs: conflictingSubmissionJobs.length,
    },
  };
}

function readOption(argv: string[], name: string): string | null {
  const inlinePrefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length).trim() || null;
  const index = argv.indexOf(`--${name}`);
  if (index >= 0) return argv[index + 1]?.trim() || null;
  return null;
}

function requireUuid(value: string | null, label: string): string {
  if (!value || !APPLICATION_ID_PATTERN.test(value)) throw new Error(`${label} must be an explicit UUID.`);
  return value;
}

export function parseCapturedResumeRecoveryArgs(argv: string[]): CapturedResumeRecoveryArgs {
  if (argv.includes("--help")) {
    throw new Error(
      "Usage: npm run queue:recover-ds160 -- --application-id=<uuid> --job-id=<uuid> [--execute]",
    );
  }
  const known = new Set(["--execute", "--application-id", "--job-id"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const name = arg.split("=", 1)[0];
    if (!known.has(name)) throw new Error(`Unknown option: ${name}`);
    if (name !== "--execute" && !arg.includes("=") && argv[index + 1]) index += 1;
  }
  return {
    applicationId: requireUuid(readOption(argv, "application-id"), "--application-id"),
    jobId: requireUuid(readOption(argv, "job-id"), "--job-id"),
    execute: argv.includes("--execute"),
  };
}

function queueSelectColumns(): string {
  return [
    "id",
    "application_id",
    "status",
    "current_stage",
    "mode",
    "provider",
    "attempts",
    "locked_by",
    "locked_at",
    "locked_until",
    "official_application_id_encrypted",
    "official_security_question_encrypted",
    "official_security_answer_encrypted",
    "official_confirmation_number_encrypted",
    "official_confirmation_page_url",
    "live_submitted_at",
  ].join(",");
}

export async function loadCapturedResumeRecoverySnapshot(
  client: SupabaseClient,
  applicationId: string,
): Promise<CapturedResumeRecoverySnapshot> {
  const [applicationResult, queueResult, fenceResult, submissionJobResult] = await Promise.all([
    client
      .from("applications")
      .select("id,country,visa_type,status,submitted_at,confirmation_number,ds160_application_id,ds160_dat_storage_path,submission_result_status,submission_result")
      .eq("id", applicationId)
      .maybeSingle(),
    client
      .from("submission_queue")
      .select(queueSelectColumns())
      .eq("application_id", applicationId),
    client
      .from("ds160_final_submission_attempts")
      .select("id,state")
      .eq("application_id", applicationId),
    client
      .from("ds160_submission_jobs")
      .select("id,status,official_submitted_at,official_confirmation_page_url,official_confirmation_number_encrypted")
      .eq("application_id", applicationId),
  ]);

  if (applicationResult.error || queueResult.error || fenceResult.error || submissionJobResult.error) {
    throw new Error("DS-160 recovery preflight query failed; no transition was attempted.");
  }

  return {
    application: (applicationResult.data ?? null) as CapturedResumeApplicationRow | null,
    queueRows: (queueResult.data ?? []) as CapturedResumeQueueRow[],
    finalFenceRows: (fenceResult.data ?? []) as CapturedResumeFinalFenceRow[],
    submissionJobRows: (submissionJobResult.data ?? []) as CapturedResumeSubmissionJobRow[],
  };
}

/**
 * Perform the only write in this tool. Every checkpoint cipher is included in
 * the WHERE fence and no encrypted field is present in the patch, so a changed
 * checkpoint or concurrent claim returns zero rows and fails closed.
 */
export async function transitionCapturedResumeQueue(
  client: RecoveryMutationClient,
  queue: CapturedResumeQueueRow,
  applicationId: string,
  jobId: string,
): Promise<void> {
  const attempts = typeof queue.attempts === "number" ? queue.attempts : Number(queue.attempts);
  const applicationCipher = text(queue.official_application_id_encrypted);
  const questionCipher = text(queue.official_security_question_encrypted);
  const answerCipher = text(queue.official_security_answer_encrypted);
  if (!Number.isInteger(attempts) || !applicationCipher || !questionCipher || !answerCipher) {
    throw new Error("DS-160 recovery checkpoint is incomplete; refusing transition.");
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("submission_queue")
    .update({
      status: CAPTURED_RESUME_PENDING_STATUS,
      current_stage: CAPTURED_RESUME_QUEUED_STAGE,
      last_error: null,
      error_code: null,
      error_message: null,
      locked_by: null,
      locked_at: null,
      locked_until: null,
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("application_id", applicationId)
    .eq("status", CAPTURED_RESUME_BLOCKED_STATUS)
    .eq("current_stage", CAPTURED_RESUME_BLOCKED_STAGE)
    .eq("mode", "live_assisted")
    .eq("provider", "ceac_live")
    .eq("attempts", attempts)
    .eq("official_application_id_encrypted", applicationCipher)
    .eq("official_security_question_encrypted", questionCipher)
    .eq("official_security_answer_encrypted", answerCipher)
    .is("locked_by", null)
    .is("locked_at", null)
    .is("locked_until", null)
    .is("official_confirmation_number_encrypted", null)
    .is("official_confirmation_page_url", null)
    .is("live_submitted_at", null)
    .select("id,status,current_stage")
    .maybeSingle();
  if (error) throw new Error("DS-160 recovery transition failed; no success was recorded.");
  const updated = record(data);
  if (
    !updated ||
    text(updated.id) !== jobId ||
    text(updated.status) !== CAPTURED_RESUME_PENDING_STATUS ||
    text(updated.current_stage) !== CAPTURED_RESUME_QUEUED_STAGE
  ) {
    throw new Error("DS-160 recovery transition lost a conditional race; no retry was attempted.");
  }
}
