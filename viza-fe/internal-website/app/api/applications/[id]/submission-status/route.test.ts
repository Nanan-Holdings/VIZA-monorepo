import { describe, expect, it } from "vitest";
import {
  deriveNonTerminalStatus,
  deriveSubmissionStatus,
  hasTaiwanApplicantHandoffReady,
  sgacRunnerJobToQueueRow,
  selectQueueForSubmissionStatus,
} from "./route-handler";
import {
  isIndonesiaPaymentApplication,
  isVietnamPaymentCheckpointState,
  resolveVietnamSubmissionActionType,
} from "./payment-country";

const ukStoppedAtPayResult = {
  country: "UK",
  status: "stopped_at_pay",
  portalUrl: "https://visas-immigration.service.gov.uk/next-steps",
  portalUsername: "appl-mr3f3iva@haggstorm.com",
};

describe("sgacRunnerJobToQueueRow", () => {
  it("maps a queued country job to the existing SGAC pending UI contract", () => {
    const enqueuedAt = new Date().toISOString();
    expect(
      sgacRunnerJobToQueueRow({
        id: "runner_1",
        status: "queued",
        attempts: 0,
        last_error: null,
        enqueued_at: enqueuedAt,
        started_at: null,
        finished_at: null,
      }),
    ).toMatchObject({
      id: "runner_1",
      status: "sgac_live_assisted_pending",
      provider: "sg_arrival_card_runner_job",
      transport: "runner_job",
      created_at: enqueuedAt,
    });
  });

  it("maps exhausted country jobs to a failed SGAC attempt", () => {
    expect(
      sgacRunnerJobToQueueRow({
        id: "runner_2",
        status: "dead_letter",
        attempts: 3,
        last_error: "Official portal unavailable",
        enqueued_at: "2026-07-30T00:00:00.000Z",
        started_at: "2026-07-30T00:01:00.000Z",
        finished_at: "2026-07-30T00:02:00.000Z",
      }),
    ).toMatchObject({
      status: "sgac_live_assisted_failed",
      error_message: "Official portal unavailable",
      updated_at: "2026-07-30T00:02:00.000Z",
    });
  });
});

describe("isIndonesiaPaymentApplication", () => {
  it("does not classify a Vietnam payment checkpoint as Indonesia", () => {
    expect(isIndonesiaPaymentApplication("vietnam", "VN_E_VISA")).toBe(false);
    expect(isIndonesiaPaymentApplication("VN", "evisa_tourism")).toBe(false);
  });

  it("recognizes Indonesia country and visa identifiers", () => {
    expect(isIndonesiaPaymentApplication("indonesia", "ID_C1_TOURIST")).toBe(true);
    expect(isIndonesiaPaymentApplication(null, "ID_B1_EVOA")).toBe(true);
  });
});

