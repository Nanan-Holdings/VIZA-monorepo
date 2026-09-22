import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function usContactTextField(fieldName: string): VisaFormFieldRow {
  return {
    id: fieldName,
    visaType: "DS160",
    fieldName,
    label: fieldName,
    fieldType: "text",
    required: false,
    stepNumber: 13,
    stepName: "US Point of Contact",
    displayOrder: 1,
    placeholder: null,
    validationRules: { allow_do_not_know: true },
    options: null,
    conditionalLogic: null,
  };
}

function usContactRelationshipField(): VisaFormFieldRow {
  return {
    id: "us_contact_relationship",
    visaType: "DS160",
    fieldName: "us_contact_relationship",
    label: "美国联系人关系",
    fieldType: "select",
    required: true,
    stepNumber: 13,
    stepName: "US Point of Contact",
    displayOrder: 4,
    placeholder: null,
    validationRules: null,
    options: [
      { value: "R", text: "RELATIVE" },
      { value: "S", text: "SPOUSE" },
      { value: "C", text: "FRIEND" },
      { value: "B", text: "BUSINESS ASSOCIATE" },
      { value: "P", text: "EMPLOYER" },
      { value: "H", text: "SCHOOL OFFICIAL" },
      { value: "O", text: "OTHER" },
    ],
    conditionalLogic: null,
  };
}

function immediateRelativeRelationshipField(): VisaFormFieldRow {
  return {
    id: "us_relative_relationship",
    visaType: "DS160",
    fieldName: "us_relative_relationship",
    label: "美国直系亲属关系",
    fieldType: "select",
    required: false,
    stepNumber: 8,
    stepName: "Family Information: Relatives",
    displayOrder: 14,
    placeholder: null,
    validationRules: { repeatable: true, repeat_group: "us_relatives" },
    options: [
      { value: "SPOUSE", text: "SPOUSE" },
      { value: "FIANCE", text: "FIANCÉ/FIANCÉE" },
      { value: "CHILD", text: "CHILD" },
      { value: "SIBLING", text: "SIBLING" },
    ],
    conditionalLogic: null,
  };
}

function preparerTextField(
  fieldName: string,
  validationRules: Record<string, unknown> | null = null,
): VisaFormFieldRow {
  return {
    id: fieldName,
    visaType: "DS160",
    fieldName,
    label: fieldName,
    fieldType: "text",
    required: true,
    stepNumber: 22,
    stepName: "Sign and Submit",
    displayOrder: 1,
    placeholder: null,
    validationRules,
    options: null,
    conditionalLogic: { showIf: "ds160_preparer_assistance === yes" },
  };
}

