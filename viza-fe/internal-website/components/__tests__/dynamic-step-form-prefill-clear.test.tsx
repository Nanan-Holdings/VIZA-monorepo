import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  convertSimplifiedToTraditional: async (value: string) => value.replaceAll("汉", "漢").replaceAll("语", "語"),
}));

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: `field-${overrides.fieldName ?? "tw-field"}`,
    visaType: "TW_ENTRY_PERMIT",
    fieldName: "name_english",
    label: "English name",
    fieldType: "text",
    required: false,
    stepNumber: 1,
    stepName: "Taiwan prefill clear",
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
    stepName: "Taiwan prefill clear",
    fields: fields.map((candidate, index) => ({ ...candidate, displayOrder: index + 1 })),
  };
}

function renderTaiwanForm(step: WizardStep, prefill: Record<string, string>) {
  return render(
    <DynamicStepForm
      step={step}
      prefill={prefill}
      onComplete={vi.fn()}
      onDraftChange={vi.fn()}
      country="taiwan"
      visaType="TW_ENTRY_PERMIT"
    />,
  );
}

function getControl(container: HTMLElement, fieldName: string): HTMLInputElement | HTMLTextAreaElement {
  const control = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-field-name="${fieldName}"] input, [data-field-name="${fieldName}"] textarea`,
  );
  expect(control).toBeTruthy();
  return control!;
}

function valueFor(container: HTMLElement, fieldName: string): string {
  return getControl(container, fieldName).value;
}

function changeValue(container: HTMLElement, fieldName: string, value: string) {
  const control = getControl(container, fieldName);
  fireEvent.change(control, { target: { value } });
  return control;
}

describe("DynamicStepForm prefill clear protection", () => {
  it("keeps a cleared name_chinese empty across rerenders with the same prefill", () => {
    mockLocale = "zh";
    const step = stepFor([
      field({ fieldName: "name_chinese", label: "Chinese name" }),
    ]);
    const prefill = { name_chinese: "Junji" };
    const { container, rerender } = renderTaiwanForm(step, prefill);

    expect(valueFor(container, "name_chinese")).toBe("Junji");
    changeValue(container, "name_chinese", "");
    expect(valueFor(container, "name_chinese")).toBe("");

    rerender(
      <DynamicStepForm
        step={step}
        prefill={prefill}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(valueFor(container, "name_chinese")).toBe("");
  });

  it("keeps a cleared name_english empty across rerenders with a same-content new prefill object", () => {
    mockLocale = "zh";
    const step = stepFor([
      field({ fieldName: "name_english", label: "English name" }),
    ]);
    const { container, rerender } = renderTaiwanForm(step, { name_english: "Ran" });

    expect(valueFor(container, "name_english")).toBe("Ran");
    changeValue(container, "name_english", "");
    expect(valueFor(container, "name_english")).toBe("");

    rerender(
      <DynamicStepForm
        step={step}
        prefill={{ name_english: "Ran" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(valueFor(container, "name_english")).toBe("");
  });

  it("keeps ordinary clearable input fields empty across same-content prefill rerenders", () => {
    mockLocale = "zh";
    const step = stepFor([
      field({ fieldName: "nickname", label: "Nickname", fieldType: "text" }),
      field({ fieldName: "overseas_address", label: "Overseas address", fieldType: "textarea" }),
      field({ fieldName: "tw_contact_mobile", label: "Mobile phone", fieldType: "tel" as VisaFormFieldRow["fieldType"] }),
    ]);
    const prefill = {
      nickname: "Old nickname",
      overseas_address: "Old address",
      tw_contact_mobile: "12345678",
    };
    const { container, rerender } = renderTaiwanForm(step, prefill);

    expect(valueFor(container, "nickname")).toBe("Old nickname");
    expect(valueFor(container, "overseas_address")).toBe("Old address");
    expect(valueFor(container, "tw_contact_mobile")).toBe("12345678");

    changeValue(container, "nickname", "");
    changeValue(container, "overseas_address", "");
    changeValue(container, "tw_contact_mobile", "");

    rerender(
      <DynamicStepForm
        step={step}
        prefill={{ ...prefill }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(valueFor(container, "nickname")).toBe("");
    expect(valueFor(container, "overseas_address")).toBe("");
    expect(valueFor(container, "tw_contact_mobile")).toBe("");
  });

  it("accepts a genuinely changed external prefill value but does not overwrite an edited value", () => {
    mockLocale = "zh";
    const step = stepFor([
      field({ fieldName: "nickname", label: "Nickname", fieldType: "text" }),
      field({ fieldName: "other_name", label: "Other name", fieldType: "text" }),
    ]);
    const { container, rerender } = renderTaiwanForm(step, {
      nickname: "Old nickname",
      other_name: "Old other",
    });

    changeValue(container, "nickname", "");
    changeValue(container, "other_name", "User edited");

    rerender(
      <DynamicStepForm
        step={step}
        prefill={{ nickname: "New nickname", other_name: "New other" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(valueFor(container, "nickname")).toBe("New nickname");
    expect(valueFor(container, "other_name")).toBe("User edited");
  });

  it("keeps Taiwan name input formatting for uppercase English and Traditional Chinese blur conversion", async () => {
    mockLocale = "zh";
    const step = stepFor([
      field({ fieldName: "name_english", label: "English name" }),
      field({ fieldName: "name_chinese", label: "Chinese name" }),
    ]);
    const { container } = renderTaiwanForm(step, {});

    changeValue(container, "name_english", "ran li");
    expect(valueFor(container, "name_english")).toBe("RAN LI");

    const chineseName = changeValue(container, "name_chinese", "汉语");
    fireEvent.blur(chineseName);

    await waitFor(() => {
      expect(valueFor(container, "name_chinese")).toBe("漢語");
    });

    expect(screen.getByText("英文姓名（依护照大写拼写）")).toBeInTheDocument();
    expect(screen.getByText("中文姓名（繁体字）")).toBeInTheDocument();
  });
});
