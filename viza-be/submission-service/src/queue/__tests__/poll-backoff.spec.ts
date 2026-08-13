import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateQueueErrorBackoffMs,
  summarizeQueueError,
} from "../poll-backoff";

test("queue error backoff grows exponentially and caps at one minute", () => {
  assert.equal(calculateQueueErrorBackoffMs(5_000, 1, () => 0.5), 5_000);
  assert.equal(calculateQueueErrorBackoffMs(5_000, 2, () => 0.5), 10_000);
  assert.equal(calculateQueueErrorBackoffMs(5_000, 4, () => 0.5), 40_000);
  assert.equal(calculateQueueErrorBackoffMs(5_000, 20, () => 0.5), 60_000);
});

test("queue errors are single-line and bounded", () => {
  const summary = summarizeQueueError(new Error(`<html>${"unavailable ".repeat(100)}</html>`));

  assert.equal(summary.includes("\n"), false);
  assert.ok(summary.length <= 320);
  assert.match(summary, /Error/);
});
