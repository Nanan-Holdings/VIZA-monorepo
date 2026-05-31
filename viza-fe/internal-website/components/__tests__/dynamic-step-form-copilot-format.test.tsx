import { fireEvent, render, screen } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "../dynamic-step-form";
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
