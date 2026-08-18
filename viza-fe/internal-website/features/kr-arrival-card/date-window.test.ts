import { describe, expect, it } from "vitest";
import {
  evaluateKoreaEArrivalCardSubmissionWindow,
  koreaSeoulMidnightIso,
  seoulCalendarDate,
  validateKoreaEArrivalCardTravelDates,
} from "./date-window";

describe("Korea e-Arrival Card submission window", () => {
  it("uses the Korean calendar date at a UTC day boundary", () => {
    expect(seoulCalendarDate(new Date("2026-08-17T15:30:00.000Z"))).toBe("2026-08-18");
    expect(evaluateKoreaEArrivalCardSubmissionWindow("2026-08-20", new Date("2026-08-17T14:00:00.000Z"))).toMatchObject({
      status: "scheduled",
      earliestSubmissionDate: "2026-08-18",
      daysUntilOpen: 1,
    });
  });

  it("represents queue wake-up at midnight Korea time", () => {
    expect(koreaSeoulMidnightIso("2026-08-18")).toBe("2026-08-17T15:00:00.000Z");
    expect(koreaSeoulMidnightIso("2026-01-01")).toBe("2025-12-31T15:00:00.000Z");
    expect(koreaSeoulMidnightIso("2026-02-30")).toBeUndefined();
  });

  it("opens on the earliest day and stays open through arrival day", () => {
    expect(evaluateKoreaEArrivalCardSubmissionWindow("2026-08-20", new Date("2026-08-18T00:00:00.000Z")).status).toBe("open");
    expect(evaluateKoreaEArrivalCardSubmissionWindow("2026-08-20", new Date("2026-08-20T12:00:00.000Z")).status).toBe("open");
    expect(evaluateKoreaEArrivalCardSubmissionWindow("2026-08-20", new Date("2026-08-21T00:00:00.000Z")).status).toBe("past");
  });

  it("validates missing, malformed, and reversed travel dates", () => {
    const missingArrival = validateKoreaEArrivalCardTravelDates(null, "2026-08-20");
    expect(missingArrival).toMatchObject({ ok: false, code: "arrival_date_required" });
    const invalidDate = validateKoreaEArrivalCardTravelDates("2026-02-30", "2026-03-01");
    expect(invalidDate).toMatchObject({ ok: false, code: "invalid_date" });
    const reversed = validateKoreaEArrivalCardTravelDates("2026-08-20", "2026-08-19");
    expect(reversed).toMatchObject({ ok: false, code: "departure_before_arrival" });
    expect(validateKoreaEArrivalCardTravelDates("2026-08-20", "2026-08-21")).toEqual({
      ok: true,
      arrivalDate: "2026-08-20",
      departureDate: "2026-08-21",
    });
  });
});
