import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import { normalizeBilingualFormField, resolveOptionDisplayLabel } from "@/lib/bilingual-schema-contract";
import { validateApplicationAnswers } from "@/lib/form-assistant/validator";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

vi.mock("next-intl", () => ({ useLocale: () => "zh", useTranslations: () => Object.assign((key: string) => key, { has: () => false }) }));
vi.mock("@/components/field-guidance-panel", () => ({ FieldGuidancePanel: () => null }));
vi.mock("@/lib/chinese-conversion", () => ({ convertSimplifiedToTraditional: async (value: string) => value }));

const field: VisaFormFieldRow = normalizeBilingualFormField({
  id: "birth-country", visaType: "DS160", fieldName: "country_of_birth",
  label: "Country/Region of Birth", fieldType: "select", required: true,
  stepNumber: 1, stepName: "Personal Information 1", displayOrder: 1,
  placeholder: null, validationRules: { source: "ISO3166-1" }, options: null, conditionalLogic: null,
});
const step: WizardStep = { stepNumber: 1, stepName: "Personal Information 1", fields: [field] };

describe("DS-160 official catalog migration", () => {
  it("keeps legacy ISO answers visible, valid, and translated through entry and review", () => {
    const onDraftChange = vi.fn();
    render(<DynamicStepForm step={step} visaType="DS160" prefill={{ country_of_birth: "CN" }} onComplete={vi.fn()} onDraftChange={onDraftChange} />);
    expect(screen.getByRole("button", { name: "中国" })).toBeInTheDocument();
    expect(onDraftChange.mock.calls.some(([answers]) => answers.country_of_birth === "")).toBe(false);
    const validation = validateApplicationAnswers({ steps: [step], visaType: "DS160", answers: { country_of_birth: "CN" } });
    expect(validation.errors).toEqual([]);
    expect(validation.missingFields).toEqual([]);
    expect(resolveOptionDisplayLabel(field.options, "CN", "zh")).toBe("中国");
    expect(resolveOptionDisplayLabel(field.options, "CN", "en")).toBe("CHINA");
  });

  it("requires clarification when a former country value maps to multiple official regions", () => {
    const validation = validateApplicationAnswers({ steps: [step], visaType: "DS160", answers: { country_of_birth: "Mexico" } });
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(resolveOptionDisplayLabel(field.options, "Mexico", "zh")).toBeNull();
  });
});
