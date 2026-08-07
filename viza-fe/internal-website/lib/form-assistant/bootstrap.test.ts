import { describe, expect, it } from "vitest";
import { shouldBootstrapFormAssistantDraft } from "./bootstrap";

describe("shouldBootstrapFormAssistantDraft", () => {
  it("creates an application-scoped draft for a first SGAC visit", () => {
    expect(shouldBootstrapFormAssistantDraft({
      applicationId: null,
      country: "singapore",
      visaType: "SG_ARRIVAL_CARD",
    })).toBe(true);
  });

  it("reuses an existing SGAC draft", () => {
    expect(shouldBootstrapFormAssistantDraft({
      applicationId: "application-id",
      country: "singapore",
      visaType: "SG_ARRIVAL_CARD",
    })).toBe(false);
  });

  it("does not create assistant drafts for other products", () => {
    expect(shouldBootstrapFormAssistantDraft({
      applicationId: null,
      country: "singapore",
      visaType: "SG_VISITOR_VISA",
    })).toBe(false);
  });
});
