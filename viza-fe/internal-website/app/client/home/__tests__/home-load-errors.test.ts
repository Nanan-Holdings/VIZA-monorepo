import { describe, expect, it } from "vitest";

import { isIgnorableDashboardLoadError } from "../home-load-errors";

describe("isIgnorableDashboardLoadError", () => {
  it("ignores browser abort errors raised while refreshing dashboard requests", () => {
    expect(isIgnorableDashboardLoadError(new DOMException("The operation was aborted.", "AbortError"))).toBe(true);
  });

  it("ignores undici abort errors raised without a DOMException name", () => {
    expect(isIgnorableDashboardLoadError(new Error("signal is aborted without reason"))).toBe(true);
  });

  it("does not ignore real load failures", () => {
    expect(isIgnorableDashboardLoadError(new Error("permission denied for table applications"))).toBe(false);
  });
});
