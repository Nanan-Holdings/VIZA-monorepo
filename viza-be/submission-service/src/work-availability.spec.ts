import assert from "node:assert/strict";
import test from "node:test";

import { isScheduledSubmissionDue } from "./scheduled-work.js";

test("scheduled arrival cards become due in their portal timezone", () => {
  const beforeSingaporeMidnight = new Date("2026-07-30T15:59:00.000Z");
  const afterSingaporeMidnight = new Date("2026-07-30T16:01:00.000Z");
  const row = {
    application_id: "application-1",
    status: "sgac_live_assisted_scheduled",
  };
  const result = { scheduledFor: "2026-07-31" };
  assert.equal(isScheduledSubmissionDue(row, result, beforeSingaporeMidnight), false);
  assert.equal(isScheduledSubmissionDue(row, result, afterSingaporeMidnight), true);
});

test("malformed scheduled metadata is treated as work", () => {
  assert.equal(
    isScheduledSubmissionDue(
      {
        application_id: "application-1",
        status: "tdac_live_assisted_scheduled",
      },
      {},
      new Date("2026-07-30T00:00:00.000Z"),
    ),
    true,
  );
});
