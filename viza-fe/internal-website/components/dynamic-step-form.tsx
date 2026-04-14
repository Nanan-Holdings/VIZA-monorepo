"use client";

import { useState, useCallback, useMemo } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

/** Helper: get the repeat_group name from a field's validationRules */
function getRepeatGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { repeatable?: boolean; repeat_group?: string } | null;
  return rules?.repeatable && rules.repeat_group ? rules.repeat_group : null;
}

/** Suffix for repeated instance keys: fieldName__2, fieldName__3, etc. (instance 0 = base) */
function instanceKey(fieldName: string, instance: number): string {
  return instance === 0 ? fieldName : `${fieldName}__${instance + 1}`;
}

export function DynamicStepForm({ step, prefill, onComplete, saving }: DynamicStepFormProps) {
  const locale = useLocale();
  const tButtons = useTranslations("application.dynamicButtons");

  // Track how many instances each repeat_group has (min 1)
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group && !counts[group]) {
        // Detect prefilled instances: check for fieldName__2, __3, etc.
        let max = 1;
        for (let i = 2; i <= 20; i++) {
          if (prefill[`${field.fieldName}__${i}`]) max = i;
        }
        counts[group] = max;
      }
    }
    return counts;
  });

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group) {
        const count = groupCounts[group] ?? 1;
        for (let i = 0; i < count; i++) {
          const key = instanceKey(field.fieldName, i);
          init[key] = prefill[key] ?? "";
        }
      } else {
        init[field.fieldName] = prefill[field.fieldName] ?? "";
      }
    }
    return init;
  });

  // Identify which repeat_groups exist, preserving field order
  const repeatGroupOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group && !seen.has(group)) {
        seen.add(group);
        order.push(group);
      }
    }
    return order;
  }, [step.fields]);

  const repeatGroupFields = useMemo(() => {
    const map: Record<string, VisaFormFieldRow[]> = {};
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group) {
        if (!map[group]) map[group] = [];
        map[group].push(field);
      }
    }
    return map;
  }, [step.fields]);

  // Find all fields whose visibility depends on a given parent field.
  const getDependentFields = useCallback(
    (parentFieldName: string): string[] => {
      return step.fields
        .filter((f) => {
          if (f.fieldName === parentFieldName) return false;
          const showIf = (f.conditionalLogic as { showIf?: string } | null)?.showIf;
          if (showIf && showIf.includes(parentFieldName)) return true;
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

  const addGroupInstance = (group: string) => {
    const count = (groupCounts[group] ?? 1) + 1;
    setGroupCounts((prev) => ({ ...prev, [group]: count }));
    // Initialize empty values for the new instance
    setValues((prev) => {
      const next = { ...prev };
      for (const field of repeatGroupFields[group] ?? []) {
        next[instanceKey(field.fieldName, count - 1)] = "";
      }
      return next;
    });
  };

  const removeGroupInstance = (group: string, instanceIdx: number) => {
    const count = groupCounts[group] ?? 1;
    if (count <= 1) return;
    setValues((prev) => {
      const next = { ...prev };
      const fields = repeatGroupFields[group] ?? [];
      // Shift values down from instanceIdx+1..count-1
      for (let i = instanceIdx; i < count - 1; i++) {
        for (const field of fields) {
          next[instanceKey(field.fieldName, i)] = next[instanceKey(field.fieldName, i + 1)] ?? "";
        }
      }
      // Remove last instance keys
      for (const field of fields) {
        delete next[instanceKey(field.fieldName, count - 1)];
      }
      return next;
    });
    setGroupCounts((prev) => ({ ...prev, [group]: count - 1 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(values);
  };

  // Required validation: only check visible fields (and all instances of repeat groups)
  const requiredFilled = step.fields
    .filter((f) => f.required)
    .filter((f) => evaluateShowIf(f, values, step.fields))
    .every((f) => {
      const group = getRepeatGroup(f);
      if (group) {
        const count = groupCounts[group] ?? 1;
        return Array.from({ length: count }, (_, i) =>
          (values[instanceKey(f.fieldName, i)] ?? "").trim()
        ).every(Boolean);
      }
      return (values[f.fieldName] ?? "").trim();
    });

  /** Translate and render a single field */
  const renderField = (field: VisaFormFieldRow, valueKey: string, forceWhiteBackground = false) => {
    const label = translateLabel(field.label, locale);
    const rawPlaceholder = field.placeholder
      ?? (field.fieldType === "select" ? tButtons("selectFallback") : null);
    const placeholder = translatePlaceholder(rawPlaceholder, locale);
    const options = field.options?.map((opt) => {
      if (typeof opt === "string") return translateOptionText(opt, locale);
      return { ...opt, text: translateOptionText(opt.text, locale) };
    }) ?? null;

    return (
      <DynamicFormField
        key={valueKey}
        field={{ ...field, label, placeholder, options }}
        value={values[valueKey] ?? ""}
        onChange={(v) => handleChange(valueKey, v)}
        forceWhiteBackground={forceWhiteBackground}
      />
    );
  };

  // Build the ordered list of render items (fields + repeat groups)
  const renderedGroups = new Set<string>();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {step.fields.map((field) => {
        // Evaluate conditional logic
        if (!evaluateShowIf(field, values, step.fields)) return null;

        const group = getRepeatGroup(field);

        // Non-repeatable field: render normally
        if (!group) {
          return renderField(field, field.fieldName);
        }

        // Repeatable group: render the whole group container once
        if (renderedGroups.has(group)) return null;
        renderedGroups.add(group);

        const groupFields = repeatGroupFields[group] ?? [];
        // Check if at least one field in group is visible
        const visibleGroupFields = groupFields.filter((f) =>
          evaluateShowIf(f, values, step.fields)
        );
        if (visibleGroupFields.length === 0) return null;

        const count = groupCounts[group] ?? 1;

        return (
          <div key={`group-${group}`} className="flex flex-col gap-3">
            {Array.from({ length: count }, (_, instanceIdx) => (
              <div
                key={`${group}-${instanceIdx}`}
                className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-4 flex flex-col gap-4"
              >
                {count > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-500">
                      #{instanceIdx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGroupInstance(group, instanceIdx)}
                      className="flex items-center gap-1 text-[13px] text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tButtons("remove")}
                    </button>
                  </div>
                )}
                {visibleGroupFields.map((gf) =>
                  renderField(gf, instanceKey(gf.fieldName, instanceIdx), true)
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addGroupInstance(group)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#03346E] hover:text-[#022a5a] transition-colors self-start cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {tButtons("addAnother")}
            </button>
          </div>
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
