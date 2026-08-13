import assert from "node:assert/strict";
import test from "node:test";

import { dryRunPhEtravelSubmissionStateCutover } from "../submission-state-cutover";
import {
  PhEtravelSubmissionStateSyncAdapter,
  type PhEtravelSubmissionStateSyncInput,
  type PhEtravelSubmissionStateSyncRpcArgs,
  type PhEtravelSubmissionStateSyncRpcClient,
} from "../submission-state-sync";
import type { PhEtravelArrivalLaunchPreflight } from "../launch-preflight";

function allowedPreflight(): PhEtravelArrivalLaunchPreflight {
  return {
    status: "allowed",
    blockingCodes: [],
    missingKeys: [],
    officialResubmitAllowed: false,
  };
}

function syncInput(overrides: Partial<PhEtravelSubmissionStateSyncInput> = {}): PhEtravelSubmissionStateSyncInput {
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

function response(input: PhEtravelSubmissionStateSyncInput, outcome: "applied" | "idempotent_replay" = "applied") {
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

class FakeV2Rpc implements PhEtravelSubmissionStateSyncRpcClient {
  readonly calls: Array<{ name: string; args: PhEtravelSubmissionStateSyncRpcArgs }> = [];

  constructor(private readonly handler: (args: PhEtravelSubmissionStateSyncRpcArgs) => Promise<{ data: unknown; error: unknown | null }>) {}

  async rpc(name: "sync_ph_etravel_submission_state", args: PhEtravelSubmissionStateSyncRpcArgs) {
    this.calls.push({ name, args });
    return this.handler(args);
  }
}

test("PH v2 cutover dry-run blocks before account, browser, or RPC when launch preflight is blocked", async () => {
  let syncCalls = 0;
  const result = await dryRunPhEtravelSubmissionStateCutover({
    preflight: {
      status: "action_required",
      code: "ph_etravel_launch_air_travel_review_required",
      blockingCodes: ["ph_etravel_launch_air_travel_review_required"],
      missingKeys: ["air.airline_code"],
      officialResubmitAllowed: false,
    },
    syncAdapter: {
      async sync() {
        syncCalls += 1;
        throw new Error("must not be called");
      },
    },
    syncInput: syncInput(),
  });

  assert.deepEqual(result, {
    stage: "preflight_blocked",
    safeReasonCode: "ph_etravel_launch_air_travel_review_required",
    rpc: "not_called",
    accountPreparation: "not_started",
    browser: "not_started",
    legacySequentialWrites: "prohibited",
    officialResubmitAllowed: false,
  });
  assert.equal(syncCalls, 0);
});

test("PH v2 cutover dry-run accepts only a complete applied reply and prohibits legacy sequential writes", async () => {
  const input = syncInput();
  const rpc = new FakeV2Rpc(async () => ({ data: response(input), error: null }));
  const result = await dryRunPhEtravelSubmissionStateCutover({
    preflight: allowedPreflight(),
    syncAdapter: new PhEtravelSubmissionStateSyncAdapter(rpc, true),
    syncInput: input,
  });

  assert.deepEqual(result, {
    stage: "synchronized",
    safeReasonCode: "phetravel_result_consistency_sync_failed",
    idempotentReplay: false,
    rpc: "called",
    accountPreparation: "not_started",
    browser: "not_started",
    legacySequentialWrites: "prohibited",
    officialResubmitAllowed: false,
  });
  assert.equal(rpc.calls.length, 1);
  assert.equal(rpc.calls[0].name, "sync_ph_etravel_submission_state");
  assert.deepEqual(rpc.calls[0].args.result_json, {
    target_status: "submitted",
    official_reference: "ETRAVEL-REF-789",
    authoritative_result_read: {
      source: "official_registration_result_read",
      post_submit_read: true,
      reference_number: "ETRAVEL-REF-789",
      stable_reference: true,
    },
    qr_render_metadata: {
      renderer: "official_client_reference_qr",
      rendered_for_reference: "ETRAVEL-REF-789",
      rendered: true,
      reference_value_validated: true,
    },
    safe_reason_code: "phetravel_result_consistency_sync_failed",
  });
  assert.equal(rpc.calls[0].args.application_patch.expected_status, "processing");
  assert.equal(rpc.calls[0].args.queue_patch.expected_status, "phetravel_live_assisted_processing");
});

test("PH v2 cutover dry-run preserves idempotency for duplicate workers and restart replay", async () => {
  const input = syncInput();
  const rpc = new FakeV2Rpc(async () => ({ data: response(input), error: null }));
  const adapter = new PhEtravelSubmissionStateSyncAdapter(rpc, true);
  const [first, duplicate] = await Promise.all([
    dryRunPhEtravelSubmissionStateCutover({ preflight: allowedPreflight(), syncAdapter: adapter, syncInput: input }),
    dryRunPhEtravelSubmissionStateCutover({ preflight: allowedPreflight(), syncAdapter: adapter, syncInput: input }),
  ]);
  assert.deepEqual(duplicate, first);
  assert.equal(rpc.calls.length, 1);

  const replayRpc = new FakeV2Rpc(async () => ({ data: response(input, "idempotent_replay"), error: null }));
  const restarted = await dryRunPhEtravelSubmissionStateCutover({
    preflight: allowedPreflight(),
    syncAdapter: new PhEtravelSubmissionStateSyncAdapter(replayRpc, true),
    syncInput: input,
  });
  assert.equal(restarted.stage, "synchronized");
  assert.equal(restarted.idempotentReplay, true);
  assert.equal(replayRpc.calls.length, 1);
  assert.equal(restarted.legacySequentialWrites, "prohibited");
  assert.equal(restarted.officialResubmitAllowed, false);
});

test("PH v2 cutover dry-run turns mismatch, timeout/throw, and partial replies into recovery without resubmit", async () => {
  const input = syncInput({ safeReasonCode: "official portal applicant@example.test OTP=123456 token=cookie passport=P1234567" });
  const scenarios: Array<{
    name: string;
    handler: (args: PhEtravelSubmissionStateSyncRpcArgs) => Promise<{ data: unknown; error: unknown | null }>;
    code: string;
  }> = [
    {
      name: "expected prior state mismatch",
      handler: async () => ({
        data: {
          outcome: "expected_prior_state_mismatch",
          application_id: input.applicationId,
          queue_id: input.queueId,
          idempotency_key: input.idempotencyKey,
          target_status: input.targetStatus,
        },
        error: null,
      }),
      code: "phetravel_submission_state_sync_state_conflict",
    },
    {
      name: "timeout error",
      handler: async () => ({ data: null, error: "timeout applicant@example.test OTP=123456" }),
      code: "phetravel_submission_state_sync_rpc_failed",
    },
    {
      name: "throw",
      handler: async () => {
        throw new Error("provider token=cookie passport=P1234567");
      },
      code: "phetravel_submission_state_sync_rpc_unavailable",
    },
    {
      name: "partial reply",
      handler: async () => ({ data: { outcome: "applied" }, error: null }),
      code: "phetravel_submission_state_sync_rpc_response_invalid",
    },
  ];

  for (const scenario of scenarios) {
    const rpc = new FakeV2Rpc(scenario.handler);
    const result = await dryRunPhEtravelSubmissionStateCutover({
      preflight: allowedPreflight(),
      syncAdapter: new PhEtravelSubmissionStateSyncAdapter(rpc, true),
      syncInput: input,
    });
    assert.deepEqual(result, {
      stage: "recovery_required",
      safeReasonCode: scenario.code,
      rpc: "called",
      accountPreparation: "not_started",
      browser: "not_started",
      legacySequentialWrites: "prohibited",
      officialResubmitAllowed: false,
    }, scenario.name);
    assert.equal(rpc.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /applicant@example\.test|123456|token|cookie|P1234567/i);
  }
});

test("PH v2 cutover dry-run refuses ambiguous final-post recovery before RPC and never enables resubmit", async () => {
  let rpcCalls = 0;
  const result = await dryRunPhEtravelSubmissionStateCutover({
    preflight: {
      status: "action_required",
      code: "ph_etravel_launch_final_result_recovery_required",
      blockingCodes: ["ph_etravel_launch_final_result_recovery_required"],
      missingKeys: ["result.official_reference", "result.reference_qr_render"],
      officialResubmitAllowed: false,
    },
    syncAdapter: {
      async sync() {
        rpcCalls += 1;
        throw new Error("must not be called");
      },
    },
    syncInput: syncInput({
      authoritativeRead: null,
      qrRender: null,
    }),
  });

  assert.equal(result.stage, "preflight_blocked");
  assert.equal(result.safeReasonCode, "ph_etravel_launch_final_result_recovery_required");
  assert.equal(result.rpc, "not_called");
  assert.equal(result.officialResubmitAllowed, false);
  assert.equal(rpcCalls, 0);
});
