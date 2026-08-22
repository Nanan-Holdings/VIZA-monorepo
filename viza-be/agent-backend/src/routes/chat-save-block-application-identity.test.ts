import { describe, expect, it } from "vitest";

import { findApplicationIdentityFields } from "./chat-save-block-application-identity.js";

describe("findApplicationIdentityFields", () => {
  it("rejects application ownership and country/product identity fields", () => {
    expect(
      findApplicationIdentityFields({
        country: "indonesia",
        visa_type: "VN_PREARRIVAL_DECLARATION",
        visa_package_id: "package-id",
        applicant_id: "applicant-id",
        group_id: "group-id",
      }),
    ).toEqual([
      "country",
      "visa_type",
      "visa_package_id",
      "applicant_id",
      "group_id",
    ]);
  });

  it("allows ordinary application detail fields", () => {
    expect(
      findApplicationIdentityFields({
        purpose: "tourism",
        departure_date: "2026-08-25",
      }),
    ).toEqual([]);
  });
});
