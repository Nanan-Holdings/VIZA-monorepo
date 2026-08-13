import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelSubmissionStateSyncRpcArgs,
  isPhEtravelSubmissionStateSyncRpcEnabled,
  PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_FEATURE_FLAG,
  PhEtravelSubmissionStateSyncAdapter,
  type PhEtravelSubmissionStateSyncInput,
  type PhEtravelSubmissionStateSyncRpcArgs,
  type PhEtravelSubmissionStateSyncRpcClient,
} from "../submission-state-sync";

function submissionInput(overrides: Partial<PhEtravelSubmissionStateSyncInput> = {}): PhEtravelSubmissionStateSyncInput {
  return {
    applicationId: "application-123",
    queueId: "queue-456",
    expectedPriorState: {
      applicationStatus: "processing",
      queueStatus: "phetravel_live_assisted_processing",
      submissionResultStatus: "processing",
    },
    targetStatus: "submitted",
    officialReference: "ETRAVEL-REF-789",
    authoritativeRead: {
      source: "official_registration_result_read",
      postSubmitRead: true,
      referenceNumber: "ETRAVEL-REF-789",
      stableReference: true,
    },
    qrRender: {
      renderer: "official_client_reference_qr",
      renderedForReference: "ETRAVEL-REF-789",
      rendered: true,
      referenceValueValidated: true,
    },
    idempotencyKey: "phetravel:queue-456:result-sync",
    safeReasonCode: "phetravel_result_consistency_sync_failed",
    ...overrides,
  };
}

function successfulResponse(input: PhEtravelSubmissionStateSyncInput, outcome: "applied" | "idempotent_replay" = "applied") {
  return {
    outcome,
    application_id: input.applicationId,
    queue_id: input.queueId,
    idempotency_key: input.idempotencyKey,
    target_status: input.targetStatus,
    application_status: "submitted",
    queue_status: "done",
    submission_result_status: "completed",
  };
}

class FakeRpcClient implements PhEtravelSubmissionStateSyncRpcClient {
  readonly calls: Array<{ name: string; args: PhEtravelSubmissionStateSyncRpcArgs }> = [];

  constructor(
    private readonly handler: (args: PhEtravelSubmissionStateSyncRpcArgs) => Promise<{ data: unknown; error: unknown | null }>,
  ) {}

  async rpc(name: string, args: PhEtravelSubmissionStateSyncRpcArgs): Promise<{ data: unknown; error: unknown | null }> {
    this.calls.push({ name, args });
    return this.handler(args);
  }
}

test("PH submission-state sync RPC args carry only the explicit safe contract input", () => {
  const input = submissionInput({ safeReasonCode: "provider text sensitive@example.test OTP token cookie" });
  const args = buildPhEtravelSubmissionStateSyncRpcArgs(input);

  assert.ok(args);
  assert.deepEqual(Object.keys(args).sort(), [
    "application_id",
    "application_patch",
    "idempotency_key",
    "queue_id",
    "queue_patch",
    "result_json",
  ]);
  assert.equal(args.application_patch.expected_status, "processing");
  assert.equal(args.queue_patch.expected_status, "phetravel_live_assisted_processing");
  assert.equal(args.result_json.official_reference, "ETRAVEL-REF-789");
  assert.deepEqual(args.result_json.authoritative_result_read, {
    source: "official_registration_result_read",
    post_submit_read: true,
    reference_number: "ETRAVEL-REF-789",
    stable_reference: true,
  });
  assert.deepEqual(args.result_json.qr_render_metadata, {
    renderer: "official_client_reference_qr",
    rendered_for_reference: "ETRAVEL-REF-789",
    rendered: true,
    reference_value_validated: true,
  });
  assert.equal(args.result_json.safe_reason_code, "ph_etravel_safe_failure");
  assert.doesNotMatch(JSON.stringify(args), /sensitive@example\.test|OTP|token|cookie/i);
});

test("PH submission-state sync remains disabled unless the exact feature flag is enabled", async () => {
  assert.equal(isPhEtravelSubmissionStateSyncRpcEnabled({}), false);
  assert.equal(isPhEtravelSubmissionStateSyncRpcEnabled({
    [PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_FEATURE_FLAG]: "true",
  }), true);

  const client = new FakeRpcClient(async () => ({ data: null, error: null }));
  const outcome = await new PhEtravelSubmissionStateSyncAdapter(client).sync(submissionInput());
  assert.deepEqual(outcome, {
    outcome: "recovery_required",
    safeReasonCode: "phetravel_submission_state_sync_rpc_not_enabled",
    officialResubmitAllowed: false,
  });
  assert.equal(client.calls.length, 0);
});

