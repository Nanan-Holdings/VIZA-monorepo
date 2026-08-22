import { describe, expect, it } from "vitest";
import { WORK_ITEM_SOPS, getWorkItemSop } from "../work-item-sops";

describe("admin work-item SOP registry", () => {
  it("has unique kinds with complete operational policy", () => {
    const kinds = WORK_ITEM_SOPS.map((sop) => sop.kind);
    expect(new Set(kinds).size).toBe(kinds.length);

    for (const sop of WORK_ITEM_SOPS) {
      expect(sop.owningTeam.length).toBeGreaterThan(0);
      expect(["p0", "p1", "p2", "p3"]).toContain(sop.defaultPriority);
      expect(sop.targetMinutes).toBeGreaterThan(0);
      expect(sop.checklist.length).toBeGreaterThanOrEqual(3);
      expect(sop.resolutionCodes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("resolves known kinds and returns undefined for unknown work", () => {
    expect(getWorkItemSop("payment_provisioning_failed")?.owningTeam).toBe("commerce_ops");
    expect(getWorkItemSop("not_registered")).toBeUndefined();
  });
});