function formerSpouseField(fieldName: string, overrides: Partial<VisaFormFieldRow> = {}): VisaFormFieldRow {
  return {
    id: fieldName,
    visaType: "DS160",
    fieldName,
    label: fieldName,
    fieldType: "text",
    required: false,
    stepNumber: 12,
    stepName: "Family Information: Former Spouse",
    displayOrder: 2,
    placeholder: null,
    validationRules: { repeatable: true, repeat_group: "former_spouses" },
    options: null,
    conditionalLogic: { showIf: "marital_status === divorced" },
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
  it("hides compatibility-only fields without dropping their saved draft values", async () => {
    const canonical = usContactTextField("secondary_phone");
    canonical.required = true;
    const legacy = usContactTextField("mobile_phone");
    legacy.label = "Legacy mobile phone";
    legacy.required = true;
    legacy.validationRules = { legacy_compatibility_only: true };
    const onDraftChange = vi.fn();

    render(
      <DynamicStepForm
        step={{ stepNumber: 1, stepName: "Address and Phone", fields: [canonical, legacy] }}
        prefill={{ secondary_phone: "canonical-value", mobile_phone: "historical-value" }}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        visaType="DS160"
      />,
    );

    expect(screen.queryByText("Legacy mobile phone")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(onDraftChange.mock.calls.some(([patch]) => (
        patch.mobile_phone === "historical-value" &&
        patch.secondary_phone === "canonical-value"
      ))).toBe(true);
    });
  });

  it("keeps required empty dates invalid", () => {
    const field = dateField();
    const step: WizardStep = { stepNumber: 1, stepName: "家庭信息", fields: [field] };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
        invalidFieldNames={new Set([field.fieldName])}
      />,
    );

    expect(container.querySelector('[data-field-name="father_date_of_birth"]'))
      .toHaveAttribute("data-validation-invalid", "true");
    expect(screen.getByText("父亲的出生日期")).toBeInTheDocument();
  });

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

  it("accepts month precision in Chinese mode and keeps the partial value canonical", async () => {
    const field = dateField({
      fieldName: "intended_arrival_date",
      id: "intended-arrival-date",
      label: "计划抵达日期",
      validationRules: { minimum_date_precision: "month" },
    });
    const { container, onDraftChange } = renderDateField(field, {
      intended_arrival_date: "2026-11",
    });

    expect(container.querySelector('[data-field-name="intended_arrival_date"]'))
      .toHaveAttribute("data-field-warning", "false");
    expect(screen.getByRole("radio", { name: "只知道年月" })).toBeChecked();
    const input = screen.getByRole("textbox", { name: "请输入年份和月份（日期未知）" });
    expect(input).toHaveValue("2026-11");

    fireEvent.change(input, { target: { value: "202612" } });
    await waitFor(() => {
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ intended_arrival_date: "2026-12" }));
    });
  });

  it("validates partial dates independently for repeated rows", () => {
    const repeatRules = {
      minimum_date_precision: "month",
      repeatable: true,
      repeat_group: "travel_dates",
      max_items: 2,
    };
    const field = dateField({
      fieldName: "planned_arrival_date",
      id: "planned-arrival-date",
      label: "计划抵达日期",
      validationRules: repeatRules,
    });
    const step: WizardStep = { stepNumber: 1, stepName: "行程信息", fields: [field] };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{ planned_arrival_date: "2026-11", planned_arrival_date__2: "2026-13" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(container.querySelector('[data-field-name="planned_arrival_date"]'))
      .toHaveAttribute("data-field-warning", "false");
    expect(container.querySelector('[data-field-name="planned_arrival_date__2"]'))
      .toHaveAttribute("data-field-warning", "true");
  });

  it("applies birth-year limits while allowing year precision", () => {
    const futureYear = String(new Date().getFullYear() + 1);
    const field = dateField({
      fieldName: "father_date_of_birth",
      validationRules: { minimum_date_precision: "year" },
    });
    const { container } = renderDateField(field, { father_date_of_birth: futureYear });

    expect(container.querySelector('[data-field-name="father_date_of_birth"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(screen.getByText("出生年份不能晚于今年")).toBeInTheDocument();
  });

  it("keeps U.S. contact unknown-name and unknown-organization branches atomic and reversible", async () => {
    const fields = [
      usContactTextField("us_contact_surname"),
      usContactTextField("us_contact_given_names"),
      usContactTextField("us_contact_organization"),
    ];
    const step: WizardStep = { stepNumber: 13, stepName: "US Point of Contact", fields };
    const onDraftChange = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          us_contact_surname: "SMITH",
          us_contact_given_names: "JOHN",
          us_contact_organization: "HOTEL",
        }}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        visaType="DS160"
      />,
    );

    const surnameRoot = container.querySelector('[data-field-name="us_contact_surname"]');
    expect(surnameRoot).not.toBeNull();
    fireEvent.click(within(surnameRoot as HTMLElement).getAllByRole("checkbox", { name: "不知道" })[0]);

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
        us_contact_surname: "DO_NOT_KNOW",
        us_contact_given_names: "DO_NOT_KNOW",
        us_contact_organization: "HOTEL",
      }));
    });

    const organizationRoot = container.querySelector('[data-field-name="us_contact_organization"]');
    expect(organizationRoot).not.toBeNull();
    fireEvent.click(within(organizationRoot as HTMLElement).getAllByRole("checkbox", { name: "不知道" })[0]);
    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
        us_contact_surname: "SMITH",
        us_contact_given_names: "JOHN",
        us_contact_organization: "DO_NOT_KNOW",
      }));
    });

    fireEvent.click(within(organizationRoot as HTMLElement).getAllByRole("checkbox", { name: "不知道" })[0]);
    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
        us_contact_surname: "SMITH",
        us_contact_given_names: "JOHN",
        us_contact_organization: "HOTEL",
      }));
    });
  });

  it("keeps Sign preparer name and organization N/A branches atomic and reversible", async () => {
    const fields = [
      preparerTextField("ds160_preparer_assistance", null),
      preparerTextField("ds160_preparer_surname"),
      preparerTextField("ds160_preparer_given_names", { has_does_not_apply: true }),
      preparerTextField("ds160_preparer_organization_name", { has_does_not_apply: true }),
    ].map((field, index) => ({ ...field, fieldType: index === 0 ? "radio" as const : field.fieldType,
      options: index === 0 ? [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }] : field.options,
      required: index === 0 ? true : field.required,
      conditionalLogic: index === 0 ? null : field.conditionalLogic,
    }));
    const step: WizardStep = { stepNumber: 22, stepName: "Sign and Submit", fields };
    const onDraftChange = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          ds160_preparer_assistance: "yes",
          ds160_preparer_surname: "ZHANG",
          ds160_preparer_given_names: "XIAOMING",
          ds160_preparer_organization_name: "AGENCY",
        }}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        visaType="DS160"
      />,
    );

    const givenRoot = container.querySelector('[data-field-name="ds160_preparer_given_names"]');
    expect(givenRoot).not.toBeNull();
    fireEvent.click(within(givenRoot as HTMLElement).getByRole("checkbox", { name: "不适用" }));
    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
        ds160_preparer_surname: "DOES_NOT_APPLY",
        ds160_preparer_given_names: "DOES_NOT_APPLY",
        ds160_preparer_organization_name: "AGENCY",
      }));
    });

    const organizationRoot = container.querySelector('[data-field-name="ds160_preparer_organization_name"]');
    expect(organizationRoot).not.toBeNull();
    fireEvent.click(within(organizationRoot as HTMLElement).getByRole("checkbox", { name: "不适用" }));
    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
        ds160_preparer_surname: "ZHANG",
        ds160_preparer_given_names: "XIAOMING",
        ds160_preparer_organization_name: "DOES_NOT_APPLY",
      }));
    });

    fireEvent.click(within(organizationRoot as HTMLElement).getByRole("checkbox", { name: "不适用" }));
    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
        ds160_preparer_organization_name: "AGENCY",
      }));
    });
  });

  it("rejects partial or simultaneous Sign preparer N/A name branches", () => {
    const fields = [
      preparerTextField("ds160_preparer_surname"),
      preparerTextField("ds160_preparer_given_names", { has_does_not_apply: true }),
      preparerTextField("ds160_preparer_organization_name", { has_does_not_apply: true }),
    ];
    const step: WizardStep = { stepNumber: 22, stepName: "Sign and Submit", fields };
    const partial = render(
      <DynamicStepForm
        step={step}
        prefill={{
          ds160_preparer_assistance: "yes",
          ds160_preparer_surname: "DOES_NOT_APPLY",
          ds160_preparer_given_names: "XIAOMING",
          ds160_preparer_organization_name: "AGENCY",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );
    expect(screen.getAllByText("填写人姓名的“不适用”必须同时用于姓氏和名字。").length)
      .toBeGreaterThan(0);
    partial.unmount();

    render(
      <DynamicStepForm
        step={step}
        prefill={{
          ds160_preparer_assistance: "yes",
          ds160_preparer_surname: "DOES_NOT_APPLY",
          ds160_preparer_given_names: "DOES_NOT_APPLY",
          ds160_preparer_organization_name: "DOES_NOT_APPLY",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );
    expect(screen.getAllByText("填写人姓名和机构不能同时选择“不适用”，请至少提供其中一项。").length)
      .toBeGreaterThan(0);
  });

  it("flags a prefilled U.S. contact when both name and organization are unknown", () => {
    const fields = [
      usContactTextField("us_contact_surname"),
      usContactTextField("us_contact_given_names"),
      usContactTextField("us_contact_organization"),
    ];
    const step: WizardStep = { stepNumber: 13, stepName: "US Point of Contact", fields };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          us_contact_surname: "DO_NOT_KNOW",
          us_contact_given_names: "DO_NOT_KNOW",
          us_contact_organization: "DO_NOT_KNOW",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(container.querySelector('[data-field-name="us_contact_surname"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(container.querySelector('[data-field-name="us_contact_organization"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(screen.getAllByText("美国联系人姓名和机构不能同时选择“不知道”，请至少提供其中一项。").length)
      .toBeGreaterThan(0);
  });

  it("flags an immediate-relative spouse when the marital branch is incompatible", () => {
    const step: WizardStep = {
      stepNumber: 8,
      stepName: "Family Information: Relatives",
      fields: [immediateRelativeRelationshipField()],
    };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          us_relative_relationship: "SPOUSE",
          marital_status: "C",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(container.querySelector('[data-field-name="us_relative_relationship"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(screen.getAllByText("选择“配偶”作为美国直系亲属关系时，婚姻状况必须为已婚或合法分居。").length)
      .toBeGreaterThan(0);
  });

  it("keeps former-spouse repeat rows within the declared count and blocks mismatches", async () => {
    const fields: VisaFormFieldRow[] = [
      formerSpouseField("number_of_former_spouses", {
        fieldType: "select",
        displayOrder: 1,
        validationRules: null,
        options: [{ value: "1", text: "1" }, { value: "2", text: "2" }],
      }),
      formerSpouseField("former_spouse_surname"),
    ];
    const step: WizardStep = {
      stepNumber: 12,
      stepName: "Family Information: Former Spouse",
      fields,
    };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          marital_status: "divorced",
          number_of_former_spouses: "2",
          former_spouse_surname: "ZHANG",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.getByText("声明的前任配偶人数为 2，但已填写 1 位。请使两者一致。")).toBeInTheDocument();
    expect(container.querySelector("[data-blocking-errors-clear='false']")).not.toBeNull();
    expect(screen.getByRole("button", { name: "addAnother" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "addAnother" }));
    await waitFor(() => {
      expect(container.querySelectorAll('[data-repeat-group-instance="true"]')).toHaveLength(2);
    });
    expect(screen.queryByRole("button", { name: "addAnother" })).not.toBeInTheDocument();
  });

  it("blocks complete duplicate former-spouse identities with the official error", () => {
    const fields: VisaFormFieldRow[] = [
      formerSpouseField("number_of_former_spouses", {
        fieldType: "select",
        displayOrder: 1,
        validationRules: null,
        options: [{ value: "1", text: "1" }, { value: "2", text: "2" }],
      }),
      formerSpouseField("former_spouse_surname"),
      formerSpouseField("former_spouse_given_names"),
      formerSpouseField("former_spouse_date_of_birth", {
        fieldType: "date",
        validationRules: { repeatable: true, repeat_group: "former_spouses", minimum_date_precision: "year" },
      }),
    ];
    const step: WizardStep = {
      stepNumber: 12,
      stepName: "Family Information: Former Spouse",
      fields,
    };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          marital_status: "divorced",
          number_of_former_spouses: "2",
          former_spouse_surname: "ZHANG",
          former_spouse_given_names: "SAN",
          former_spouse_date_of_birth: "1980-01-02",
          former_spouse_surname__2: "ZHANG",
          former_spouse_given_names__2: "SAN",
          former_spouse_date_of_birth__2: "1980-01-02",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.getAllByText("不能输入重复的前配偶").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-blocking-errors-clear='false']")).not.toBeNull();
  });

  it("does not invent a five-row ceiling for an unbounded repeat group", async () => {
    const fields = [formerSpouseField("language_name", {
      id: "language-name",
      label: "语言",
      required: false,
      conditionalLogic: null,
      validationRules: { repeatable: true, repeat_group: "languages" },
    })];
    const step: WizardStep = {
      stepNumber: 15,
      stepName: "Additional Information",
      fields,
    };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{ language_name: "中文" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    const addButton = () => screen.getByRole("button", { name: "addAnother" });
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(addButton());
      await waitFor(() => {
        expect(container.querySelectorAll('[data-repeat-group-instance="true"]')).toHaveLength(index + 2);
      });
    }
    expect(container.querySelectorAll('[data-repeat-group-instance="true"]')).toHaveLength(6);
  });

  it("renders specific travel arrival and departure as one official block", () => {
    const conditional = { showIf: "has_specific_plans === yes" };
    const travelField = (
      fieldName: string,
      fieldType: VisaFormFieldRow["fieldType"],
      required: boolean,
      validationRules: Record<string, unknown> | null,
      displayOrder: number,
    ): VisaFormFieldRow => ({
      id: fieldName,
      visaType: "DS160",
      fieldName,
      label: fieldName,
      fieldType,
      required,
      stepNumber: 3,
      stepName: "Travel Information",
      displayOrder,
      placeholder: null,
      validationRules,
      options: null,
      conditionalLogic: conditional,
    });
    const fields: VisaFormFieldRow[] = [
      {
        ...travelField("has_specific_plans", "radio", true, null, 3),
        options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
        conditionalLogic: null,
      },
      travelField("arrival_date", "date", true, { format: "DD-MMM-YYYY" }, 4),
      travelField("arrival_flight", "text", false, { maxLength: 20 }, 7),
      travelField("arrival_city", "text", true, { maxLength: 20 }, 8),
      travelField("departure_date", "date", true, { format: "DD-MMM-YYYY" }, 9),
      travelField("departure_flight", "text", false, { maxLength: 20 }, 12),
      travelField("departure_city", "text", true, { maxLength: 20 }, 13),
    ];
    const step: WizardStep = { stepNumber: 3, stepName: "Travel Information", fields };

    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{ has_specific_plans: "yes" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.queryByRole("button", { name: "addAnother" })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-repeat-group-instance="true"]')).toHaveLength(0);
  });

  it("honors an explicit repeat-group max while leaving unbounded groups open", async () => {
    const fields = [formerSpouseField("previous_school", {
      id: "previous-school",
      label: "学校",
      required: false,
      conditionalLogic: null,
      validationRules: { repeatable: true, repeat_group: "schools", max_items: 2 },
    })];
    const step: WizardStep = {
      stepNumber: 15,
      stepName: "Additional Information",
      fields,
    };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{ previous_school: "NUS" }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "addAnother" }));
    await waitFor(() => {
      expect(container.querySelectorAll('[data-repeat-group-instance="true"]')).toHaveLength(2);
    });
    expect(screen.queryByRole("button", { name: "addAnother" })).not.toBeInTheDocument();
  });

  it("flags repeated DS-160 purpose categories even when B subtypes differ", () => {
    const repeatRules = { repeatable: true, repeat_group: "trip_purpose" };
    const fields: VisaFormFieldRow[] = [
      {
        ...formerSpouseField("purpose_of_trip", {
          id: "purpose-of-trip",
          label: "赴美目的",
          fieldType: "select",
          required: true,
          conditionalLogic: null,
          validationRules: repeatRules,
          options: [{ value: "B", text: "Business or pleasure (B)" }, { value: "C", text: "Transit (C)" }],
        }),
      },
      {
        ...formerSpouseField("purpose_of_trip_specify", {
          id: "purpose-of-trip-specify",
          label: "具体目的",
          fieldType: "select",
          required: true,
          conditionalLogic: null,
          validationRules: repeatRules,
          options: [{ value: "B1", text: "Business (B1)" }, { value: "B2", text: "Tourism (B2)" }],
        }),
      },
    ];
    const step: WizardStep = { stepNumber: 3, stepName: "Travel Information", fields };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          purpose_of_trip: "B",
          purpose_of_trip_specify: "B1",
          purpose_of_trip__2: "B",
          purpose_of_trip_specify__2: "B2",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.getByText("赴美目的类别不能重复（第 2 项与第 1 项相同）。请选择不同的类别。"))
      .toBeInTheDocument();
    expect(container.querySelector('[data-field-name="purpose_of_trip__2"]'))
      .toHaveAttribute("data-field-warning", "true");
  });

  it("blocks organization-only U.S. contacts from using person-only relationships", () => {
    const step: WizardStep = {
      stepNumber: 13,
      stepName: "US Point of Contact",
      fields: [
        usContactTextField("us_contact_surname"),
        usContactTextField("us_contact_given_names"),
        usContactTextField("us_contact_organization"),
        usContactRelationshipField(),
      ],
    };
    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{
          us_contact_surname: "DO_NOT_KNOW",
          us_contact_given_names: "DO_NOT_KNOW",
          us_contact_organization: "HOTEL",
          us_contact_relationship: "R",
        }}
        onComplete={vi.fn()}
        onDraftChange={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.getByText("仅提供机构名称时，关系不能选择亲属、配偶或朋友。请提供联系人姓名，或选择其他关系。"))
      .toBeInTheDocument();
    expect(container.querySelector('[data-field-name="us_contact_relationship"]'))
      .toHaveAttribute("data-field-warning", "true");
    expect(container.querySelector("[data-blocking-errors-clear='false']")).not.toBeNull();
  });
});
