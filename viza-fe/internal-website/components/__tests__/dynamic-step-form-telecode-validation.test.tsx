import { fireEvent, render } from "@testing-library/react";
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

function telecodeFields(): VisaFormFieldRow[] {
  const fields = [
    ["telecode_surname", "Telecode Surname", true, 1],
    ["telecode_given_names", "Telecode Given Names", false, 2],
  ] as const;
  return fields.map(([fieldName, label, required, displayOrder]) => normalizeBilingualFormField({
    id: fieldName,
    visaType: "DS160",
    fieldName,
    label,
    fieldType: "text",
    required,
    stepNumber: 1,
    stepName: "Personal Information 1",
    displayOrder,
    placeholder: "4-digit groups separated by spaces",
    validationRules: {
      maxLength: 20,
      pattern: "^[0-9]{4}(?: [0-9]{4})*$",
      specific_error_zh: "请输入由空格分隔的四位数字组",
    },
    options: null,
    conditionalLogic: { showIf: "has_telecode === yes" },
  }));
}

function stepFor(): WizardStep {
  return {
    stepNumber: 1,
    stepName: "Personal Information 1",
    fields: telecodeFields(),
  };
}

describe("DynamicStepForm DS-160 telecode validation", () => {
  it("accepts spaced four-digit groups and optional given names", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={stepFor()}
        prefill={{ has_telecode: "yes", telecode_surname: "1234 5678" }}
        onComplete={onComplete}
        visaType="DS160"
      />,
    );

    expect(container.querySelector<HTMLInputElement>('[data-field-name="telecode_surname"] input')).toHaveAttribute("maxLength", "20");
    const continueButton = container.querySelector<HTMLButtonElement>("button[data-required-filled]");
    expect(continueButton).toHaveAttribute("data-required-filled", "true");
    expect(continueButton).not.toBeDisabled();

    fireEvent.submit(container.querySelector("form")!);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      telecode_surname: "1234 5678",
    }));
  });

  it("rejects unspaced or partial telecode groups in either populated field", () => {
    const { container } = render(
      <DynamicStepForm
        step={stepFor()}
        prefill={{ has_telecode: "yes", telecode_surname: "12345678", telecode_given_names: "1234 567" }}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(container.querySelector('[data-field-name="telecode_surname"]')).toHaveTextContent("请输入由空格分隔的四位数字组");
    expect(container.querySelector('[data-field-name="telecode_given_names"]')).toHaveTextContent("请输入由空格分隔的四位数字组");
    expect(container.querySelector<HTMLButtonElement>("button[data-required-filled]")).toBeDisabled();
  });
});
