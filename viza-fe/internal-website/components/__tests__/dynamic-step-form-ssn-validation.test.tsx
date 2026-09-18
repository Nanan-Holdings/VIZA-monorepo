import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DynamicStepForm } from "@/components/dynamic-step-form";
import { normalizeBilingualFormField } from "@/lib/bilingual-schema-contract";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => Object.assign((key: string) => ({
    "dynamicField.doesNotApply": "不适用",
    "dynamicField.doNotKnow": "不知道",
  }[key] ?? key), { has: () => false }),
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

vi.mock("@/lib/chinese-conversion", () => ({
  convertSimplifiedToTraditional: async (value: string) => value,
}));

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const elementPrototype = Element.prototype as Element & Partial<{
    scrollIntoView: () => void;
    hasPointerCapture: () => boolean;
    setPointerCapture: () => void;
    releasePointerCapture: () => void;
  }>;
  elementPrototype.scrollIntoView ??= vi.fn();
  elementPrototype.hasPointerCapture ??= vi.fn(() => false);
  elementPrototype.setPointerCapture ??= vi.fn();
  elementPrototype.releasePointerCapture ??= vi.fn();
});

function ssnField(): VisaFormFieldRow {
  return normalizeBilingualFormField({
    id: "us-social-security-number",
    visaType: "DS160",
    fieldName: "us_social_security_number",
    label: "U.S. Social Security Number",
    fieldType: "text",
    required: false,
    stepNumber: 2,
    stepName: "Personal Information 2",
    displayOrder: 1,
    placeholder: null,
    validationRules: {
      has_does_not_apply: true,
      pattern: "^[0-9]{3}-[0-9]{2}-[0-9]{4}$",
    },
    options: null,
    conditionalLogic: null,
  });
}

function stepFor(field: VisaFormFieldRow): WizardStep {
  return {
    stepNumber: 2,
    stepName: "Personal Information 2",
    fields: [field],
  };
}

describe("DynamicStepForm DS-160 Social Security Number validation", () => {
  it("blocks completion while the required SSN is blank", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={stepFor(ssnField())}
        prefill={{}}
        onComplete={onComplete}
        visaType="DS160"
      />,
    );

    const continueButton = container.querySelector<HTMLButtonElement>("button[data-required-filled]");
    expect(continueButton).toHaveAttribute("data-required-filled", "false");
    expect(continueButton).toBeDisabled();

    fireEvent.submit(container.querySelector("form")!);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("allows the official DOES_NOT_APPLY answer without a nine-digit error", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={stepFor(ssnField())}
        prefill={{ us_social_security_number: "DOES_NOT_APPLY" }}
        onComplete={onComplete}
        visaType="DS160"
      />,
    );

    const fieldRoot = container.querySelector('[data-field-name="us_social_security_number"]');
    const continueButton = container.querySelector<HTMLButtonElement>("button[data-required-filled]");
    expect(fieldRoot).toHaveAttribute("data-field-warning", "false");
    expect(fieldRoot).not.toHaveTextContent("9");
    expect(continueButton).toHaveAttribute("data-required-filled", "true");
    expect(continueButton).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "不适用" })).toBeChecked();
    expect(screen.queryByLabelText("美国社会安全号码")).not.toBeInTheDocument();

    fireEvent.submit(container.querySelector("form")!);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ us_social_security_number: "DOES_NOT_APPLY" }));
  });

  it("still rejects an ordinary SSN value that fails the official pattern", () => {
    const { container } = render(
      <DynamicStepForm
        step={stepFor(ssnField())}
        prefill={{ us_social_security_number: "123" }}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const fieldRoot = container.querySelector('[data-field-name="us_social_security_number"]');
    const continueButton = container.querySelector<HTMLButtonElement>("button[data-required-filled]");
    expect(fieldRoot).toHaveAttribute("data-field-warning", "true");
    expect(fieldRoot).toHaveTextContent("格式不符合要求");
    expect(continueButton).toBeDisabled();
  });
});
