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

  it("lets empty dependent selects fall back to a localized text input", () => {
    const onChange = vi.fn();
    const wardField = field({
      id: "ward",
      fieldName: "intended_ward_commune",
      label: "Intended ward/commune in Viet Nam",
      fieldType: "select",
      placeholder: "Choose ward/commune in Viet Nam",
      options: [],
      validationRules: {
        dependent_on: "intended_province_city",
      },
    });

    render(
      <DynamicFormField
        field={wardField}
        value=""
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    const input = screen.getByPlaceholderText(/坊\/社/);
    expect(input).toHaveAttribute("type", "text");

    fireEvent.change(input, { target: { value: "Phuong Ben Nghe" } });
    expect(onChange).toHaveBeenCalledWith("Phuong Ben Nghe");
  });

  it("locks page scrolling while a searchable dropdown is open", () => {
    const onChange = vi.fn();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 240 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1264 });

    const searchableField = field({
      id: "residence",
      fieldName: "place_of_residence",
      label: "Place of Residence",
      fieldType: "select",
      placeholder: "Select residence",
      options: Array.from({ length: 16 }, (_, index) => ({
        value: `OPTION_${index}`,
        label_zh: `选项 ${index}`,
        label_en: `Option ${index}`,
      })),
    });

    render(
      <DynamicFormField
        field={searchableField}
        value=""
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /请选择/ }));

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-240px");

    const outsideWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 1600,
    });
    document.body.dispatchEvent(outsideWheel);
    expect(outsideWheel.defaultPrevented).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
    scrollTo.mockRestore();
  });
});
