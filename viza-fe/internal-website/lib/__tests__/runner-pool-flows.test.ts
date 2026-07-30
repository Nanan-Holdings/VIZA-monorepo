import { describe, expect, it } from "vitest";
import { resolveRunnerPoolFlow } from "@/lib/queue/flows";

describe("resolveRunnerPoolFlow", () => {
  it.each([
    ["singapore", "SG_ARRIVAL_CARD", "sgac"],
    ["malaysia", "MY_MDAC_ARRIVAL_CARD", "mdac"],
    ["thailand", "TH_TDAC_ARRIVAL_CARD", "tdac"],
    ["vietnam", "VN_PREARRIVAL_DECLARATION", "vn_prearrival"],
    ["vietnam", "VN_E_VISA", "vn_evisa"],
    ["indonesia", "ID_C1_TOURIST", "id_c1"],
    ["indonesia", "ID_B1_EVOA", "id_b1_evoa"],
    ["south_korea", "KR_C39_SHORT_TERM_VISIT", "kr_eform"],
  ])("maps %s/%s to %s", (country, visaType, expected) => {
    expect(resolveRunnerPoolFlow(country, visaType)).toBe(expected);
  });

  it("does not route unsupported country/visa combinations", () => {
    expect(resolveRunnerPoolFlow("malaysia", "VN_E_VISA")).toBeNull();
    expect(resolveRunnerPoolFlow("france", "FR_SHORT_STAY")).toBeNull();
  });
});
