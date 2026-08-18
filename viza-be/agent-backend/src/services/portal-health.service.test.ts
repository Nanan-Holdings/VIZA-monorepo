import { describe, expect, it } from "vitest";
import { classifyPortalProbe } from "./portal-health.service.js";

describe("classifyPortalProbe", () => {
  it("treats fast successful responses as operational", () => {
    expect(classifyPortalProbe(200, 120)).toBe("ok");
  });

  it("treats slow successes and access gates as degraded", () => {
    expect(classifyPortalProbe(200, 5_001)).toBe("degraded");
    expect(classifyPortalProbe(403, 120)).toBe("degraded");
  });

  it("treats upstream server failures as down", () => {
    expect(classifyPortalProbe(503, 120)).toBe("down");
  });
});