test("PH submission-state sync coalesces concurrent and repeated idempotency keys", async () => {
  const input = submissionInput();
  const client = new FakeRpcClient(async () => ({ data: successfulResponse(input), error: null }));
  const adapter = new PhEtravelSubmissionStateSyncAdapter(client, true);

  const [first, second] = await Promise.all([adapter.sync(input), adapter.sync(input)]);
  const third = await adapter.sync(input);

  assert.deepEqual(first, {
    outcome: "synchronized",
    idempotentReplay: false,
    safeReasonCode: "phetravel_result_consistency_sync_failed",
    officialResubmitAllowed: false,
  });
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].name, "sync_ph_etravel_submission_state");
});

test("PH submission-state sync accepts only the RPC's explicit idempotent replay outcome", async () => {
  const input = submissionInput();
  const client = new FakeRpcClient(async () => ({
    data: successfulResponse(input, "idempotent_replay"),
    error: null,
  }));

  const outcome = await new PhEtravelSubmissionStateSyncAdapter(client, true).sync(input);
  assert.deepEqual(outcome, {
    outcome: "synchronized",
    idempotentReplay: true,
    safeReasonCode: "phetravel_result_consistency_sync_failed",
    officialResubmitAllowed: false,
  });
  assert.equal(client.calls.length, 1);
});

test("PH submission-state sync rejects a stale expected state without a resubmit", async () => {
  const input = submissionInput();
  const client = new FakeRpcClient(async () => ({
    data: {
      outcome: "expected_prior_state_mismatch",
      application_id: input.applicationId,
      queue_id: input.queueId,
      idempotency_key: input.idempotencyKey,
      target_status: input.targetStatus,
    },
    error: null,
  }));

  const outcome = await new PhEtravelSubmissionStateSyncAdapter(client, true).sync(input);
  assert.deepEqual(outcome, {
    outcome: "recovery_required",
    safeReasonCode: "phetravel_submission_state_sync_state_conflict",
    officialResubmitAllowed: false,
  });
  assert.equal(client.calls.length, 1);
});

test("PH submission-state sync refuses reference-only, missing authoritative read, or mismatched QR render evidence before calling RPC", async () => {
  const client = new FakeRpcClient(async () => ({ data: null, error: null }));
  const outcome = await new PhEtravelSubmissionStateSyncAdapter(client, true).sync(submissionInput({
    qrRender: null,
  }));

  assert.deepEqual(outcome, {
    outcome: "recovery_required",
    safeReasonCode: "ph_etravel_authoritative_result_read_required",
    officialResubmitAllowed: false,
  });
  assert.equal(client.calls.length, 0);

  const missingRead = await new PhEtravelSubmissionStateSyncAdapter(client, true).sync(submissionInput({
    authoritativeRead: null,
  }));
  assert.deepEqual(missingRead, {
    outcome: "recovery_required",
    safeReasonCode: "ph_etravel_authoritative_result_read_required",
    officialResubmitAllowed: false,
  });
  assert.equal(client.calls.length, 0);

  const mismatched = await new PhEtravelSubmissionStateSyncAdapter(client, true).sync(submissionInput({
    qrRender: {
      renderer: "official_client_reference_qr",
      renderedForReference: "OTHER-REFERENCE",
      rendered: true,
      referenceValueValidated: true,
    },
  }));
  assert.equal(mismatched.outcome, "recovery_required");
  assert.equal(client.calls.length, 0);
});

test("PH submission-state sync blocks conflicting idempotency replay and hides RPC errors", async () => {
  const input = submissionInput();
  const client = new FakeRpcClient(async () => ({
    data: null,
    error: "official page said applicant@example.test OTP=111111 token=cookie passport=P1234567",
  }));
  const adapter = new PhEtravelSubmissionStateSyncAdapter(client, true);

  const failed = await adapter.sync(input);
  const retried = await adapter.sync(input);
  const conflict = await adapter.sync(submissionInput({ targetStatus: "recovery_required" }));

  assert.deepEqual(failed, {
    outcome: "recovery_required",
    safeReasonCode: "phetravel_submission_state_sync_rpc_failed",
    officialResubmitAllowed: false,
  });
  assert.deepEqual(retried, failed);
  assert.deepEqual(conflict, {
    outcome: "recovery_required",
    safeReasonCode: "phetravel_submission_state_sync_idempotency_conflict",
    officialResubmitAllowed: false,
  });
  assert.equal(client.calls.length, 1);
  assert.doesNotMatch(JSON.stringify([failed, retried, conflict]), /applicant@example\.test|111111|token|cookie|P1234567/i);
});

test("PH submission-state sync treats a missing RPC as recoverable and never exposes the thrown provider text", async () => {
  const client = new FakeRpcClient(async () => {
    throw new Error("official portal applicant@example.test OTP=111111 token=cookie passport=P1234567");
  });
  const outcome = await new PhEtravelSubmissionStateSyncAdapter(client, true).sync(submissionInput());

  assert.deepEqual(outcome, {
    outcome: "recovery_required",
    safeReasonCode: "phetravel_submission_state_sync_rpc_unavailable",
    officialResubmitAllowed: false,
  });
  assert.doesNotMatch(JSON.stringify(outcome), /applicant@example\.test|111111|token|cookie|P1234567/i);
});
