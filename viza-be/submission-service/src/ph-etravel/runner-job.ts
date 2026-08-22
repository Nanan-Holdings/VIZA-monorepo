import type { SubmissionPayload } from "../country-submissions/types.js";
import type { CanonicalRecord } from "../queue/answers.js";
import type { DispatchOutcome } from "../queue/types.js";
import { evaluatePhEtravelSubmissionWindow, type PhEtravelSubmissionWindow } from "./date-window.js";
import { safePhEtravelErrorSummary } from "./error-safety.js";
import { evaluatePhEtravelArrivalLaunchPreflight } from "./launch-preflight.js";
import { normalizePhEtravelPortalPayload, type PhEtravelPortalPayload } from "./normalize.js";
import {
  classifyPhEtravelStoredResult,
  type PhEtravelStoredSubmissionEvidence,
} from "./result-consistency.js";
import {
  gatePhEtravelAuthoritativeResult,
  type PhEtravelAuthoritativeRegistrationRead,
  type PhEtravelDerivedQrRenderMetadata,
} from "./result-evidence.js";
import {
  isPhEtravelSubmissionStateSyncRpcEnabled,
  PhEtravelSubmissionStateSyncAdapter,
  type PhEtravelSubmissionStateSyncAdapter as PhEtravelSubmissionStateSyncAdapterType,
  type PhEtravelSubmissionStateSyncInput,
} from "./submission-state-sync.js";
import {
  PH_ETRAVEL_FINAL_SUBMIT_ENABLED,
  runPhEtravelPortalSubmission,
  type PhEtravelPortalSubmissionResult,
  type PhEtravelRunnerOptions,
} from "./runner.js";

const PH_ETRAVEL_ACTIVE_RUNNER_JOB_STATUSES = ["queued", "running"] as const;

export type PhEtravelRunnerJobStage =
  | "scheduled"
  | "past_date_action_required"
  | "active_job_guard"
  | "submitted_state_synchronized"
  | "result_recovery_required"
  | "preflight_action_required"
  | "account_or_portal_action_required"
  | "review_stop"
  | "browser_execution_disabled";

export interface PhEtravelRunnerJobState {
  applicationStatus: string | null;
  submissionResultStatus: string | null;
  submissionResult: unknown | null;
  activeJobIds: string[];
}

export interface PhEtravelAuthoritativeRegistrationReader {
  read(input: { applicationId: string }): Promise<PhEtravelAuthoritativeRegistrationRead | null>;
}

export interface PhEtravelReferenceQrRenderer {
  render(input: { referenceNumber: string }): Promise<PhEtravelDerivedQrRenderMetadata | null>;
}

export interface PhEtravelRunnerJobDependencies {
  loadAnswers?: (applicationId: string) => Promise<CanonicalRecord>;
  loadState?: (applicationId: string, currentJobId: string) => Promise<PhEtravelRunnerJobState>;
  syncAdapter?: Pick<PhEtravelSubmissionStateSyncAdapterType, "sync">;
  authoritativeReader?: PhEtravelAuthoritativeRegistrationReader;
  qrRenderer?: PhEtravelReferenceQrRenderer;
  portalRunner?: (
    payload: PhEtravelPortalPayload,
    options: PhEtravelRunnerOptions,
  ) => Promise<PhEtravelPortalSubmissionResult>;
  allowBrowser?: boolean;
  now?: Date;
}

