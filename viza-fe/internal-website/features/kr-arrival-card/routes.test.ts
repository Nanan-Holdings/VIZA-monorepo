import { describe, expect, it } from "vitest";
import { buildKoreaArrivalCardFormHref, buildKoreaArrivalCardGateHref } from "./routes";

describe("Korea e-Arrival Card routes", () => {
  it("sends a repeat submission through the eligibility gate with its new application", () => {
    expect(buildKoreaArrivalCardGateHref("new application/id")).toBe(
      "/client/arrival-cards/south-korea?applicationId=new%20application%2Fid",
    );
  });

  it("preserves the application id after a completed preflight", () => {
    expect(buildKoreaArrivalCardFormHref({
      adultRepresentative: true,
      applicationId: "new-application-id",
    })).toContain("applicationId=new-application-id");
    expect(buildKoreaArrivalCardFormHref({
      adultRepresentative: true,
      applicationId: "new-application-id",
    })).toContain("preflight=needs_declaration");
  });
});
