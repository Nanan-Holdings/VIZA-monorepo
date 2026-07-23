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

test("stale timeout scanning uses heartbeats and cannot overwrite a queue that advanced during the scan", () => {
  const source = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");
  const staleStart = source.indexOf("async function markStaleQueueItemsTimedOut");
  const staleEnd = source.indexOf("async function loadDs160Answers", staleStart);
  assert.notEqual(staleStart, -1);
  assert.notEqual(staleEnd, -1);

  const staleBody = source.slice(staleStart, staleEnd);
  assert.match(staleBody, /item\.heartbeat_at \|\| item\.updated_at \|\| item\.created_at/);
  assert.match(staleBody, /\.eq\("status", item\.status\)/);
  assert.match(staleBody, /\.eq\("updated_at", item\.updated_at\)/);
  assert.match(staleBody, /updatedRows\.length === 0/);
});

test("Vietnam live processing has a longer outage grace period than the generic stale timeout", () => {
  const source = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");
  assert.match(source, /VN_LIVE_PROCESSING_TIMEOUT_MS/);
  assert.match(
    source,
    /status === "vn_live_assisted_processing" \|\| status === "vn_payment_processing"/,
  );
});

test("stale timeout scanning covers interrupted Indonesia payment workers", () => {
  const source = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");
  const statusesStart = source.indexOf("const STALE_QUEUE_STATUSES");
  const statusesEnd = source.indexOf("function parseProviderAllowlist", statusesStart);
  assert.notEqual(statusesStart, -1);
  assert.notEqual(statusesEnd, -1);

  const statuses = source.slice(statusesStart, statusesEnd);
  assert.match(statuses, /"id_c1_payment_processing"/);
  assert.match(statuses, /"id_b1_evoa_payment_processing"/);
});

test("Indonesia cloud processing refreshes its queue heartbeat until the run ends", () => {
  const source = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");
  const indonesiaStart = source.indexOf("async function processIndonesiaItem");
  const indonesiaEnd = source.indexOf("async function markIndonesiaQueueStage", indonesiaStart);
  assert.notEqual(indonesiaStart, -1);
  assert.notEqual(indonesiaEnd, -1);

  const indonesiaBody = source.slice(indonesiaStart, indonesiaEnd);
  assert.match(indonesiaBody, /const heartbeatTimer = setInterval/);
  assert.match(indonesiaBody, /heartbeat_at: heartbeatAt/);
  assert.match(indonesiaBody, /\.in\("status", \[processingStatus, paymentProcessingStatus\]\)/);
  assert.match(indonesiaBody, /clearInterval\(heartbeatTimer\)/);
});