export interface PhEtravelRunnerJobResult {
  stage: PhEtravelRunnerJobStage;
  safeReasonCode: string;
  accountPreparation: "not_started";
  browser: "not_started";
  queue: "not_started";
  officialResubmitAllowed: false;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalDateForArrival(answers: CanonicalRecord): string | null {
  const transport = text(answers.transport_type).toUpperCase();
  // SEA has no flight or generic-trip fallback: E24 requires voyage-only dates.
  const key = transport === "SEA" ? "voyage_arrival_date" : "flight_arrival_date";
  return text(answers[key]) || null;
}

function safeResult(stage: PhEtravelRunnerJobStage, code: string): PhEtravelRunnerJobResult {
  return {
    stage,
    safeReasonCode: safePhEtravelErrorSummary({ code }).code,
    accountPreparation: "not_started",
    browser: "not_started",
    queue: "not_started",
    officialResubmitAllowed: false,
  };
}

/** Converts portal checkpoints to an allowlisted non-submitted runner state. */
export function classifyPhEtravelRunnerJobPortalCheckpoint(code: string): PhEtravelRunnerJobResult {
  return safeResult("account_or_portal_action_required", code);
}

function fullName(answers: CanonicalRecord): string {
  return text(answers.full_name) || [text(answers.first_name ?? answers.given_names), text(answers.last_name ?? answers.surname)]
    .filter(Boolean)
    .join(" ");
}

/**
 * Converts canonical runner_job answers into the existing PH normalizer input.
 * This has no selector or official-payload side effect; the resulting input is
 * still preflight-gated before normalization/browser execution.
 */
export function buildPhEtravelArrivalRunnerJobPayload(
  applicationId: string,
  jobId: string,
  answers: CanonicalRecord,
): SubmissionPayload {
  return {
    payloadVersion: "ph_etravel_runner_job_v1",
    countryCode: "PH",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    applicationId,
    dryRun: false,
    idempotencyKey: `ph-etravel-runner-job:${jobId}`,
    personal: {
      fullName: fullName(answers) || null,
      dateOfBirth: text(answers.date_of_birth) || null,
      gender: text(answers.sex ?? answers.gender) || null,
      nationality: text(answers.nationality) || null,
      passportNumber: text(answers.passport_number) || null,
      passportIssueDate: text(answers.passport_issue_date) || null,
      passportExpiryDate: text(answers.passport_expiry_date) || null,
      passportIssuingCountry: text(answers.passport_issuing_country) || null,
      email: text(answers.email_address ?? answers.email) || null,
      phone: text(answers.mobile_number ?? answers.phone) || null,
    },
    trip: {
      destinationCountry: "Philippines",
      arrivalDate: canonicalDateForArrival(answers),
      departureDate: text(answers.transport_type).toUpperCase() === "SEA"
        ? text(answers.voyage_departure_date) || null
        : text(answers.flight_departure_date) || null,
      purpose: text(answers.purpose_of_travel) || null,
    },
    countrySpecific: { ...answers, travel_type: "ARRIVAL" },
    metadata: { runnerJob: true },
  };
}

/** Reads only internal state; errors are converted to a safe recovery result. */
export async function loadPhEtravelRunnerJobState(
  applicationId: string,
  currentJobId: string,
): Promise<PhEtravelRunnerJobState> {
  const { supabase } = await import("../supabase.js");
  const [{ data: application, error: applicationError }, { data: jobs, error: jobsError }] = await Promise.all([
    supabase
      .from("applications")
      .select("status, submission_result_status, submission_result")
      .eq("id", applicationId)
      .maybeSingle(),
    supabase
      .from("runner_job")
      .select("id")
      .eq("application_id", applicationId)
      .eq("country", "philippines")
      .in("status", [...PH_ETRAVEL_ACTIVE_RUNNER_JOB_STATUSES]),
  ]);
  if (applicationError || jobsError) throw new Error("ph_etravel_runner_job_state_unavailable");
  const row = application as {
    status?: string | null;
    submission_result_status?: string | null;
    submission_result?: unknown;
  } | null;
  return {
    applicationStatus: text(row?.status) || null,
    submissionResultStatus: text(row?.submission_result_status) || null,
    submissionResult: row?.submission_result ?? null,
    activeJobIds: (jobs ?? [])
      .map((job) => text((job as { id?: unknown }).id))
      .filter((id) => id && id !== currentJobId),
  };
}

async function createDefaultSyncAdapter(): Promise<PhEtravelSubmissionStateSyncAdapter> {
  const { supabase } = await import("../supabase.js");
  return new PhEtravelSubmissionStateSyncAdapter(
    {
      rpc: async (name, args) => {
        const result = await supabase.rpc(name, args);
        return { data: result.data, error: result.error };
      },
    },
    isPhEtravelSubmissionStateSyncRpcEnabled(),
  );
}

function syncInput(
  applicationId: string,
  jobId: string,
  state: PhEtravelRunnerJobState,
  evidence: PhEtravelStoredSubmissionEvidence,
): PhEtravelSubmissionStateSyncInput {
  return {
    applicationId,
    queueId: jobId,
    expectedPriorState: {
      applicationStatus: state.applicationStatus ?? "processing",
      queueStatus: "running",
      submissionResultStatus: state.submissionResultStatus,
    },
    targetStatus: "submitted",
    officialReference: evidence.officialReference,
    authoritativeRead: evidence.authoritativeRead,
    qrRender: evidence.qrRender,
    idempotencyKey: `ph-etravel-state-sync:${applicationId}:${jobId}`,
    safeReasonCode: "phetravel_result_consistency_sync_failed",
  };
}

async function synchronizeSubmittedEvidence(input: {
  applicationId: string;
  jobId: string;
  state: PhEtravelRunnerJobState;
  evidence: PhEtravelStoredSubmissionEvidence;
  syncAdapter: Pick<PhEtravelSubmissionStateSyncAdapterType, "sync">;
}): Promise<PhEtravelRunnerJobResult> {
  const outcome = await input.syncAdapter.sync(syncInput(
    input.applicationId,
    input.jobId,
    input.state,
    input.evidence,
  ));
  return outcome.outcome === "synchronized"
    ? safeResult("submitted_state_synchronized", outcome.safeReasonCode)
    : safeResult("result_recovery_required", outcome.safeReasonCode);
}

async function recoverAuthoritativeResult(input: {
  applicationId: string;
  jobId: string;
  state: PhEtravelRunnerJobState;
  reader?: PhEtravelAuthoritativeRegistrationReader;
  qrRenderer?: PhEtravelReferenceQrRenderer;
  resolveSyncAdapter: () => Promise<Pick<PhEtravelSubmissionStateSyncAdapterType, "sync">>;
}): Promise<PhEtravelRunnerJobResult> {
  if (!input.reader || !input.qrRenderer) {
    return safeResult("result_recovery_required", "ph_etravel_authoritative_result_read_required");
  }
  try {
    const authoritativeRead = await input.reader.read({ applicationId: input.applicationId });
    if (!authoritativeRead) return safeResult("result_recovery_required", "ph_etravel_authoritative_result_read_required");
    const qrRender = await input.qrRenderer.render({ referenceNumber: authoritativeRead.referenceNumber });
    const gate = gatePhEtravelAuthoritativeResult({ authoritativeRead, qrRender });
    if (gate.status !== "recoverable_submitted_candidate") {
      return safeResult("result_recovery_required", gate.code);
    }
    return synchronizeSubmittedEvidence({
      applicationId: input.applicationId,
      jobId: input.jobId,
      state: input.state,
      evidence: {
        officialReference: gate.officialReference,
        referenceNumber: gate.officialReference,
        authoritativeRead,
        qrRender: gate.qrRender,
        pdfArtifacts: [],
        screenshotArtifacts: [],
      },
      syncAdapter: await input.resolveSyncAdapter(),
    });
  } catch {
    return safeResult("result_recovery_required", "ph_etravel_authoritative_result_read_required");
  }
}

function windowResult(window: PhEtravelSubmissionWindow): PhEtravelRunnerJobResult | null {
  if (window.status === "scheduled") return safeResult("scheduled", "ph_etravel_runner_window_scheduled");
  if (window.status === "past" || window.status === "invalid") {
    return safeResult("past_date_action_required", "ph_etravel_runner_window_action_required");
  }
  return null;
}

/**
 * Canonical PH arrival runner_job orchestration. It is intentionally local and
 * fail-closed: state/recovery, 72-hour window, and launch preflight all happen
 * before an account, mailbox/OTP/MPIN, Turnstile, browser, or form-filler call.
 */
export async function runPhEtravelArrivalRunnerJob(
  applicationId: string,
  jobId: string,
  dependencies: PhEtravelRunnerJobDependencies = {},
): Promise<PhEtravelRunnerJobResult> {
  const loadAnswers = dependencies.loadAnswers ?? (async (id: string) => {
    const { loadCanonicalAnswers } = await import("../queue/answers.js");
    return loadCanonicalAnswers(id);
  });
  const loadState = dependencies.loadState ?? loadPhEtravelRunnerJobState;
  let syncAdapter = dependencies.syncAdapter;
  const resolveSyncAdapter = async (): Promise<Pick<PhEtravelSubmissionStateSyncAdapterType, "sync">> => {
    if (!syncAdapter) syncAdapter = await createDefaultSyncAdapter();
    return syncAdapter;
  };
  let state: PhEtravelRunnerJobState;
  try {
    state = await loadState(applicationId, jobId);
  } catch {
    return safeResult("result_recovery_required", "phetravel_submission_state_sync_rpc_unavailable");
  }

  if (state.activeJobIds.length > 0) {
    return safeResult("active_job_guard", "ph_etravel_runner_active_job_exists");
  }

  const stored = classifyPhEtravelStoredResult(state.submissionResult);
  if (stored.action === "submitted_complete" || stored.action === "submitted_pending_sync") {
    return synchronizeSubmittedEvidence({
      applicationId,
      jobId,
      state,
      evidence: stored.evidence,
      syncAdapter: await resolveSyncAdapter(),
    });
  }
  if (stored.action === "recover_authoritative_result" || stored.action === "submitted_evidence_incomplete") {
    return recoverAuthoritativeResult({
      applicationId,
      jobId,
      state,
      reader: dependencies.authoritativeReader,
      qrRenderer: dependencies.qrRenderer,
      resolveSyncAdapter,
    });
  }
  if (stored.action === "action_required_not_submitted") {
    return safeResult("preflight_action_required", stored.code ?? "ph_etravel_stopped_before_submit");
  }

  let answers: CanonicalRecord;
  try {
    answers = await loadAnswers(applicationId);
  } catch {
    return safeResult("preflight_action_required", "phetravel_validation_failed");
  }
  const window = evaluatePhEtravelSubmissionWindow(canonicalDateForArrival(answers), dependencies.now ?? new Date());
  const windowStop = windowResult(window);
  if (windowStop) return windowStop;

  const payload = buildPhEtravelArrivalRunnerJobPayload(applicationId, jobId, answers);
  const preflight = evaluatePhEtravelArrivalLaunchPreflight({
    payload,
    finalSubmitEnabled: PH_ETRAVEL_FINAL_SUBMIT_ENABLED,
  });
  if (preflight.status !== "allowed") return safeResult("preflight_action_required", preflight.code);

  // This remains unreachable with the current P0 gates. A future controlled
  // enablement must explicitly inject a portal adapter; final Submit stays off.
  if (!dependencies.allowBrowser || !dependencies.portalRunner) {
    return safeResult("browser_execution_disabled", "ph_etravel_stopped_before_submit");
  }
  try {
    const portal = await dependencies.portalRunner(normalizePhEtravelPortalPayload(payload), {
      stopBeforeSubmit: true,
    });
    if (!portal.submitted) return safeResult("review_stop", "ph_etravel_stopped_before_submit");
    const gate = gatePhEtravelAuthoritativeResult({
      authoritativeRead: portal.authoritativeRead,
      qrRender: portal.qrRender,
    });
    if (gate.status !== "recoverable_submitted_candidate") {
      return safeResult("result_recovery_required", gate.code);
    }
    return synchronizeSubmittedEvidence({
      applicationId,
      jobId,
      state,
      evidence: {
        officialReference: gate.officialReference,
        referenceNumber: gate.officialReference,
        authoritativeRead: portal.authoritativeRead!,
        qrRender: portal.qrRender!,
        pdfArtifacts: [],
        screenshotArtifacts: [],
      },
      syncAdapter: await resolveSyncAdapter(),
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "ph_etravel_stopped_before_submit";
    return classifyPhEtravelRunnerJobPortalCheckpoint(code);
  }
}

/** Canonical queue dispatch entrypoint. It never drives official final Submit. */
export async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const result = await runPhEtravelArrivalRunnerJob(applicationId, jobId ?? applicationId);
  return {
    outcome: "halted_before_pay",
    reachedStep: result.stage,
    artefacts: [],
  };
}
