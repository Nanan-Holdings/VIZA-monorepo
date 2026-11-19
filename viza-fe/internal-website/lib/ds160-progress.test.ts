import { describe, expect, it } from "vitest";
import { DS160_CHECKPOINTS, ds160ProgressForStage } from "./ds160-progress";

describe("ds160ProgressForStage", () => {
  it("maps a CEAC page to its checkpoint and caps creep below the next one", () => {
    expect(ds160ProgressForStage("ceac_page:passport")).toMatchObject({
      progress: 42,
      ceiling: 46,
      phase: "filling",
      labelZh: "护照信息",
    });
  });

  it("counts the pre-form CEAC pages as the site-opened checkpoint", () => {
    expect(ds160ProgressForStage("ceac_page:security_notice")?.key).toBe("ceac_session_ready");
  });

  it("returns null for unknown or missing stages", () => {
    expect(ds160ProgressForStage("ceac_page:unknown_page")).toBeNull();
    expect(ds160ProgressForStage(null)).toBeNull();
  });

  it("keeps checkpoints strictly increasing and below 100", () => {
    for (let i = 1; i < DS160_CHECKPOINTS.length; i += 1) {
      expect(DS160_CHECKPOINTS[i].progress).toBeGreaterThan(DS160_CHECKPOINTS[i - 1].progress);
    }
    expect(DS160_CHECKPOINTS.at(-1)?.progress).toBeLessThan(100);
    expect(ds160ProgressForStage("ceac_page:confirmation")?.ceiling).toBe(99);
  });

  it("estimates fewer minutes left later in the run", () => {
    const early = ds160ProgressForStage("ceac_starting")?.minutesLeft ?? 0;
    const late = ds160ProgressForStage("ceac_page:review")?.minutesLeft ?? 0;
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThanOrEqual(1);
  });
});
