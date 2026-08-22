import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractFranceTlsSlotsFromDom,
  type FranceTlsSlotDomRecord,
} from "../slot-observation";

const observedAt = new Date("2026-08-19T04:00:00.000Z");

describe("France TLS slot observation", () => {
  it("pairs date/time only within each provider slot container", () => {
    const records: FranceTlsSlotDomRecord[] = [
      { providerSlotId: "slot-a", text: "15/09/2026 09:30" },
      { providerSlotId: "slot-b", text: "16/09/2026 14:45" },
    ];
    const result = extractFranceTlsSlotsFromDom(records, "shanghai", { observedAt });

    assert.equal(result.status, "slots_observed");
    assert.deepEqual(result.slots.map((slot) => [slot.appointmentDate, slot.appointmentTime]), [
      ["2026-09-15", "09:30"],
      ["2026-09-16", "14:45"],
    ]);
    assert.equal(result.slots[0].metadataRedactedJson.providerSlotId, "slot-a");
    assert.equal(result.slots[0].metadataRedactedJson.expiresAt, "2026-08-19T04:10:00.000Z");
  });

  it("does not synthesize midnight or records without provider ids", () => {
    const result = extractFranceTlsSlotsFromDom([
      { text: "2026-09-15" },
      { providerSlotId: "slot-midnight", text: "2026-09-15 00:00" },
    ], "shanghai", { observedAt });

    assert.equal(result.status, "selector_drift");
    assert.deepEqual(result.slots, []);
    assert.equal(result.invalidRecordCount, 2);
  });

  it("returns an explicit no-slots result only for an official no-availability marker", () => {
    const result = extractFranceTlsSlotsFromDom([], "shanghai", {
      noSlotsText: "Aucun créneau disponible pour le moment.",
      observedAt,
    });
    assert.equal(result.status, "no_slots_available");
    assert.deepEqual(result.slots, []);
  });

  it("reports selector drift when the page has neither slots nor no-slots evidence", () => {
    const result = extractFranceTlsSlotsFromDom([], "shanghai", {
      noSlotsText: "Appointment calendar",
      observedAt,
    });
    assert.equal(result.status, "selector_drift");
  });
});
