"use client";

import { useState, useCallback, useMemo } from "react";
import { AlertCircle, Bot, CheckCircle2, HelpCircle, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { DynamicFormField } from "@/components/dynamic-form-field";
import { FieldGuidancePanel } from "@/components/field-guidance-panel";
import { type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";
import {
  getChineseLabel,
  getChineseOptionText,
  getChinesePlaceholder,
  getEnglishLabel,
  getEnglishOptionText,
  getEnglishPlaceholder,
  toChineseSourceValue,
  toOfficialEnglishValue,
} from "@/lib/ds160-translations";
import { evaluateShowIf, isRequiredUnlessSatisfied } from "@/lib/form-utils";
import { cn } from "@/lib/utils";

interface DynamicStepFormProps {
  step: WizardStep;
  prefill: Record<string, string>;
  onComplete: (data: Record<string, string>) => void;
  saving?: boolean;
  country?: string | null;
  visaType?: string;
}

const REPEAT_GROUP_MAX_OVERRIDES: Record<string, number> = {
  specific_travel_plans: 1,
};

/** Default max instances for repeatable groups without an explicit max_items */
const REPEAT_GROUP_DEFAULT_MAX = 5;

type BilingualSide = "zh" | "en";

interface BilingualTextValue {
  zh: string;
  en: string;
}

type FieldIssueSeverity = "ok" | "warning" | "error";

interface FieldIssue {
  severity: FieldIssueSeverity;
  message: string;
}

function isTextLikeField(field: VisaFormFieldRow): boolean {
  return field.fieldType === "text" || field.fieldType === "textarea";
}

function toInitialBilingualText(value?: string): BilingualTextValue {
  const storedValue = value ?? "";
  if (!storedValue.trim()) return { zh: "", en: "" };
  if (/[\u3400-\u9fff]/.test(storedValue)) {
    return { zh: storedValue, en: toOfficialEnglishValue(storedValue) };
  }
  return { zh: toChineseSourceValue(storedValue), en: storedValue };
}

function getSideOptions(
  options: VisaFormFieldRow["options"],
  side: BilingualSide,
): VisaFormFieldRow["options"] {
  if (!options) return null;
  return options.map((option) => {
    const value = typeof option === "string" ? option : option.value;
    const text = typeof option === "string" ? option : option.text;
    return {
      value,
      text: side === "zh" ? getChineseOptionText(text) : getEnglishOptionText(text),
    };
  });
}

function parseFlexibleDate(value?: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "DO_NOT_KNOW" || trimmed === "DOES_NOT_APPLY") return null;

  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const official = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const chinese = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);

  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (official) return new Date(Number(official[3]), Number(official[2]) - 1, Number(official[1]));
  if (chinese) return new Date(Number(chinese[1]), Number(chinese[2]) - 1, Number(chinese[3]));

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function findAnswerValue(values: Record<string, string>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const value = values[candidate];
    if (value?.trim()) return value;
  }

  const entries = Object.entries(values);
  for (const candidate of candidates) {
    const found = entries.find(([key, value]) =>
      key.toLowerCase().includes(candidate.toLowerCase()) && value.trim()
    );
    if (found) return found[1];
  }

  return null;
}

function normaliseFieldOptions(options: VisaFormFieldRow["options"]): Array<{ value: string; text: string }> {
  if (!options) return [];
  return options.map((option) => {
    if (typeof option === "string") return { value: option, text: option };
    return { value: option.value, text: option.text || option.value };
  });
}

