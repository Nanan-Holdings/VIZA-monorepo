import assert from "node:assert/strict";
import test from "node:test";
import { extractShenyangVfsSlotsFromTexts } from "./slots.js";

test("extracts and deduplicates only date-and-time slot observations", () => {
  const slots = extractShenyangVfsSlotsFromTexts([
    "18/08/2026 09:30 Available",
    "18/08/2026 09:30 Available",
    "2026-08-19 14:00",
    "20 August 2026 10:15",
    "21/08/2026 11:00 Fully booked",
    "Continue",
  ], "2026-08-13T08:00:00.000Z");

  assert.deepEqual(slots.map((slot) => [slot.appointment_date, slot.appointment_time]), [
    ["2026-08-18", "09:30"],
    ["2026-08-19", "14:00"],
    ["2026-08-20", "10:15"],
  ]);
  assert.ok(slots.every((slot) => slot.source === "official_vfs_korea_shenyang"));
  assert.ok(slots.every((slot) => slot.status === "observed"));
});

test("does not invent a slot from a date-only calendar label", () => {
  assert.deepEqual(extractShenyangVfsSlotsFromTexts(["18 August 2026", "No appointments available"]), []);
});
