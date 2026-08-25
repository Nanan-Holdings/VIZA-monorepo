import { describe, expect, it } from "vitest";
import {
  isSgacApplicantType,
  isSgacResidentApplicantType,
  SGAC_APPLICANT_TYPES,
  sgacPortalUrlForApplicantType,
} from "../applicant-type";

describe("SGAC applicant type architecture", () => {
  it("keeps ICA's three residency routes inside one SGAC type contract", () => {
    expect(SGAC_APPLICANT_TYPES).toEqual([
      "singapore_citizen_or_permanent_resident",
      "long_term_pass_holder",
      "foreign_visitor",
    ]);
    expect(isSgacApplicantType("permanent_resident")).toBe(false);
  });

  it.each([
    ["singapore_citizen_or_permanent_resident", "scpr", true],
    ["long_term_pass_holder", "ltp", true],
    ["foreign_visitor", "fvipa", false],
  ] as const)("maps %s to ICA %s", (applicantType, route, resident) => {
    expect(sgacPortalUrlForApplicantType(applicantType)).toBe(
      `https://eservices.ica.gov.sg/sgarrivalcard/${route}`,
    );
    expect(isSgacResidentApplicantType(applicantType)).toBe(resident);
  });
});