function getLocalFieldIssue(
  field: VisaFormFieldRow,
  valueKey: string,
  value: string,
  values: Record<string, string>,
): FieldIssue {
  const trimmed = value.trim();
  const rules = field.validationRules as {
    maxLength?: number;
    pattern?: string;
  } | null;
  const issue = (severity: FieldIssueSeverity, message: string): FieldIssue => ({ severity, message });

  if (field.required && !trimmed) {
    return issue("warning", "Required field");
  }

  if (rules?.maxLength && trimmed.length > rules.maxLength) {
    return issue("error", `Over ${rules.maxLength} characters`);
  }

  if (rules?.pattern && trimmed) {
    try {
      if (!new RegExp(rules.pattern).test(trimmed)) {
        return issue("error", "Format issue");
      }
    } catch {
      // Ignore malformed schema regexes here; the backend logs them.
    }
  }

  const options = normaliseFieldOptions(field.options);
  if ((field.fieldType === "select" || field.fieldType === "radio") && trimmed && options.length > 0) {
    const optionMatch = options.some(
      (option) =>
        option.value.toLowerCase() === trimmed.toLowerCase() ||
        option.text.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!optionMatch) return issue("error", "Option mismatch");
  }

  const currentDate = field.fieldType === "date" ? parseFlexibleDate(trimmed) : null;
  if (field.fieldType === "date" && trimmed && !currentDate) {
    return issue("error", "Date format issue");
  }

  if (
    currentDate &&
    (valueKey.toLowerCase().includes("birth") || field.fieldName.toLowerCase().includes("birth")) &&
    currentDate > new Date()
  ) {
    return issue("error", "Future birth date");
  }

  const issueDate = parseFlexibleDate(findAnswerValue(values, [
    "passport_issuance_date",
    "passport_issue_date",
    "travel_document_issue_date",
    "issue_date",
  ]) ?? undefined);
  const expiryDate = parseFlexibleDate(findAnswerValue(values, [
    "passport_expiration_date",
    "passport_expiry_date",
    "travel_document_expiry_date",
    "expiry_date",
    "valid_until",
  ]) ?? undefined);

  if (issueDate && expiryDate && expiryDate <= issueDate) {
    return issue("error", "Expiry before issue date");
  }

  const arrivalDate = parseFlexibleDate(findAnswerValue(values, [
    "arrival_date",
    "intended_arrival_date",
    "entry_date",
  ]) ?? undefined);
  const departureDate = parseFlexibleDate(findAnswerValue(values, [
    "departure_date",
    "intended_departure_date",
    "exit_date",
  ]) ?? undefined);

  if (arrivalDate && departureDate && departureDate <= arrivalDate) {
    return issue("error", "Departure before arrival");
  }
  if (arrivalDate && expiryDate && expiryDate < arrivalDate) {
    return issue("error", "Document expires before travel");
  }
  if (arrivalDate && expiryDate && expiryDate < addMonths(arrivalDate, 6)) {
    return issue("warning", "Document expires within 6 months of travel");
  }

  const currentNationality = findAnswerValue(values, ["current_nationality", "nationality_country", "nationality"]);
  const nationalityAtBirth = findAnswerValue(values, ["nationality_at_birth"]);
  const nationalityDifferent = findAnswerValue(values, ["nationality_at_birth_different"]);
  if (
    currentNationality &&
    nationalityAtBirth &&
    nationalityDifferent?.toLowerCase() === "no" &&
    currentNationality.toLowerCase() !== nationalityAtBirth.toLowerCase()
  ) {
    return issue("warning", "Nationality answers may conflict");
  }

  return issue("ok", "AI guidance");
}

function issueButtonClasses(severity: FieldIssueSeverity): string {
  if (severity === "error") return "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
  return "border-[#dbe7f5] bg-[#f8fbff] text-[#03346E] hover:bg-[#eef6ff]";
}

/** Helper: get the repeat_group name from a field's validationRules */
function getRepeatGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { repeatable?: boolean; repeat_group?: string } | null;
  return rules?.repeatable && rules.repeat_group ? rules.repeat_group : null;
}

function getRepeatGroupMax(field: VisaFormFieldRow): number | null {
  const rules = field.validationRules as { repeatable?: boolean; repeat_group?: string; max_items?: number } | null;
  if (!rules?.repeatable || !rules.repeat_group) return null;
  return typeof rules.max_items === "number" && rules.max_items > 0 ? rules.max_items : null;
}

