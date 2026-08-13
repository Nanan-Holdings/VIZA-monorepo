import { describe, expect, test } from "vitest";

import {
  auditPhEtravelLaunchScenarios,
  getPhEtravelLaunchGapCount,
  getPhEtravelLaunchReadiness,
  PH_ETRAVEL_LAUNCH_SCENARIOS,
} from "../launch-readiness";

describe("Philippines eTravel E18 launch readiness scenarios", () => {
  test("covers S0 through S8 and each of the 36 remaining gaps exactly once", () => {
    expect(PH_ETRAVEL_LAUNCH_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "S0",
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
    ]);
    expect(getPhEtravelLaunchGapCount()).toBe(36);
    expect(auditPhEtravelLaunchScenarios()).toEqual([]);
  });

  test("keeps all current scenarios in safe review and diverts unsupported identities", () => {
    for (const scenario of PH_ETRAVEL_LAUNCH_SCENARIOS) {
      const readiness = getPhEtravelLaunchReadiness({
        scenarioId: scenario.id,
      });
      expect(readiness.state).toBe("review");
      expect(readiness.authorization).toBe("stop_before_submit");
      expect(readiness.noResubmit).toBe(true);
    }
    expect(
      getPhEtravelLaunchReadiness({
        scenarioId: "S4",
        isUnsupportedIdentity: true,
      }).state
    ).toBe("diverted");
  });

  test("keeps P0 blockers and result recovery outside user inputs and success", () => {
    const p0 = PH_ETRAVEL_LAUNCH_SCENARIOS.filter(
      (scenario) => scenario.priority === "P0"
    );
    const result = getPhEtravelLaunchReadiness({ scenarioId: "S8" });

    expect(p0.map((scenario) => scenario.id)).toEqual([
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S8",
    ]);
    expect(result.canonicalKeys).toEqual([
      "result.official_reference",
      "result.reference_qr_render",
    ]);
    expect(result.userCopy.en).not.toMatch(
      /selector|reference_number|retry|submit/i
    );
    expect(result.userCopy.zh).not.toMatch(/提交|重试|参考号/u);
  });

  test("detects duplicate gaps, unsafe authorization, and non-review scenario keys", () => {
    const s1 = PH_ETRAVEL_LAUNCH_SCENARIOS.find(
      (scenario) => scenario.id === "S1"
    );
    const s2 = PH_ETRAVEL_LAUNCH_SCENARIOS.find(
      (scenario) => scenario.id === "S2"
    );
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();

    expect(
      auditPhEtravelLaunchScenarios([
        ...PH_ETRAVEL_LAUNCH_SCENARIOS,
        {
          ...s1!,
          canonicalKeys: [...s1!.canonicalKeys, "registration.flight_type"],
        },
        { ...s2!, noResubmit: false },
      ])
    ).toEqual(
      expect.arrayContaining([
        "duplicate_scenario",
        "duplicate_gap_assignment",
        "scenario_key_not_needs_review",
        "unsafe_authorization",
      ])
    );
  });
});
