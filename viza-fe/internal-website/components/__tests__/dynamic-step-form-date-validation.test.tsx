import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => Object.assign((key: string) => ({
    "dynamicField.doNotKnow": "不知道",
    "dynamicField.doesNotApply": "不适用",
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

function dateField(overrides: Partial<VisaFormFieldRow> = {}): VisaFormFieldRow {
  return {
    id: "father-date-of-birth",
    visaType: "DS160",
    fieldName: "father_date_of_birth",
    label: "父亲的出生日期",
    fieldType: "date",
    required: true,
    stepNumber: 1,
    stepName: "家庭信息",
    displayOrder: 1,
    placeholder: null,
    validationRules: { format: "DD-MMM-YYYY", allow_do_not_know: true },
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

function renderDateField(
  field: VisaFormFieldRow,
  prefill: Record<string, string>,
  onDraftChange = vi.fn(),
) {
  const step: WizardStep = {
    stepNumber: 1,
    stepName: "家庭信息",
    fields: [field],
  };
  const view = render(
    <DynamicStepForm
      step={step}
      prefill={prefill}
      onComplete={vi.fn()}
      onDraftChange={onDraftChange}
      visaType="DS160"
    />,
  );
  return { ...view, onDraftChange };
}

describe("DynamicStepForm date sentinel validation", () => {
  it.each(["1988", "2023-02-29"])("rejects an incomplete or impossible date: %s", (value) => {
    const { container } = renderDateField(dateField(), { father_date_of_birth: value });
    expect(container.querySelector('[data-field-name="father_date_of_birth"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(screen.getByText("日期格式不符合要求")).toBeInTheDocument();
  });

  it("does not flag an allowed unknown date and clears the sentinel when unchecked", async () => {
    const { container, onDraftChange } = renderDateField(
      dateField(),
      { father_date_of_birth: "DO_NOT_KNOW" },
    );
    const fieldRoot = container.querySelector('[data-field-name="father_date_of_birth"]');

    expect(fieldRoot).toHaveAttribute("data-field-warning", "false");
    expect(screen.getByRole("checkbox", { name: "不知道" })).toBeChecked();
    expect(screen.queryByText("日期格式不符合要求")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "不知道" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "不知道" })).not.toBeChecked();
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ father_date_of_birth: "" }));
    });
    expect(screen.queryByText("日期格式不符合要求")).not.toBeInTheDocument();
  });

  it("still rejects the unknown sentinel when the schema does not allow it", () => {
    const { container } = renderDateField(
      dateField({ validationRules: { format: "DD-MMM-YYYY" } }),
      { father_date_of_birth: "DO_NOT_KNOW" },
    );

    expect(container.querySelector('[data-field-name="father_date_of_birth"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(screen.getByText("日期格式不符合要求")).toBeInTheDocument();
  });
});
