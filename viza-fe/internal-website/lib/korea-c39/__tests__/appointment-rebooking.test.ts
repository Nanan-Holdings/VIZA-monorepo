import { describe, expect, it } from "vitest";
import { planKoreaRebooking } from "../appointment-rebooking";

const cancelledJob = {
  id: "cancelled-job",
  status: "appointment_cancelled",
  user_preferences_json: { centerCode: "beijing" },
};

describe("planKoreaRebooking", () => {
  it("creates a deterministic new task after cancellation", () => {
    expect(planKoreaRebooking("application-1", cancelledJob, null)).toEqual({
      kind: "create",
      previousJobId: "cancelled-job",
      idempotencyKey: "korea-kvac:rebook:application-1:cancelled-job",
    });
  });

  it("reuses the same new task on repeated clicks", () => {
    expect(planKoreaRebooking("application-1", {
      id: "new-job",
      status: "not_started",
      user_preferences_json: { rebookingAfterCancellation: true },
    }, null)).toEqual({ kind: "reuse", jobId: "new-job" });
  });

  it("rejects a new task while an active appointment exists", () => {
    expect(planKoreaRebooking("application-1", {
      id: "booked-job",
      status: "appointment_booked",
      user_preferences_json: null,
    }, "confirmation-1")).toEqual({ kind: "reject", reason: "active_appointment" });
  });

  it("rejects when the previous task was not cancelled", () => {
    expect(planKoreaRebooking("application-1", {
      id: "pending-job",
      status: "not_started",
      user_preferences_json: null,
    }, null)).toEqual({ kind: "reject", reason: "appointment_not_cancelled" });
  });

  it("rejects a cancelled task when its confirmation pointer is still considered active", () => {
    expect(planKoreaRebooking("application-1", cancelledJob, "active-confirmation")).toEqual({
      kind: "reject",
      reason: "active_appointment",
    });
  });
});
