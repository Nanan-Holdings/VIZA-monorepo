import { describe, expect, test } from "vitest";
import {
  evaluateSgacSubmissionWindow,
  validateSgacTravelDates,
} from "../date-window";

const NOW = new Date("2026-06-22T10:00:00+08:00");

describe("SGAC submission date window", () => {
  test("opens from two days before arrival through arrival day", () => {
    expect(evaluateSgacSubmissionWindow("2026-06-22", NOW)).toMatchObject({
      status: "open",
      earliestSubmissionDate: "2026-06-20",
    });
    expect(evaluateSgacSubmissionWindow("2026-06-24", NOW)).toMatchObject({
      status: "open",
      earliestSubmissionDate: "2026-06-22",
    });
  });

  test("schedules applications that are more than three SGAC days away", () => {
    expect(evaluateSgacSubmissionWindow("2026-06-25", NOW)).toMatchObject({
      status: "scheduled",
      earliestSubmissionDate: "2026-06-23",
      daysUntilOpen: 1,
    });
    expect(evaluateSgacSubmissionWindow("2026-07-02", NOW)).toMatchObject({
      status: "scheduled",
      earliestSubmissionDate: "2026-06-30",
      daysUntilOpen: 8,
    });
  });

  test("rejects past or invalid arrival dates", () => {
    expect(evaluateSgacSubmissionWindow("2026-06-21", NOW)).toMatchObject({
      status: "past",
    });
    expect(evaluateSgacSubmissionWindow("not-a-date", NOW)).toMatchObject({
      status: "invalid",
    });
  });

  test("allows same-day departure and rejects only dates before arrival", () => {
    expect(validateSgacTravelDates("2026-06-22", "2026-06-23")).toMatchObject({
      ok: true,
    });
    expect(validateSgacTravelDates("2026-06-22", "2026-06-22")).toMatchObject({
      ok: true,
    });
    expect(validateSgacTravelDates("2026-06-22", "2026-06-21")).toMatchObject({
      ok: false,
      code: "departure_before_arrival",
    });
  });
});
