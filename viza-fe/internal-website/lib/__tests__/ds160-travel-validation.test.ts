import { describe, expect, it } from "vitest";
import {
  getDs160TripPurposeDuplicateIssue,
  getDs160TripPurposeDuplicateMessage,
  normalizeDs160TripPurposeCategory,
} from "../ds160-travel-validation";

describe("DS-160 repeated travel-purpose validation", () => {
  it("compares primary categories while ignoring B subtypes", () => {
    expect(normalizeDs160TripPurposeCategory("B")).toBe("B");
    expect(normalizeDs160TripPurposeCategory("BUSINESS OR PLEASURE (B)")).toBe("B");
    expect(normalizeDs160TripPurposeCategory("B1/B2")).toBe("B");
    expect(normalizeDs160TripPurposeCategory("B2")).toBe("B");
  });

  it("flags only the later row when a category is repeated", () => {
    const answers = {
      purpose_of_trip: "B",
      purpose_of_trip_specify: "B1",
      purpose_of_trip__2: "B",
      purpose_of_trip_specify__2: "B2",
    };
    expect(getDs160TripPurposeDuplicateIssue(answers, "purpose_of_trip")).toBeNull();
    expect(getDs160TripPurposeDuplicateIssue(answers, "purpose_of_trip__2")).toMatchObject({
      kind: "duplicate_category",
      category: "B",
      firstRow: 1,
      duplicateRow: 2,
      fieldName: "purpose_of_trip__2",
    });
  });

  it("allows distinct categories and localizes the official-style error", () => {
    const answers = {
      purpose_of_trip: "B",
      purpose_of_trip__2: "C",
    };
    expect(getDs160TripPurposeDuplicateIssue(answers, "purpose_of_trip__2")).toBeNull();
    const issue = getDs160TripPurposeDuplicateIssue(
      { purpose_of_trip: "B", purpose_of_trip__2: "B" },
      "purpose_of_trip__2",
    );
    expect(issue).not.toBeNull();
    expect(getDs160TripPurposeDuplicateMessage(issue!, false))
      .toBe("Duplicated Purpose of Trip to the U.S. provided.");
    expect(getDs160TripPurposeDuplicateMessage(issue!, true))
      .toContain("赴美目的类别不能重复");
  });
});
