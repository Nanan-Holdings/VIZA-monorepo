import { describe, expect, it } from "vitest";
import { SEARCHABLE_VISA_DESTINATIONS } from "@/lib/visa-destinations";
import {
  canUseFormAssistant,
  getFormAssistantFallbackSources,
  isFormAssistantEnabled,
} from "./constants";

describe("form assistant product coverage", () => {
  it.each([
    "SG_ARRIVAL_CARD",
    "MY_MDAC_ARRIVAL_CARD",
    "TH_TDAC_ARRIVAL_CARD",
    "DS160",
    "schengen_c",
    "evisa_tourism",
  ])("accepts the current product identifier %s", (visaType) => {
    expect(isFormAssistantEnabled(visaType)).toBe(true);
  });

  it("accepts every currently selectable application product", () => {
    const visaTypes = [...new Set(SEARCHABLE_VISA_DESTINATIONS.map((destination) => destination.visaType))];
    expect(visaTypes.length).toBeGreaterThan(30);
    expect(visaTypes.filter((visaType) => !isFormAssistantEnabled(visaType))).toEqual([]);
  });

  it.each([null, undefined, "", "not a product", "../../secret"])(
    "rejects an invalid product identifier %s",
    (visaType) => {
      expect(isFormAssistantEnabled(visaType)).toBe(false);
    },
  );

  it("requires both an owned draft and a non-empty DB schema", () => {
    expect(canUseFormAssistant({
      applicationId: "application-id",
      visaType: "DS160",
      schemaFieldCount: 20,
    })).toBe(true);
    expect(canUseFormAssistant({
      applicationId: null,
      visaType: "DS160",
      schemaFieldCount: 20,
    })).toBe(false);
    expect(canUseFormAssistant({
      applicationId: "application-id",
      visaType: "DS160",
      schemaFieldCount: 0,
    })).toBe(false);
  });

  it("never leaks SGAC sources into another product", () => {
    expect(getFormAssistantFallbackSources("singapore", "SG_ARRIVAL_CARD")).toHaveLength(1);
    expect(getFormAssistantFallbackSources("germany", "schengen_c")).toEqual([]);
    expect(getFormAssistantFallbackSources("singapore", "SG_VISITOR_VISA")).toEqual([]);
  });
});
