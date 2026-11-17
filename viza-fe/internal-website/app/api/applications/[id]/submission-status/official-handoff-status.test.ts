import { describe, expect, it } from "vitest";
import { deriveNonTerminalStatus } from "./route-handler";

const now = new Date().toISOString();

const application = {
  id: "id_application",
  applicant_id: "profile_1",
  country: "indonesia",
  visa_type: "ID_C1_TOURIST",
  submitted_at: now,
  submission_result: {
    country: "GENERIC",
    targetCountry: "ID",
    status: "awaiting_applicant_official_submit",
    handoffId: "takeover_1",
  },
  submission_result_status: "needs_user_action",
  submission_result_updated_at: now,
  updated_at: now,
};

function queue(status: string, payload: Record<string, unknown> = {}) {
  return {
    id: "queue_1",
    status,
    provider: "indonesia_c1_live",
    attempts: 1,
    current_stage: "awaiting_applicant_official_submit",
    vn_result_payload: payload,
    error_message: null,
    last_error: null,
    created_at: now,
    updated_at: now,
    heartbeat_at: null,
  } as unknown as Parameters<typeof deriveNonTerminalStatus>[1];
}

describe("official applicant handoff status", () => {
  it("asks the applicant to finish on the official site while the handoff is open", () => {
    const status = deriveNonTerminalStatus(application, queue("id_c1_applicant_handoff"), true);
    expect(status).toMatchObject({ status: "needs_user_action", stage: "payment_handoff", error: null });
    expect(status.message).toMatch(/submit, and pay the government fee yourself/);
  });

  it("does not let a stale payment payload turn the handoff into 'automated payment unavailable'", () => {
    const status = deriveNonTerminalStatus(
      application,
      queue("id_b1_evoa_applicant_handoff", { actionType: "official_fee_payment_required" }),
      true,
    );
    expect(status.message).not.toMatch(/Automated payment is unavailable/);
  });

  it("shows a cancelled submission as stopped, not running", () => {
    for (const status of ["id_c1_live_assisted_cancelled", "id_b1_evoa_applicant_cancelled"]) {
      const derived = deriveNonTerminalStatus(application, queue(status), true);
      expect(derived).toMatchObject({ status: "failed" });
      expect(derived.message).toMatch(/You cancelled this submission/);
    }
  });

  it("offers a new session after expiry and completes after the applicant submits", () => {
    expect(deriveNonTerminalStatus(application, queue("id_c1_applicant_handoff_expired"), true)).toMatchObject({
      status: "needs_user_action",
    });
    expect(deriveNonTerminalStatus(application, queue("id_b1_evoa_applicant_submitted"), true)).toMatchObject({
      status: "completed",
      progress: 100,
    });
  });
});
