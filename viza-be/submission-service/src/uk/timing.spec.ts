import assert from "node:assert/strict";
import test from "node:test";
import {
  createUkTimingRecorder,
  type UkTimingSummary,
} from "./timing.js";

class FakeClock {
  private value = 100;

  public now(): number {
    return this.value;
  }

  public advance(ms: number): void {
    this.value += ms;
  }
}

test("UK timing records fixed fields and deterministic durations", () => {
  const clock = new FakeClock();
  const summaries: UkTimingSummary[] = [];
  const timing = createUkTimingRecorder({
    runId: "run-test",
    clock,
    sink: (summary) => summaries.push(summary),
  });

  const launch = timing.start("browser_launch", "resume");
  clock.advance(17);
  launch.end("success");

  const page = timing.start("page_goto", "standardApplicantsEmail");
  clock.advance(23);
  page.end("failed", 1, "radio_option_unmatched");

  clock.advance(5);
  const summary = timing.finish("failed");

  assert.equal(summary.runId, "run-test");
  assert.deepEqual(summary.records, [
    {
      runId: "run-test",
      stage: "browser_launch",
      slug: "resume",
      durationMs: 17,
      outcome: "success",
      count: 1,
    },
    {
      runId: "run-test",
      stage: "page_goto",
      slug: "standardApplicantsEmail",
      durationMs: 23,
      outcome: "failed",
      count: 1,
      diagnosticCode: "radio_option_unmatched",
    },
    {
      runId: "run-test",
      stage: "run",
      durationMs: 45,
      outcome: "failed",
      count: 1,
    },
  ]);
  assert.equal(summaries.length, 1);
  assert.equal(timing.finish("success"), summary);
});

test("timing sink failures do not escape finish", () => {
  const clock = new FakeClock();
  const timing = createUkTimingRecorder({
    clock,
    sink: () => {
      throw new Error("sink failure");
    },
  });

  assert.doesNotThrow(() => timing.finish("stopped"));
});
