import { describe, expect, it } from "vitest";

import { resolveKvacCenter } from "../kvac-routing";

describe("resolveKvacCenter", () => {
  it("uses current residence proof before hukou province", () => {
    const result = resolveKvacCenter({
      currentResidenceProvince: "上海市",
      hasResidenceProof: true,
      hukouProvince: "湖北省",
    });

    expect(result.recommended.code).toBe("shanghai");
    expect(result.basis).toBe("current_residence");
    expect(result.alternatives.map((center) => center.code)).toContain("wuhan");
  });

  it("falls back to hukou province when residence proof is unavailable", () => {
    const result = resolveKvacCenter({
      currentResidenceProvince: "上海市",
      hasResidenceProof: false,
      hukouProvince: "湖北省",
    });

    expect(result.recommended.code).toBe("wuhan");
    expect(result.basis).toBe("hukou");
  });

  it("returns an ambiguous result with alternatives when no province is usable", () => {
    const result = resolveKvacCenter({});

    expect(result.basis).toBe("ambiguous");
    expect(result.recommended.code).toBe("beijing");
    expect(result.alternatives.length).toBeGreaterThan(1);
  });
});
