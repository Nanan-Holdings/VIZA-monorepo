const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

test("legacy submission_queue poll fetches pending work before stale timeout scanning", () => {
  const source = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");
  const pollStart = source.indexOf("async function pollOnce");
  const pollEnd = source.indexOf("let pollInFlight", pollStart);
  assert.notEqual(pollStart, -1);
  assert.notEqual(pollEnd, -1);

  const pollBody = source.slice(pollStart, pollEnd);
  const staleScanIndex = pollBody.indexOf("markStaleQueueItemsTimedOut");
  const fetchIndex = pollBody.indexOf("fetchPendingItems");

  assert.notEqual(staleScanIndex, -1);
  assert.notEqual(fetchIndex, -1);
  assert.ok(
    fetchIndex < staleScanIndex,
    "pending queue rows must be fetched before stale scanning so restart/backlog rows can still be picked up",
  );
});

test("stale timeout scanning never marks unclaimed pending rows as stalled", () => {
  const source = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");
  const staleStart = source.indexOf("async function markStaleQueueItemsTimedOut");
  const staleEnd = source.indexOf("async function loadDs160Answers", staleStart);
  assert.notEqual(staleStart, -1);
  assert.notEqual(staleEnd, -1);

  const staleBody = source.slice(staleStart, staleEnd);
  assert.match(staleBody, /if \(isPendingQueueStatus\(item\.status\)\) return false/);
  assert.doesNotMatch(staleBody, /queue_pickup_stalled/);
  assert.doesNotMatch(staleBody, /status:\s*"stalled"/);
});
