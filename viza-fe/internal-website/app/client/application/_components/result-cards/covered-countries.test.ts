import { describe, expect, it } from "vitest";
import {
  hasDeclaredResultPresentation,
  RESULT_PRESENTATION_REGISTRY,
} from "./covered-countries";

describe("result presentation registry", () => {
  it("declares every supported result product exactly once", () => {
    const pairs = RESULT_PRESENTATION_REGISTRY.map(({ country, visaType }) => `${country}:${visaType}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("requires every product to declare where a confirmed success is presented", () => {
    expect(RESULT_PRESENTATION_REGISTRY.every((entry) =>
      entry.successPresentation === "terminal-success-panel" ||
      entry.successPresentation === "review-associated-state",
    )).toBe(true);

    const terminalPairs = RESULT_PRESENTATION_REGISTRY
      .filter((entry) => entry.successPresentation === "terminal-success-panel")
      .map((entry) => `${entry.country}:${entry.visaType}`);
    expect(terminalPairs).toEqual(expect.arrayContaining([
      "SG:SG_ARRIVAL_CARD",
      "PH:PH_ETRAVEL_ARRIVAL_CARD",
      "PH:PH_ETRAVEL_DEPARTURE_CARD",
      "MY:MY_MDAC_ARRIVAL_CARD",
      "TH:TH_TDAC_ARRIVAL_CARD",
      "VN:VN_PREARRIVAL_DECLARATION",
      "KR:KR_E_ARRIVAL_CARD",
      "TW:TW_ENTRY_PERMIT",
      "US:US_DS160",
      "FR:EU_SCHENGEN_C_SHORT_STAY",
      "JP:JP_VISIT_JAPAN_WEB",
      "KE:KE_ETA",
    ]));
  });

  it.each([
    ["SG", "SG_ARRIVAL_CARD"],
    ["PH", "PH_ETRAVEL_ARRIVAL_CARD"],
    ["PH", "PH_ETRAVEL_DEPARTURE_CARD"],
    ["MY", "MY_MDAC_ARRIVAL_CARD"],
    ["TH", "TH_TDAC_ARRIVAL_CARD"],
    ["VN", "VN_PREARRIVAL_DECLARATION"],
    ["KR", "KR_E_ARRIVAL_CARD"],
    ["ID", "ID_B1_EVOA"],
  ])("declares %s / %s", (country, visaType) => {
    expect(hasDeclaredResultPresentation(country, visaType)).toBe(true);
  });

  it("does not allow a country-only declaration to pass", () => {
    expect(hasDeclaredResultPresentation("SG", "UNKNOWN_PRODUCT")).toBe(false);
  });
});
