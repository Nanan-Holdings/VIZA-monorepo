import { describe, expect, it } from "vitest";
import {
  ageAtSeoulDate,
  canContinueKoreaArrivalPreflight,
  requiresAdultRepresentative,
} from "./eligibility";

describe("Korea e-Arrival Card eligibility preflight", () => {
  const beforeBirthday = new Date("2026-08-17T00:00:00.000Z");
  const afterBirthday = new Date("2026-08-18T00:00:00.000Z");

  it("calculates age using the Korean calendar date", () => {
    expect(ageAtSeoulDate("2012-08-18", beforeBirthday)).toBe(13);
    expect(ageAtSeoulDate("2012-08-18", afterBirthday)).toBe(14);
    expect(requiresAdultRepresentative("2012-08-18", beforeBirthday)).toBe(true);
    expect(requiresAdultRepresentative("2012-08-18", afterBirthday)).toBe(false);
  });

  it("does not infer a minor or representative requirement from invalid input", () => {
    expect(ageAtSeoulDate("not-a-date", afterBirthday)).toBeNull();
    expect(requiresAdultRepresentative(null, afterBirthday)).toBe(false);
  });

  it("only permits a needs-declaration answer with a valid DOB", () => {
    expect(canContinueKoreaArrivalPreflight({
      eligibility: "exempt",
      dateOfBirth: "1990-01-01",
      adultRepresentativeConfirmed: false,
    })).toBe(false);
    expect(canContinueKoreaArrivalPreflight({
      eligibility: "uncertain",
      dateOfBirth: "1990-01-01",
      adultRepresentativeConfirmed: false,
    })).toBe(false);
    expect(canContinueKoreaArrivalPreflight({
      eligibility: "needs_declaration",
      dateOfBirth: "",
      adultRepresentativeConfirmed: false,
    })).toBe(false);
    expect(canContinueKoreaArrivalPreflight({
      eligibility: "needs_declaration",
      dateOfBirth: "2012-08-18",
      adultRepresentativeConfirmed: false,
      now: beforeBirthday,
    })).toBe(false);
    expect(canContinueKoreaArrivalPreflight({
      eligibility: "needs_declaration",
      dateOfBirth: "2012-08-18",
      adultRepresentativeConfirmed: true,
      now: beforeBirthday,
    })).toBe(true);
    expect(canContinueKoreaArrivalPreflight({
      eligibility: "needs_declaration",
      dateOfBirth: "1990-01-01",
      adultRepresentativeConfirmed: false,
      now: afterBirthday,
    })).toBe(true);
  });
});
