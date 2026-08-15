import { describe, expect, it } from "vitest";

import type { VisaFormFieldDbRow } from "@/types/visa-form-fields";

import { buildApplicationSchemaEdgeCaseCatalog } from "../catalog";

function row(
  visaType: string,
  fieldName: string,
  overrides: Partial<VisaFormFieldDbRow> = {},
): VisaFormFieldDbRow {
  return {
    id: `${visaType}-${fieldName}`,
    visa_type: visaType,
    field_name: fieldName,
    label: fieldName,
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Step one",
    display_order: 1,
    placeholder: null,
    validation_rules: null,
    options: null,
    conditional_logic: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("application schema edge-case catalog", () => {
  it("keeps every design edge case and retains unaffected visa schemas", () => {
    const catalog = buildApplicationSchemaEdgeCaseCatalog([
      row("TEST_A", "gender", {
        field_type: "radio",
        options: [{ value: "male", text: "Male" }, { value: "female", text: "Female" }],
      }),
      row("TEST_A", "purpose", {
        field_type: "select",
        display_order: 2,
        options: [{ value: "tourism", text: "Tourism" }, { value: "business", text: "Business" }],
      }),
      row("TEST_A", "tourism_details", {
        step_number: 2,
        step_name: "Step two",
        conditional_logic: { showIf: "purpose === tourism" },
      }),
      row("TEST_B", "surname"),
    ]);

    expect(catalog.fieldCount).toBe(4);
    expect(catalog.edgeCases.map((edgeCase) => edgeCase.code)).toEqual([
      "binary_non_boolean_radio",
      "cross_step_conditional",
    ]);
    expect(catalog.affectedVisaTypeCount).toBe(1);
    expect(catalog.visaTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({ visaType: "TEST_A", edgeCaseCount: 2 }),
      expect.objectContaining({ visaType: "TEST_B", edgeCaseCount: 0 }),
    ]));
    expect(catalog.edgeCases[1].fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "purpose", component: "application-select" }),
      expect.objectContaining({ fieldName: "tourism_details", component: "application-input" }),
    ]));
  });
});
