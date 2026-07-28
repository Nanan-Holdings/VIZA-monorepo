import { describe, it, expect } from "vitest";
import { mapRunnerJobStatus } from "./runner-lifecycle";

/** POR-011: runner_job lifecycle mapping for the status hub. */
describe("mapRunnerJobStatus", () => {
  it("halt-before-gov-pay → actionable 'pay government fee' step", () => {
    const lc = mapRunnerJobStatus("succeeded", { outcome: "halted_before_pay" });
    expect(lc.phase).toBe("action_required");
    expect(lc.actionable).toBe(true);
    expect(lc.label).toMatch(/government fee/i);
  });

  it("dead_letter → support-contact state", () => {
    const lc = mapRunnerJobStatus("dead_letter");
    expect(lc.phase).toBe("support");
    expect(lc.supportNeeded).toBe(true);
  });

  it("failed → support state", () => {
    expect(mapRunnerJobStatus("failed").supportNeeded).toBe(true);
  });

  it("queued/running/succeeded(no halt) map to pending/in_progress/done", () => {
    expect(mapRunnerJobStatus("queued").phase).toBe("pending");
    expect(mapRunnerJobStatus("running").phase).toBe("in_progress");
    expect(mapRunnerJobStatus("succeeded").phase).toBe("done");
  });
});
