import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
  if (typeof elementPrototype.scrollIntoView !== "function") {
    elementPrototype.scrollIntoView = vi.fn();
  }
  if (typeof elementPrototype.hasPointerCapture !== "function") {
    elementPrototype.hasPointerCapture = vi.fn(() => false);
  }
  if (typeof elementPrototype.setPointerCapture !== "function") {
    elementPrototype.setPointerCapture = vi.fn();
  }
  if (typeof elementPrototype.releasePointerCapture !== "function") {
    elementPrototype.releasePointerCapture = vi.fn();
  }
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
    id: `field-${overrides.fieldName ?? "test-field"}`,
    visaType: "DS160",
    fieldName: "answer",
    label: "Answer",
    fieldType: "text",
    required: false,
    stepNumber: 1,
    stepName: "Performance regression",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

function stepFor(fields: VisaFormFieldRow[]): WizardStep {
  return {
    stepNumber: 1,
    stepName: "Performance regression",
    fields: fields.map((candidate, index) => ({ ...candidate, displayOrder: index + 1 })),
  };
}

function renderForm(step: WizardStep, prefill: Record<string, string> = {}) {
  return render(
    <DynamicStepForm
      step={step}
      prefill={prefill}
      onComplete={vi.fn()}
      onDraftChange={vi.fn()}
      visaType="DS160"
    />,
  );
}

function getControl(container: HTMLElement, fieldName: string): HTMLInputElement | HTMLTextAreaElement {
  const control = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-field-name="${fieldName}"] input:not([type="radio"]):not([type="checkbox"]), [data-field-name="${fieldName}"] textarea`,
  );
  expect(control).toBeTruthy();
  return control!;
}

function rect(height: number): DOMRect {
  return {
    bottom: height,
    height,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

afterEach(() => {
  vi.restoreAllMocks();
  mockLocale = "zh";
});

describe("DynamicStepForm performance boundaries", () => {
  it("does not read form geometry for ordinary text input", () => {
    const geometrySpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(rect(500));
    const { container } = renderForm(stepFor([
      field({ fieldName: "surname", label: "Surname" }),
      field({ fieldName: "given_name", label: "Given name" }),
    ]));

    geometrySpy.mockClear();
    fireEvent.change(getControl(container, "surname"), { target: { value: "Chen" } });

    expect(geometrySpy).not.toHaveBeenCalled();
  });

  it("keeps the scroll offset when a conditional branch collapses", async () => {
    let scrollY = 600;
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    const geometrySpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.scrollHeightContent !== "true") return rect(0);
        return rect(this.querySelector('[data-field-name="details"]') ? 1000 : 500);
      });
    const { container } = renderForm(stepFor([
      field({ fieldName: "show_details", label: "Show details" }),
      field({
        fieldName: "details",
        label: "Details",
        conditionalLogic: { showIf: "show_details === yes" },
      }),
    ]));

    geometrySpy.mockClear();
    scrollTo.mockClear();
    const controller = getControl(container, "show_details");
    fireEvent.change(controller, { target: { value: "yes" } });
    await waitFor(() => expect(container.querySelector('[data-field-name="details"]')).toBeTruthy());

    scrollY = 600;
    fireEvent.change(controller, { target: { value: "" } });
    await waitFor(() => expect(container.querySelector('[data-field-name="details"]')).toBeNull());

    expect(geometrySpy).toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: "auto" });
  });

  it("resolves exact cross-field dates before aliases and refreshes the lookup after edits", () => {
    const { container } = renderForm(
      stepFor([
        field({ fieldName: "passport_issue_date", fieldType: "date", validationRules: { allow_year_only: true } }),
        field({ fieldName: "profile_passport_issue_date", fieldType: "date", validationRules: { allow_year_only: true } }),
        field({ fieldName: "passport_expiry_date", fieldType: "date", validationRules: { allow_year_only: true } }),
      ]),
      {
        passport_issue_date: "2024",
        profile_passport_issue_date: "2026",
        passport_expiry_date: "2025",
      },
    );

    const expiry = () => container.querySelector('[data-field-name="passport_expiry_date"]');
    expect(expiry()).toHaveAttribute("data-field-warning", "false");

    // With the exact key cleared, the prefixed alias is the fallback answer.
    fireEvent.change(getControl(container, "passport_issue_date"), { target: { value: "" } });
    expect(expiry()).toHaveAttribute("data-field-warning", "true");

    // A new values object must get a fresh index; the old alias result cannot
    // remain cached after the edited field changes.
    fireEvent.change(getControl(container, "profile_passport_issue_date"), { target: { value: "2024" } });
    expect(expiry()).toHaveAttribute("data-field-warning", "false");
  });

  it("validates a selected value against the active dependent options", () => {
    const { container } = renderForm(
      stepFor([
        field({
          fieldName: "province",
          fieldType: "select",
          options: [{ value: "north", text: "North" }],
        }),
        field({
          fieldName: "district",
          fieldType: "select",
          validationRules: {
            dependent_on: "province",
            dependent_options: {
              north: [{ value: "north-1", text: "North District" }],
            },
          },
        }),
      ]),
      { province: "north", district: "stale-district" },
    );

    expect(container.querySelector('[data-field-name="district"]'))
      .toHaveAttribute("data-field-warning", "true");
  });

  it("keeps repeated cross-field lookups within the matching instance suffix", () => {
    const repeatRules = { repeatable: true, repeat_group: "documents", max_items: 2 };
    const { container } = renderForm(
      stepFor([
        field({ fieldName: "profile_passport_issue_date", fieldType: "date", validationRules: { ...repeatRules, allow_year_only: true } }),
        field({ fieldName: "passport_expiry_date", fieldType: "date", validationRules: { ...repeatRules, allow_year_only: true } }),
      ]),
      {
        profile_passport_issue_date: "2024",
        profile_passport_issue_date__2: "2026",
        passport_expiry_date: "2025",
        passport_expiry_date__2: "2025",
      },
    );

    expect(container.querySelector('[data-field-name="passport_expiry_date"]'))
      .toHaveAttribute("data-field-warning", "false");
    expect(container.querySelector('[data-field-name="passport_expiry_date__2"]'))
      .toHaveAttribute("data-field-warning", "true");
  });
});
