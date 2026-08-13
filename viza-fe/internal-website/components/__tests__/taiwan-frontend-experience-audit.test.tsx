import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TwResultCard } from "@/app/client/application/_components/result-cards/TwResultCard";
import { DynamicFormField } from "@/components/dynamic-form-field";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import { twConfig, twDeliveryLocationTestHooks, type TwForm } from "@/components/client/wizards/tw/config";
import { normalizeBilingualFormField } from "@/lib/bilingual-schema-contract";
import type { TwSubmissionResult } from "@/lib/submission-result";
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

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: overrides.fieldName ?? "tw-field",
    visaType: "TW_ENTRY_PERMIT",
    fieldName: "name_english",
    label: "English name",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Taiwan audit",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

function ControlledDynamicFormField({ testField }: { testField: VisaFormFieldRow }) {
  const [value, setValue] = useState("");
  return (
    <>
      <DynamicFormField field={testField} value={value} onChange={setValue} displayLocale="zh" />
      <output data-testid="stored-value">{value}</output>
    </>
  );
}

function ControlledTwDeliveryStep({ initialForm = {} }: { initialForm?: TwForm }) {
  const [form, setForm] = useState<TwForm>(initialForm);
  const step = twConfig.steps.find((candidate) => candidate.key === "delivery_location");
  if (!step) return null;
  return (
    <>
      {step.render({
        form,
        setForm,
        applicationId: null,
        onContinue: vi.fn(),
        onBack: vi.fn(),
        onSubmit: vi.fn(),
        submitting: false,
        goToStep: vi.fn(),
      })}
      <output data-testid="tw-form-state">{JSON.stringify(form)}</output>
    </>
  );
}

