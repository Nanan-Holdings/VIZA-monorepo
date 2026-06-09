import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicFormField } from "../dynamic-form-field";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

let mockLocale = "zh";

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => key,
}));

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: "purpose",
    visaType: "TEST",
    fieldName: "purpose_of_journey",
    label: "Purpose of journey",
    fieldType: "radio",
    required: true,
    stepNumber: 1,
    stepName: "Travel",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

describe("DynamicFormField localization", () => {
  it("renders localized radio labels while preserving official stored values", () => {
    const onChange = vi.fn();
    const purposeField = field({
      options: [
        { value: "tourism", text: "Tourism" },
        { value: "business", text: "Business" },
      ],
    });

    mockLocale = "zh";
    const { rerender } = render(
      <DynamicFormField
        field={purposeField}
        value=""
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    expect(screen.getByText("旅游")).toBeInTheDocument();
    expect(screen.getByText("商务")).toBeInTheDocument();
    expect(screen.queryByText("Tourism")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("旅游"));
    expect(onChange).toHaveBeenCalledWith("tourism");

    mockLocale = "en";
    rerender(
      <DynamicFormField
        field={purposeField}
        value=""
        onChange={onChange}
        displayLocale="en"
      />,
    );

    expect(screen.getByText("Tourism")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
  });
});
