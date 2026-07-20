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
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const status = deriveNonTerminalStatus(
      {
        id: "app_pickup_timeout",
        applicant_id: "profile_1",
        country: "indonesia",
        visa_type: "ID_B1_EVOA",
        submitted_at: oneMinuteAgo,
        submission_result: null,
        submission_result_status: "waiting",
        submission_result_updated_at: oneMinuteAgo,
        updated_at: oneMinuteAgo,
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
        created_at: oneMinuteAgo,
        updated_at: oneMinuteAgo,
      },
    );

    expect(status.status).toBe("stalled");
    expect(status.message).toContain("worker has not picked it up");
  });

  it("treats Indonesia payment pending as manual action required", () => {
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

    expect(status.status).toBe("needs_user_action");
    expect(status.stage).toBe("payment_handoff");
    expect(status.progress).toBe(99);
    expect(status.message).toContain("Continue payment from the official payment page.");
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
});
