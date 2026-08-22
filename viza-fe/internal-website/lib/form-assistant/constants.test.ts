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
    expect(getFormAssistantFallbackSources("south_korea", "KR_E_ARRIVAL_CARD")[0]?.url).toBe(
      "https://www.e-arrivalcard.go.kr/portal/",
    );
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

  it("explains an address from its source without inventing a country-specific value", () => {
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

  it.each([
    ["Indonesia C1", "information_true_declaration", "I declare that the information I provided is true.", "checkbox"],
    ["Indonesia e-VOA", "billing_responsibility_declaration", "I understand that official payment must be completed.", "checkbox"],
    ["Vietnam e-Visa", "final_declaration", "I declare that the above statements are true and complete.", "checkbox"],
    ["Vietnam pre-arrival", "visa_information_acknowledgement", "I have read and understood this information.", "checkbox"],
    ["Singapore", "has_health_symptoms", "Do you currently have any listed health symptoms?", "radio"],
    ["Malaysia", "purpose_of_travel", "Purpose of Travel", "select"],
    ["Thailand", "transit_without_stay", "I am a transit passenger and will not stay in Thailand.", "checkbox"],
    ["Philippines", "data_privacy_agreement", "I agree to the Data Privacy and Affidavit of Undertaking.", "checkbox"],
    ["Taiwan", "accepted_terms", "I have read and accept the following terms and conditions.", "checkbox"],
    ["United States", "has_specific_travel_plans", "Have you made specific travel plans?", "radio"],
    ["France", "directive_2004_38_acknowledged", "I acknowledge these rights under Directive 2004/38/EC.", "radio"],
    ["Korea", "declaration_consent", "I declare that the application is true and correct.", "checkbox"],
  ] as const)("keeps the %s choice-field copilot semantic and example-free", (_country, fieldName, label, fieldType) => {
    const explanation = buildFieldExplanation({
      fieldName,
      label,
      fieldType,
      required: true,
      placeholder: null,
      options: fieldType === "radio"
        ? [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }]
        : fieldType === "select"
          ? [{ value: "tourism", text: "Tourism" }]
          : [{ value: "yes", text: "I agree" }],
      validationRules: fieldName === "visa_information_acknowledgement"
        ? { helper_zh: "请提供越南签证信息（如适用），并与官方签证文件一致。" }
        : null,
    }, "zh");

    expect(explanation.example).toBeNull();
    expect(explanation.summary).toMatch(/勾选|选择|选“|确认|声明|同意/);
    expect(JSON.stringify(explanation)).not.toContain("请按护照、身份证明或官方文件上的原文填写");
  });

  it("surfaces configured country-field helper copy inside the copilot", () => {
    const explanation = buildFieldExplanation({
      fieldName: "visa_information_acknowledgement",
      label: "我已阅读并理解此信息",
      fieldType: "checkbox",
      required: true,
      placeholder: null,
      options: null,
      validationRules: {
        helper_zh: "请提供越南签证信息（如适用），并与官方签证文件一致。",
      },
    }, "zh");

    expect(explanation.sourceHint).toContain("越南签证信息");
  });

  it.each([
    ["YYYY-MM-DD", "2026-09-15"],
    ["DD/MM/YYYY", "15/09/2026"],
    ["YYYY/MM/DD", "2026/09/15"],
    ["DD-MMM-YYYY", "15-SEP-2026"],
    ["YYYY", "2026"],
  ])("uses only the declared date format %s for examples", (format, expected) => {
    const explanation = buildFieldExplanation({
      fieldName: "travel_date",
      label: "Travel date",
      fieldType: "date",
      required: true,
      placeholder: null,
      options: null,
      validationRules: { format },
    }, "en");

    expect(explanation.example).toBe(expected);
  });

  it("uses canonical date metadata and treats an explicit year field as YYYY", () => {
    const philippinesDate = buildFieldExplanation({
      fieldName: "flight_arrival_date",
      label: "Date of Arrival",
      fieldType: "date",
      required: true,
      placeholder: null,
      options: null,
      validationRules: { canonical_format: "YYYY-MM-DD" },
    }, "en");
    const ds160Year = buildFieldExplanation({
      fieldName: "last_visa_issue_year",
      label: "Date Last Visa Was Issued (Year)",
      fieldType: "text",
      required: true,
      placeholder: "YYYY",
      options: null,
      validationRules: { format: "DD-MMM-YYYY", pattern: "^[0-9]{4}$" },
    }, "en");

    expect(philippinesDate.example).toBe("2026-09-15");
    expect(ds160Year.example).toBe("2026");
  });

  it("explains the Philippines holder category instead of repeating the misleading Nationality label", () => {
    const explanation = buildFieldExplanation({
      fieldName: "passport_holder_type",
      label: "Nationality",
      fieldType: "radio",
      required: true,
      placeholder: null,
      options: [
        { value: "FILIPINO", text: "PHILIPPINE PASSPORT Holder" },
        { value: "FOREIGNER", text: "FOREIGN PASSPORT Holder" },
      ],
      validationRules: { official: true },
    }, "en");

    expect(explanation.summary).toContain("passport or travel-document holder category");
    expect(explanation.summary).toContain("not for a second nationality");
    expect(explanation.example).toBeNull();
  });

  it("does not collapse a combined issuing-authority/place field into one meaning", () => {
    const explanation = buildFieldExplanation({
      fieldName: "passport_issuing_authority",
      label: "Issuing Authority/Place of issue",
      fieldType: "text",
      required: false,
      placeholder: null,
      options: null,
      validationRules: null,
    }, "zh");

    expect(explanation.summary).toContain("合并询问");
    expect(explanation.sourceHint).toContain("不要根据办理城市");
    expect(explanation.example).toBeNull();
  });

  it("keeps Taiwan Chinese-name guidance separate from romanized passport names", () => {
    const explanation = buildFieldExplanation({
      fieldName: "name_chinese",
      label: "中文姓名",
      fieldType: "text",
      required: true,
      placeholder: null,
      options: null,
      validationRules: { script: "traditional_chinese" },
    }, "zh");

    expect(explanation.sourceHint).toContain("繁体或简体中文");
    expect(explanation.sourceHint).not.toContain("拼音原样填写");
    expect(explanation.example).toBeNull();
  });

  it("does not guess a date format or phone country code", () => {
    const unknownDate = buildFieldExplanation({
      fieldName: "travel_date",
      label: "Travel date",
      fieldType: "date",
      required: true,
      placeholder: null,
      options: null,
      validationRules: null,
    }, "en");
    const phone = buildFieldExplanation({
      fieldName: "mobile_phone",
      label: "Mobile phone",
      fieldType: "tel",
      required: true,
      placeholder: "e.g. +65 8123 4567",
      options: null,
      validationRules: null,
    }, "en");

    expect(unknownDate.example).toBeNull();
    expect(phone.example).toBeNull();
    expect(JSON.stringify(phone)).not.toContain("+65");
    expect(JSON.stringify(phone)).not.toContain("+86");
  });

  it("does not confuse an email_address key with a street address", () => {
    const explanation = buildFieldExplanation({
      fieldName: "email_address",
      label: "Email Address",
      fieldType: "text",
      required: true,
      placeholder: "name@example.com",
      options: null,
      validationRules: { format: "email" },
    }, "en");

    expect(explanation.summary).toContain("email address");
    expect(explanation.summary).not.toContain("identifiable address");
    expect(explanation.example).toBe("name@example.com");
  });
});
