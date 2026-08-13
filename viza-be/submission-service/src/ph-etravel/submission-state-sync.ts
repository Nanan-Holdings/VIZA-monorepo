import {
  PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT,
} from "./result-consistency";
import { safePhEtravelErrorSummary } from "./error-safety";
import {
  gatePhEtravelAuthoritativeResult,
  type PhEtravelAuthoritativeRegistrationRead,
  type PhEtravelDerivedQrRenderMetadata,
} from "./result-evidence";

export const PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_FEATURE_FLAG =
  "PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_ENABLED";

export type PhEtravelSubmissionStateSyncTarget =
  | "submitted"
  | "action_required"
  | "recovery_required";

export interface PhEtravelSubmissionStateSyncExpectedPriorState {
  applicationStatus: string;
  queueStatus: string;
  submissionResultStatus?: string | null;
}

export interface PhEtravelSubmissionStateSyncInput {
  applicationId: string;
  queueId: string;
  expectedPriorState: PhEtravelSubmissionStateSyncExpectedPriorState;
  targetStatus: PhEtravelSubmissionStateSyncTarget;
  officialReference?: string | null;
  authoritativeRead?: PhEtravelAuthoritativeRegistrationRead | null;
  qrRender?: PhEtravelDerivedQrRenderMetadata | null;
  idempotencyKey: string;
  safeReasonCode: string;
}

export interface PhEtravelSubmissionStateSyncRpcArgs {
  application_id: string;
  queue_id: string;
  idempotency_key: string;
  result_json: Record<string, unknown>;
  application_patch: Record<string, unknown>;
  queue_patch: Record<string, unknown>;
}

export interface PhEtravelSubmissionStateSyncRpcClient {
  rpc(
    name: typeof PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.name,
    args: PhEtravelSubmissionStateSyncRpcArgs,
  ): Promise<{ data: unknown; error: unknown | null }>;
}

export type PhEtravelSubmissionStateSyncOutcome =
  | {
    outcome: "synchronized";
    idempotentReplay: boolean;
    safeReasonCode: string;
    officialResubmitAllowed: false;
  }
  | {
    outcome: "recovery_required";
    safeReasonCode: string;
    officialResubmitAllowed: false;
  };

interface CachedOutcome {
  fingerprint: string;
  outcome: PhEtravelSubmissionStateSyncOutcome;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeMachineValue(value: string | null | undefined, maxLength = 160): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9._:-]*$/i.test(normalized) && normalized.length <= maxLength
    ? normalized
    : null;
}

function safeStateValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[a-z][a-z0-9_-]*$/i.test(normalized) && normalized.length <= 80
    ? normalized
    : null;
}

function safeOfficialReference(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9._-]*$/i.test(normalized) && normalized.length <= 160
    ? normalized
    : null;
}

function safeOutcome(code: string): PhEtravelSubmissionStateSyncOutcome {
  return {
    outcome: "recovery_required",
    safeReasonCode: safePhEtravelErrorSummary({ code }).code,
    officialResubmitAllowed: false,
  };
}

function expectedTargetState(targetStatus: PhEtravelSubmissionStateSyncTarget): {
  applicationStatus: string;
  queueStatus: string;
  submissionResultStatus: string;
} {
  switch (targetStatus) {
    case "submitted":
      return {
        applicationStatus: "submitted",
        queueStatus: "done",
        submissionResultStatus: "completed",
      };
    case "action_required":
    case "recovery_required":
      return {
        applicationStatus: "processing",
        queueStatus: "phetravel_blocked",
        submissionResultStatus: "action_required",
      };
  }
}

function hasSubmittedEvidence(input: PhEtravelSubmissionStateSyncInput): boolean {
  const officialReference = safeOfficialReference(input.officialReference);
  const gate = gatePhEtravelAuthoritativeResult({
    authoritativeRead: input.authoritativeRead,
    qrRender: input.qrRender,
  });
  return gate.status === "recoverable_submitted_candidate" && gate.officialReference === officialReference;
}

