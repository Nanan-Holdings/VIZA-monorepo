import { describe, expect, it } from "vitest";
import { deriveNonTerminalStatus } from "./route";

const ukStoppedAtPayResult = {
  country: "UK",
  status: "stopped_at_pay",
  portalUrl: "https://visas-immigration.service.gov.uk/next-steps",
  portalUsername: "appl-mr3f3iva@haggstorm.com",
};

describe("deriveNonTerminalStatus", () => {
  it("keeps stale pending live submission rows queued instead of surfacing a stalled error", () => {
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

    expect(status.status).toBe("queued");
    expect(status.stage).toBe("preparing");
    expect(status.progress).toBe(12);
    expect(status.error).toBeNull();
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
