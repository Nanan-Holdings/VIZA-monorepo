import assert from "node:assert/strict";
import test from "node:test";
import { hasOfficialArrivalCardSuccess } from "../arrival-card-success-guard";

test("does not treat a completed dry run as an official arrival-card submission", () => {
  assert.equal(hasOfficialArrivalCardSuccess({
    applicationResult: null,
    completedQueues: [{
      mode: "dry_run",
      official_status: null,
      live_submitted_at: null,
    }],
  }), false);
});

test("accepts a live queue only when official submitted evidence was persisted", () => {
  assert.equal(hasOfficialArrivalCardSuccess({
    applicationResult: null,
    completedQueues: [{
      mode: "live_assisted",
      official_status: "submitted",
      live_submitted_at: "2026-07-20T09:00:00.000Z",
    }],
  }), true);
});

test("accepts an application result explicitly marked submitted", () => {
  assert.equal(hasOfficialArrivalCardSuccess({
    applicationResult: { submitted: true },
    completedQueues: [],
  }), true);
});
