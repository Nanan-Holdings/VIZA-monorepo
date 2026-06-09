import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "../dynamic-step-form";
import { buildUniversalProfileAnswerPatch } from "@/lib/universal-profile-prefill";
import { getChineseLabel, getChineseOptionText, getEnglishPlaceholder } from "@/lib/ds160-translations";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";
import { type WizardStep } from "@/types/visa-form-fields";
import { auConfig } from "@/components/client/wizards/au/config";
import { egConfig } from "@/components/client/wizards/eg/config";
import { idConfig } from "@/components/client/wizards/id/config";
import { schengenConfig } from "@/components/client/wizards/schengen/config";
import { ukConfig } from "@/components/client/wizards/uk/config";
import { usConfig } from "@/components/client/wizards/us/config";
import { vnConfig } from "@/components/client/wizards/vn/config";
import type { WizardConfig } from "@/components/client/wizards/shell/types";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const requiredTextStep: WizardStep = {
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      id: "field-surname",
      visaType: "DS160",
      fieldName: "surname",
      label: "Surname",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Personal Information",
      displayOrder: 1,
      placeholder: "e.g. LI",
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const shortcutStep: WizardStep = {
  stepNumber: 1,
  stepName: "Shortcuts",
  fields: [
    {
      id: "field-travel-plan",
      visaType: "DS160",
      fieldName: "has_travel_plan",
      label: "Do you have a specific travel plan?",
      fieldType: "radio",
      required: false,
      stepNumber: 1,
      stepName: "Shortcuts",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: [
        { value: "YES", text: "Yes" },
        { value: "NO", text: "No" },
      ],
      conditionalLogic: null,
    },
  ],
};

const purposeOfTripStep: WizardStep = {
  stepNumber: 3,
  stepName: "Travel Information",
  fields: [
    {
      id: "field-purpose-of-trip",
      visaType: "DS160",
      fieldName: "purpose_of_trip",
      label: "Purpose of Trip to the U.S.",
      fieldType: "select",
      required: true,
      stepNumber: 3,
      stepName: "Travel Information",
      displayOrder: 1,
      placeholder: "Select...",
      validationRules: { repeatable: true, repeat_group: "trip_purpose" },
      options: [
        { value: "A", text: "FOREIGN GOVERNMENT OFFICIAL (A)" },
        { value: "B", text: "TEMP. BUSINESS OR PLEASURE VISITOR (B)" },
        { value: "C", text: "ALIEN IN TRANSIT (C)" },
      ],
      conditionalLogic: null,
    },
  ],
};

const placeOfBirthStep: WizardStep = {
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      id: "field-place-of-birth",
      visaType: "SCHENGEN_C",
      fieldName: "place_of_birth",
      label: "Place of birth (city or town)",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Personal Information",
      displayOrder: 1,
      placeholder: "City and country of birth",
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const cityOfBirthStep: WizardStep = {
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      id: "field-city-of-birth",
      visaType: "DS160",
      fieldName: "city_of_birth",
      label: "City of Birth",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Personal Information",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const documentDateConsistencyStep: WizardStep = {
  stepNumber: 3,
  stepName: "Travel Document & Identity",
  fields: [
    {
      id: "field-surname",
      visaType: "SCHENGEN_C",
      fieldName: "surname",
      label: "Surname (family name)",
      fieldType: "text",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-date-of-birth",
      visaType: "SCHENGEN_C",
      fieldName: "date_of_birth",
      label: "Date of birth",
      fieldType: "date",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 2,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-document-issue-date",
      visaType: "SCHENGEN_C",
      fieldName: "travel_document_issue_date",
      label: "Date of issue",
      fieldType: "date",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 3,
      placeholder: null,
      validationRules: { format: "DD/MM/YYYY", inline_group: "travel_document_dates" },
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-document-expiry-date",
      visaType: "SCHENGEN_C",
      fieldName: "travel_document_expiry_date",
      label: "Expiry date",
      fieldType: "date",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 4,
      placeholder: null,
      validationRules: { format: "DD/MM/YYYY", inline_group: "travel_document_dates" },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const schengenPurposeStep: WizardStep = {
  stepNumber: 7,
  stepName: "Trip Details",
  fields: [
    {
      id: "field-purpose-of-journey",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      fieldName: "purpose_of_journey",
      label: "Main purpose of the journey",
      fieldType: "select",
      required: true,
      stepNumber: 7,
      stepName: "Trip Details",
      displayOrder: 1,
      placeholder: "请选择...",
      validationRules: null,
      options: [
        { value: "tourism", text: "Tourism" },
        { value: "business", text: "Business" },
        { value: "cultural", text: "Cultural" },
      ],
      conditionalLogic: null,
    },
  ],
};

const schengenDestinationStep: WizardStep = {
  stepNumber: 7,
  stepName: "Trip Details",
  fields: [
    {
      id: "field-main-destination-country",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      fieldName: "main_destination_country",
      label: "Member State of main destination",
      fieldType: "country",
      required: true,
      stepNumber: 7,
      stepName: "Trip Details",
      displayOrder: 1,
      placeholder: null,
      validationRules: { source: "ISO3166-1" },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const wizardConfigs: Array<WizardConfig<unknown>> = [
  usConfig as WizardConfig<unknown>,
  ukConfig as WizardConfig<unknown>,
  schengenConfig as WizardConfig<unknown>,
  vnConfig as WizardConfig<unknown>,
  auConfig as WizardConfig<unknown>,
  egConfig as WizardConfig<unknown>,
  idConfig as WizardConfig<unknown>,
];

const messageSets = [
  { locale: "en", messages: enMessages },
  { locale: "zh", messages: zhMessages },
] as const;

const translationPropNames = new Set([
  "titleKey",
  "subtitleKey",
  "labelKey",
  "placeholderKey",
  "descriptionKey",
  "hintKey",
  "submitLabelKey",
  "yesKey",
  "noKey",
]);

function getPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, root);
}

function collectTranslationKeys(value: unknown, keys: Set<string>) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectTranslationKeys(item, keys));
    return;
  }

  if (isValidElement(value)) {
    collectTranslationKeys((value as { props?: unknown }).props, keys);
    return;
  }

  for (const [prop, nested] of Object.entries(value as Record<string, unknown>)) {
    if (translationPropNames.has(prop) && typeof nested === "string" && nested && !nested.startsWith("literal:")) {
      keys.add(nested);
      continue;
    }
    collectTranslationKeys(nested, keys);
  }
}

function renderWizardStep(config: WizardConfig<unknown>, index: number): ReactNode {
  const form = config.emptyForm();
  return config.steps[index].render({
    form,
    setForm: () => undefined,
    applicationId: null,
    onContinue: () => undefined,
    onBack: () => undefined,
    onSubmit: () => undefined,
    submitting: false,
    goToStep: () => undefined,
  });
}

describe("DynamicStepForm copilot format", () => {
  it("uses the unified Chinese copilot trigger format", () => {
    render(
      <DynamicStepForm
        step={requiredTextStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.getByText("必填项")).toBeInTheDocument();
    expect(screen.queryByText("Required field")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask AI" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review tip" })).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "问 AI" });
    expect(trigger).toHaveAttribute("data-copilot-trigger", "surname");

    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "收起 AI 帮助" })).toBeInTheDocument();
    expect(screen.getByTestId("field-guidance-panel")).toBeInTheDocument();
  });

  it("supports Windows and Mac undo/redo shortcuts for non-text controls", () => {
    const { container } = render(
      <DynamicStepForm
        step={shortcutStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const getYesRadios = () =>
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"][value="YES"]'));
    const firstYesRadio = () => getYesRadios()[0];

    fireEvent.click(firstYesRadio()!);
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);

    fireEvent.keyDown(firstYesRadio()!, { key: "z", ctrlKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(false);

    fireEvent.keyDown(firstYesRadio()!, { key: "y", ctrlKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);

    fireEvent.keyDown(firstYesRadio()!, { key: "z", metaKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(false);

    fireEvent.keyDown(firstYesRadio()!, { key: "Z", metaKey: true, shiftKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);
  });

  it("keeps the B1/B2 purpose dropdown selectable after copilot opens and closes", () => {
    const { container } = render(
      <DynamicStepForm
        step={purposeOfTripStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const comboboxes = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="combobox"]'));
    expect(comboboxes).toHaveLength(2);
    expect(comboboxes.every((combobox) => combobox.disabled)).toBe(false);
    expect(container).toHaveTextContent("临时商务或旅游访客 (B)");
    expect(container).toHaveTextContent("TEMP. BUSINESS OR PLEASURE VISITOR (B)");

    const trigger = screen.getByRole("button", { name: "问 AI" });
    fireEvent.click(trigger);
    expect(screen.getByTestId("field-guidance-panel")).toBeInTheDocument();
    expect(comboboxes.every((combobox) => combobox.disabled)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "收起 AI 帮助" }));
    expect(screen.queryByTestId("field-guidance-panel")).not.toBeInTheDocument();
    expect(comboboxes.every((combobox) => combobox.disabled)).toBe(false);
  });

  it("autofills bilingual values from universal profile without submitting helper keys", () => {
    const onComplete = vi.fn();
    const prefill = buildUniversalProfileAnswerPatch({
      full_name: "CHEN HONGYU",
      full_name_zh: "陈泓羽",
      full_name_en: "CHEN HONGYU",
      birth_country: "China",
      birth_province_or_state: "湖南",
      birth_province_or_state_zh: "湖南",
      birth_province_or_state_en: "Hunan",
      birth_city: "长沙",
      birth_city_zh: "长沙",
      birth_city_en: "Changsha",
    });

    render(
      <DynamicStepForm
        step={placeOfBirthStep}
        prefill={prefill}
        onComplete={onComplete}
        visaType="SCHENGEN_C"
      />,
    );

    expect(screen.getByDisplayValue("长沙")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Changsha")).toBeInTheDocument();
    expect(prefill.full_name_zh).toBe("陈泓羽");
    expect(prefill.full_name_en).toBe("CHEN HONGYU");
    expect(prefill.state_of_birth).toBe("Hunan");
    expect(prefill.country_of_birth).toBe("China");

    fireEvent.click(screen.getByRole("button", { name: "continue" }));

    expect(onComplete).toHaveBeenCalledWith({ place_of_birth: "Changsha" });
  });

  it("uses the server translation fallback when local sync leaves Chinese in the English field", async () => {
    const onComplete = vi.fn();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ translatedText: "Hengqin, Zhuhai" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DynamicStepForm
        step={cityOfBirthStep}
        prefill={{}}
        onComplete={onComplete}
        visaType="DS160"
      />,
    );

    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes).toHaveLength(2);

    fireEvent.change(textboxes[0]!, { target: { value: "珠海横琴" } });
    expect(screen.getAllByDisplayValue("珠海横琴")).toHaveLength(2);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Hengqin, Zhuhai")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/translations/field",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "珠海横琴",
          sourceLanguage: "zh-CN",
          targetLanguage: "en",
          fieldType: "text",
        }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    expect(onComplete).toHaveBeenCalledWith({ city_of_birth: "Hengqin, Zhuhai" });
  });

  it("shows document date-order errors only on the expiry field", () => {
    const { container } = render(
      <DynamicStepForm
        step={documentDateConsistencyStep}
        prefill={{
          surname: "CHEN",
          date_of_birth: "2006-07-27",
          travel_document_issue_date: "2030-01-01",
          travel_document_expiry_date: "2029-01-01",
        }}
        onComplete={vi.fn()}
        visaType="SCHENGEN_C"
      />,
    );

    expect(screen.getAllByText("到期日必须晚于签发日")).toHaveLength(1);

    const surnameTrigger = container.querySelector('[data-copilot-trigger="surname"]');
    const birthDateTrigger = container.querySelector('[data-copilot-trigger="date_of_birth"]');
    const issueDateTrigger = container.querySelector('[data-copilot-trigger="travel_document_issue_date"]');
    const expiryDateTrigger = container.querySelector('[data-copilot-trigger="travel_document_expiry_date"]');

    expect(surnameTrigger?.parentElement).not.toHaveTextContent("到期日必须晚于签发日");
    expect(birthDateTrigger?.parentElement).not.toHaveTextContent("到期日必须晚于签发日");
    expect(issueDateTrigger?.parentElement).not.toHaveTextContent("到期日必须晚于签发日");
    expect(expiryDateTrigger?.parentElement).toHaveTextContent("到期日必须晚于签发日");
  });

  it("keeps Schengen option and placeholder language scoped to each side", () => {
    const { container } = render(
      <DynamicStepForm
        step={schengenPurposeStep}
        prefill={{}}
        onComplete={vi.fn()}
        country="france"
        visaType="EU_SCHENGEN_C_SHORT_STAY"
      />,
    );

    expect(getChineseOptionText("Tourism")).toBe("旅游");
    expect(getChineseOptionText("Business")).toBe("商务");
    expect(getChineseOptionText("Cultural")).toBe("文化");
    expect(getEnglishPlaceholder("请选择...")).toBe("Select...");

    expect(container).toHaveTextContent("旅游");
    expect(container).toHaveTextContent("商务");
    expect(container).toHaveTextContent("文化");
    expect(container).toHaveTextContent("Tourism");
    expect(container).toHaveTextContent("Business");
    expect(container).toHaveTextContent("Cultural");
    expect(container).toHaveTextContent("Select...");
  });

  it("uses exact Chinese copy for Schengen declaration labels", () => {
    const visConsentLabel =
      "I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years.";

    expect(getChineseLabel(
      "Is the application being filled in by someone other than the applicant?",
      "has_different_filler",
    )).toBe("本申请表是否由申请人以外的其他人填写？");
    expect(getChineseLabel("Place of application", "place_of_application")).toBe("申请提交地点");
    expect(getChineseLabel(visConsentLabel, "declaration_vis_consent")).toContain("我知悉并同意");
    expect(getChineseLabel(visConsentLabel, "declaration_vis_consent")).not.toBe("声明");
  });

  it("defaults France Schengen main destination and localizes country names per side", async () => {
    const { container } = render(
      <DynamicStepForm
        step={schengenDestinationStep}
        prefill={{}}
        onComplete={vi.fn()}
        country="france"
        visaType="EU_SCHENGEN_C_SHORT_STAY"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("法国")).toBeInTheDocument();
    });
    expect(screen.getByText("France")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("法国 (France)");
  });

  it("keeps registered wizard prompts aligned with localized country copy", () => {
    for (const config of wizardConfigs) {
      for (const { locale, messages } of messageSets) {
        const namespace = getPath(messages, config.i18nNamespace);
        expect.soft(namespace, `${locale} ${config.visaType} is missing ${config.i18nNamespace}`).toBeTruthy();

        const keys = new Set<string>();
        config.steps.forEach((step, index) => {
          keys.add(step.titleKey);
          collectTranslationKeys(renderWizardStep(config, index), keys);
        });

        config.reviewSections(config.emptyForm()).forEach((section) => {
          keys.add(section.titleKey);
        });

        for (const key of keys) {
          expect.soft(
            getPath(namespace, key),
            `${locale} ${config.visaType} missing translation key ${config.i18nNamespace}.${key}`,
          ).toBeTruthy();
        }
      }
    }
  });
});
