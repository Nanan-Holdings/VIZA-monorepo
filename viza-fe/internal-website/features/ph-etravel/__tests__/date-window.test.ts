import { describe, expect, test } from "vitest";

import {
  evaluatePhEtravelSubmissionWindow,
  validatePhEtravelFlightDates,
  validatePhEtravelTravelDates,
} from "../date-window";

describe("Philippines eTravel date window", () => {
  test("schedules official submission until the 72-hour window opens", () => {
    expect(evaluatePhEtravelSubmissionWindow("2026-07-05", new Date("2026-06-30T10:00:00+08:00"))).toMatchObject({
      status: "scheduled",
      earliestSubmissionDate: "2026-07-02",
      daysUntilOpen: 2,
    });
  });

  test("opens from three days before flight arrival through arrival day", () => {
    expect(evaluatePhEtravelSubmissionWindow("2026-07-05", new Date("2026-07-02T10:00:00+08:00"))).toMatchObject({
      status: "open",
      earliestSubmissionDate: "2026-07-02",
    });
    expect(evaluatePhEtravelSubmissionWindow("2026-07-05", new Date("2026-07-05T10:00:00+08:00"))).toMatchObject({
      status: "open",
    });
  });

  test("marks past arrival dates as past instead of queueable", () => {
    expect(evaluatePhEtravelSubmissionWindow("2026-07-05", new Date("2026-07-06T10:00:00+08:00"))).toMatchObject({
      status: "past",
      earliestSubmissionDate: "2026-07-02",
      daysUntilOpen: 0,
    });
  });

  test("validates flight departure and arrival dates instead of traveller stay dates", () => {
    expect(validatePhEtravelFlightDates("2026-07-04", "2026-07-05")).toMatchObject({
      ok: true,
      departureDate: "2026-07-04",
      arrivalDate: "2026-07-05",
    });
    expect(validatePhEtravelFlightDates("2026-07-06", "2026-07-05")).toMatchObject({
      ok: false,
      code: "departure_after_arrival",
    });
  });

  test("validates SEA voyage dates as the Philippines eTravel travel window source", () => {
    expect(validatePhEtravelTravelDates({
      transportType: "SEA",
      flightDepartureDate: "2026-08-01",
      flightArrivalDate: "2026-08-02",
      voyageDepartureDate: "2026-07-04",
      voyageArrivalDate: "2026-07-05",
    })).toMatchObject({
      ok: true,
      transportType: "SEA",
      dateSource: "voyage",
      departureDate: "2026-07-04",
      arrivalDate: "2026-07-05",
    });

    expect(validatePhEtravelTravelDates({
      transportType: "SEA",
      voyageDepartureDate: "2026-07-06",
      voyageArrivalDate: "2026-07-05",
    })).toMatchObject({
      ok: false,
      transportType: "SEA",
      dateSource: "voyage",
      code: "departure_after_arrival",
    });
  });
});
