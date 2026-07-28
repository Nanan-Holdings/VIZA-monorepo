import { describe, expect, test } from "vitest";
import type { WizardStep } from "@/types/visa-form-fields";
import {
  getBilingualReviewValue,
  getLocalizedOptionText,
  getReviewOptionText,
  getReviewOfficialLabel,
  getReviewSourceLabel,
} from "../dynamic-review-step";

function baseField(overrides: Partial<WizardStep["fields"][number]>): WizardStep["fields"][number] {
  return {
    id: overrides.fieldName ?? "field",
    visaType: "VN_E_VISA",
    fieldName: overrides.fieldName ?? "field",
    label: overrides.label ?? "Field",
    fieldType: overrides.fieldType ?? "text",
    required: true,
    stepNumber: 1,
    stepName: "Vietnam",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

describe("dynamic review localization", () => {
  test("uses Vietnam schema metadata for Chinese and official review labels", () => {
    const field = baseField({
      fieldName: "has_violated_vietnam_laws",
      label: "Have you violated Vietnamese laws/regulations?",
      fieldType: "radio",
      validationRules: {
        label_zh: "是否曾违反越南法律或法规？",
        label_en: "Have you violated Vietnamese laws/regulations?",
        official_label_en: "Have you violated Vietnamese laws/regulations?",
      },
    });

    expect(getReviewSourceLabel(field)).toBe("是否曾违反越南法律或法规？");
    expect(getReviewOfficialLabel(field)).toBe("Have you violated Vietnamese laws/regulations?");
  });

  test("localizes enum values without changing the stored official value", () => {
    const options = [
      {
        value: "single",
        text: "Single-entry",
        label_zh: "单次入境",
        label_en: "Single-entry",
        official_label: "Single-entry",
      },
    ];

    expect(getLocalizedOptionText("single", options, "zh")).toBe("单次入境");
    expect(getLocalizedOptionText("single", options, "en")).toBe("Single-entry");
    expect(getLocalizedOptionText("official", [{ value: "official", text: "Official" }], "zh")).toBe("公务人员");
  });

  test("prefers explicit Chinese companion values on the review left side", () => {
    const field = baseField({
      fieldName: "purpose_of_entry",
      label: "Purpose of entry",
      fieldType: "text",
    });
    const answers = {
      purpose_of_entry: "Tourism",
      purpose_of_entry_zh: "旅游",
    };

    expect(getBilingualReviewValue(answers, "purpose_of_entry", "Tourism", field, "zh")).toBe("旅游");
    expect(getBilingualReviewValue(answers, "purpose_of_entry", "Tourism", field, "en")).toBe("Tourism");
  });

  test("resolves the selected Vietnam visa issue-place code on both review sides", () => {
    const field = baseField({
      fieldName: "visa_issued_place",
      label: "Issued Place",
      fieldType: "select",
      validationRules: {
        official_source: "prearrival_category:visa_issue_place",
        depends_on: "visa_type",
      },
    });
    const answers = {
      visa_type: "EV",
      visa_issued_place: "18A-131",
    };

    expect(getReviewOptionText(answers, "18A-131", field, "zh"))
      .toBe("越南出入境管理局 - 公安部");
    expect(getReviewOptionText(answers, "18A-131", field, "en"))
      .toBe("Vietnam Immigration Department - Ministry of Public Security");
  });

  test("resolves persisted Vietnam province and ward codes on both review sides", () => {
    const provinceField = baseField({
      fieldName: "province_city_of_hotel",
      label: "Province / City of Hotel",
      fieldType: "select",
      validationRules: {
        official_source: "prearrival_category:administrative_unit_level1",
      },
    });
    const wardField = baseField({
      fieldName: "ward_commune_of_hotel",
      label: "Ward / Commune of Hotel",
      fieldType: "select",
      validationRules: {
        official_source: "prearrival_category:administrative_unit_level2",
        depends_on: "province_city_of_hotel",
      },
    });
    const answers = {
      province_city_of_hotel: "48",
      ward_commune_of_hotel: "20285",
    };

    expect(getReviewOptionText(answers, "48", provinceField, "zh")).toBe("岘港市");
    expect(getReviewOptionText(answers, "48", provinceField, "en")).toBe("Da Nang City");
    expect(getReviewOptionText(answers, "20285", wardField, "zh")).toBe("五行山坊");
    expect(getReviewOptionText(answers, "20285", wardField, "en")).toBe("Ngu Hanh Son Ward");
  });

  test("resolves Vietnam administrative codes when an older schema lacks source metadata", () => {
    const provinceField = baseField({
      fieldName: "province_city_of_hotel",
      label: "Province / City of Hotel",
      fieldType: "select",
    });
    const wardField = baseField({
      fieldName: "ward_commune_of_hotel",
      label: "Ward / Commune of Hotel",
      fieldType: "select",
    });
    const answers = {
      province_city_of_hotel: "48",
      ward_commune_of_hotel: "20285",
    };

    expect(getReviewOptionText(answers, "48", provinceField, "zh")).toBe("岘港市");
    expect(getReviewOptionText(answers, "20285", wardField, "zh")).toBe("五行山坊");
  });
});
