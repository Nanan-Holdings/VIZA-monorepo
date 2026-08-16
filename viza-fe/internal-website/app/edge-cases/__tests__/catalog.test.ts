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
      row("TEST_A", "nationality_requires_transit_visa", {
        field_type: "radio",
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      }),
      row("TEST_A", "journey_purpose", {
        field_type: "select",
        display_order: 2,
        options: [{ value: "transit", text: "Transit" }, { value: "visit", text: "Visit" }],
      }),
      row("TEST_A", "transit_acknowledgement", {
        display_order: 3,
        conditional_logic: {
          showIf: "nationality_requires_transit_visa === yes && journey_purpose === transit",
        },
      }),
      row("TEST_A", "passport_upload", {
        field_type: "file",
        display_order: 4,
      }),
      row("TEST_B", "surname"),
    ]);

    expect(catalog.fieldCount).toBe(5);
    expect(catalog.edgeCases.map((edgeCase) => edgeCase.code)).toEqual([
      "file_field_requires_document_contract",
    ]);
    expect(catalog.affectedVisaTypeCount).toBe(1);
    expect(catalog.visaTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({ visaType: "TEST_A", edgeCaseCount: 1 }),
      expect.objectContaining({ visaType: "TEST_B", edgeCaseCount: 0 }),
    ]));
  });
});
