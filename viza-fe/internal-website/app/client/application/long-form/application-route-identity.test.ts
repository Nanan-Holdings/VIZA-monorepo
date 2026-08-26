import { describe, expect, it } from "vitest";
import { resolveApplicationRouteProduct } from "./application-route-identity";

const usApplication = {
  id: "36cdba28-3bd0-45b8-a5d1-e7b8148980ef",
  country: "united_states",
  visa_type: "DS160",
};

describe("resolveApplicationRouteProduct", () => {
  it("uses the owned application identity for an ID-only US route", () => {
    expect(
      resolveApplicationRouteProduct({
        applicationId: usApplication.id,
        application: usApplication,
        explicitCountry: null,
        requestedVisaType: null,
        packageCountry: null,
        packageVisaType: null,
      }),
    ).toEqual({
      country: "united_states",
      visaType: "DS160",
      source: "application",
    });
  });

  it("does not let the current Philippines product override a US application", () => {
    expect(
      resolveApplicationRouteProduct({
        applicationId: usApplication.id,
        application: usApplication,
        explicitCountry: null,
        requestedVisaType: null,
        packageCountry: "philippines",
        packageVisaType: "PH_ETRAVEL_ARRIVAL_CARD",
      }),
    ).toMatchObject({ country: "united_states", visaType: "DS160" });
  });

  it("does not let spoofed Philippines query parameters override a US application", () => {
    expect(
      resolveApplicationRouteProduct({
        applicationId: usApplication.id,
        application: usApplication,
        explicitCountry: "philippines",
        requestedVisaType: "PH_ETRAVEL_ARRIVAL_CARD",
        packageCountry: "philippines",
        packageVisaType: "PH_ETRAVEL_ARRIVAL_CARD",
      }),
    ).toEqual({
      country: "united_states",
      visaType: "DS160",
      source: "application",
    });
  });

  it("allows explicit country and visa type only when no application ID exists", () => {
    expect(
      resolveApplicationRouteProduct({
        applicationId: null,
        application: null,
        explicitCountry: "philippines",
        requestedVisaType: "PH_ETRAVEL_ARRIVAL_CARD",
        packageCountry: "united_states",
        packageVisaType: "DS160",
      }),
    ).toEqual({
      country: "philippines",
      visaType: "PH_ETRAVEL_ARRIVAL_CARD",
      source: "explicit",
    });
  });
});