/** Detect the "Purpose of Trip to the U.S." field by label */
function isPurposeOfTripField(field: VisaFormFieldRow): boolean {
  return field.label.toLowerCase().includes("purpose of trip");
}

/** Find the B visa category option value from field options */
function findBOptionValue(options: VisaFormFieldRow["options"]): string | null {
  if (!options) return null;
  for (const opt of options) {
    const val = typeof opt === "string" ? opt : opt.value;
    if (/\(B\)\s*$/.test(val)) return val;
  }
  return null;
}

/** Suffix for repeated instance keys: fieldName__2, fieldName__3, etc. (instance 0 = base) */
function instanceKey(fieldName: string, instance: number): string {
  return instance === 0 ? fieldName : `${fieldName}__${instance + 1}`;
}

/** Get the inline_group from a field's validationRules */
function getInlineGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { inline_group?: string } | null;
  return rules?.inline_group ?? null;
}

/** Get the block_group from a field's validationRules — used to wrap
 *  a set of consecutive non-repeatable fields in a visual container box. */
function getBlockGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { block_group?: string } | null;
  return rules?.block_group ?? null;
}

/** Check if a field should be disabled because a sibling select in its
 *  inline_group currently has "LESS_THAN_24_HOURS" selected.
 *  Works for both regular and repeat-group fields by matching instance suffix. */
function isDisabledByLT24(
  field: VisaFormFieldRow,
  valueKey: string,
  values: Record<string, string>,
  allFields: VisaFormFieldRow[],
): boolean {
  if (field.fieldType === "select") return false;

  const ig = getInlineGroup(field);
  if (!ig) return false;

  const suffix = valueKey.substring(field.fieldName.length);

  for (const sibling of allFields) {
    if (sibling.fieldName === field.fieldName) continue;
    if (getInlineGroup(sibling) !== ig) continue;
    if (sibling.fieldType !== "select") continue;

    const hasLT24 = sibling.options?.some((opt) => {
      const val = typeof opt === "string" ? opt : opt.value;
      return val === "LESS_THAN_24_HOURS";
    });
    if (!hasLT24) continue;

    if (values[sibling.fieldName + suffix] === "LESS_THAN_24_HOURS") return true;
  }

  return false;
}

/** Group consecutive fields sharing the same inline_group into sub-arrays for row rendering */
function groupFieldsInline(fields: VisaFormFieldRow[]): Array<VisaFormFieldRow | VisaFormFieldRow[]> {
  const result: Array<VisaFormFieldRow | VisaFormFieldRow[]> = [];
  let currentInline: string | null = null;
  let currentBatch: VisaFormFieldRow[] = [];

  const flush = () => {
    if (currentBatch.length > 1) {
      result.push(currentBatch);
    } else if (currentBatch.length === 1) {
      result.push(currentBatch[0]);
    }
    currentBatch = [];
    currentInline = null;
  };

  for (const field of fields) {
    const ig = getInlineGroup(field);
    if (ig && ig === currentInline) {
      currentBatch.push(field);
    } else {
      flush();
      if (ig) {
        currentInline = ig;
        currentBatch = [field];
      } else {
        result.push(field);
      }
    }
  }
  flush();
  return result;
}

