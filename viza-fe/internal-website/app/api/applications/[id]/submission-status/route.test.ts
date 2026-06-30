import { describe, expect, it } from "vitest";
import { deriveNonTerminalStatus } from "./route";

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
