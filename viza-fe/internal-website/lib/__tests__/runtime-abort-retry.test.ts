import { describe, expect, it, vi } from "vitest";

import { withRuntimeAbortRetry } from "../runtime-abort-retry";

describe("withRuntimeAbortRetry", () => {
  it("retries once when Supabase auth locks abort during page load", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("signal is aborted without reason"))
      .mockResolvedValueOnce("loaded");

    await expect(withRuntimeAbortRetry(operation)).resolves.toBe("loaded");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-abort failures", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("permission denied"));

    await expect(withRuntimeAbortRetry(operation)).rejects.toThrow("permission denied");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
