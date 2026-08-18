import { describe, expect, it } from "vitest";

import { findApplicationIdentityFields } from "./application-identity-guard";

describe("findApplicationIdentityFields", () => {
  it("rejects application ownership and country/product identity fields", () => {
    expect(
      findApplicationIdentityFields({
        country: "vietnam",
        visa_type: "PH_ETRAVEL_DEPARTURE_CARD",
        visa_package_id: "package-id",
        applicant_id: "applicant-id",
        id: "application-id",
      }),
    ).toEqual([
      "country",
      "visa_type",
      "visa_package_id",
      "applicant_id",
      "id",
    ]);
  });

  it("allows ordinary application detail fields", () => {
    expect(
      findApplicationIdentityFields({
        purpose: "tourism",
        arrival_date: "2026-08-20",
      }),
    ).toEqual([]);
  });
});