export function DynamicStepForm({
  step,
  prefill,
  onComplete,
  saving,
  country,
  visaType,
}: DynamicStepFormProps) {
  const tButtons = useTranslations("application.dynamicButtons");
  const locale = useLocale();
  const [activeGuidanceKey, setActiveGuidanceKey] = useState<string | null>(null);

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
    // Seed with the full prefill so cross-step conditionals (e.g. a later step
    // gated on purpose_of_visit from an earlier step) can be evaluated.
    const init: Record<string, string> = { ...prefill };
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group) {
        const count = groupCounts[group] ?? 1;
        for (let i = 0; i < count; i++) {
          const key = instanceKey(field.fieldName, i);
          if (!(key in init)) init[key] = "";
        }
      } else {
        if (!(field.fieldName in init)) init[field.fieldName] = "";
        // Auto-select B for "Purpose of Trip to the U.S."
        if (!init[field.fieldName] && isPurposeOfTripField(field)) {
          const bValue = findBOptionValue(field.options);
          if (bValue) init[field.fieldName] = bValue;
        }
      }
    }
    return init;
  });

  const [textPairs, setTextPairs] = useState<Record<string, BilingualTextValue>>(() => {
    const init: Record<string, BilingualTextValue> = {};
    for (const field of step.fields) {
      if (!isTextLikeField(field)) continue;
      const group = getRepeatGroup(field);
      if (group) {
        const count = groupCounts[group] ?? 1;
        for (let i = 0; i < count; i++) {
          const key = instanceKey(field.fieldName, i);
          init[key] = toInitialBilingualText(prefill[key]);
        }
      } else {
        init[field.fieldName] = toInitialBilingualText(prefill[field.fieldName]);
      }
    }
    return init;
  });

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

  const repeatGroupMax = useMemo(() => {
    const map: Record<string, number> = {};
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (!group) continue;

      const fieldMax = getRepeatGroupMax(field);
      if (fieldMax !== null) {
        map[group] = map[group] ? Math.min(map[group], fieldMax) : fieldMax;
      } else if (!map[group] && REPEAT_GROUP_MAX_OVERRIDES[group]) {
        map[group] = REPEAT_GROUP_MAX_OVERRIDES[group];
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

      // Clear inline-group sibling value fields when LESS_THAN_24_HOURS is selected
      if (value === "LESS_THAN_24_HOURS") {
        const baseFieldName = fieldName.replace(/__\d+$/, "");
        const suffix = fieldName.substring(baseFieldName.length);
        const changedField = step.fields.find((f) => f.fieldName === baseFieldName);
        if (changedField) {
          const ig = getInlineGroup(changedField);
          if (ig) {
            for (const f of step.fields) {
              if (f.fieldName === baseFieldName || getInlineGroup(f) !== ig || f.fieldType === "select") continue;
              next[f.fieldName + suffix] = "";
            }
          }
        }
      }

      return next;
    });
  };

  const handleBilingualTextChange = (fieldName: string, side: BilingualSide, value: string) => {
    const currentPair = textPairs[fieldName] ?? toInitialBilingualText(values[fieldName]);
    const nextPair = side === "zh"
      ? { zh: value, en: toOfficialEnglishValue(value) }
      : { zh: toChineseSourceValue(value), en: value };
    setTextPairs((prev) => ({ ...prev, [fieldName]: nextPair }));

    const officialValue = nextPair.en || nextPair.zh || currentPair.en || currentPair.zh;
    handleChange(fieldName, officialValue);
  };

  const addGroupInstance = (group: string) => {
    const currentCount = groupCounts[group] ?? 1;
    const max = repeatGroupMax[group] ?? Number.POSITIVE_INFINITY;
    if (currentCount >= max) return;

    const count = currentCount + 1;
    setGroupCounts((prev) => ({ ...prev, [group]: count }));
    // Initialize empty values for the new instance
    setValues((prev) => {
      const next = { ...prev };
      for (const field of repeatGroupFields[group] ?? []) {
        next[instanceKey(field.fieldName, count - 1)] = "";
      }
      return next;
    });
    setTextPairs((prev) => {
      const next = { ...prev };
      for (const field of repeatGroupFields[group] ?? []) {
        if (isTextLikeField(field)) {
          next[instanceKey(field.fieldName, count - 1)] = { zh: "", en: "" };
        }
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
    setTextPairs((prev) => {
      const next = { ...prev };
      const fields = repeatGroupFields[group] ?? [];
      for (let i = instanceIdx; i < count - 1; i++) {
        for (const field of fields) {
          if (isTextLikeField(field)) {
            next[instanceKey(field.fieldName, i)] = next[instanceKey(field.fieldName, i + 1)] ?? { zh: "", en: "" };
          }
        }
      }
      for (const field of fields) {
        if (isTextLikeField(field)) {
          delete next[instanceKey(field.fieldName, count - 1)];
        }
      }
      return next;
    });
    setGroupCounts((prev) => ({ ...prev, [group]: count - 1 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(values);
  };

  // Detect yes/no toggles that gate subsequent fields until answered.
  // These are toggles where following fields should be hidden until the user picks Yes or No.
  const gatingToggles = useMemo(() => {
    const GATING_LABEL_PATTERNS = [
      "specific travel plan",
      "part of a group",
      "traveling with",
      "persons traveling with",
    ];
    return step.fields
      .filter((f) =>
        (f.fieldType === "radio" || f.fieldType === "select") &&
        GATING_LABEL_PATTERNS.some((p) => f.label.toLowerCase().includes(p))
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [step.fields]);

  /** Check whether a field should be hidden because a preceding yes/no toggle is unanswered
   *  or because it requires a specific toggle answer (e.g. companion fields only for "No"). */
  const isGatedByUnansweredToggle = useCallback((field: VisaFormFieldRow): boolean => {
    if (field.conditionalLogic) return false; // has explicit DB logic, skip gating

    // Find the nearest preceding gating toggle
    const precedingToggle = gatingToggles
      .filter((t) => t.displayOrder < field.displayOrder && t.fieldName !== field.fieldName)
      .at(-1); // last one = nearest preceding

    if (!precedingToggle) return false;

    const toggleValue = (values[precedingToggle.fieldName] ?? "").trim();

    // Toggle not answered → always hide
    if (!toggleValue) return true;

    // "Group or organization" toggle: companion person fields only show for "No"
    const isGroupToggle =
      precedingToggle.label.toLowerCase().includes("part of a group") ||
      precedingToggle.label.toLowerCase().includes("group or organization");
    if (isGroupToggle) {
      const lbl = field.label.toLowerCase();
      const isCompanionField =
        lbl.includes("person traveling") ||
        lbl.includes("companion") ||
        lbl.includes("relationship with person");
      if (isCompanionField && toggleValue.toLowerCase() !== "no") return true;
    }

    return false;
  }, [gatingToggles, values]);

  // Required validation: only check visible fields (and all instances of repeat groups)
  const requiredFilled = step.fields
    .filter((f) => f.required)
    // Annex-I-style starred fields: required_unless exempts the field when its
    // expression evaluates true (e.g. UK Withdrawal Agreement beneficiaries
    // skip fields 21/22/30/31/32 of the Schengen form).
    .filter((f) => !isRequiredUnlessSatisfied(f, values))
    .filter((f) => {
      if (isGatedByUnansweredToggle(f)) return false;
      if (isDisabledByLT24(f, f.fieldName, values, step.fields)) return false;
      return evaluateShowIf(f, values, step.fields);
    })
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
    const rawPlaceholder = field.placeholder
      ?? (field.fieldType === "select" ? tButtons("selectFallback") : null);
    const zhPlaceholder = getChinesePlaceholder(rawPlaceholder, field.fieldName);
    const enPlaceholder = getEnglishPlaceholder(rawPlaceholder);

    // Filter purpose of trip to only show "B" option
    let fieldOptions = field.options;
    if (isPurposeOfTripField(field) && fieldOptions) {
      fieldOptions = fieldOptions.filter((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        return /\(B\)\s*$/.test(val);
      });
    }

    const isLockedPurpose = isPurposeOfTripField(field);
    const lt24Disabled = isDisabledByLT24(field, valueKey, values, step.fields);
    const isTextLike = isTextLikeField(field);
    const pair = textPairs[valueKey] ?? toInitialBilingualText(values[valueKey]);

    const renderSide = (side: BilingualSide) => {
      const sideField: VisaFormFieldRow = {
        ...field,
        fieldName: `${valueKey}-${side}`,
        label: side === "zh" ? getChineseLabel(field.label, field.fieldName) : getEnglishLabel(field.label),
        placeholder: side === "zh" ? zhPlaceholder : enPlaceholder,
        options: getSideOptions(fieldOptions, side),
      };

      return (
        <DynamicFormField
          key={`${valueKey}-${side}`}
          field={sideField}
          value={isTextLike ? pair[side] : (values[valueKey] ?? "")}
          onChange={(nextValue) => {
            if (isTextLike) {
              handleBilingualTextChange(valueKey, side, nextValue);
              return;
            }
            handleChange(valueKey, nextValue);
          }}
          forceWhiteBackground={forceWhiteBackground}
          disabled={isLockedPurpose || lt24Disabled}
          displayLocale={side}
        />
      );
    };

    const guidanceField: VisaFormFieldRow = {
      ...field,
      options: fieldOptions ?? null,
    };
    const issue = getLocalFieldIssue(guidanceField, valueKey, values[valueKey] ?? "", values);
    const panelOpen = activeGuidanceKey === valueKey;
    const resolvedVisaType = visaType ?? field.visaType ?? step.fields[0]?.visaType ?? "B211A";
    const buttonLabel = panelOpen
      ? locale.startsWith("zh") ? "AI 帮助已打开" : "AI help open"
      : issue.severity === "ok"
        ? locale.startsWith("zh") ? "问 AI" : "Ask AI"
        : locale.startsWith("zh") ? "查看提示" : "Review tip";
    const IssueIcon = issue.severity === "error"
      ? AlertCircle
      : issue.severity === "warning"
        ? HelpCircle
        : CheckCircle2;

    return (
      <div
        key={valueKey}
        className={cn(
          "rounded-lg border border-transparent p-2 transition-colors",
          panelOpen ? "border-[#dbe7f5] bg-[#fbfdff]" : "hover:border-[#eef3f8]",
        )}
        onClick={() => setActiveGuidanceKey(valueKey)}
        onFocusCapture={() => setActiveGuidanceKey(valueKey)}
      >
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {renderSide("zh")}
          {renderSide("en")}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          {issue.severity !== "ok" && (
            <span className={cn("text-[12px] font-medium", issue.severity === "error" ? "text-red-600" : "text-amber-700")}>
              {issue.message}
            </span>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setActiveGuidanceKey(valueKey);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
              issueButtonClasses(issue.severity),
            )}
            aria-expanded={panelOpen}
            aria-label={buttonLabel}
          >
            {issue.severity === "ok" ? <Bot className="h-3.5 w-3.5" /> : <IssueIcon className="h-3.5 w-3.5" />}
            {buttonLabel}
          </button>
        </div>
        {panelOpen && (
          <div className="mt-3">
            <FieldGuidancePanel
              country={country}
              visaType={resolvedVisaType}
              locale={locale}
              field={guidanceField}
              answer={values[valueKey] ?? ""}
              allAnswers={values}
              onClose={() => setActiveGuidanceKey(null)}
            />
          </div>
        )}
      </div>
    );
  };

  // Build the ordered list of render items (fields + repeat groups)
  const renderedGroups = new Set<string>();
  const renderedInlineGroups = new Set<string>();
  const renderedBlockGroups = new Set<string>();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {step.fields.map((field) => {
        // Evaluate conditional logic — force-show fields that are LT24-disabled rather than hiding them
        if (!evaluateShowIf(field, values, step.fields) && !isDisabledByLT24(field, field.fieldName, values, step.fields)) return null;
        // Hide fields gated by an unanswered toggle (e.g. travel plans)
        if (isGatedByUnansweredToggle(field)) return null;

        const group = getRepeatGroup(field);

        // Non-repeatable field
        if (!group) {
          // Block group: wrap a consecutive set of non-repeatable fields in a
          // container box, rendered once for the group.
          const bg = getBlockGroup(field);
          if (bg) {
            if (renderedBlockGroups.has(bg)) return null;
            renderedBlockGroups.add(bg);

            const blockFields = step.fields.filter(
              (f) =>
                !getRepeatGroup(f) &&
                getBlockGroup(f) === bg &&
                (evaluateShowIf(f, values, step.fields) || isDisabledByLT24(f, f.fieldName, values, step.fields)) &&
                !isGatedByUnansweredToggle(f),
            );

            if (blockFields.length === 0) return null;

            const renderedInlineInBlock = new Set<string>();
            return (
              <div
                key={`block-${bg}`}
                className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-4 flex flex-col gap-4"
              >
                {blockFields.map((f) => {
                  const inlineInBlock = getInlineGroup(f);
                  if (inlineInBlock) {
                    if (renderedInlineInBlock.has(inlineInBlock)) return null;
                    renderedInlineInBlock.add(inlineInBlock);
                    const inlineFields = blockFields.filter((x) => getInlineGroup(x) === inlineInBlock);
                    if (inlineFields.length <= 1) return renderField(f, f.fieldName, true);
                    return (
                      <div key={`inline-${inlineInBlock}`} className="grid gap-4">
                        {inlineFields.map((x) => renderField(x, x.fieldName, true))}
                      </div>
                    );
                  }
                  return renderField(f, f.fieldName, true);
                })}
              </div>
            );
          }

          const ig = getInlineGroup(field);
          if (ig) {
            // Inline group: render all visible fields in this group together, once
            if (renderedInlineGroups.has(ig)) return null;
            renderedInlineGroups.add(ig);

            const inlineFields = step.fields.filter(
              (f) =>
                !getRepeatGroup(f) &&
                getInlineGroup(f) === ig &&
                (evaluateShowIf(f, values, step.fields) || isDisabledByLT24(f, f.fieldName, values, step.fields)) &&
                !isGatedByUnansweredToggle(f)
            );

            if (inlineFields.length <= 1) {
              return renderField(inlineFields[0], inlineFields[0].fieldName);
            }

            return (
              <div key={`inline-${ig}`} className="grid gap-4">
                {inlineFields.map((f) => renderField(f, f.fieldName))}
              </div>
            );
          }
          return renderField(field, field.fieldName);
        }

        // Repeatable group: render the whole group container once
        if (renderedGroups.has(group)) return null;
        renderedGroups.add(group);

        const groupFields = repeatGroupFields[group] ?? [];
        // Check if at least one field in group is visible
        const visibleGroupFields = groupFields.filter((f) =>
          evaluateShowIf(f, values, step.fields) || isDisabledByLT24(f, f.fieldName, values, step.fields)
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
                {groupFieldsInline(visibleGroupFields).map((item) => {
                  if (Array.isArray(item)) {
                    return (
                      <div key={item.map((f) => f.fieldName).join("-")} className="grid gap-4">
                        {item.map((f) => renderField(f, instanceKey(f.fieldName, instanceIdx), true))}
                      </div>
                    );
                  }
                  return renderField(item, instanceKey(item.fieldName, instanceIdx), true);
                })}
              </div>
            ))}
            {(groupCounts[group] ?? 1) < (repeatGroupMax[group] ?? REPEAT_GROUP_DEFAULT_MAX) && (
              <button
                type="button"
                onClick={() => addGroupInstance(group)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#03346E] hover:text-[#022a5a] transition-colors self-start cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {tButtons("addAnother")}
              </button>
            )}
          </div>
        );
      })}

      <BrandActionButton
        type="submit"
        disabled={!requiredFilled}
        loading={saving}
        loadingText={tButtons("saving")}
        className="mt-2"
      >
        {tButtons("continue")}
      </BrandActionButton>
      <div className="fixed bottom-4 right-4 z-40 flex max-w-[260px] items-center gap-2 rounded-lg border border-[#dbe7f5] bg-white/95 px-3 py-2 text-[12px] text-[#3f4652] shadow-lg backdrop-blur">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#03346E] text-white">
          <Bot className="h-4 w-4" />
        </span>
        <span>
          {locale.startsWith("zh")
            ? "对问题有疑问？点击题目旁的 AI 提示。"
            : "Need help? Click the AI tip beside any question."}
        </span>
      </div>
    </form>
  );
}
