import { describe, expect, it } from "vitest";
import { shouldBootstrapFormAssistantDraft } from "./bootstrap";

describe("shouldBootstrapFormAssistantDraft", () => {
  it("creates an application-scoped draft for a first SGAC visit", () => {
    expect(shouldBootstrapFormAssistantDraft({
      applicationId: null,
      country: "singapore",
      visaType: "SG_ARRIVAL_CARD",
      hasFormSchema: true,
    })).toBe(true);
  });

  it("reuses an existing SGAC draft", () => {
    expect(shouldBootstrapFormAssistantDraft({
      applicationId: "application-id",
      country: "singapore",
      visaType: "SG_ARRIVAL_CARD",
      hasFormSchema: true,
    })).toBe(false);
  });

  it.each([
    ["germany", "schengen_c"],
    ["united_states", "DS160"],
    ["vietnam", "evisa_tourism"],
    ["malaysia", "MY_MDAC_ARRIVAL_CARD"],
  ])("creates an application-scoped draft for the %s %s form", (country, visaType) => {
    expect(shouldBootstrapFormAssistantDraft({
      applicationId: null,
      country,
      visaType,
      hasFormSchema: true,
    })).toBe(true);
  });

  it("does not create an assistant draft when the product has no DB form schema", () => {
    expect(shouldBootstrapFormAssistantDraft({
      applicationId: null,
      country: "legacy",
      visaType: "legacy_form",
      hasFormSchema: false,
    })).toBe(false);
  });
});