describe("isVietnamPaymentCheckpointState", () => {
  it("recognizes both legacy and payment-resume Vietnam queue shapes", () => {
    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
        payloadCheckpoint: "payment_page_visible",
      }),
    ).toBe(true);

    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
        errorCode: "manual_payment_required",
        currentStage: "official_fee_manual_review",
        officialStatus: "payment_authorized",
        payloadStatus: "payment_manual_review",
      }),
    ).toBe(true);
  });

  it.each([
    { errorCode: "manual_payment_required" },
    { currentStage: "official_fee_manual_review" },
    { officialStatus: "registration_code_captured_payment_pending" },
    { paymentStatus: "manual_review" },
    { payloadStatus: "payment_manual_review" },
  ])("recognizes the Vietnam payment signal $errorCode$currentStage$officialStatus$payloadStatus", (signals) => {
    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
        ...signals,
      }),
    ).toBe(true);
  });

  it("does not turn a Vietnam CAPTCHA block into a payment checkpoint", () => {
    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
        errorCode: "captcha_required",
        currentStage: "captcha_submitted_blocked",
        payloadStatus: "captcha_failed",
      }),
    ).toBe(false);
  });

  it("fails closed when stale payment and CAPTCHA markers conflict", () => {
    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
        errorCode: "captcha_required",
        currentStage: "official_fee_manual_review",
        payloadActionType: "payment_required",
      }),
    ).toBe(false);
    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
        currentStage: "official_fee_manual_review",
        payloadActionType: "payment_required",
        payloadStatus: "captcha_failed",
      }),
    ).toBe(false);
  });

  it("does not upgrade review or unknown Vietnam blocks to payment", () => {
    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
        errorCode: "review_action_disabled",
      }),
    ).toBe(false);
    expect(
      isVietnamPaymentCheckpointState({
        status: "vn_blocked",
        provider: "vietnam_evisa_live",
      }),
    ).toBe(false);
  });

  it("keeps Indonesia and unrelated countries outside the Vietnam payment state", () => {
    expect(
      isVietnamPaymentCheckpointState({
        status: "id_c1_payment_pending",
        provider: "indonesia_c1_live",
        errorCode: "manual_payment_required",
        currentStage: "official_fee_manual_review",
      }),
    ).toBe(false);
    expect(
      isVietnamPaymentCheckpointState({
        status: "blocked",
        provider: "france_live",
        errorCode: "manual_payment_required",
      }),
    ).toBe(false);
    expect(
      isVietnamPaymentCheckpointState({
        status: "blocked",
        provider: "france_live",
        payloadCheckpoint: "payment_page_visible",
        payloadActionType: "payment_required",
      }),
    ).toBe(false);
  });

  it("canonicalizes a confirmed Vietnam payment handoff action", () => {
    expect(resolveVietnamSubmissionActionType(true, "final_submit_required")).toBe(
      "payment_required",
    );
    expect(resolveVietnamSubmissionActionType(false, "captcha_required")).toBe(
      "captcha_required",
    );
  });
});

