import { describe, expect, it } from "vitest";

import { runtimeAbortErrorScript } from "../runtime-abort-error-script";

describe("runtimeAbortErrorScript", () => {
  it("installs early listeners for runtime abort errors", () => {
    expect(runtimeAbortErrorScript).toContain("unhandledrejection");
    expect(runtimeAbortErrorScript).toContain("error");
    expect(runtimeAbortErrorScript).toContain("signal is aborted");
    expect(runtimeAbortErrorScript).toContain("preventDefault");
  });
});
