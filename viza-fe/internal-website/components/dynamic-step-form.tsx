"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DynamicFormField } from "@/components/dynamic-form-field";
import { type WizardStep } from "@/types/visa-form-fields";
import { translateLabel, translatePlaceholder, translateOptionText } from "@/lib/ds160-translations";

interface DynamicStepFormProps {
  step: WizardStep;
  prefill: Record<string, string>;
  onComplete: (data: Record<string, string>) => void;
  saving?: boolean;
}

export function DynamicStepForm({ step, prefill, onComplete, saving }: DynamicStepFormProps) {
  const locale = useLocale();
  const tButtons = useTranslations("application.dynamicButtons");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of step.fields) {
      init[field.fieldName] = prefill[field.fieldName] ?? "";
    }
    return init;
  });

  const handleChange = (fieldName: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(values);
  };

  const requiredFilled = step.fields
    .filter((f) => f.required)
    .every((f) => values[f.fieldName]?.trim());

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {step.fields.map((field) => {
        const label = translateLabel(field.label, locale);
        const rawPlaceholder = field.placeholder
          ?? (field.fieldType === "select" ? tButtons("selectFallback") : null);
        const placeholder = translatePlaceholder(rawPlaceholder, locale);
        const options = field.options?.map((opt) => {
          if (typeof opt === "string") {
            return translateOptionText(opt, locale);
          }
          return { ...opt, text: translateOptionText(opt.text, locale) };
        }) ?? null;
        return (
          <DynamicFormField
            key={field.id}
            field={{ ...field, label, placeholder, options }}
            value={values[field.fieldName] ?? ""}
            onChange={(v) => handleChange(field.fieldName, v)}
          />
        );
      })}

      <Button
        type="submit"
        disabled={!requiredFilled || saving}
        className="mt-2 h-12 rounded-full bg-[#03346E] text-[15px] font-medium text-white hover:bg-[#022a5a] disabled:opacity-50"
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {tButtons("saving")}
          </span>
        ) : (
          tButtons("continue")
        )}
      </Button>
    </form>
  );
}