function isValidInput(input: PhEtravelSubmissionStateSyncInput): boolean {
  return Boolean(
    safeMachineValue(input.applicationId) &&
    safeMachineValue(input.queueId) &&
    safeMachineValue(input.idempotencyKey, 240) &&
    safeStateValue(input.expectedPriorState.applicationStatus) &&
    safeStateValue(input.expectedPriorState.queueStatus) &&
    (input.targetStatus === "submitted" ||
      input.targetStatus === "action_required" ||
      input.targetStatus === "recovery_required") &&
    (input.expectedPriorState.submissionResultStatus === undefined ||
      input.expectedPriorState.submissionResultStatus === null ||
      safeStateValue(input.expectedPriorState.submissionResultStatus)) &&
    (input.targetStatus !== "submitted" || hasSubmittedEvidence(input)),
  );
}

function inputFingerprint(input: PhEtravelSubmissionStateSyncInput): string {
  return JSON.stringify({
    applicationId: input.applicationId,
    queueId: input.queueId,
    expectedPriorState: input.expectedPriorState,
    targetStatus: input.targetStatus,
    officialReference: input.officialReference ?? null,
    authoritativeRead: input.authoritativeRead ?? null,
    qrRender: input.qrRender ?? null,
    safeReasonCode: safePhEtravelErrorSummary({ code: input.safeReasonCode }).code,
  });
}

export function isPhEtravelSubmissionStateSyncRpcEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment[PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_FEATURE_FLAG] === "true";
}

export function buildPhEtravelSubmissionStateSyncRpcArgs(
  input: PhEtravelSubmissionStateSyncInput,
): PhEtravelSubmissionStateSyncRpcArgs | null {
  if (!isValidInput(input)) return null;

  const expected = expectedTargetState(input.targetStatus);
  const safeReasonCode = safePhEtravelErrorSummary({ code: input.safeReasonCode }).code;
  const officialReference = safeOfficialReference(input.officialReference);
  const authoritativeRead = input.authoritativeRead && {
    source: input.authoritativeRead.source,
    post_submit_read: input.authoritativeRead.postSubmitRead,
    reference_number: safeOfficialReference(input.authoritativeRead.referenceNumber),
    stable_reference: input.authoritativeRead.stableReference,
  };
  const qrRender = input.qrRender && {
    renderer: input.qrRender.renderer,
    rendered_for_reference: safeOfficialReference(input.qrRender.renderedForReference),
    rendered: input.qrRender.rendered,
    reference_value_validated: input.qrRender.referenceValueValidated,
  };

  return {
    application_id: safeMachineValue(input.applicationId)!,
    queue_id: safeMachineValue(input.queueId)!,
    idempotency_key: safeMachineValue(input.idempotencyKey, 240)!,
    result_json: {
      target_status: input.targetStatus,
      official_reference: officialReference,
      authoritative_result_read: authoritativeRead,
      qr_render_metadata: qrRender,
      safe_reason_code: safeReasonCode,
    },
    application_patch: {
      expected_status: safeStateValue(input.expectedPriorState.applicationStatus),
      expected_submission_result_status: input.expectedPriorState.submissionResultStatus === undefined
        ? null
        : safeStateValue(input.expectedPriorState.submissionResultStatus),
      status: expected.applicationStatus,
      submission_result_status: expected.submissionResultStatus,
      confirmation_number: officialReference,
      external_reference: officialReference,
    },
    queue_patch: {
      expected_status: safeStateValue(input.expectedPriorState.queueStatus),
      status: expected.queueStatus,
      current_stage: input.targetStatus === "submitted"
        ? "submitted"
        : "result_consistency_recovery_required",
      official_status: input.targetStatus === "submitted"
        ? "submitted"
        : "submitted_pending_application_sync",
      error_code: input.targetStatus === "submitted" ? null : safeReasonCode,
    },
  };
}

