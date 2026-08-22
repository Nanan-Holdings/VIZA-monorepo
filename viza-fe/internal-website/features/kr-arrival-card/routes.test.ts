import { describe, expect, it } from "vitest";
import {
  buildKoreaArrivalCardFormHref,
  buildKoreaArrivalCardGateHref,
  buildKoreaArrivalCardIntegratedFormHref,
} from "./routes";

describe("Korea e-Arrival Card routes", () => {
  it("sends a repeat submission through the eligibility gate with its new application", () => {
    expect(buildKoreaArrivalCardGateHref("new application/id")).toBe(
      "/client/arrival-cards/south-korea?applicationId=new%20application%2Fid",
    );
  });

  it("preserves the application id after a completed preflight", () => {
    const href = buildKoreaArrivalCardFormHref({
      adultRepresentative: true,
      applicationId: "new-application-id",
    });
    expect(href).toContain("applicationId=new-application-id");
    expect(href).not.toContain("preflight=");
    expect(href).not.toContain("adultRepresentative=");
  });

  it("opens the integrated form route without trusting URL preflight flags", () => {
    expect(buildKoreaArrivalCardIntegratedFormHref()).toBe(
      "/client/application/long-form?country=south_korea&visaType=KR_E_ARRIVAL_CARD&skipFormCheck=true",
    );
  });
});