describe("deriveNonTerminalStatus", () => {
  it("marks stale pending live submission rows stalled when the worker has not picked them up", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_1",
        applicant_id: "profile_1",
        country: "france",
        visa_type: "EU_SCHENGEN_C_SHORT_STAY",
        submitted_at: tenMinutesAgo,
        submission_result: null,
        submission_result_status: "waiting",
        submission_result_updated_at: tenMinutesAgo,
        updated_at: tenMinutesAgo,
      },
      {
        id: "queue_1",
        status: "france_live_assisted_pending",
        attempts: 0,
        mode: "live_assisted",
        provider: "france_visas_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: null,
        heartbeat_at: null,
        manual_action_status: null,
        official_status: null,
        created_at: tenMinutesAgo,
        updated_at: tenMinutesAgo,
      },
    );

    expect(status.status).toBe("stalled");
    expect(status.stage).toBe("confirming_result");
    expect(status.progress).toBe(99);
    expect(status.message).toContain("worker has not picked it up");
  });

  it("marks pending rows stalled after the shorter pickup timeout", () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_pickup_timeout",
        applicant_id: "profile_1",
        country: "indonesia",
        visa_type: "ID_B1_EVOA",
        submitted_at: sixMinutesAgo,
        submission_result: null,
        submission_result_status: "waiting",
        submission_result_updated_at: sixMinutesAgo,
        updated_at: sixMinutesAgo,
      },
      {
        id: "queue_pickup_timeout",
        status: "id_b1_evoa_live_assisted_pending",
        attempts: 0,
        mode: "live_assisted",
        provider: "indonesia_b1_evoa_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: null,
        heartbeat_at: null,
        manual_action_status: null,
        official_status: null,
        created_at: sixMinutesAgo,
        updated_at: sixMinutesAgo,
      },
    );

    expect(status.status).toBe("stalled");
    expect(status.message).toContain("worker has not picked it up");
  });

  it("keeps Indonesia payment pending in the automatic cloud workflow", () => {
    const now = new Date().toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_2",
        applicant_id: "profile_2",
        country: "ID",
        visa_type: "ID_C1_TOURIST",
        submitted_at: now,
        submission_result: {
          country: "ID",
          status: "stopped_at_pay",
          mode: "live_assisted",
          targetCountry: "ID",
          visaType: "ID_C1_TOURIST",
          provider: "indonesia_c1_live",
          applicationId: "app_2",
          implementationStatus: "partial",
          message: "prepared",
        },
        submission_result_status: "action_required",
        submission_result_updated_at: now,
        updated_at: now,
      },
      {
        id: "queue_2",
        status: "id_c1_payment_pending",
        attempts: 0,
        mode: "live_assisted",
        provider: "indonesia_c1_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "payment_page_visible",
        heartbeat_at: now,
        manual_action_status: null,
        official_status: null,
        created_at: now,
        updated_at: now,
      },
    );

    expect(status.status).toBe("running");
    expect(status.stage).toBe("payment_handoff");
    expect(status.progress).toBe(90);
    expect(status.message).not.toContain("Continue payment from the official payment page.");
  });

  it("does not show an older application failure while a new cloud retry is active", () => {
    const now = new Date().toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_active_retry",
        applicant_id: "profile_active_retry",
        country: "ID",
        visa_type: "ID_B1_EVOA",
        submitted_at: now,
        submission_result: {
          error: "Submission job failed: worker heartbeat stopped for 600s.",
        },
        submission_result_status: "failed",
        submission_result_updated_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: now,
      },
      {
        id: "queue_active_retry",
        status: "id_b1_evoa_payment_processing",
        attempts: 0,
        mode: "live_assisted",
        provider: "indonesia_b1_evoa_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "official_fee_payment_processing",
        heartbeat_at: now,
        manual_action_status: null,
        official_status: null,
        created_at: now,
        updated_at: now,
      },
    );

    expect(status.status).toBe("running");
    expect(status.message).toBe("Current stage: official_fee_payment_processing.");
    expect(status.error).toBeNull();
  });

  it("keeps the Vietnam cloud job running while SC Mobile 3DS approval is pending", () => {
    const now = new Date().toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_vn_3ds",
        applicant_id: "profile_vn_3ds",
        country: "VN",
        visa_type: "evisa_tourism",
        submitted_at: now,
        submission_result: null,
        submission_result_status: "processing",
        submission_result_updated_at: now,
        updated_at: now,
      },
      {
        id: "queue_vn_3ds",
        status: "processing",
        attempts: 0,
        mode: "live_assisted",
        provider: "vietnam_evisa_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "bank_authentication_waiting",
        heartbeat_at: now,
        manual_action_status: null,
        official_status: null,
        created_at: now,
        updated_at: now,
      },
    );

    expect(status.status).toBe("running");
    expect(status.stage).toBe("payment_handoff");
    expect(status.progress).toBe(94);
    expect(status.message).toContain("SC Mobile Banking App");
    expect(status.error).toBeNull();
  });

  it("keeps an authorized Vietnam payment handoff above the generic pending baseline", () => {
    const now = new Date().toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_vn_payment_authorized",
        applicant_id: "profile_vn_payment_authorized",
        country: "VN",
        visa_type: "evisa_tourism",
        submitted_at: now,
        submission_result: null,
        submission_result_status: "processing",
        submission_result_updated_at: now,
        updated_at: now,
      },
      {
        id: "queue_vn_payment_authorized",
        status: "vn_cloud_live_pending",
        attempts: 0,
        mode: "live_assisted",
        provider: "vietnam_evisa_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "payment_authorized",
        heartbeat_at: now,
        manual_action_status: "completed",
        official_status: "payment_authorized",
        payment_status: null,
        vn_result_payload: {},
        created_at: now,
        updated_at: now,
      },
    );

    expect(status.status).toBe("running");
    expect(status.stage).toBe("payment_handoff");
    expect(status.progress).toBe(88);
    expect(status.message).toBe("Current stage: payment_authorized.");
  });

  it("does not move an authorized Vietnam payment back when the worker starts", () => {
    const now = new Date().toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_vn_payment_starting",
        applicant_id: "profile_vn_payment_starting",
        country: "VN",
        visa_type: "evisa_tourism",
        submitted_at: now,
        submission_result: null,
        submission_result_status: "processing",
        submission_result_updated_at: now,
        updated_at: now,
      },
      {
        id: "queue_vn_payment_starting",
        status: "vn_live_assisted_processing",
        attempts: 0,
        mode: "live_assisted",
        provider: "vietnam_evisa_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "starting",
        heartbeat_at: now,
        manual_action_status: "completed",
        official_status: "processing",
        payment_status: "authorized",
        vn_result_payload: { status: "payment_authorized" },
        created_at: now,
        updated_at: now,
      },
    );

    expect(status.status).toBe("running");
    expect(status.stage).toBe("payment_handoff");
    expect(status.progress).toBe(88);
    expect(status.message).toBe("Current stage: starting.");
  });

  it("prefers a terminal UK payment handoff over a stale completed queue row", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_uk",
        applicant_id: "profile_1",
        country: "uk",
        visa_type: "UK_STANDARD_VISITOR",
        submitted_at: tenMinutesAgo,
        submission_result: ukStoppedAtPayResult,
        submission_result_status: "stopped_at_pay",
        submission_result_updated_at: tenMinutesAgo,
        updated_at: tenMinutesAgo,
      },
      {
        id: "queue_uk",
        status: "uk_prefilled",
        attempts: 1,
        mode: "dry_run",
        provider: "gov_uk",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "halted_before_pay",
        heartbeat_at: null,
        manual_action_status: null,
        official_status: null,
        created_at: tenMinutesAgo,
        updated_at: tenMinutesAgo,
      },
    );

    expect(status.status).toBe("needs_user_action");
    expect(status.stage).toBe("payment_handoff");
    expect(status.error).toBeNull();
  });
});