function isCompleteRpcResponse(
  data: unknown,
  input: PhEtravelSubmissionStateSyncInput,
): data is Record<string, unknown> {
  if (!isRecord(data)) return false;
  const expected = expectedTargetState(input.targetStatus);
  return (data.outcome === "applied" || data.outcome === "idempotent_replay") &&
    data.application_id === input.applicationId &&
    data.queue_id === input.queueId &&
    data.idempotency_key === input.idempotencyKey &&
    data.target_status === input.targetStatus &&
    data.application_status === expected.applicationStatus &&
    data.queue_status === expected.queueStatus &&
    data.submission_result_status === expected.submissionResultStatus;
}

function isExpectedPriorStateMismatch(
  data: unknown,
  input: PhEtravelSubmissionStateSyncInput,
): boolean {
  return isRecord(data) &&
    data.outcome === "expected_prior_state_mismatch" &&
    data.application_id === input.applicationId &&
    data.queue_id === input.queueId &&
    data.idempotency_key === input.idempotencyKey &&
    data.target_status === input.targetStatus;
}

/**
 * A process-local coalescer complements the database RPC's cross-worker
 * idempotency guarantee. It never invokes browser or official portal actions.
 */
export class PhEtravelSubmissionStateSyncAdapter {
  private readonly completed = new Map<string, CachedOutcome>();
  private readonly inFlight = new Map<string, Promise<PhEtravelSubmissionStateSyncOutcome>>();

  constructor(
    private readonly client: PhEtravelSubmissionStateSyncRpcClient,
    private readonly enabled = false,
  ) {}

  async sync(input: PhEtravelSubmissionStateSyncInput): Promise<PhEtravelSubmissionStateSyncOutcome> {
    const args = buildPhEtravelSubmissionStateSyncRpcArgs(input);
    if (!args) {
      return safeOutcome(input.targetStatus === "submitted"
        ? "ph_etravel_authoritative_result_read_required"
        : "phetravel_submission_state_sync_input_invalid");
    }
    if (!this.enabled) return safeOutcome("phetravel_submission_state_sync_rpc_not_enabled");

    const fingerprint = inputFingerprint(input);
    const completed = this.completed.get(args.idempotency_key);
    if (completed) {
      return completed.fingerprint === fingerprint
        ? completed.outcome
        : safeOutcome("phetravel_submission_state_sync_idempotency_conflict");
    }
    const inFlight = this.inFlight.get(args.idempotency_key);
    if (inFlight) {
      return inFlight;
    }

    const pending = this.callRpc(input, args, fingerprint);
    this.inFlight.set(args.idempotency_key, pending);
    try {
      return await pending;
    } finally {
      this.inFlight.delete(args.idempotency_key);
    }
  }

  private async callRpc(
    input: PhEtravelSubmissionStateSyncInput,
    args: PhEtravelSubmissionStateSyncRpcArgs,
    fingerprint: string,
  ): Promise<PhEtravelSubmissionStateSyncOutcome> {
    const finish = (outcome: PhEtravelSubmissionStateSyncOutcome): PhEtravelSubmissionStateSyncOutcome => {
      this.completed.set(args.idempotency_key, { fingerprint, outcome });
      return outcome;
    };
    try {
      const response = await this.client.rpc(PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT.name, args);
      if (response.error !== null) return finish(safeOutcome("phetravel_submission_state_sync_rpc_failed"));
      if (isExpectedPriorStateMismatch(response.data, input)) {
        return finish(safeOutcome("phetravel_submission_state_sync_state_conflict"));
      }
      if (!isCompleteRpcResponse(response.data, input)) {
        return finish(safeOutcome("phetravel_submission_state_sync_rpc_response_invalid"));
      }

      const outcome: PhEtravelSubmissionStateSyncOutcome = {
        outcome: "synchronized",
        idempotentReplay: response.data.outcome === "idempotent_replay",
        safeReasonCode: safePhEtravelErrorSummary({ code: input.safeReasonCode }).code,
        officialResubmitAllowed: false,
      };
      return finish(outcome);
    } catch {
      return finish(safeOutcome("phetravel_submission_state_sync_rpc_unavailable"));
    }
  }
}
