import { describe, expect, it } from "vitest";
import { deriveNonTerminalStatus, selectQueueForSubmissionStatus } from "./route";

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
