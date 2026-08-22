import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelArrivalRunnerJobPayload,
  classifyPhEtravelRunnerJobPortalCheckpoint,
  runPhEtravelArrivalRunnerJob,
  type PhEtravelRunnerJobState,
} from "../runner-job.js";
import type { CanonicalRecord } from "../../queue/answers.js";

const applicationId = "app-runner-job-test";
const jobId = "job-runner-job-test";

function answers(overrides: CanonicalRecord = {}): CanonicalRecord {
  return {
    transport_type: "AIR",
    flight_arrival_date: "2026-08-15",
    flight_departure_date: "2026-08-14",
    travel_type: "ARRIVAL",
    registration_for: "FOR_ME",
    traveller_type: "AIRCRAFT PASSENGER",
    ...overrides,
  };
}

function state(overrides: Partial<PhEtravelRunnerJobState> = {}): PhEtravelRunnerJobState {
  return {
    applicationStatus: "processing",
    submissionResultStatus: "processing",
    submissionResult: null,
    activeJobIds: [],
    ...overrides,
  };
}

function completeStoredResult(): Record<string, unknown> {
  return {
    country: "PH",
    provider: "philippines_etravel_live",
    status: "submitted",
    submitted: true,
    resultEvidence: {
      authoritativeRead: {
        source: "official_registration_result_read",
        postSubmitRead: true,
        referenceNumber: "REF-RUNNER-001",
        stableReference: true,
      },
      qrRender: {
        renderer: "official_client_reference_qr",
        renderedForReference: "REF-RUNNER-001",
        rendered: true,
        referenceValueValidated: true,
      },
    },
    artifacts: { screenshots: [], pdfs: [] },
  };
}

test("PH runner_job preserves AIR/SEA 72-hour dates and starts no external work", async () => {
  let portalCalls = 0;
  const scheduled = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadAnswers: async () => answers(),
    loadState: async () => state(),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
    now: new Date("2026-08-10T00:00:00Z"),
  });
  assert.equal(scheduled.stage, "scheduled");
  assert.equal(scheduled.safeReasonCode, "ph_etravel_runner_window_scheduled");
  assert.equal(portalCalls, 0);
  assert.deepEqual(
    [scheduled.accountPreparation, scheduled.browser, scheduled.queue, scheduled.officialResubmitAllowed],
    ["not_started", "not_started", "not_started", false],
  );

  const seaPayload = buildPhEtravelArrivalRunnerJobPayload(applicationId, jobId, answers({
    transport_type: "SEA",
    voyage_arrival_date: "2026-08-15",
    voyage_departure_date: "2026-08-14",
    flight_arrival_date: "2020-01-01",
    flight_departure_date: "2020-01-01",
  }));
  assert.equal(seaPayload.trip.arrivalDate, "2026-08-15");
  assert.equal(seaPayload.trip.departureDate, "2026-08-14");
});

test("PH runner_job blocks active duplicates and P0 preflight before account, OTP, Turnstile, or browser", async () => {
  let portalCalls = 0;
  const duplicate = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadAnswers: async () => answers(),
    loadState: async () => state({ activeJobIds: ["other-active-job"] }),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
    now: new Date("2026-08-13T00:00:00Z"),
  });
  assert.equal(duplicate.stage, "active_job_guard");
  assert.equal(duplicate.safeReasonCode, "ph_etravel_runner_active_job_exists");

  const preflight = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadAnswers: async () => answers({ email_address: "synthetic@example.test", passport_number: "P12345678" }),
    loadState: async () => state(),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
    now: new Date("2026-08-13T00:00:00Z"),
  });
  assert.equal(preflight.stage, "preflight_action_required");
  assert.equal(portalCalls, 0);
  assert.doesNotMatch(JSON.stringify(preflight), /synthetic@example\.test|P12345678/);
});

test("PH runner_job syncs only stored authoritative reference-derived QR evidence", async () => {
  const calls: unknown[] = [];
  const result = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: completeStoredResult() }),
    syncAdapter: {
      sync: async (input) => {
        calls.push(input);
        return {
          outcome: "synchronized",
          idempotentReplay: false,
          safeReasonCode: "phetravel_result_consistency_sync_failed",
          officialResubmitAllowed: false,
        };
      },
    },
  });
  assert.equal(result.stage, "submitted_state_synchronized");
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { targetStatus: string }).targetStatus, "submitted");
  assert.equal(result.officialResubmitAllowed, false);
});

test("PH runner_job treats reference-only, QR mismatch, RPC failure, restart, and ambiguous POST as recovery only", async () => {
  let portalCalls = 0;
  const referenceOnly = {
    country: "PH",
    provider: "philippines_etravel_live",
    status: "submitted",
    submitted: true,
    referenceNumber: "REF-ONLY-001",
  };
  const missingReader = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: referenceOnly }),
    portalRunner: async () => {
      portalCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(missingReader.stage, "result_recovery_required");
  assert.equal(portalCalls, 0);

  const mismatch = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: {
      ...referenceOnly,
      errorDetails: { code: "ph_etravel_final_post_ambiguous_recovery_required" },
    } }),
    authoritativeReader: {
      read: async () => ({
        source: "official_registration_result_read",
        postSubmitRead: true,
        stableReference: true,
        referenceNumber: "REF-RECOVERY-001",
      }),
    },
    qrRenderer: {
      render: async () => ({
        renderer: "official_client_reference_qr",
        rendered: true,
        referenceValueValidated: true,
        renderedForReference: "WRONG-REFERENCE",
      }),
    },
  });
  assert.equal(mismatch.stage, "result_recovery_required");

  const rpcUnavailable = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: completeStoredResult() }),
    syncAdapter: {
      sync: async () => ({
        outcome: "recovery_required",
        safeReasonCode: "phetravel_submission_state_sync_rpc_unavailable",
        officialResubmitAllowed: false,
      }),
    },
  });
  const restarted = await runPhEtravelArrivalRunnerJob(applicationId, jobId, {
    loadState: async () => state({ submissionResult: completeStoredResult() }),
    syncAdapter: {
      sync: async () => ({
        outcome: "recovery_required",
        safeReasonCode: "phetravel_submission_state_sync_rpc_unavailable",
        officialResubmitAllowed: false,
      }),
    },
  });
  assert.deepEqual(restarted, rpcUnavailable);
  assert.equal(rpcUnavailable.stage, "result_recovery_required");
  assert.equal(portalCalls, 0);
});

test("PH runner_job exposes OTP and Turnstile checkpoints as safe non-submitted states", () => {
  const otp = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_official_login_verification_required");
  const turnstile = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_registration_turnstile_blocked");
  const unsafe = classifyPhEtravelRunnerJobPortalCheckpoint("email=synthetic@example.test otp=123456");
  for (const result of [otp, turnstile, unsafe]) {
    assert.equal(result.stage, "account_or_portal_action_required");
    assert.equal(result.officialResubmitAllowed, false);
  }
  assert.equal(otp.safeReasonCode, "ph_etravel_official_login_verification_required");
  assert.equal(turnstile.safeReasonCode, "ph_etravel_registration_turnstile_blocked");
  assert.equal(unsafe.safeReasonCode, "ph_etravel_safe_failure");
  assert.doesNotMatch(JSON.stringify(unsafe), /synthetic@example\.test|123456/);
});
