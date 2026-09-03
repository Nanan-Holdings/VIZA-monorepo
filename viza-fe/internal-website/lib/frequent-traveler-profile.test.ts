import { describe, expect, it } from "vitest";
import { normalizeFrequentTravelerInput } from "./frequent-traveler-profile";

describe("normalizeFrequentTravelerInput", () => {
  it("rejects malformed calendar dates", () => {
    expect(
      normalizeFrequentTravelerInput({ fullName: "Test Traveler", dateOfBirth: "2024-02-31" }),
    ).toEqual({ error: "Enter a valid date of birth." });
  });

  it("rejects a passport expiry before its issue date", () => {
    expect(
      normalizeFrequentTravelerInput({
        fullName: "Test Traveler",
        passportIssueDate: "2025-01-02",
        passportExpiryDate: "2025-01-01",
      }),
    ).toEqual({ error: "Passport expiry date must be after the issue date." });
  });

  it("rejects invalid emails and unsupported gender values", () => {
    expect(
      normalizeFrequentTravelerInput({ fullName: "Test Traveler", email: "not-an-email" }),
    ).toEqual({ error: "Enter a valid traveler email address." });
    expect(
      normalizeFrequentTravelerInput({ fullName: "Test Traveler", gender: "unknown" }),
    ).toEqual({ error: "Select a valid traveler gender." });
  });

  it("normalizes valid passport and country fields", () => {
    const result = normalizeFrequentTravelerInput({
      fullName: "LI XIAOMING",
      nationality: "CN",
      dateOfBirth: "1990-01-01",
      passportIssueDate: "2020-01-01",
      passportExpiryDate: "2030-01-01",
      email: "traveler@example.com",
    });

    expect(result).toHaveProperty("value");
    if ("value" in result) {
      expect(result.value.nationality).toBe("China");
      expect(result.value.email).toBe("traveler@example.com");
    }
  });
});
