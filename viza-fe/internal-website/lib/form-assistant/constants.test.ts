import { describe, expect, it } from "vitest";
import { SEARCHABLE_VISA_DESTINATIONS } from "@/lib/visa-destinations";
import {
  buildFieldClarificationFallback,
  buildFieldExplanation,
  canUseFormAssistant,
  getFormAssistantFallbackSources,
  isFieldClarificationRequest,
  isFormAssistantEnabled,
  isUsefulFieldClarificationReply,
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

describe("shared field explanation policy", () => {
  const accommodationAddress = {
    fieldName: "accommodation_address_line_1",
    label: "住宿地址——第1行",
    fieldType: "text" as const,
    required: true,
    placeholder: "Street and number",
    options: null,
  };

  it("gives both assistants the same address meaning, source, and safe example", () => {
    const explanation = buildFieldExplanation(accommodationAddress, "zh");
    const reply = buildFieldClarificationFallback(accommodationAddress, "zh");

    expect(explanation.summary).toContain("门牌号、街道名");
    expect(explanation.sourceHint).toContain("酒店预订单");
    expect(explanation.example).toBe("15 Rue de Rivoli, Appartement 3B");
    expect(reply).toContain(explanation.summary);
    expect(reply).toContain("格式示例：15 Rue de Rivoli, Appartement 3B");
  });

  it("detects clarification turns and rejects repeated-question replies", () => {
    expect(isFieldClarificationRequest("什么意思")).toBe(true);
    expect(isUsefulFieldClarificationReply(
      "请告诉我住宿地址——第1行。",
      "什么意思",
      accommodationAddress,
    )).toBe(false);
    expect(isUsefulFieldClarificationReply(
      "请从酒店预订单查看主要街道地址，例如 15 Rue de Rivoli。",
      "什么意思",
      accommodationAddress,
    )).toBe(true);
  });
});
