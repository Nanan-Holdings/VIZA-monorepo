import { describe, expect, it } from "vitest";

import {
  RunnerCutoverPausedError,
  assertRunnerCutoverActive,
  isRunnerCutoverPaused,
} from "../runner-cutover-pause.server";

describe("runner controlled-cutover pause guard", () => {
  it.each([undefined, "", "false", "TRUE", "1", "on"])(
    "keeps runners active unless the server flag is exactly true (%s)",
    (value) => {
      const env = value === undefined ? {} : { RUNNER_CUTOVER_PAUSED: value };
      expect(isRunnerCutoverPaused(env)).toBe(false);
      expect(() => assertRunnerCutoverActive(env)).not.toThrow();
    },
  );

  it("fails closed with a typed error for the explicit pause value", () => {
    const env = { RUNNER_CUTOVER_PAUSED: "true" };

    expect(isRunnerCutoverPaused(env)).toBe(true);
    expect(() => assertRunnerCutoverActive(env)).toThrowError(RunnerCutoverPausedError);
    try {
      assertRunnerCutoverActive(env);
    } catch (error) {
      expect(error).toMatchObject({
        name: "RunnerCutoverPausedError",
        code: "runner_cutover_paused",
      });
    }
  });
});
