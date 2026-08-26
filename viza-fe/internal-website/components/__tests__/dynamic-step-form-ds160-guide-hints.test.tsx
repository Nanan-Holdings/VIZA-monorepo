import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "../dynamic-step-form";
import {
  DS160_LONG_FORM_GUIDE_HINT_KEYS,
  getDs160LongFormGuideHintKeys,
} from "@/lib/ds160-guide-hints";
import { type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";

const intlState = vi.hoisted(() => ({
  locale: "zh",
  simplifiedForm: {
    zh: {
      "identity.firstNameHint": "请按护照上的名逐字填写；如果护照没有名，美国国务院官网要求在名处填写“无名（FNU）”。",
      "identity.lastNameHint": "请按护照上的姓逐字填写，拼写、空格和顺序都应与护照一致。",
      "identity.hasNativeAlphabetTooltip": "中国护照申请人请填写真实中文全名，不能用拼音或英文替代；只有确实不适用时才选择“不适用”。",
      "passport.bookNumberHelp": "护照本号是独立于护照号码之外的簿册或库存控制编号，不是护照号码本身。不要把资料页右上角的护照号码重复填入。",
      "passport.extraSsnHint": "美国社会安全号码是美国社会安全局签发的 9 位号码。曾经拥有就必须填写，即使现在不再使用；从未拥有才选“不适用”。不要在这里填写美国个人纳税人识别号码。",
      "passport.extraItinHint": "美国个人纳税人识别号码是美国国税局签发的 9 位税务号码，通常以 9 开头。曾经拥有就必须填写；从未拥有才选“不适用”。不要在这里填写美国社会安全号码。",
      "travel.hasCompanionsHint": "请按真实同行安排回答。美国国务院官方说明：如果您与家人同行，或作为旅行团、表演团体、运动队的一部分同行，应选择“是”。因同一雇主的工作目的同行者，不必逐一列出。不要为了提高面试效果而虚构同行人。",
      "travel.companionGroupTravelHint": "如果随旅行团、学校、公司或其他组织统一出行，请选择“是”并填写团组或组织名称。",
    },
    en: {
      "identity.firstNameHint": "Enter your given names exactly as shown in your passport. If your passport has no given name, CEAC requires you to enter “FNU”.",
      "identity.lastNameHint": "Enter all surnames exactly as listed in your passport, including spelling, spacing, and order.",
      "identity.hasNativeAlphabetTooltip": "Chinese passport applicants should enter their real Chinese full name and should not substitute pinyin or English.",
      "passport.bookNumberHelp": "A passport book number is a booklet or inventory control number separate from the passport number itself. Do not repeat the passport number.",
      "passport.extraSsnHint": "A U.S. Social Security Number is a nine-digit number issued by the Social Security Administration. Do not enter a U.S. taxpayer identification number here.",
      "passport.extraItinHint": "A U.S. Individual Taxpayer Identification Number is a nine-digit tax number issued by the Internal Revenue Service, usually starting with 9. Do not enter a Social Security Number here.",
      "travel.hasCompanionsHint": "Answer according to your real travel arrangements. U.S. Department of State DS-160 Travel Companions Help says you should answer Yes if you are traveling with family, as part of an organized tour, or as part of a performing group or athletic team.",
      "travel.companionGroupTravelHint": "If you are traveling with a tour, school, company, or other organization, answer Yes and enter the group or organization name.",
    },
  },
}));

vi.mock("next-intl", () => ({
  useLocale: () => intlState.locale,
  useTranslations: (namespace?: string) => {
    const translate = (key: string) => {
      if (namespace === "simplifiedForm") {
        const locale = intlState.locale.startsWith("zh") ? "zh" : "en";
        return intlState.simplifiedForm[locale][key as keyof typeof intlState.simplifiedForm.zh] ?? key;
      }
      return key;
    };
    return Object.assign(translate, { has: () => false });
  },
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

function field(input: Partial<VisaFormFieldRow> & { fieldName: string; label: string; fieldType?: VisaFormFieldRow["fieldType"] }): VisaFormFieldRow {
  return {
    id: `field-${input.fieldName}`,
    visaType: input.visaType ?? "DS160",
    fieldName: input.fieldName,
    label: input.label,
    fieldType: input.fieldType ?? "text",
    required: input.required ?? false,
    stepNumber: input.stepNumber ?? 1,
    stepName: input.stepName ?? "Personal Information 1",
    displayOrder: input.displayOrder ?? 1,
    placeholder: input.placeholder ?? null,
    validationRules: input.validationRules ?? null,
    options: input.options ?? null,
    conditionalLogic: input.conditionalLogic ?? null,
  };
}

function step(fields: VisaFormFieldRow[], stepNumber: number, stepName: string): WizardStep {
  return { stepNumber, stepName, fields: fields.map((item, index) => ({ ...item, stepNumber, stepName, displayOrder: index + 1 })) };
}

function renderStep(wizardStep: WizardStep, options?: { country?: string; visaType?: string; prefill?: Record<string, string> }) {
  return render(
    <DynamicStepForm
      step={wizardStep}
      prefill={options?.prefill ?? {}}
      country={options?.country ?? "united_states"}
      visaType={options?.visaType ?? "DS160"}
      onComplete={vi.fn()}
      showContinueButton={false}
    />,
  );
}

describe("DynamicStepForm DS-160 guide hints", () => {
  it("locks the long-form field-key contract for approved DS-160 hints", () => {
    expect(Object.keys(DS160_LONG_FORM_GUIDE_HINT_KEYS).length).toBeGreaterThanOrEqual(50);
    expect(getDs160LongFormGuideHintKeys("passport_book_number")).toEqual(["passport.bookNumberHelp"]);
    expect(getDs160LongFormGuideHintKeys("us_social_security_number")).toEqual(["passport.extraSsnHint"]);
    expect(getDs160LongFormGuideHintKeys("us_taxpayer_id")).toEqual(["passport.extraItinHint"]);
    expect(getDs160LongFormGuideHintKeys("companion_surname__2")).toEqual(["travel.hasCompanionsHint"]);
  });

  it("renders approved identity hints in the actual dynamic long-form", () => {
    intlState.locale = "zh";

    renderStep(step([
      field({ fieldName: "surname", label: "Surnames" }),
      field({ fieldName: "given_names", label: "Given Names" }),
      field({ fieldName: "full_name_native_alphabet", label: "Full Name in Native Alphabet" }),
    ], 1, "Personal Information 1"));

    expect(screen.getByText(/请按护照上的姓逐字填写/)).toBeInTheDocument();
    expect(screen.getByText(/无名（FNU）/)).toBeInTheDocument();
    expect(screen.getByText(/真实中文全名，不能用拼音或英文替代/)).toBeInTheDocument();
  });

  it("renders approved passport, SSN, and ITIN hints in the actual dynamic long-form", () => {
    intlState.locale = "zh";

    renderStep(step([
      field({ fieldName: "passport_book_number", label: "Passport Book Number" }),
      field({ fieldName: "us_social_security_number", label: "U.S. Social Security Number" }),
      field({ fieldName: "us_taxpayer_id", label: "U.S. Taxpayer ID Number" }),
    ], 2, "Personal Information 2"));

    expect(screen.getByText(/护照本号是独立于护照号码之外/)).toBeInTheDocument();
    expect(screen.getByText(/不要把资料页右上角的护照号码重复填入/)).toBeInTheDocument();
    expect(screen.getByText(/美国社会安全局签发的 9 位号码/)).toBeInTheDocument();
    expect(screen.getByText(/不要在这里填写美国个人纳税人识别号码/)).toBeInTheDocument();
    expect(screen.getByText(/美国国税局签发的 9 位税务号码/)).toBeInTheDocument();
    expect(screen.getByText(/不要在这里填写美国社会安全号码/)).toBeInTheDocument();
  });

  it("renders approved travel companions hints, including conditional companion fields", () => {
    intlState.locale = "zh";

    renderStep(
      step([
        field({
          fieldName: "has_companions",
          label: "Are there other persons traveling with you?",
          fieldType: "radio",
          options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
        }),
        field({
          fieldName: "companion_group_travel",
          label: "Are you traveling as part of a group or organization?",
          fieldType: "radio",
          options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
          conditionalLogic: { showIf: "has_companions === yes" },
        }),
        field({
          fieldName: "companion_surname",
          label: "Surnames",
          conditionalLogic: { showIf: "companion_group_travel === no" },
          validationRules: { repeatable: true, repeat_group: "companions" },
        }),
      ], 4, "Travel Companions"),
      { prefill: { has_companions: "yes", companion_group_travel: "no" } },
    );

    expect(screen.getAllByText(/美国国务院官方说明/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/不要为了提高面试效果而虚构同行人/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/如果随旅行团、学校、公司或其他组织统一出行/)).toBeInTheDocument();
  });

  it("renders English hints in English mode and does not leak DS-160 hints to other countries", () => {
    intlState.locale = "en";

    const passportStep = step([
      field({ fieldName: "passport_book_number", label: "Passport Book Number" }),
    ], 6, "Passport");
    const { rerender } = renderStep(passportStep);

    expect(screen.getByText(/booklet or inventory control number separate from the passport number/)).toBeInTheDocument();

    rerender(
      <DynamicStepForm
        step={passportStep}
        prefill={{}}
        country="canada"
        visaType="CA_TRV"
        onComplete={vi.fn()}
        showContinueButton={false}
      />,
    );

    expect(screen.queryByText(/booklet or inventory control number separate from the passport number/)).not.toBeInTheDocument();
  });
});
