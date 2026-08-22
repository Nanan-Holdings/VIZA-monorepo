import { describe, expect, it } from "vitest";
import { isKoreaEArrivalCardLiveEnabled } from "./config";

describe("Korea e-Arrival Card live rollout flag", () => {
  it("defaults to disabled unless both flags are explicitly true", () => {
    expect(isKoreaEArrivalCardLiveEnabled({})).toBe(false);
    expect(isKoreaEArrivalCardLiveEnabled({ serverFlag: "false", clientFlag: "true" })).toBe(false);
    expect(isKoreaEArrivalCardLiveEnabled({ serverFlag: "true", clientFlag: "false" })).toBe(false);
    expect(isKoreaEArrivalCardLiveEnabled({ serverFlag: "1", clientFlag: "1" })).toBe(false);
    expect(isKoreaEArrivalCardLiveEnabled({ serverFlag: "true", clientFlag: "true" })).toBe(true);
  });
});
