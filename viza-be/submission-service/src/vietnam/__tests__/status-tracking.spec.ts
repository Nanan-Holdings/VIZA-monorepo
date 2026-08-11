import assert from "node:assert/strict";
import { test } from "node:test";
import { computeVietnamTrackingSlot } from "../status-tracking-schedule.js";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";

test("vn.status-tracking: assigns a deterministic 02:00-04:59 Vietnam slot", () => {
  const now = new Date("2026-07-18T00:00:00.000Z");
  const first = computeVietnamTrackingSlot(
    "11111111-1111-4111-8111-111111111111",
    now,
  );
  const second = computeVietnamTrackingSlot(
    "11111111-1111-4111-8111-111111111111",
    now,
  );
  assert.deepEqual(first, second);
  assert.ok(first.hour >= 2 && first.hour <= 4);
  assert.ok(first.minute >= 0 && first.minute <= 59);
  assert.ok(Date.parse(first.nextDailyCheckAt) > now.getTime());
});

test("vn.status-tracking: advances to the next Vietnam day after today's slot", () => {
  const applicationId = "22222222-2222-4222-8222-222222222222";
  const morning = computeVietnamTrackingSlot(
    applicationId,
    new Date("2026-07-17T17:05:00.000Z"),
  );
  const afterSlot = computeVietnamTrackingSlot(
    applicationId,
    new Date("2026-07-18T12:00:00.000Z"),
  );
  assert.equal(
    Date.parse(afterSlot.nextDailyCheckAt) -
      Date.parse(morning.nextDailyCheckAt),
    24 * 60 * 60 * 1_000,
  );
});

test("vn.status-tracking: treats a duplicate plain insert as an idempotent success", async () => {
  const { insertIgnoringDuplicate } = await import("../status-tracking.js");

  const inserted = await insertIgnoringDuplicate(
    Promise.resolve({ error: { code: "23505", message: "duplicate key" } }),
  );

  assert.equal(inserted, false);
});

test("vn.status-tracking: reports a newly inserted row", async () => {
  const { insertIgnoringDuplicate } = await import("../status-tracking.js");

  const inserted = await insertIgnoringDuplicate(
    Promise.resolve({ error: null }),
  );

  assert.equal(inserted, true);
});

test("vn.status-tracking: rethrows non-duplicate plain insert errors", async () => {
  const { insertIgnoringDuplicate } = await import("../status-tracking.js");
  const error = { code: "42P10", message: "conflict target is not usable" };

  await assert.rejects(
    insertIgnoringDuplicate(Promise.resolve({ error })),
    (caught: unknown) =>
      caught instanceof Error && caught.message === error.message,
  );
});
