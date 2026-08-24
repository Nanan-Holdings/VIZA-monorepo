import { describe, expect, it } from "vitest";
import { normalizeKoreaIssueNumber } from "./official-reference";

describe("Korea e-Arrival Card issue-number guard", () => {
  it("keeps a portal-issued identifier", () => {
    expect(normalizeKoreaIssueNumber("KR-12345")).toBe("KR-12345");
    expect(normalizeKoreaIssueNumber("KR1234")).toBe("KR1234");
  });

  it("rejects a copied result-table label", () => {
    expect(normalizeKoreaIssueNumber("country")).toBeNull();
    expect(normalizeKoreaIssueNumber("country/region")).toBeNull();
  });

  it("rejects empty, prose, and non-identifier values", () => {
    expect(normalizeKoreaIssueNumber(null)).toBeNull();
    expect(normalizeKoreaIssueNumber("The declaration was submitted")).toBeNull();
    expect(normalizeKoreaIssueNumber("ABCDEF")).toBeNull();
  });
});
