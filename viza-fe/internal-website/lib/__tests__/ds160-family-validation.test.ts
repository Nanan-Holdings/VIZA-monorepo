import { describe, expect, it } from "vitest";
import {
  getDs160ImmediateRelativeRelationshipIssue,
  getDs160ImmediateRelativeRelationshipIssueMessage,
} from "@/lib/ds160-family-validation";

describe("DS-160 immediate-relative relationship constraints", () => {
  it("allows spouse only for married and legally separated applicants", () => {
    for (const maritalStatus of ["M", "MARRIED", "L", "LEGALLY_SEPARATED"]) {
      expect(getDs160ImmediateRelativeRelationshipIssue({
        us_relative_relationship: "SPOUSE",
        marital_status: maritalStatus,
      })).toBeNull();
    }
  });

  it("rejects spouse for every other observed marital branch", () => {
    for (const maritalStatus of ["C", "COMMON_LAW", "P", "W", "D", "S", "O", "single", "civil_union"]) {
      expect(getDs160ImmediateRelativeRelationshipIssue({
        us_relative_relationship: "spouse",
        marital_status: maritalStatus,
      })).toEqual({ kind: "spouse_marital_status" });
    }
  });

  it("scopes repeated rows while keeping marital status global", () => {
    expect(getDs160ImmediateRelativeRelationshipIssue({
      us_relative_relationship: "FIANCE",
      us_relative_relationship__2: "SPOUSE",
      marital_status: "S",
    }, "us_relative_relationship__2")).toEqual({ kind: "spouse_marital_status" });
    expect(getDs160ImmediateRelativeRelationshipIssue({
      us_relative_relationship: "SPOUSE",
      us_relative_relationship__2: "FIANCE",
      marital_status: "M",
    }, "us_relative_relationship__2")).toBeNull();
  });

  it("does not apply the spouse rule to fiance or other relationships", () => {
    for (const relationship of ["FIANCE", "CHILD", "SIBLING", "O"]) {
      expect(getDs160ImmediateRelativeRelationshipIssue({
        us_relative_relationship: relationship,
        marital_status: "S",
      })).toBeNull();
    }
  });

  it("localizes the CEAC-compatible branch error", () => {
    const issue = { kind: "spouse_marital_status" as const };
    expect(getDs160ImmediateRelativeRelationshipIssueMessage(issue, true)).toContain("已婚或合法分居");
    expect(getDs160ImmediateRelativeRelationshipIssueMessage(issue, false)).toContain("Married or Legally Separated");
  });
});
