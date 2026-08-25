import { describe, expect, it } from "vitest";
import {
  buildApplicationAgreementHref,
  resolveApplicationAgreement,
} from "@/lib/application-agreements";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

function checkbox(overrides: Partial<VisaFormFieldRow> = {}): VisaFormFieldRow {
  return {
    id: "field-id",
    visaType: "SG_ARRIVAL_CARD",
    fieldName: "ica_declaration_accepted",
    label: "I have read and agreed to the declaration.",
    fieldType: "checkbox",
    required: true,
    stepNumber: 3,
    stepName: "Declaration",
    displayOrder: 1,
    placeholder: null,
    validationRules: { label_zh: "我已阅读并同意该声明。" },
    options: [{ value: "true", text: "I agree" }],
    conditionalLogic: null,
    ...overrides,
  };
}

describe("application agreement metadata", () => {
  it("uses the exact schema statement and official Chinese text", () => {
    expect(resolveApplicationAgreement(checkbox())).toMatchObject({
      contentEn: "I have read and agreed to the declaration.",
      contentZh: "我已阅读并同意该声明。",
      version: "schema-statement-v1",
      sourceUrl: "https://eservices.ica.gov.sg/sgac-services/common/code/toggleLang?lang=EN",
    });
  });

  it("does not treat an ordinary checkbox as a legal agreement", () => {
    expect(resolveApplicationAgreement(checkbox({
      fieldName: "same_as_home_address",
      label: "Same as home address",
      required: false,
    }))).toBeNull();
  });

  it("builds a route-safe agreement link", () => {
    expect(buildApplicationAgreementHref("SG ARRIVAL/CARD", "declaration accepted")).toBe(
      "/client/application/agreements/SG%20ARRIVAL%2FCARD/declaration%20accepted",
    );
  });
});
