import { describe, expect, it } from "vitest";
import {
  getUsContactRelationshipIssue,
  getUsContactRelationshipIssueMessage,
} from "@/lib/us-contact-validation";

const organizationOnly = (relationship: string) => ({
  us_contact_surname: "DO_NOT_KNOW",
  us_contact_given_names: "DO_NOT_KNOW",
  us_contact_organization: "HOTEL",
  us_contact_relationship: relationship,
});

const personOnly = (relationship: string, maritalStatus: string) => ({
  us_contact_surname: "SMITH",
  us_contact_given_names: "JANE",
  us_contact_organization: "DO_NOT_KNOW",
  us_contact_relationship: relationship,
  marital_status: maritalStatus,
});

describe("DS-160 U.S. contact relationship constraints", () => {
  it("rejects relative, spouse, and friend when only an organization is known", () => {
    for (const relationship of ["R", "S", "C", "RELATIVE", "SPOUSE", "FRIEND"]) {
      expect(getUsContactRelationshipIssue(organizationOnly(relationship))).toEqual({
        kind: "organization_only_relationship",
      });
    }
    for (const relationship of ["B", "P", "H", "O", "BUSINESS ASSOCIATE", "EMPLOYER", "SCHOOL OFFICIAL", "OTHER"]) {
      expect(getUsContactRelationshipIssue(organizationOnly(relationship))).toBeNull();
    }
  });

  it("allows spouse only for married, common-law, or legally-separated applicants", () => {
    for (const maritalStatus of ["M", "C", "L", "married", "common_law", "legally_separated"]) {
      expect(getUsContactRelationshipIssue(personOnly("S", maritalStatus))).toBeNull();
    }
    for (const maritalStatus of ["P", "W", "D", "S", "O", "single", "civil_union"]) {
      expect(getUsContactRelationshipIssue(personOnly("S", maritalStatus))).toEqual({
        kind: "spouse_marital_status",
      });
    }
    for (const relationship of ["R", "C", "B", "P", "H", "O"]) {
      expect(getUsContactRelationshipIssue(personOnly(relationship, "single"))).toBeNull();
    }
  });

  it("keeps the two-unknown branch fail-closed and localized", () => {
    const issue = getUsContactRelationshipIssue({
      us_contact_surname: "DO_NOT_KNOW",
      us_contact_given_names: "DO_NOT_KNOW",
      us_contact_organization: "DO_NOT_KNOW",
      us_contact_relationship: "O",
    });
    expect(issue).toEqual({ kind: "both_unknown" });
    expect(getUsContactRelationshipIssueMessage(issue!, true)).toContain("不能同时选择");
    expect(getUsContactRelationshipIssueMessage(issue!, false)).toContain("cannot both be unknown");
  });
});

