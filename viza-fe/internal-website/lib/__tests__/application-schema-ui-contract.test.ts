import { describe, expect, it } from "vitest";

import {
  compileApplicationSchemaForUi,
  getApplicationFieldUiComponent,
  getCompiledConditionalPanelController,
  getCompiledConditionalPanelMode,
} from "@/lib/application-schema-ui-contract";
import {
  type VisaFormFieldRow,
  type VisaFormFieldType,
  type WizardStep,
} from "@/types/visa-form-fields";

function field(
  fieldName: string,
  fieldType: VisaFormFieldType,
  overrides: Partial<VisaFormFieldRow> = {},
): VisaFormFieldRow {
  return {
    id: `field-${fieldName}`,
    visaType: "TEST_SCHEMA_UI",
    fieldName,
    label: fieldName,
    fieldType,
    required: true,
    stepNumber: 1,
    stepName: "Test step",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

function steps(...fields: VisaFormFieldRow[]): WizardStep[] {
  const byStep = new Map<number, WizardStep>();
  for (const schemaField of fields) {
    const step = byStep.get(schemaField.stepNumber) ?? {
      stepNumber: schemaField.stepNumber,
      stepName: schemaField.stepName ?? `Step ${schemaField.stepNumber}`,
      fields: [],
    };
    step.fields.push(schemaField);
    byStep.set(schemaField.stepNumber, step);
  }
  return [...byStep.values()];
}

describe("application schema UI contract", () => {
  it.each([
    ["text", "application-input"],
    ["password", "sensitive-input"],
    ["email", "application-input"],
    ["tel", "application-input"],
    ["number", "application-input"],
    ["textarea", "application-textarea"],
    ["date", "application-date-picker"],
    ["country", "country-dropdown"],
    ["checkbox", "application-checkbox"],
    ["file", "supporting-document-card"],
  ] as const)("maps %s fields to %s", (fieldType, component) => {
    expect(getApplicationFieldUiComponent(field("mapped", fieldType))).toBe(component);
  });

  it("maps option counts and remote sources to canonical select/radio components", () => {
    expect(getApplicationFieldUiComponent(field("yes_no", "radio", {
      options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
    }))).toBe("application-yes-no-control");
    expect(getApplicationFieldUiComponent(field("radio_group", "radio", {
      options: ["air", "land", "sea"],
    }))).toBe("application-radio-group");
    expect(getApplicationFieldUiComponent(field("short_select", "select", {
      options: ["a", "b"],
    }))).toBe("application-select");
    expect(getApplicationFieldUiComponent(field("remote_select", "select", {
      validationRules: { remote_search: true },
      options: [],
    }))).toBe("application-searchable-select");
  });

  it("infers built-in country, US state, and phone-code option adapters", () => {
    expect(getApplicationFieldUiComponent(field("country_of_birth", "select", {
      options: [],
    }))).toBe("country-dropdown");
    expect(getApplicationFieldUiComponent(field("us_address_state", "select", {
      visaType: "DS160",
      options: [],
    }))).toBe("application-region-select");
    expect(getApplicationFieldUiComponent(field("phone_country_code", "select", {
      options: [],
    }))).toBe("application-searchable-select");
  });

  it("reuses an unambiguous sibling option set for scraped semantic variants", () => {
    const currentOccupation = field("current_occupation", "select", {
      options: Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1),
        text: `Occupation ${index + 1}`,
      })),
    });
    const parentOccupation = field("kin_father_occupation", "select", {
      displayOrder: 2,
      options: [],
    });

    const compiled = compileApplicationSchemaForUi(steps(currentOccupation, parentOccupation));
    expect(compiled.steps[0].fields[1].options).toEqual(currentOccupation.options);
    expect(compiled.steps[0].fields[1].validationRules).toMatchObject({
      option_source_field: "current_occupation",
      ui_component: "application-searchable-select",
    });
    expect(compiled.report.summary.errors).toBe(0);
  });

  it("assigns every same-step Yes/No descendant to one shared controller panel", () => {
    const controller = field("has_national_id", "radio", {
      options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
    });
    const number = field("national_id_number", "text", {
      displayOrder: 2,
      conditionalLogic: { showIf: "has_national_id === yes" },
    });
    const country = field("national_id_country", "country", {
      displayOrder: 3,
      conditionalLogic: { showIf: "has_national_id === yes" },
    });

    const compiled = compileApplicationSchemaForUi(steps(controller, number, country));
    const descendants = compiled.steps[0].fields.slice(1);
    expect(descendants.map(getCompiledConditionalPanelController)).toEqual([
      "has_national_id",
      "has_national_id",
    ]);
    expect(descendants.map(getCompiledConditionalPanelMode)).toEqual(["shared", "shared"]);
    expect(compiled.report.issues).toHaveLength(0);
  });

  it("keeps nested descendants in the terminal controller panel", () => {
    const controller = field("funding_provider", "select", {
      options: ["self", "sponsor", "both"],
    });
    const other = field("self_means_other", "radio", {
      displayOrder: 2,
      options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      conditionalLogic: { showIf: "funding_provider in [self, both]" },
    });
    const explanation = field("self_means_other_explain", "text", {
      displayOrder: 3,
      conditionalLogic: { showIf: "self_means_other === yes" },
    });

    const compiled = compileApplicationSchemaForUi(steps(controller, other, explanation));
    expect(getCompiledConditionalPanelController(compiled.steps[0].fields[2])).toBe("funding_provider");
  });

  it("uses the outer card for cross-step branches and reports design guidance", () => {
    const controller = field("purpose_of_visit", "select", {
      options: ["tourism", "business"],
    });
    const dependent = field("tourism_sub_purpose", "radio", {
      stepNumber: 2,
      stepName: "Purpose details",
      options: ["tourist", "family", "friends"],
      conditionalLogic: { showIf: "purpose_of_visit === tourism" },
    });

    const compiled = compileApplicationSchemaForUi(steps(controller, dependent));
    const compiledDependent = compiled.steps[1].fields[0];
    expect(getCompiledConditionalPanelMode(compiledDependent)).toBe("outer_only");
    expect(compiled.report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "cross_step_conditional", designEdgeCase: true }),
    ]));
  });

  it("reports missing, compound, and unsupported controls instead of guessing", () => {
    const controllerA = field("controller_a", "radio", {
      options: ["yes", "no"],
    });
    const controllerB = field("controller_b", "select", {
      displayOrder: 2,
      options: ["one", "two"],
    });
    const compound = field("compound_details", "text", {
      displayOrder: 3,
      conditionalLogic: { showIf: "controller_a === yes && controller_b === one" },
    });
    const missing = field("missing_details", "text", {
      displayOrder: 4,
      conditionalLogic: { showIf: "missing_controller === yes" },
    });
    const unsupported = field("signature", "text", {
      displayOrder: 5,
      fieldType: "signature_pad" as VisaFormFieldType,
    });

    const compiled = compileApplicationSchemaForUi(
      steps(controllerA, controllerB, compound, missing, unsupported),
    );
    expect(compiled.report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "multiple_conditional_roots",
      "unknown_conditional_controller",
      "unsupported_field_type",
    ]));
    expect(compiled.report.summary.errors).toBe(2);
  });

  it("reports repeat and inline group shapes that need correction or new components", () => {
    const repeatA = field("traveller_name", "text", {
      validationRules: { repeat_group: "travellers", repeatable: true, max_items: 5 },
    });
    const repeatB = field("traveller_passport", "text", {
      displayOrder: 2,
      validationRules: { repeat_group: "travellers", max_items: 3 },
    });
    const inlineA = field("date_a", "date", {
      displayOrder: 3,
      validationRules: { inline_group: "dates" },
    });
    const inlineB = field("date_b", "date", {
      displayOrder: 4,
      validationRules: { inline_group: "dates" },
    });
    const inlineC = field("date_c", "date", {
      displayOrder: 5,
      validationRules: { inline_group: "dates" },
    });

    const compiled = compileApplicationSchemaForUi(
      steps(repeatA, repeatB, inlineA, inlineB, inlineC),
    );
    expect(compiled.report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "repeat_group_missing_repeatable",
      "repeat_group_conflicting_max_items",
      "inline_group_too_large",
    ]));
  });
});
