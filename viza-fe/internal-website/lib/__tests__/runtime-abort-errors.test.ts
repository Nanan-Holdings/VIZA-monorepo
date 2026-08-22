import { describe, expect, it } from "vitest";

import { isIgnorableRuntimeAbortError } from "../runtime-abort-errors";

describe("isIgnorableRuntimeAbortError", () => {
  it("matches DOM abort exceptions from cancelled browser requests", () => {
    expect(isIgnorableRuntimeAbortError(new DOMException("The operation was aborted.", "AbortError"))).toBe(true);
  });

  it("matches Next runtime abort errors without a DOMException name", () => {
    expect(isIgnorableRuntimeAbortError(new Error("signal is aborted without reason"))).toBe(true);
  });

  it("matches the plain abort error emitted by the Next server runtime", () => {
    expect(isIgnorableRuntimeAbortError(new Error("aborted"))).toBe(true);
  });

  it("does not match real runtime failures", () => {
    expect(isIgnorableRuntimeAbortError(new Error("permission denied for table applications"))).toBe(false);
    expect(isIgnorableRuntimeAbortError(new Error("application load aborted after database failure"))).toBe(false);
  });
});
