"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DynamicFormField } from "@/components/dynamic-form-field";
import { type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";
import { translateLabel, translatePlaceholder, translateOptionText } from "@/lib/ds160-translations";

/**
 * Evaluate a conditionalLogic.showIf expression against current form values.
 * Supports: "field === value", multiple OR conditions "a === b || c === d".
 *
 * Also infers conditional visibility when explicit conditionalLogic is missing
 * from the DB but the field is clearly subordinate to a yes/no toggle:
 *  - repeat_group "X" → toggle field "X_used"
 *  - field name shares a prefix with a yes/no radio field (e.g.
 *    "other_name_surname" is subordinate to "other_names_used")
 */
function evaluateShowIf(
  field: VisaFormFieldRow,
  values: Record<string, string>,
  allFields?: VisaFormFieldRow[],
): boolean {
  const logic = field.conditionalLogic;

  // 1. Explicit showIf condition
  if (logic) {
    const showIf = (logic as { showIf?: string }).showIf;
    if (showIf && typeof showIf === "string") {
      const conditions = showIf.split("||").map((s) => s.trim());
      return conditions.some((cond) => {
        const match = cond.match(/^(\S+)\s*===\s*(\S+)$/);
        if (!match) return false;
        const [, fieldName, expected] = match;
        const actual = (values[fieldName] ?? "").toLowerCase();
        return actual === expected.toLowerCase();
      });
    }
  }

  // 2. Infer conditional visibility when no explicit logic exists
  if (!logic && allFields) {
    // 2a. repeat_group → look for "<group>_used" toggle
    const rules = field.validationRules as { repeat_group?: string } | null;
    const group = rules?.repeat_group;
    if (group) {
      const toggleName = `${group}_used`;
      if (allFields.some((f) => f.fieldName === toggleName)) {
        return (values[toggleName] ?? "").toLowerCase() === "yes";
      }
    }

    // 2b. Find the closest yes/no toggle field that this field's name
    //     is prefixed by. E.g. "other_name_type" is subordinate to
    //     "other_names_used" because both share the "other_name" stem.
    //     We look for radio fields with yes/no options whose name
    //     (minus a trailing "_used", "s_used", etc.) is a prefix of
    //     this field's name.
    const yesNoToggles = allFields.filter(
      (f) =>
        f.fieldName !== field.fieldName &&
        (f.fieldType === "radio" || f.fieldType === "select") &&
        f.options &&
        Array.isArray(f.options) &&
        f.options.some((o) => {
          const val = typeof o === "string" ? o : o.value;
          return val.toLowerCase() === "yes";
        })
    );

    for (const toggle of yesNoToggles) {
      // Derive possible prefix stems from the toggle name
      // e.g. "other_names_used" → ["other_names_used", "other_names", "other_name"]
      //      "has_telecode"     → ["has_telecode", "telecode"]
      //      "has_specific_plans" → ["has_specific_plans", "specific_plans", "specific_plan"]
      const stems: string[] = [toggle.fieldName];
      const withoutUsed = toggle.fieldName.replace(/_used$/, "");
      if (withoutUsed !== toggle.fieldName) {
        stems.push(withoutUsed);
        // also try singular: "other_names" → "other_name"
        if (withoutUsed.endsWith("s")) stems.push(withoutUsed.slice(0, -1));
      }
      const withoutHas = toggle.fieldName.replace(/^has_/, "");
      if (withoutHas !== toggle.fieldName) {
        stems.push(withoutHas);
        if (withoutHas.endsWith("s")) stems.push(withoutHas.slice(0, -1));
      }

      for (const stem of stems) {
        if (field.fieldName.startsWith(stem) && field.fieldName !== toggle.fieldName) {
          return (values[toggle.fieldName] ?? "").toLowerCase() === "yes";
        }
      }
    }
  }

  return true; // no condition → always visible
}

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

  // Find all fields whose visibility depends on a given parent field.
  // Uses the same logic as evaluateShowIf's inference to stay consistent.
  const getDependentFields = useCallback(
    (parentFieldName: string): string[] => {
      return step.fields
        .filter((f) => {
          if (f.fieldName === parentFieldName) return false;
          // Explicit showIf reference
          const showIf = (f.conditionalLogic as { showIf?: string } | null)?.showIf;
          if (showIf && showIf.includes(parentFieldName)) return true;
          // Inferred: check if evaluateShowIf would tie this field to parentFieldName
          // by testing with yes vs empty — if visibility changes, it's dependent.
          if (!f.conditionalLogic) {
            const withYes = { ...values, [parentFieldName]: "yes" };
            const withNo = { ...values, [parentFieldName]: "" };
            const visibleWithYes = evaluateShowIf(f, withYes, step.fields);
            const visibleWithNo = evaluateShowIf(f, withNo, step.fields);
            if (visibleWithYes !== visibleWithNo) return true;
          }
          return false;
        })
        .map((f) => f.fieldName);
    },
    [step.fields, values]
  );

  const handleChange = (fieldName: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [fieldName]: value };
      // Clear dependent fields that are now hidden
      const dependents = getDependentFields(fieldName);
      for (const dep of dependents) {
        const depField = step.fields.find((f) => f.fieldName === dep);
        if (depField && !evaluateShowIf(depField, next, step.fields)) {
          next[dep] = "";
        }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(values);
  };

  const requiredFilled = step.fields
    .filter((f) => f.required)
    .filter((f) => evaluateShowIf(f, values, step.fields)) // only check visible required fields
    .every((f) => values[f.fieldName]?.trim());

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {step.fields.map((field) => {
        // Evaluate conditional logic — hide field if condition not met
        if (!evaluateShowIf(field, values, step.fields)) return null;

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
