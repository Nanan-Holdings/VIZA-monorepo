import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelArrivalRunnerJobPayload,
  classifyPhEtravelRunnerJobFrontendState,
  classifyPhEtravelRunnerJobPortalFailure,
  classifyPhEtravelRunnerJobPortalCheckpoint,
  PH_ETRAVEL_RUNNER_JOB_FRONTEND_STATES,
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

  const nonArrivalPayload = buildPhEtravelArrivalRunnerJobPayload(
    applicationId,
    jobId,
    answers({ travel_type: "DEPARTURE" }),
  );
  assert.equal(nonArrivalPayload.countrySpecific.travel_type, "DEPARTURE");
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
  let authoritativeReadCalls = 0;
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
      read: async () => {
        authoritativeReadCalls += 1;
        return {
          source: "official_registration_result_read",
          postSubmitRead: true,
          stableReference: true,
          referenceNumber: "REF-RECOVERY-001",
        };
      },
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
  assert.equal(authoritativeReadCalls, 1);

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

test("PH runner_job treats final POST success-shaped checkpoints as recovery, not submitted", () => {
  const http200 = classifyPhEtravelRunnerJobPortalFailure("ph_etravel_final_post_http_200_unverified");
  const ambiguous = classifyPhEtravelRunnerJobPortalFailure("ph_etravel_final_post_ambiguous_recovery_required");
  const unreadable = classifyPhEtravelRunnerJobPortalFailure("ph_etravel_authoritative_result_read_required");

  for (const result of [http200, ambiguous, unreadable]) {
    assert.equal(result.stage, "result_recovery_required");
    assert.equal(result.browser, "not_started");
    assert.equal(result.queue, "not_started");
    assert.equal(result.officialResubmitAllowed, false);
  }
});

test("PH runner_job exposes OTP and Turnstile checkpoints as safe non-submitted states", () => {
  const otp = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_official_login_verification_required");
  const turnstile = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_registration_turnstile_blocked");
  const profileSave = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_profile_save_authorization_required");
  const residence = classifyPhEtravelRunnerJobPortalCheckpoint("ph_etravel_residence_action_required");
  const unsafe = classifyPhEtravelRunnerJobPortalCheckpoint("email=synthetic@example.test otp=123456");
  for (const result of [otp, turnstile, profileSave, residence, unsafe]) {
    assert.equal(result.stage, "account_or_portal_action_required");
    assert.equal(result.officialResubmitAllowed, false);
  }
  assert.equal(otp.safeReasonCode, "ph_etravel_official_login_verification_required");
  assert.equal(turnstile.safeReasonCode, "ph_etravel_registration_turnstile_blocked");
  assert.equal(profileSave.safeReasonCode, "ph_etravel_profile_save_authorization_required");
  assert.equal(residence.safeReasonCode, "ph_etravel_residence_action_required");
  assert.equal(unsafe.safeReasonCode, "ph_etravel_safe_failure");
  assert.doesNotMatch(JSON.stringify(unsafe), /synthetic@example\.test|123456/);
});

test("PH Review stop and ambiguous final POST use distinct non-submitted recovery states", () => {
  const review = classifyPhEtravelRunnerJobPortalFailure("ph_etravel_stopped_before_submit");
  const ambiguous = classifyPhEtravelRunnerJobPortalFailure("ph_etravel_final_post_ambiguous_recovery_required");
  const referenceRead = classifyPhEtravelRunnerJobPortalFailure("ph_etravel_authoritative_result_read_required");

  assert.equal(review.stage, "review_stop");
  assert.equal(ambiguous.stage, "result_recovery_required");
  assert.equal(referenceRead.stage, "result_recovery_required");
  for (const result of [review, ambiguous, referenceRead]) {
    assert.equal(result.officialResubmitAllowed, false);
  }
});

test("PH runner_job frontend projection distinguishes processing, action-required, failed, recovery, and submitted", () => {
  assert.deepEqual(PH_ETRAVEL_RUNNER_JOB_FRONTEND_STATES, [
    "processing",
    "action_required",
    "failed",
    "recovery_required",
    "submitted",
  ]);
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "scheduled" }), "processing");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "active_job_guard" }), "processing");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "preflight_action_required" }), "action_required");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "account_or_portal_action_required" }), "action_required");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "review_stop" }), "action_required");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "browser_execution_disabled" }), "action_required");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "past_date_action_required" }), "failed");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "result_recovery_required" }), "recovery_required");
  assert.equal(classifyPhEtravelRunnerJobFrontendState({ stage: "submitted_state_synchronized" }), "submitted");
});
