import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateKrEArrivalSubmissionWindow,
  krEArrivalEarliestSubmissionAt,
  validateKrEArrivalTravelDates,
} from "../date-window.js";

test("Korea e-Arrival window opens two Korea calendar days before arrival", () => {
  const now = new Date("2026-08-18T15:30:00.000Z"); // 2026-08-19 in Seoul
  const result = evaluateKrEArrivalSubmissionWindow("2026-08-21", now);
  assert.equal(result.status, "open");
  assert.equal(result.earliestSubmissionDate, "2026-08-19");
  assert.equal(result.earliestSubmissionAt, "2026-08-19T00:00:00+09:00");
});

test("Korea e-Arrival window uses Seoul date at UTC boundary", () => {
  const now = new Date("2026-08-18T14:59:59.000Z"); // 2026-08-18 23:59:59 KST
  const result = evaluateKrEArrivalSubmissionWindow("2026-08-21", now);
  assert.equal(result.status, "scheduled");
  assert.equal(result.daysUntilOpen, 1);
});

test("earliest timestamp is KST midnight", () => {
  assert.equal(
    krEArrivalEarliestSubmissionAt("2026-02-01"),
    "2026-01-30T00:00:00+09:00",
  );
});

test("travel dates allow same-day departure and reject an earlier departure", () => {
  assert.deepEqual(
    validateKrEArrivalTravelDates("2026-08-21", "2026-08-21"),
    { ok: true, arrivalDate: "2026-08-21", departureDate: "2026-08-21" },
  );
  const invalid = validateKrEArrivalTravelDates("2026-08-21", "2026-08-20");
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.code, "departure_before_arrival");
});

test("invalid date is fail-closed", () => {
  assert.equal(evaluateKrEArrivalSubmissionWindow("2026-02-30").status, "invalid");
  assert.equal(validateKrEArrivalTravelDates("2026-02-30", "2026-03-01").ok, false);
});
