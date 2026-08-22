import { describe, expect, it } from "vitest";
import {
  buildJapanApplicationFormHref,
  getJapanVfsChecklist,
  getJapanVfsEligibility,
} from "../japan-vfs-sg";

describe("Japan VFS Singapore eligibility", () => {
  it("routes appointment review edits back to the exact Japan tourist application", () => {
    expect(buildJapanApplicationFormHref("application/id with spaces")).toBe(
      "/client/application/long-form?country=japan&visaType=JP_TOURIST&applicationId=application%2Fid+with+spaces",
    );
  });

  it("accepts a PRC ordinary-passport holder whose pass covers the return date", () => {
    expect(getJapanVfsEligibility({ nationality: "China", passportType: "ordinary", singaporePassType: "employment_pass", singaporePassExpiryDate: "2027-01-01", intendedReturnDate: "2026-12-01" }).eligible).toBe(true);
  });
  it("rejects Singapore short-term visitors and expiring passes", () => {
    expect(getJapanVfsEligibility({ nationality: "China", passportType: "ordinary", singaporePassType: "visitor", singaporePassExpiryDate: "2027-01-01", intendedReturnDate: "2026-12-01" }).eligible).toBe(false);
    expect(getJapanVfsEligibility({ nationality: "China", passportType: "ordinary", singaporePassType: "pr", singaporePassExpiryDate: "2026-10-01", intendedReturnDate: "2026-12-01" }).eligible).toBe(false);
  });
  it("adds multiple-entry and sponsored-applicant evidence", () => {
    const ids = getJapanVfsChecklist("multiple_entry", "student").map((item) => item.id);
    expect(ids).toContain("multiple_reason");
    expect(ids).toContain("sponsor_letter");
  });
});