describe("Taiwan frontend experience audit", () => {
  it("keeps TW_ENTRY_PERMIT on the dynamic form single-column Chinese render path", () => {
    mockLocale = "zh";
    const onComplete = vi.fn();
    const step: WizardStep = {
      stepNumber: 1,
      stepName: "Applicant identity",
      fields: [
        field({
          fieldName: "name_english",
          label: "English name",
          placeholder: "Name as shown in passport",
        }),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={onComplete}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.getByText("英文姓名（依护照大写拼写）")).toBeInTheDocument();
    expect(screen.queryByText("English name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Name as shown in passport")).not.toBeInTheDocument();
  });

  it("uppercases Taiwan English names and converts Chinese names to Traditional on blur", async () => {
    mockLocale = "zh";

    const { rerender } = render(
      <ControlledDynamicFormField
        testField={field({
          fieldName: "name_english",
          label: "English name",
        })}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "zhang san" } });
    expect(screen.getByTestId("stored-value")).toHaveTextContent("ZHANG SAN");

    rerender(
      <ControlledDynamicFormField
        testField={field({
          fieldName: "name_chinese",
          label: "Chinese name",
        })}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "汉语" } });
    fireEvent.blur(screen.getByRole("textbox"));

    await waitFor(() => {
      expect(screen.getByTestId("stored-value")).toHaveTextContent("漢語");
    });
  });

  it("keeps Taiwan conditional fields and review sections aligned with visible answers", () => {
    const basicStep = twConfig.steps.find((step) => step.key === "basic_status");
    const otherNationalityStep = twConfig.steps.find((step) => step.key === "other_nationality");
    const identitySection = twConfig.reviewSections({
      mainland_id_number_not_applicable: "yes",
      birth_place_is_mainland: "other",
      current_occupation: "62",
      has_other_nationality_passport: "yes",
    }).find((section) => section.editStepKey === "identity");
    const otherNationalitySection = twConfig.reviewSections({
      has_other_nationality_passport: "yes",
    }).find((section) => section.editStepKey === "other_nationality");

    expect(basicStep).toBeDefined();
    expect(otherNationalityStep?.showIf?.({ has_other_nationality_passport: "yes" })).toBe(true);
    expect(otherNationalityStep?.showIf?.({ has_other_nationality_passport: "no" })).toBe(false);
    expect(identitySection?.rows.map((row) => row.labelKey)).toContain("literal:出生国家/地区");
    expect(identitySection?.rows.map((row) => row.labelKey)).toContain("literal:经历");
    expect(identitySection?.rows.map((row) => row.labelKey)).not.toContain("literal:大陆身份证号码");
    expect(otherNationalitySection?.rows.map((row) => row.labelKey)).toContain("literal:他国护（证）照号码");
    expect(twConfig.reviewSections({ eligibility_category: "1", embassy_office: "53" })[1].rows.map((row) => row.labelKey))
      .not.toContain("literal:目前户口登记状态");
    expect(twConfig.reviewSections({ eligibility_category: "2", embassy_office: "50" })[1].rows.map((row) => row.labelKey))
      .toContain("literal:目前户口登记状态");
  });

  it("filters Taiwan receiving offices by selected continent in the simplified wizard", () => {
    const embassyOptionsFor = (continent: string) => {
      const embassyField = twDeliveryLocationTestHooks.deliveryFields({ continent })
        .find((candidate) => candidate.kind === "select" && candidate.key === "embassy_office");
      return embassyField?.kind === "select" ? embassyField.options.map((option) => option.value) : [];
    };

    expect(embassyOptionsFor("A")).toEqual(["50", "51", "5A", "5C", "5F", "55", "56", "53", "52", "67", "57", "58", "66", "54"]);
    expect(embassyOptionsFor("B")).toEqual(["6A", "6B", "60", "61", "62", "64", "65", "70"]);
    expect(embassyOptionsFor("C")).toEqual(["GP", "72", "63"]);
    expect(embassyOptionsFor("D")).toEqual(["71"]);
    expect(embassyOptionsFor("E")).toEqual(["73", "74"]);
    expect(embassyOptionsFor("B")).not.toContain("72");

    expect(twDeliveryLocationTestHooks.normalizeDeliveryLocationChange(
      { continent: "B", embassy_office: "60" },
      { continent: "C", embassy_office: "60" },
    )).toMatchObject({ continent: "C", embassy_office: "" });
  });

  it("keeps Taiwan required and optional contact contracts aligned with the audited official form", () => {
    const contactSection = twConfig.reviewSections({
      tw_contact_mobile_not_applicable: "yes",
    }).find((section) => section.editStepKey === "tw_contact");
    const contactWithMobileSection = twConfig.reviewSections({
      tw_contact_mobile_not_applicable: "no",
    }).find((section) => section.editStepKey === "tw_contact");
    const identitySection = twConfig.reviewSections({
      current_occupation: "1",
    }).find((section) => section.editStepKey === "identity");
    const identityWithExperienceSection = twConfig.reviewSections({
      current_occupation: "62",
    }).find((section) => section.editStepKey === "identity");
    const identityWithFreelanceSection = twConfig.reviewSections({
      current_occupation: "15",
    }).find((section) => section.editStepKey === "identity");

    const contactLabels = contactSection?.rows.map((row) => row.labelKey) ?? [];
    expect(contactLabels).toEqual(expect.arrayContaining([
      "literal:县市",
      "literal:街、路段",
      "literal:门牌号/楼/室（住饭店请填饭店名称）",
      "literal:乡镇市区",
      "literal:村/里（非必填）",
      "literal:邻(仅填数字)",
      "literal:巷(仅填数字)",
      "literal:弄(仅填数字)",
      "literal:在台联络电话",
      "literal:无在台联络手机号码",
    ]));
    expect(contactLabels).not.toContain("literal:在台联络手机号码");
    expect(contactWithMobileSection?.rows.map((row) => row.labelKey)).toContain("literal:在台联络手机号码");

    const identityLabels = identitySection?.rows.map((row) => row.labelKey) ?? [];
    expect(identityLabels).toContain("literal:公司名称及单位全衔或学校名称");
    expect(identityLabels).toContain("literal:职称");
    expect(identityLabels).not.toContain("literal:经历");
    expect(identityWithExperienceSection?.rows.map((row) => row.labelKey)).toContain("literal:经历");
    expect(identityWithFreelanceSection?.rows.map((row) => row.labelKey)).not.toContain("literal:经历");
  });

  it("renders mainland ID number as required when the no-ID exemption is not checked", () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 2,
      stepName: "Applicant identity",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "mainland_id_number_not_applicable",
          label: "No mainland ID number",
          fieldType: "checkbox",
          required: false,
          displayOrder: 1,
        })),
        normalizeBilingualFormField(field({
          fieldName: "mainland_id_number",
          label: "Mainland ID number",
          fieldType: "text",
          required: false,
          displayOrder: 2,
          conditionalLogic: { showIf: "mainland_id_number_not_applicable === false" },
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    const mainlandIdLabel = screen.getByText("大陆身份证号码");
    expect(mainlandIdLabel).toBeInTheDocument();
    expect(mainlandIdLabel).toHaveTextContent("*");
    expect(screen.getByRole("button", { name: "continue" }))
      .toHaveAttribute("data-required-filled", "false");
    expect(screen.queryByText("选填")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /无大陆身份证号码/u }));

    expect(screen.queryByText("大陆身份证号码")).not.toBeInTheDocument();
  });

  it("renders Taiwan company name and job title as required even if stale DB rows mark them optional", () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 2,
      stepName: "Applicant identity",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "company_name",
          label: "Company name and full organization/unit name or school name",
          required: false,
          displayOrder: 1,
        })),
        normalizeBilingualFormField(field({
          fieldName: "job_title",
          label: "Job title",
          required: false,
          displayOrder: 2,
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.getByText("公司名称及单位全衔或学校名称")).toHaveTextContent("*");
    expect(screen.getByText("职称")).toHaveTextContent("*");
    expect(screen.queryByText("选填")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "continue" }))
      .toHaveAttribute("data-required-filled", "false");
  });

  it("renders Taiwan city and district as linked dropdowns", () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 3,
      stepName: "Taiwan contact address",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_city",
          label: "City/County",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: [{ value: "16", text: "高雄市" }],
        })),
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_district",
          label: "District/township",
          fieldType: "text",
          required: false,
          displayOrder: 2,
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{ tw_contact_city: "16" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /请选择/u }));
    expect(screen.getByText("新兴区")).toBeInTheDocument();
    expect(screen.getByText("前金区")).toBeInTheDocument();
    expect(screen.getByText("苓雅区")).toBeInTheDocument();
    expect(screen.getByText("盐埕区")).toBeInTheDocument();
    expect(screen.queryByText("中正区")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "新兴区" }));

    fireEvent.click(screen.getByRole("button", { name: /高雄市/u }));
    fireEvent.click(screen.getByRole("button", { name: "台北市" }));

    fireEvent.click(screen.getByRole("button", { name: /请选择/u }));
    expect(screen.getByText("中正区")).toBeInTheDocument();
    expect(screen.queryByText("新兴区")).not.toBeInTheDocument();
  });

  it("shows the hotel address guidance only on the Taiwan contact address step", () => {
    mockLocale = "zh";
    const notice = "可填写在台住宿酒店的地址；即使尚未预订酒店，也可以先填写预计入住的酒店地址。没有在台个人联系电话时，可将酒店电话填写在‘在台市内电话’。";
    const contactStep: WizardStep = {
      stepNumber: 3,
      stepName: "Taiwan Contact Address",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_city",
          label: "City/County",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: [{ value: "16", text: "高雄市" }],
        })),
      ],
    };
    const otherTaiwanStep: WizardStep = {
      ...contactStep,
      stepName: "Applicant Identity",
    };

    const { rerender } = render(
      <DynamicStepForm
        step={contactStep}
        prefill={{}}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );
    expect(screen.getByText(notice)).toBeInTheDocument();

    rerender(
      <DynamicStepForm
        step={otherTaiwanStep}
        prefill={{}}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );
    expect(screen.queryByText(notice)).not.toBeInTheDocument();

    rerender(
      <DynamicStepForm
        step={contactStep}
        prefill={{}}
        onComplete={vi.fn()}
        country="vietnam"
        visaType="VN_E_VISA"
      />,
    );
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
  });

  it("does not loop when Taiwan dependent select options rerender with the same value", () => {
    mockLocale = "zh";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const step: WizardStep = {
      stepNumber: 3,
      stepName: "Taiwan contact address",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_city",
          label: "City/County",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: [
            { value: "16", text: "高雄市" },
            { value: "01", text: "臺北市" },
          ],
        })),
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_district",
          label: "District/township",
          fieldType: "select",
          required: true,
          displayOrder: 2,
          validationRules: {
            dependent_on: "tw_contact_city",
            dependent_options_key: "taiwan_districts_by_city",
          },
          options: [],
        })),
      ],
    };

    const { rerender } = render(
      <DynamicStepForm
        step={step}
        prefill={{ tw_contact_city: "16", tw_contact_district: "新興區" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    rerender(
      <DynamicStepForm
        step={step}
        prefill={{ tw_contact_city: "16", tw_contact_district: "新興區" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /新兴区/u }));
    expect(screen.getByText("前金区")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("Maximum update depth exceeded"),
    );
    consoleError.mockRestore();
  });

  it("does not loop across Taiwan birthplace primary and branch selects", async () => {
    mockLocale = "zh";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mainlandRegionOptions = [
      "湖南", "湖北", "四川", "上海", "南京", "漢口", "重慶",
      "山東", "山西", "河南", "河北", "陝西", "甘肅",
    ].map((label) => ({ value: label, text: label, label_zh: label }));
    const nationalityOptions = [
      { value: "13", text: "日本", label_zh: "日本" },
      { value: "27", text: "新加坡", label_zh: "新加坡" },
      { value: "994", text: "無國籍-依1954年無國籍人士公約", label_zh: "無國籍-依1954年無國籍人士公約" },
      { value: "995", text: "難民-依1954年難民公約所定義", label_zh: "難民-依1954年難民公約所定義" },
      { value: "996", text: "難民-非依1954年難民公約所定義", label_zh: "難民-非依1954年難民公約所定義" },
      { value: "997", text: "無國籍-不屬於代碼994、995及996者", label_zh: "無國籍-不屬於代碼994、995及996者" },
      { value: "999", text: "無國籍", label_zh: "無國籍" },
      ...Array.from({ length: 6 }, (_, index) => ({
        value: String(100 + index),
        text: `国家${index}`,
        label_zh: `国家${index}`,
      })),
    ];
    const step: WizardStep = {
      stepNumber: 2,
      stepName: "Applicant Identity",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "birth_place_is_mainland",
          label: "Place of birth (same as travel document held)",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: [
            { value: "mainland", text: "Mainland China", label_zh: "中國大陸" },
            { value: "other", text: "Other", label_zh: "其他" },
          ],
        })),
        normalizeBilingualFormField(field({
          fieldName: "birth_place_mainland_region",
          label: "Mainland China birth province/city/region",
          fieldType: "select",
          required: true,
          displayOrder: 2,
          options: mainlandRegionOptions,
          conditionalLogic: { showIf: "birth_place_is_mainland === mainland" },
        })),
        normalizeBilingualFormField(field({
          fieldName: "birth_place_other_country",
          label: "Country/region of birth",
          fieldType: "select",
          required: true,
          displayOrder: 3,
          options: nationalityOptions,
          conditionalLogic: { showIf: "birth_place_is_mainland === other" },
        })),
      ],
    };

    const { rerender } = render(
      <DynamicStepForm
        step={step}
        prefill={{ birth_place_is_mainland: "mainland", birth_place_mainland_region: "湖南" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    rerender(
      <DynamicStepForm
        step={step}
        prefill={{ birth_place_is_mainland: "mainland", birth_place_mainland_region: "湖南" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    const birthplaceSelect = document
      .querySelector('[data-field-name="birth_place_is_mainland"]')
      ?.querySelector('[role="combobox"]') as HTMLElement | null;
    expect(birthplaceSelect).toHaveTextContent("中國大陸");
    expect(screen.getByRole("button", { name: /湖南/u })).toBeInTheDocument();

    fireEvent.click(birthplaceSelect!);
    fireEvent.click(screen.getByRole("option", { name: "其他" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /请选择/u })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /请选择/u }));
    expect(screen.getByText("無國籍-依1954年無國籍人士公約")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("Maximum update depth exceeded"),
    );
    consoleError.mockRestore();
  });

  it("does not notify an unchanged Taiwan draft again when the parent recreates the step", async () => {
    mockLocale = "zh";
    const onDraftChange = vi.fn();

    function ParentHarness() {
      const [, setParentRender] = useState(0);
      const recreatedStep: WizardStep = {
        stepNumber: 2,
        stepName: "Applicant Identity",
        fields: [
          normalizeBilingualFormField(field({
            fieldName: "birth_place_is_mainland",
            label: "Place of birth (same as travel document held)",
            fieldType: "select",
            options: [
              { value: "mainland", text: "Mainland China", label_zh: "中國大陸" },
              { value: "other", text: "Other", label_zh: "其他" },
            ],
          })),
        ],
      };

      return (
        <DynamicStepForm
          step={recreatedStep}
          prefill={{ birth_place_is_mainland: "mainland" }}
          onComplete={vi.fn()}
          onDraftChange={(patch) => {
            onDraftChange(patch);
            setParentRender((version) => version + 1);
          }}
          country="taiwan"
          visaType="TW_ENTRY_PERMIT"
        />
      );
    }

    render(<ParentHarness />);

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledTimes(1));
    expect(onDraftChange).toHaveBeenLastCalledWith({ birth_place_is_mainland: "mainland" });

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "其他" }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledTimes(2));
    expect(onDraftChange).toHaveBeenLastCalledWith({ birth_place_is_mainland: "other" });
  });

  it("switches Taiwan landline and mobile required badges when no mobile is checked", () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 3,
      stepName: "Taiwan contact address",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "tw_local_phone",
          label: "Taiwan landline number",
          required: false,
          displayOrder: 1,
        })),
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_mobile_not_applicable",
          label: "No Taiwan contact mobile number",
          fieldType: "checkbox",
          required: false,
          displayOrder: 2,
        })),
        normalizeBilingualFormField(field({
          fieldName: "tw_contact_mobile",
          label: "Taiwan contact mobile number",
          required: true,
          displayOrder: 3,
          conditionalLogic: { showIf: "tw_contact_mobile_not_applicable === false" },
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.getByText("在台联络电话")).not.toHaveTextContent("*");
    expect(screen.getByText("在台联络手机号码")).toHaveTextContent("*");
    expect(screen.getByRole("button", { name: "continue" }))
      .toHaveAttribute("data-required-filled", "false");

    fireEvent.click(screen.getByRole("checkbox", { name: /无在台联络手机号码/u }));

    expect(screen.queryByText("在台联络手机号码")).not.toBeInTheDocument();
    expect(screen.getByText("在台联络电话")).toHaveTextContent("*");
    expect(screen.getByRole("button", { name: "continue" }))
      .toHaveAttribute("data-required-filled", "false");
  });

  it("renders other-nationality passport fields as required only when triggered", () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 4,
      stepName: "Other nationality",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "has_other_nationality_passport",
          label: "Do you hold a passport of another nationality?",
          fieldType: "radio",
          required: true,
          displayOrder: 1,
          options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
        })),
        normalizeBilingualFormField(field({
          fieldName: "other_nationality_country",
          label: "Other nationality held",
          fieldType: "select",
          required: true,
          displayOrder: 2,
          options: [{ value: "13", text: "日本" }],
          conditionalLogic: { showIf: "has_other_nationality_passport === yes" },
        })),
        normalizeBilingualFormField(field({
          fieldName: "other_passport_number",
          label: "Other country's passport/document number",
          required: true,
          displayOrder: 3,
          conditionalLogic: { showIf: "has_other_nationality_passport === yes" },
        })),
        normalizeBilingualFormField(field({
          fieldName: "other_passport_expiry_date",
          label: "Other country's passport/document validity expiry date",
          fieldType: "date",
          required: true,
          displayOrder: 4,
          conditionalLogic: { showIf: "has_other_nationality_passport === yes" },
        })),
      ],
    };

    const { rerender } = render(
      <DynamicStepForm
        step={step}
        prefill={{ has_other_nationality_passport: "no" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.queryByText("所具其他国籍为")).not.toBeInTheDocument();
    expect(screen.queryByText("他国护（证）照号码")).not.toBeInTheDocument();
    expect(screen.queryByText("他国护（证）照有效期限")).not.toBeInTheDocument();

    rerender(
      <DynamicStepForm
        step={step}
        prefill={{ has_other_nationality_passport: "yes" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.getByText("所具其他国籍为")).toHaveTextContent("*");
    expect(screen.getByText("他国护（证）照号码")).toHaveTextContent("*");
    expect(screen.getByText("他国护（证）照有效期限")).toHaveTextContent("*");
    expect(screen.getByRole("button", { name: "continue" }))
      .toHaveAttribute("data-required-filled", "false");
  });

  it("keeps father and mother status required without expanding other kinship fields", () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 5,
      stepName: "Kinship",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "kin_father_status",
          label: "Father — Living/deceased/divorced",
          fieldType: "select",
          required: false,
          displayOrder: 1,
          options: [{ value: "1", text: "Living", label_zh: "存" }],
        })),
        normalizeBilingualFormField(field({
          fieldName: "kin_mother_status",
          label: "Mother — Living/deceased/divorced",
          fieldType: "select",
          required: false,
          displayOrder: 2,
          options: [{ value: "1", text: "Living", label_zh: "存" }],
        })),
        normalizeBilingualFormField(field({
          fieldName: "kin_mother_name",
          label: "Mother — Name",
          required: false,
          displayOrder: 3,
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.getByText("父 — 存殁")).toHaveTextContent("*");
    expect(screen.getByText("母 — 存殁")).toHaveTextContent("*");
    expect(screen.getByText("母亲 — 姓名")).not.toHaveTextContent("*");
    expect(screen.getByRole("button", { name: "continue" }))
      .toHaveAttribute("data-required-filled", "false");
  });

  it("does not present a normal official URL as a resumable filled-session handoff", () => {
    mockLocale = "zh";
    const result = {
      country: "TW",
      status: "stopped_at_captcha",
      portalUrl: "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china",
      pagesFilled: ["Delivery Location", "Applicant Identity"],
    } satisfies TwSubmissionResult;

    render(<TwResultCard result={result} />);

    expect(screen.getByText("已停在官方验证码前，尚未提交")).toBeInTheDocument();
    expect(screen.getByText(/没有识别验证码，也没有点击「确认资料」最终提交/u)).toBeInTheDocument();
    expect(screen.getByText(/请勿把普通官网入口当成可接续链接/u)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /官网|移民署|CAPTCHA|验证码/u })).not.toBeInTheDocument();
  });

  it("exposes a stable field anchor for missing-information navigation", async () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 2,
      stepName: "Photo & Basic Status",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "household_revoked",
          label: "Household registration revoked",
          fieldType: "radio",
          options: [
            { value: "yes", label_zh: "是", label_en: "Yes" },
            { value: "no", label_zh: "否", label_en: "No" },
          ],
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
        focusFieldName="household_revoked"
      />,
    );

    const fieldFrame = document.querySelector('[data-field-name="household_revoked"]');
    expect(fieldFrame).toBeTruthy();
    await waitFor(() => {
      expect(fieldFrame?.className).toContain("ring-amber-300");
    });
  });

  it("shows household registration status only for permanent-residency HK/Macau office paths", () => {
    mockLocale = "zh";
    const step: WizardStep = {
      stepNumber: 1,
      stepName: "Photo & Basic Status",
      fields: [
        normalizeBilingualFormField(field({
          fieldName: "household_revoked",
          label: "Household registration revoked",
          fieldType: "radio",
          required: false,
          validationRules: { required_when: "eligibility_category === 2 && embassy_office in [50, 51]" },
          conditionalLogic: { showIf: "eligibility_category === 2 && embassy_office in [50, 51]" },
          options: [
            { value: "no", label_zh: "未注销户口登记，或已注销户口登记但尚未取得香港、澳门护照", label_en: "Not revoked" },
            { value: "yes", label_zh: "已注销户口登记", label_en: "Revoked" },
          ],
        })),
      ],
    };

    render(
      <DynamicStepForm
        step={step}
        prefill={{ eligibility_category: "2", embassy_office: "50" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );

    expect(screen.getByText("目前户口登记状态")).toHaveTextContent("*");

    cleanup();
    render(
      <DynamicStepForm
        step={step}
        prefill={{ eligibility_category: "2", embassy_office: "53" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );
    expect(screen.queryByText("目前户口登记状态")).not.toBeInTheDocument();

    cleanup();
    render(
      <DynamicStepForm
        step={step}
        prefill={{ eligibility_category: "1", embassy_office: "50" }}
        onComplete={vi.fn()}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
      />,
    );
    expect(screen.queryByText("目前户口登记状态")).not.toBeInTheDocument();
  });
});
