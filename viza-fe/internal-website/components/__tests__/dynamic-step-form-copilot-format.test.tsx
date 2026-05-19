import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "../dynamic-step-form";
import { type WizardStep } from "@/types/visa-form-fields";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

const requiredTextStep: WizardStep = {
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      id: "field-surname",
      visaType: "DS160",
      fieldName: "surname",
      label: "Surname",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Personal Information",
      displayOrder: 1,
      placeholder: "e.g. LI",
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const shortcutStep: WizardStep = {
  stepNumber: 1,
  stepName: "Shortcuts",
  fields: [
    {
      id: "field-travel-plan",
      visaType: "DS160",
      fieldName: "has_travel_plan",
      label: "Do you have a specific travel plan?",
      fieldType: "radio",
      required: false,
      stepNumber: 1,
      stepName: "Shortcuts",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: [
        { value: "YES", text: "Yes" },
        { value: "NO", text: "No" },
      ],
      conditionalLogic: null,
    },
  ],
};

describe("DynamicStepForm copilot format", () => {
  it("uses the unified Chinese copilot trigger format", () => {
    render(
      <DynamicStepForm
        step={requiredTextStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.getByText("必填项")).toBeInTheDocument();
    expect(screen.queryByText("Required field")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask AI" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review tip" })).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "问 AI" });
    expect(trigger).toHaveAttribute("data-copilot-trigger", "surname");

    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "收起 AI 帮助" })).toBeInTheDocument();
    expect(screen.getByTestId("field-guidance-panel")).toBeInTheDocument();
  });

  it("supports Windows and Mac undo/redo shortcuts for non-text controls", () => {
    const { container } = render(
      <DynamicStepForm
        step={shortcutStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const getYesRadios = () =>
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"][value="YES"]'));
    const firstYesRadio = () => getYesRadios()[0];

    fireEvent.click(firstYesRadio()!);
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);

    fireEvent.keyDown(firstYesRadio()!, { key: "z", ctrlKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(false);

    fireEvent.keyDown(firstYesRadio()!, { key: "y", ctrlKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);

    fireEvent.keyDown(firstYesRadio()!, { key: "z", metaKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(false);

    fireEvent.keyDown(firstYesRadio()!, { key: "Z", metaKey: true, shiftKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);
  });
});
