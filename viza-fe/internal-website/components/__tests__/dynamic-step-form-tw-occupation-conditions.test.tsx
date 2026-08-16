import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import { normalizeBilingualFormField } from "@/lib/bilingual-schema-contract";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: overrides.fieldName ?? "tw-field",
    visaType: "TW_ENTRY_PERMIT",
    fieldName: "current_occupation",
    label: "现职",
    fieldType: "select",
    required: true,
    stepNumber: 2,
    stepName: "Applicant Identity",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

function step(): WizardStep {
  return {
    stepNumber: 2,
    stepName: "Applicant Identity",
    fields: [
      field({
        fieldName: "current_occupation",
        label: "现职",
        fieldType: "select",
        options: [
          { value: "14", text: "学生", label_zh: "学生" },
          { value: "52", text: "职员", label_zh: "职员" },
          { value: "61", text: "待业", label_zh: "待业" },
          { value: "62", text: "退休", label_zh: "退休" },
        ],
      }),
      field({
        fieldName: "company_name",
        label: "公司名称及单位全衔或学校名称",
        fieldType: "text",
        required: true,
        displayOrder: 2,
        conditionalLogic: { showIf: "current_occupation not in [61,62]" },
        validationRules: { required_when: "current_occupation not in [61,62]" },
      }),
      field({
        fieldName: "job_title",
        label: "职称",
        fieldType: "text",
        required: true,
        displayOrder: 3,
        conditionalLogic: { showIf: "current_occupation not in [14,61,62]" },
        validationRules: { required_when: "current_occupation not in [14,61,62]" },
      }),
    ],
  };
}

function renderOccupationStep(initialOccupation: string) {
  return render(
    <DynamicStepForm
      step={step()}
      prefill={{ current_occupation: initialOccupation }}
      onComplete={vi.fn()}
      country="taiwan"
      visaType="TW_ENTRY_PERMIT"
    />,
  );
}

function expectCompanyVisible(visible: boolean) {
  const assertion = expect(screen.queryByText("公司名称及单位全衔或学校名称"));
  visible ? assertion.toBeInTheDocument() : assertion.not.toBeInTheDocument();
}

function expectTitleVisible(visible: boolean) {
  const assertion = expect(screen.queryByText("职称"));
  visible ? assertion.toBeInTheDocument() : assertion.not.toBeInTheDocument();
}

describe("DynamicStepForm Taiwan occupation conditions", () => {
  it("shows company but hides title for students without maximum update depth errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderOccupationStep("14");

    expectCompanyVisible(true);
    expectTitleVisible(false);
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("Maximum update depth exceeded"));
  });

  it("hides company and title for retired and unemployed, but requires both for ordinary occupations", () => {
    const { rerender } = renderOccupationStep("62");

    expectCompanyVisible(false);
    expectTitleVisible(false);

    rerender(
      <DynamicStepForm
        step={step()}
        prefill={{ current_occupation: "61" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );
    expectCompanyVisible(false);
    expectTitleVisible(false);

    rerender(
      <DynamicStepForm
        step={step()}
        prefill={{ current_occupation: "52" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );
    expectCompanyVisible(true);
    expectTitleVisible(true);
    expect(screen.queryByText("必填项")).not.toBeInTheDocument();
    expect(screen.getByText("公司名称及单位全衔或学校名称").parentElement).toHaveTextContent("*");
    expect(screen.getByText("职称").parentElement).toHaveTextContent("*");
    expect(screen.getByPlaceholderText("请填写公司名称及单位全衔或学校名称")).toBeRequired();
    expect(screen.getByPlaceholderText("请填写职称")).toBeRequired();
  });

  it("updates occupation visibility after the official occupation code changes", async () => {
    renderOccupationStep("52");
    expectCompanyVisible(true);
    expectTitleVisible(true);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "学生" }));
    expectCompanyVisible(true);
    await waitFor(() => expectTitleVisible(false));

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "退休" }));
    await waitFor(() => {
      expectCompanyVisible(false);
      expectTitleVisible(false);
    });
  });

  it("renders Taiwan contact city and district options in Simplified Chinese without changing canonical values", () => {
    const addressStep: WizardStep = {
      stepNumber: 3,
      stepName: "Taiwan contact address",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_city",
          label: "City/County",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: null,
        })),
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_district",
          label: "District/township",
          fieldType: "text",
          required: false,
          displayOrder: 2,
          options: null,
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={addressStep}
        prefill={{ tw_contact_city: "1" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.getByRole("button", { name: "台北市" })).toBeInTheDocument();
    expect(screen.queryByText("臺北市")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /请选择/u }));
    expect(screen.getByRole("button", { name: "中山区" })).toBeInTheDocument();
    expect(screen.queryByText("中山區")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "中山区" }));

    fireEvent.click(screen.getByRole("button", { name: "台北市" }));
    expect(screen.getByRole("button", { name: "高雄市" })).toBeInTheDocument();
    expect(screen.queryByText("臺北市")).not.toBeInTheDocument();
  });
});
