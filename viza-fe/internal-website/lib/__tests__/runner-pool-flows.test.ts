import { describe, expect, it } from "vitest";
import {
  resolveRunnerPoolFlow,
  shouldUseSharedRunnerPool,
} from "@/lib/queue/flows";

describe("resolveRunnerPoolFlow", () => {
  it.each([
    ["singapore", "SG_ARRIVAL_CARD", "sgac"],
    ["malaysia", "MY_MDAC_ARRIVAL_CARD", "mdac"],
    ["thailand", "TH_TDAC_ARRIVAL_CARD", "tdac"],
    ["vietnam", "VN_PREARRIVAL_DECLARATION", "vn_prearrival"],
    ["vietnam", "VN_E_VISA", "vn_evisa"],
    ["south_korea", "KR_C39_SHORT_TERM_VISIT", "kr_eform"],
  ])("maps %s/%s to %s", (country, visaType, expected) => {
    expect(resolveRunnerPoolFlow(country, visaType)).toBe(expected);
  });

  it("does not route unsupported country/visa combinations", () => {
    expect(resolveRunnerPoolFlow("malaysia", "VN_E_VISA")).toBeNull();
    expect(resolveRunnerPoolFlow("france", "FR_SHORT_STAY")).toBeNull();
    expect(resolveRunnerPoolFlow("indonesia", "ID_C1_TOURIST")).toBeNull();
    expect(resolveRunnerPoolFlow("indonesia", "ID_B1_EVOA")).toBeNull();
  });
});

describe("shouldUseSharedRunnerPool", () => {
  it("keeps Vietnam e-Visa on legacy even when the pool migration gate is open", () => {
    expect(shouldUseSharedRunnerPool("vn_evisa", true)).toBe(false);
  });

  it("keeps Vietnam pre-arrival pool-only while the global migration gate is closed", () => {
    expect(shouldUseSharedRunnerPool("vn_prearrival", false)).toBe(true);
  });

  it.each(["sgac", "mdac", "tdac", "kr_eform"] as const)(
    "uses the migration gate for %s",
    (flowKey) => {
      expect(shouldUseSharedRunnerPool(flowKey, false)).toBe(false);
      expect(shouldUseSharedRunnerPool(flowKey, true)).toBe(true);
    },
  );
});