describe("deriveSubmissionStatus", () => {
  it("lets a newer completed queue replace an older stalled application result", () => {
    const status = deriveSubmissionStatus(
      {
        id: "application-id",
        applicant_id: "applicant-id",
        country: "United States",
        visa_type: "B1_B2",
        submitted_at: null,
        submission_result: {
          status: "stalled",
          error: "Submission job stalled because the worker did not pick it up in time.",
        },
        submission_result_status: "stalled",
        submission_result_updated_at: "2026-07-29T04:30:00.000Z",
        updated_at: "2026-07-29T04:30:00.000Z",
      },
      {
        id: "queue-id",
        status: "ds160_submitted",
        attempts: 1,
        mode: "live_assisted",
        provider: "ceac",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "completed",
        heartbeat_at: "2026-07-29T04:36:00.000Z",
        manual_action_status: null,
        official_status: null,
        created_at: "2026-07-29T04:31:00.000Z",
        updated_at: "2026-07-29T04:36:00.000Z",
      },
      true,
    );

    expect(status.status).toBe("completed");
    expect(status.progress).toBe(100);
  });
});

describe("selectQueueForSubmissionStatus", () => {
  it("prefers the latest active retry queue over a superseded queue with the same updated timestamp", () => {
    const updatedAt = new Date().toISOString();

    const queue = selectQueueForSubmissionStatus([
      {
        id: "old_queue",
        status: "retry_superseded",
        attempts: 0,
        mode: "live_assisted",
        provider: "indonesia_b1_evoa_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: "preparing_managed_alias",
        heartbeat_at: updatedAt,
        manual_action_status: null,
        official_status: null,
        created_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: updatedAt,
      },
      {
        id: "new_queue",
        status: "id_b1_evoa_live_assisted_pending",
        attempts: 0,
        mode: "live_assisted",
        provider: "indonesia_b1_evoa_live",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: null,
        heartbeat_at: null,
        manual_action_status: null,
        official_status: null,
        created_at: updatedAt,
        updated_at: updatedAt,
      },
    ]);

    expect(queue?.id).toBe("new_queue");
    expect(queue?.current_stage).toBeNull();
  });

  it("does not fall back to an older completed dry run after a live retry was superseded", () => {
    const latest = new Date().toISOString();
    const older = new Date(Date.now() - 60_000).toISOString();

    const queue = selectQueueForSubmissionStatus([
      {
        id: "superseded_live_retry",
        status: "retry_superseded",
        attempts: 0,
        mode: "live_assisted",
        provider: "philippines_etravel_live",
        last_error: null,
        error_code: "duplicate_retry_after_success",
        error_message: "Duplicate retry suppressed.",
        current_stage: "duplicate_suppressed",
        heartbeat_at: latest,
        manual_action_status: null,
        official_status: null,
        created_at: latest,
        updated_at: latest,
      },
      {
        id: "old_dry_run",
        status: "done",
        attempts: 0,
        mode: "dry_run",
        provider: "philippines_etravel_dry_run",
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: null,
        heartbeat_at: null,
        manual_action_status: null,
        official_status: null,
        created_at: older,
        updated_at: older,
      },
    ]);

    expect(queue?.id).toBe("superseded_live_retry");
  });

  it("does not fall back to an older payment checkpoint after a newer retry failed", () => {
    const newest = new Date().toISOString();
    const older = new Date(Date.now() - 60_000).toISOString();

    const queue = selectQueueForSubmissionStatus([
      {
        id: "new_failed_retry",
        status: "id_b1_evoa_payment_failed",
        attempts: 3,
        mode: "live_assisted",
        provider: "indonesia_b1_evoa_live",
        last_error: "Payment worker heartbeat stopped.",
        error_code: "queue_processing_timed_out",
        error_message: "Payment worker heartbeat stopped.",
        current_stage: "failed",
        heartbeat_at: newest,
        manual_action_status: null,
        official_status: null,
        created_at: newest,
        updated_at: newest,
      },
      {
        id: "old_payment_checkpoint",
        status: "id_b1_evoa_payment_pending",
        attempts: 0,
        mode: "live_assisted",
        provider: "indonesia_b1_evoa_live",
        last_error: null,
        error_code: "user_payment_required",
        error_message: null,
        current_stage: "user_payment_required",
        heartbeat_at: older,
        manual_action_status: "user_payment_required",
        official_status: null,
        created_at: older,
        updated_at: older,
      },
    ]);

    expect(queue?.id).toBe("new_failed_retry");
  });
});

describe("hasTaiwanApplicantHandoffReady", () => {
  it("lets a durable Taiwan applicant handoff outrank the lease-holding runner", () => {
    expect(
      hasTaiwanApplicantHandoffReady({
        country: "taiwan",
        visa_type: "TW_ENTRY_PERMIT",
        submission_result_status: "needs_user_action",
        submission_result: {
          country: "TW",
          status: "stopped_at_captcha",
          handoffId: "handoff_1",
        },
      }),
    ).toBe(true);
  });

  it("rejects incomplete and non-Taiwan handoff results", () => {
    expect(
      hasTaiwanApplicantHandoffReady({
        country: "taiwan",
        visa_type: "TW_ENTRY_PERMIT",
        submission_result_status: "needs_user_action",
        submission_result: { country: "TW", status: "stopped_at_captcha" },
      }),
    ).toBe(false);
    expect(
      hasTaiwanApplicantHandoffReady({
        country: "vietnam",
        visa_type: "evisa_tourism",
        submission_result_status: "needs_user_action",
        submission_result: { status: "stopped_at_captcha", handoffId: "handoff_1" },
      }),
    ).toBe(false);
  });
});
