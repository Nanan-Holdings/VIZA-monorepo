import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DynamicStepForm } from "@/components/dynamic-step-form";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

let mockLocale = "zh";

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

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

vi.mock("@/lib/chinese-conversion", () => ({
  convertSimplifiedToTraditional: async (value: string) => value,
}));

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: `field-${overrides.fieldName ?? "us_address_state"}`,
    visaType: "DS160",
    fieldName: "us_address_state",
    label: "State",
    fieldType: "select",
    required: false,
    stepNumber: 3,
    stepName: "Travel Information",
    displayOrder: 1,
    placeholder: null,
    validationRules: { source: "US_STATES" },
    options: [{ value: "", text: "Select a state", label_zh: "请选择州" }],
    conditionalLogic: null,
    ...overrides,
  };
}

function stepFor(fields: VisaFormFieldRow[]): WizardStep {
  return {
    stepNumber: 3,
    stepName: "Travel Information",
    fields: fields.map((candidate, index) => ({ ...candidate, displayOrder: index + 1 })),
  };
}

describe("DynamicStepForm US state hydration", () => {
  it("passes a saved CA answer through the US_STATES control and displays it in Chinese", async () => {
    mockLocale = "zh";
    const onDraftChange = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={stepFor([field({})])}
        prefill={{ us_address_state: "CA" }}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        country="united_states"
        visaType="DS160"
      />,
    );

    await waitFor(() => expect(onDraftChange).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("加利福尼亚州");
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ us_address_state: "CA" }));
      expect(container.querySelector('[data-field-name="us_address_state"]'))
        .toHaveAttribute("data-field-warning", "false");
    });
  });
});
