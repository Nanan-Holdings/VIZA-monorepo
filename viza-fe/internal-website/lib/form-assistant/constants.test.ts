import { describe, expect, it } from "vitest";
import { SEARCHABLE_VISA_DESTINATIONS } from "@/lib/visa-destinations";
import {
  buildFieldClarificationFallback,
  buildFieldExplanation,
  canUseFormAssistant,
  getFormAssistantFallbackSources,
  isFieldClarificationRequest,
  isFormAssistantConfirmationField,
  isFormAssistantEnabled,
  isUsefulFieldClarificationReply,
} from "./constants";

describe("form assistant product coverage", () => {
  it("distinguishes legal declarations from ordinary required checkboxes", () => {
    expect(isFormAssistantConfirmationField({
      fieldName: "customs_information_acknowledgement",
      label: "I confirm that I have read and understood the customs and currency declaration information above.",
      fieldType: "checkbox",
      required: true,
      validationRules: null,
    })).toBe(true);

    expect(isFormAssistantConfirmationField({
      fieldName: "has_connecting_flight",
      label: "Will you have a connecting flight?",
      fieldType: "checkbox",
      required: true,
      validationRules: null,
    })).toBe(false);

    expect(isFormAssistantConfirmationField({
      fieldName: "data_privacy_consent",
      label: "By clicking Continue, you agree to our Data Privacy and Affidavit of Undertaking.",
      fieldType: "checkbox",
      required: false,
      validationRules: { mustBeTrue: true },
    })).toBe(true);
  });

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

  it("gives both assistants the same address meaning and source without inventing an example", () => {
    const explanation = buildFieldExplanation(accommodationAddress, "zh");
    const reply = buildFieldClarificationFallback(accommodationAddress, "zh");

    expect(explanation.summary).toContain("门牌号、街道名");
    expect(explanation.sourceHint).toContain("酒店预订单");
    expect(explanation.example).toBeNull();
    expect(reply).toContain(explanation.summary);
    expect(reply).not.toContain("格式示例");
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

  it("explains option-backed fields as a chat reply instead of a page selection", () => {
    const reply = buildFieldClarificationFallback({
      fieldName: "traveller_type",
      label: "Traveller Type",
      fieldType: "select",
      required: true,
      placeholder: null,
      options: [
        { value: "AIRCRAFT PASSENGER", text: "AIRCRAFT PASSENGER" },
        { value: "VESSEL PASSENGER", text: "VESSEL PASSENGER" },
      ],
    }, "en");

    expect(reply).toContain("asks whether you are travelling as an aircraft passenger or a vessel passenger");
    expect(reply).toContain("Reply with how you are entering the destination country");
    expect(reply).toContain("simply aircraft");
    expect(reply).toContain("Available answers: AIRCRAFT PASSENGER or VESSEL PASSENGER");
    expect(reply).not.toMatch(/\b(?:choose|select|click)\b/i);
  });

  it("lists every small reviewed applicant-type answer in clarification chat", () => {
    const reply = buildFieldClarificationFallback({
      fieldName: "sgac_applicant_type",
      label: "Residency Type",
      fieldType: "select",
      required: true,
      placeholder: null,
      options: [
        { value: "singapore_citizen_or_permanent_resident", label_en: "Singapore Citizen / Permanent Resident" },
        { value: "long_term_pass_holder", label_en: "Long-Term Pass Holder" },
        { value: "foreign_visitor", label_en: "Foreign Visitor / In-Principle Approval Holder" },
      ],
    }, "en");

    expect(reply).toContain("Available answers: Singapore Citizen / Permanent Resident, Long-Term Pass Holder, or Foreign Visitor / In-Principle Approval Holder");
    expect(reply).toContain("Reply in your own words");
  });

  it("explains country of origin by its travel meaning, not its control type", () => {
    const reply = buildFieldClarificationFallback({
      fieldName: "origin_country",
      label: "Country of Origin",
      fieldType: "select",
      required: true,
      placeholder: null,
      options: [{ value: "SG", text: "Singapore" }],
    }, "en");

    expect(reply).toContain("journey segment");
    expect(reply).toContain("itinerary or ticket");
    expect(reply).toContain("not your nationality, country of birth, or permanent residence");
    expect(reply).toContain("If this flight departs from Singapore");
    expect(reply).not.toContain("official category");
  });

  it("distinguishes baggage count from a customs declaration decision", () => {
    const reply = buildFieldClarificationFallback({
      fieldName: "has_baggage_or_currency_to_declare",
      label: "Do you have baggage or currency to declare?",
      fieldType: "radio",
      required: true,
      placeholder: null,
      options: [
        { value: "yes", text: "Yes" },
        { value: "no", text: "No" },
      ],
    }, "en");

    expect(reply).toContain("not how many bags you have");
    expect(reply).toContain("Having checked or carry-on baggage alone does not make the answer Yes");
    expect(reply).toContain("declarable goods");
    expect(reply).not.toContain("official category");
    expect(reply).not.toContain("Format example: Yes, No");
  });

  it.each([
    ["transit_country", "Country of Transit", "connection before reaching the destination"],
    ["destination_country", "Country of Destination", "onward or final country"],
    ["country_of_residence", "Permanent Country of Residence", "normally live"],
    ["nationality", "Citizenship", "passport"],
    ["occupation", "Occupation", "current main job"],
    ["purpose_of_travel", "Purpose of Travel", "main real reason"],
    ["airport_of_origin", "Airport of Origin", "flight segment"],
    ["port_of_entry", "Airport of Destination in the Philippines", "arriving flight lands"],
    ["accompanied_under_18_count", "Below 18 yrs. old", "family members under age 18"],
    ["accompanied_18_plus_count", "18 yrs. old and above", "family members aged 18 or older"],
    ["checked_baggage_count", "Checked-in (pcs)", "checked baggage pieces"],
    ["handcarry_baggage_count", "Hand-carried (pcs)", "hand-carried baggage pieces"],
  ])("provides a semantic explanation for %s", (fieldName, label, expectedMeaning) => {
    const explanation = buildFieldExplanation({
      fieldName,
      label,
      fieldType: "select",
      required: true,
      placeholder: null,
      options: [{ value: "EXAMPLE", text: "Example" }],
    }, "en");

    expect(`${explanation.summary} ${explanation.sourceHint}`).toContain(expectedMeaning);
    expect(explanation.summary).not.toContain("official category");
  });

  it.each([
    ["country_of_citizenship", "Country of citizenship", "passport"],
    ["current_nationality", "Current nationality", "passport"],
    ["birth_country", "Birth country", "born"],
    ["residence_country", "Country of residence", "normally live"],
    ["country_boarded", "Country where you boarded", "journey segment"],
    ["purpose_of_visit", "Purpose of visit", "main real reason"],
    ["purpose_of_journey", "Purpose of journey", "main real reason"],
    ["arrival_airport", "Arrival airport", "arriving flight lands"],
    ["current_occupation", "Current occupation", "current main job"],
  ])("reuses shared semantics for cross-country field alias %s", (fieldName, label, expectedMeaning) => {
    const explanation = buildFieldExplanation({
      fieldName,
      label,
      fieldType: "select",
      required: true,
      placeholder: null,
      options: [{ value: "EXAMPLE", text: "Example" }],
    }, "en");

    expect(`${explanation.summary} ${explanation.sourceHint}`).toContain(expectedMeaning);
    expect(explanation.summary).not.toContain("Philippines");
  });

  it("uses country schema helper text instead of a generic option explanation", () => {
    const explanation = buildFieldExplanation({
      fieldName: "local_permit_category",
      label: "Permit category",
      fieldType: "select",
      required: true,
      placeholder: null,
      validationRules: {
        helper_en: "Use the category printed on the approval notice.",
      },
      options: [
        { value: "A", text: "Category A" },
        { value: "B", text: "Category B" },
      ],
    }, "en");

    expect(explanation.sourceHint).toBe("Use the category printed on the approval notice.");
    expect(explanation.summary).not.toContain("official category");
  });

  it("does not dump arbitrary examples for large official option sets", () => {
    const reply = buildFieldClarificationFallback({
      fieldName: "unmapped_official_category",
      label: "Unmapped official category",
      fieldType: "select",
      required: true,
      placeholder: null,
      options: Array.from({ length: 6 }, (_, index) => ({
        value: `COUNTRY_${index + 1}`,
        text: `Country ${index + 1}`,
      })),
    }, "en");

    expect(reply).toContain("Reply in your own words");
    expect(reply).not.toContain("Format example");
    expect(reply).not.toContain("Country 1");
  });
});
