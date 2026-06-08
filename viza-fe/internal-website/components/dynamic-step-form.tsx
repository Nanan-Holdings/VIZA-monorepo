"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Bot, Plus, Trash2 } from "lucide-react";
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
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

interface DynamicStepFormProps {
  step: WizardStep;
  prefill: Record<string, string>;
  onComplete: (data: Record<string, string>) => void;
  onDraftChange?: (data: Record<string, string>) => void;
  saving?: boolean;
  country?: string | null;
  visaType?: string;
}

const REPEAT_GROUP_MAX_OVERRIDES: Record<string, number> = {
  specific_travel_plans: 1,
};

/** Default max instances for repeatable groups without an explicit max_items */
const REPEAT_GROUP_DEFAULT_MAX = 5;

const SCHENGEN_DESTINATION_BY_COUNTRY_SLUG: Record<string, string> = {
  austria: "Austria",
  belgium: "Belgium",
  bulgaria: "Bulgaria",
  croatia: "Croatia",
  czech_republic: "Czechia",
  czechia: "Czechia",
  denmark: "Denmark",
  estonia: "Estonia",
  finland: "Finland",
  france: "France",
  germany: "Germany",
  greece: "Greece",
  hungary: "Hungary",
  iceland: "Iceland",
  italy: "Italy",
  latvia: "Latvia",
  liechtenstein: "Liechtenstein",
  lithuania: "Lithuania",
  luxembourg: "Luxembourg",
  malta: "Malta",
  netherlands: "Netherlands",
  norway: "Norway",
  poland: "Poland",
  portugal: "Portugal",
  romania: "Romania",
  slovakia: "Slovakia",
  slovenia: "Slovenia",
  spain: "Spain",
  sweden: "Sweden",
  switzerland: "Switzerland",
};

type BilingualSide = "zh" | "en";

interface BilingualTextValue {
  zh: string;
  en: string;
}

interface FormHistorySnapshot {
  values: Record<string, string>;
  textPairs: Record<string, BilingualTextValue>;
  groupCounts: Record<string, number>;
}

interface CloudTranslationCandidate {
  valueKey: string;
  sourceText: string;
}

type ApplicationTranslateResponse = {
  translatedText?: unknown;
};

type FieldIssueSeverity = "ok" | "warning" | "error";

interface FieldIssue {
  severity: FieldIssueSeverity;
  message: string;
}

const TEXT_EDITING_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

const CLOUD_TRANSLATION_DEBOUNCE_MS = 350;
const CLOUD_TRANSLATION_CACHE = new Map<string, string>();

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return TEXT_EDITING_INPUT_TYPES.has(target.type);
  }
  return false;
}

function cloneTextPairs(pairs: Record<string, BilingualTextValue>): Record<string, BilingualTextValue> {
  return Object.fromEntries(
    Object.entries(pairs).map(([key, value]) => [key, { ...value }]),
  );
}

function isTextLikeField(field: VisaFormFieldRow): boolean {
  return field.fieldType === "text" || field.fieldType === "textarea";
}

function hasChineseText(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function isMachineTranslationSensitiveField(field: VisaFormFieldRow): boolean {
  const fieldName = field.fieldName.toLowerCase();
  const label = field.label.toLowerCase();
  return (
    /(?:^|_)(surname|surnames|given_names?|family_name|first_name|last_name|middle_name|full_name|native_full_name)(?:_|$)/.test(fieldName)
    || /\b(surname|surnames|given names|family name|first name|last name|middle name|full name)\b/.test(label)
    || /(?:^|_)(email|phone|telephone|number|identifier|password|url|ssn|taxpayer)(?:_|$)/.test(fieldName)
  );
}

function shouldRequestCloudTranslation(field: VisaFormFieldRow, pair: BilingualTextValue): boolean {
  const sourceText = pair.zh.trim();
  if (!sourceText || !hasChineseText(sourceText)) return false;
  if (isMachineTranslationSensitiveField(field)) return false;
  if (pair.en.trim() && !hasChineseText(pair.en)) return false;

  const localEnglish = toOfficialEnglishValue(sourceText).trim();
  return !localEnglish || hasChineseText(localEnglish);
}

function normalizeCloudTranslation(value: string, sourceText: string): string | null {
  const translated = value.replace(/\s+/g, " ").trim();
  if (!translated) return null;
  if (translated === sourceText.trim()) return null;
  if (hasChineseText(translated)) return null;
  return translated;
}

async function requestCloudEnglishTranslation(
  sourceText: string,
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetch("/api/translations/field", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: sourceText,
      sourceLanguage: "zh-CN",
      targetLanguage: "en",
      fieldType: "text",
    }),
    signal,
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as ApplicationTranslateResponse;
  return typeof payload.translatedText === "string" ? payload.translatedText : null;
}

function getBilingualPrefillText(
  key: string,
  prefill: Record<string, string>,
  fallbackValue?: string,
): BilingualTextValue {
  const zh = prefill[`${key}_zh`]?.trim();
  const en = prefill[`${key}_en`]?.trim();
  if (zh || en) {
    return {
      zh: zh || toChineseSourceValue(en ?? fallbackValue ?? ""),
      en: en || toOfficialEnglishValue(zh ?? fallbackValue ?? ""),
    };
  }
  return toInitialBilingualText(fallbackValue);
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
    if (typeof option === "string") {
      return {
        value: option,
        text: side === "zh" ? getChineseOptionText(option) : getEnglishOptionText(option),
      };
    }

    const value = option.value;
    const sourceText = option.official_label ?? option.text ?? option.label_en ?? option.value;
    const text = side === "zh"
      ? (option.label_zh ?? getChineseOptionText(sourceText))
      : (option.label_en ?? getEnglishOptionText(sourceText));
    return {
      value,
      text,
    };
  });
}

function getValidationRuleText(
  field: VisaFormFieldRow,
  keys: string[],
): string | null {
  const rules = field.validationRules;
  if (!rules) return null;
  for (const key of keys) {
    const value = rules[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getLocalizedFieldLabel(field: VisaFormFieldRow, side: BilingualSide): string {
  if (side === "zh") {
    return getValidationRuleText(field, ["label_zh", "zh_label"])
      ?? getChineseLabel(field.label, field.fieldName);
  }
  return getValidationRuleText(field, ["label_en", "official_label_en", "official_label"])
    ?? getEnglishLabel(field.label);
}

function getLocalizedPlaceholder(
  field: VisaFormFieldRow,
  side: BilingualSide,
  fallback: string | null,
): string | null {
  return getValidationRuleText(
    field,
    side === "zh" ? ["placeholder_zh", "zh_placeholder"] : ["placeholder_en", "en_placeholder"],
  ) ?? fallback;
}

function buildStrictDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseFlexibleDate(value?: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "DO_NOT_KNOW" || trimmed === "DOES_NOT_APPLY") return null;

  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const official = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const chinese = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);

  if (iso) return buildStrictDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (official) return buildStrictDate(Number(official[3]), Number(official[2]), Number(official[1]));
  if (chinese) return buildStrictDate(Number(chinese[1]), Number(chinese[2]), Number(chinese[3]));

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

const DOCUMENT_ISSUE_DATE_CANDIDATES = [
  "passport_issuance_date",
  "passport_issue_date",
  "passport_date_of_issue",
  "travel_document_issue_date",
  "date_of_issue",
  "issue_date",
] as const;

const DOCUMENT_EXPIRY_DATE_CANDIDATES = [
  "passport_expiration_date",
  "passport_expiry_date",
  "passport_date_of_expiry",
  "travel_document_expiry_date",
  "date_of_expiry",
  "expiration_date",
  "expiry_date",
  "valid_until",
] as const;

const ARRIVAL_DATE_CANDIDATES = [
  "arrival_date",
  "intended_arrival_date",
  "entry_date",
] as const;

const DEPARTURE_DATE_CANDIDATES = [
  "departure_date",
  "intended_departure_date",
  "date_of_departure",
  "exit_date",
] as const;

const NATIONALITY_CONSISTENCY_CANDIDATES = [
  "current_nationality",
  "nationality_country",
  "nationality",
  "nationality_at_birth",
  "nationality_at_birth_different",
] as const;

function getRepeatInstanceSuffix(key: string): string {
  return key.match(/__\d+$/)?.[0] ?? "";
}

function stripRepeatInstanceSuffix(key: string): string {
  return key.replace(/__\d+$/, "");
}

function normaliseFieldKey(key: string): string {
  return stripRepeatInstanceSuffix(key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fieldKeyMatchesCandidate(key: string, candidate: string): boolean {
  const normalisedKey = normaliseFieldKey(key);
  const normalisedCandidate = normaliseFieldKey(candidate);
  return (
    normalisedKey === normalisedCandidate ||
    normalisedKey.endsWith(`_${normalisedCandidate}`) ||
    normalisedKey.includes(`_${normalisedCandidate}_`)
  );
}

function fieldKeyMatchesAny(key: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => fieldKeyMatchesCandidate(key, candidate));
}

function currentFieldMatchesAny(
  field: VisaFormFieldRow,
  valueKey: string,
  candidates: readonly string[],
): boolean {
  return fieldKeyMatchesAny(field.fieldName, candidates) || fieldKeyMatchesAny(valueKey, candidates);
}

function fieldSearchText(field: VisaFormFieldRow, valueKey: string): string {
  return `${field.fieldName} ${valueKey} ${field.label} ${field.stepName ?? ""}`.toLowerCase();
}

function isCurrentDocumentExpiryField(field: VisaFormFieldRow, valueKey: string): boolean {
  if (!currentFieldMatchesAny(field, valueKey, DOCUMENT_EXPIRY_DATE_CANDIDATES)) return false;

  const searchText = fieldSearchText(field, valueKey);
  if (
    searchText.includes("entry permit") ||
    searchText.includes("prior schengen") ||
    searchText.includes("last schengen visa")
  ) {
    return false;
  }

  return (
    searchText.includes("passport") ||
    searchText.includes("travel_document") ||
    searchText.includes("travel document") ||
    searchText.includes("expiry date") ||
    searchText.includes("expiration date") ||
    fieldKeyMatchesAny(valueKey, ["date_of_expiry", "expiration_date", "expiry_date"])
  );
}

function isCurrentDepartureDateField(field: VisaFormFieldRow, valueKey: string): boolean {
  return currentFieldMatchesAny(field, valueKey, DEPARTURE_DATE_CANDIDATES);
}

function isCurrentNationalityConsistencyField(field: VisaFormFieldRow, valueKey: string): boolean {
  return currentFieldMatchesAny(field, valueKey, NATIONALITY_CONSISTENCY_CANDIDATES);
}

function findAnswerValue(
  values: Record<string, string>,
  candidates: readonly string[],
  repeatSuffix = "",
): string | null {
  if (repeatSuffix) {
    for (const candidate of candidates) {
      const value = values[`${candidate}${repeatSuffix}`];
      if (value?.trim()) return value;
    }
  }

  for (const candidate of candidates) {
    const value = values[candidate];
    if (value?.trim()) return value;
  }

  const entries = Object.entries(values);
  for (const candidate of candidates) {
    const found = entries.find(([key, value]) =>
      (!repeatSuffix || key.endsWith(repeatSuffix)) &&
      fieldKeyMatchesCandidate(key, candidate) &&
      value.trim()
    );
    if (found) return found[1];
  }

  return null;
}

function normaliseFieldOptions(options: VisaFormFieldRow["options"]): Array<{ value: string; text: string }> {
  if (!options) return [];
  return options.map((option) => {
    if (typeof option === "string") return { value: option, text: option };
    return {
      value: option.value,
      text: option.text ?? option.label_en ?? option.label_zh ?? option.official_label ?? option.value,
    };
  });
}

function isAuxiliaryBilingualKey(key: string): boolean {
  return /_(zh|en)$/.test(key);
}

function filterCurrentStepValues(
  fields: VisaFormFieldRow[],
  values: Record<string, string>,
  groupCounts: Record<string, number>,
): Record<string, string> {
  const allowedKeys = new Set<string>();
  for (const field of fields) {
    const group = getRepeatGroup(field);
    if (group) {
      const count = groupCounts[group] ?? 1;
      for (let i = 0; i < count; i++) {
        allowedKeys.add(instanceKey(field.fieldName, i));
      }
    } else {
      allowedKeys.add(field.fieldName);
    }
  }

  const filtered: Record<string, string> = {};
  for (const key of allowedKeys) {
    if (isAuxiliaryBilingualKey(key)) continue;
    filtered[key] = values[key] ?? "";
  }
  return filtered;
}

function getLocalFieldIssue(
  field: VisaFormFieldRow,
  valueKey: string,
  value: string,
  values: Record<string, string>,
  locale: string,
): FieldIssue {
  const isZh = isChineseLocale(locale);
  const trimmed = value.trim();
  const rules = field.validationRules as {
    maxLength?: number;
    pattern?: string;
  } | null;
  const issue = (severity: FieldIssueSeverity, message: string): FieldIssue => ({ severity, message });

  if (field.required && !trimmed) {
    return issue("warning", isZh ? "必填项" : "Required");
  }

  if (rules?.maxLength && trimmed.length > rules.maxLength) {
    return issue("error", isZh ? `最多 ${rules.maxLength} 个字符` : `Maximum ${rules.maxLength} characters`);
  }

  if (rules?.pattern && trimmed) {
    try {
      if (!new RegExp(rules.pattern).test(trimmed)) {
        return issue("error", isZh ? "格式不符合要求" : "Format does not match the requirement");
      }
    } catch {
      // Ignore malformed schema regexes here; the backend logs them.
    }
  }

  const options = normaliseFieldOptions(field.options);
  if (
    (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "checkbox") &&
    trimmed &&
    options.length > 0
  ) {
    const optionMatch = options.some(
      (option) =>
        option.value.toLowerCase() === trimmed.toLowerCase() ||
        option.text.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!optionMatch) return issue("error", isZh ? "请选择题目提供的选项" : "Choose one of the provided options");
  }

  const currentDate = field.fieldType === "date" ? parseFlexibleDate(trimmed) : null;
  if (field.fieldType === "date" && trimmed && !currentDate) {
    return issue("error", isZh ? "日期格式不符合要求" : "Date format does not match the requirement");
  }

  if (
    currentDate &&
    (valueKey.toLowerCase().includes("birth") || field.fieldName.toLowerCase().includes("birth")) &&
    currentDate > new Date()
  ) {
    return issue("error", isZh ? "出生日期不能晚于今天" : "Date of birth cannot be later than today");
  }

  const repeatSuffix = getRepeatInstanceSuffix(valueKey);
  const issueDate = parseFlexibleDate(findAnswerValue(
    values,
    DOCUMENT_ISSUE_DATE_CANDIDATES,
    repeatSuffix,
  ) ?? undefined);
  const expiryDate = parseFlexibleDate(findAnswerValue(
    values,
    DOCUMENT_EXPIRY_DATE_CANDIDATES,
    repeatSuffix,
  ) ?? undefined);

  if (isCurrentDocumentExpiryField(field, valueKey) && issueDate && expiryDate && expiryDate <= issueDate) {
    return issue("error", isZh ? "到期日必须晚于签发日" : "Expiry date must be after the issue date");
  }

  const arrivalDate = parseFlexibleDate(findAnswerValue(
    values,
    ARRIVAL_DATE_CANDIDATES,
    repeatSuffix,
  ) ?? undefined);
  const departureDate = parseFlexibleDate(findAnswerValue(
    values,
    DEPARTURE_DATE_CANDIDATES,
    repeatSuffix,
  ) ?? undefined);

  if (isCurrentDepartureDateField(field, valueKey) && arrivalDate && departureDate && departureDate <= arrivalDate) {
    return issue("error", isZh ? "离开日期必须晚于到达日期" : "Departure date must be after arrival date");
  }
  if (isCurrentDocumentExpiryField(field, valueKey) && arrivalDate && expiryDate && expiryDate < arrivalDate) {
    return issue("error", isZh ? "证件到期日在旅行日期之前" : "Document expires before the travel date");
  }
  if (isCurrentDocumentExpiryField(field, valueKey) && arrivalDate && expiryDate && expiryDate < addMonths(arrivalDate, 6)) {
    return issue("warning", isZh ? "证件有效期距离旅行日期不足 6 个月" : "Document validity is less than 6 months from the travel date");
  }

  const currentNationality = findAnswerValue(values, ["current_nationality", "nationality_country", "nationality"]);
  const nationalityAtBirth = findAnswerValue(values, ["nationality_at_birth"]);
  const nationalityDifferent = findAnswerValue(values, ["nationality_at_birth_different"]);
  if (
    currentNationality &&
    nationalityAtBirth &&
    nationalityDifferent?.toLowerCase() === "no" &&
    currentNationality.toLowerCase() !== nationalityAtBirth.toLowerCase() &&
    isCurrentNationalityConsistencyField(field, valueKey)
  ) {
    return issue("warning", isZh ? "国籍相关答案可能不一致" : "Nationality answers may be inconsistent");
  }

  return issue("ok", isZh ? "AI 填写帮助" : "AI field guidance");
}

function issueMessageClasses(severity: FieldIssueSeverity): string {
  if (severity === "error") return "text-red-600";
  return "text-[#03346E]";
}

function copilotButtonClasses(): string {
  return "border-[#b8d3f3] bg-[#eef6ff] text-[#03346E] hover:bg-[#e3f0ff]";
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

function getOptionValueAndText(option: NonNullable<VisaFormFieldRow["options"]>[number]): { value: string; text: string } {
  if (typeof option === "string") return { value: option, text: option };
  return {
    value: option.value ?? "",
    text: option.text ?? option.label_en ?? option.label_zh ?? option.official_label ?? option.value ?? "",
  };
}

function isBTripPurposeOption(option: NonNullable<VisaFormFieldRow["options"]>[number]): boolean {
  const { value, text } = getOptionValueAndText(option);
  return [value, text].some((part) => {
    const normalized = part.trim().toLowerCase();
    return normalized === "b" || /\(b\)\s*$/.test(normalized);
  });
}

/** Find the B visa category option value from field options */
function findBOptionValue(options: VisaFormFieldRow["options"]): string | null {
  if (!options) return null;
  for (const opt of options) {
    if (isBTripPurposeOption(opt)) {
      const { value, text } = getOptionValueAndText(opt);
      return value || text;
    }
  }
  return null;
}

function normalizeCountrySlug(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getDefaultFieldValue(
  field: VisaFormFieldRow,
  country?: string | null,
  visaType?: string,
): string {
  if (
    visaType === "EU_SCHENGEN_C_SHORT_STAY" &&
    field.fieldName === "main_destination_country"
  ) {
    return SCHENGEN_DESTINATION_BY_COUNTRY_SLUG[normalizeCountrySlug(country)] ?? "";
  }

  if (!isPurposeOfTripField(field)) return "";
  return findBOptionValue(field.options) ?? "";
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
  onDraftChange,
  saving,
  country,
  visaType,
}: DynamicStepFormProps) {
  const tButtons = useTranslations("application.dynamicButtons");
  const locale = useLocale();
  const isChineseInterface = isChineseLocale(locale);
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
          const defaultValue = getDefaultFieldValue(field, country, visaType);
          if (!(key in init)) {
            init[key] = defaultValue;
          } else if (!init[key] && defaultValue) {
            init[key] = defaultValue;
          }
        }
      } else {
        const defaultValue = getDefaultFieldValue(field, country, visaType);
        if (!(field.fieldName in init)) {
          init[field.fieldName] = defaultValue;
        } else if (!init[field.fieldName] && defaultValue) {
          init[field.fieldName] = defaultValue;
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
          init[key] = getBilingualPrefillText(key, prefill, prefill[key]);
        }
      } else {
        init[field.fieldName] = getBilingualPrefillText(field.fieldName, prefill, prefill[field.fieldName]);
      }
    }
    return init;
  });

  const valuesRef = useRef(values);
  const textPairsRef = useRef(textPairs);
  const groupCountsRef = useRef(groupCounts);
  const onDraftChangeRef = useRef(onDraftChange);
  const previousPrefillRef = useRef(prefill);
  const undoStackRef = useRef<FormHistorySnapshot[]>([]);
  const redoStackRef = useRef<FormHistorySnapshot[]>([]);
  const pendingCloudTranslationsRef = useRef(new Set<string>());

  valuesRef.current = values;
  textPairsRef.current = textPairs;
  groupCountsRef.current = groupCounts;

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  const getSnapshot = (): FormHistorySnapshot => ({
    values: { ...valuesRef.current },
    textPairs: cloneTextPairs(textPairsRef.current),
    groupCounts: { ...groupCountsRef.current },
  });

  const restoreSnapshot = (snapshot: FormHistorySnapshot) => {
    valuesRef.current = snapshot.values;
    textPairsRef.current = snapshot.textPairs;
    groupCountsRef.current = snapshot.groupCounts;
    setValues(snapshot.values);
    setTextPairs(snapshot.textPairs);
    setGroupCounts(snapshot.groupCounts);
  };

  const pushUndoSnapshot = () => {
    undoStackRef.current = [...undoStackRef.current.slice(-79), getSnapshot()];
    redoStackRef.current = [];
  };

  const applyCloudTranslation = useCallback((valueKey: string, sourceText: string, translatedText: string) => {
    const normalized = normalizeCloudTranslation(translatedText, sourceText);
    if (!normalized) return;

    const currentPair = textPairsRef.current[valueKey];
    if (!currentPair || currentPair.zh.trim() !== sourceText) return;
    if (currentPair.en.trim() && !hasChineseText(currentPair.en)) return;

    const nextPair = { ...currentPair, en: normalized };
    const nextTextPairs = { ...textPairsRef.current, [valueKey]: nextPair };
    textPairsRef.current = nextTextPairs;
    setTextPairs(nextTextPairs);

    const currentValue = valuesRef.current[valueKey] ?? "";
    if (!currentValue.trim() || currentValue === currentPair.en || hasChineseText(currentValue)) {
      const nextValues = { ...valuesRef.current, [valueKey]: normalized };
      valuesRef.current = nextValues;
      setValues(nextValues);
    }
  }, []);

  useEffect(() => {
    const previousPrefill = previousPrefillRef.current;
    let valuesChanged = false;
    let textPairsChanged = false;
    const nextValues = { ...valuesRef.current };
    const nextTextPairs = cloneTextPairs(textPairsRef.current);

    const applyPrefillValue = (key: string, field: VisaFormFieldRow) => {
      const nextPrefill = prefill[key]?.trim();
      if (!nextPrefill) return;

      const currentValue = valuesRef.current[key] ?? "";
      const previousValue = previousPrefill[key] ?? "";
      if (currentValue.trim() && currentValue !== previousValue) return;

      if (nextValues[key] !== nextPrefill) {
        nextValues[key] = nextPrefill;
        valuesChanged = true;
      }

      if (isTextLikeField(field)) {
        const currentPair = textPairsRef.current[key] ?? { zh: "", en: "" };
        const pairWasEdited = Boolean(currentPair.zh.trim() || currentPair.en.trim()) && currentValue !== previousValue;
        if (!pairWasEdited) {
          nextTextPairs[key] = getBilingualPrefillText(key, prefill, nextPrefill);
          textPairsChanged = true;
        }
      }
    };

    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group) {
        const count = groupCountsRef.current[group] ?? 1;
        for (let i = 0; i < count; i++) {
          applyPrefillValue(instanceKey(field.fieldName, i), field);
        }
      } else {
        applyPrefillValue(field.fieldName, field);
      }
    }

    previousPrefillRef.current = prefill;
    if (valuesChanged) {
      valuesRef.current = nextValues;
      setValues(nextValues);
    }
    if (textPairsChanged) {
      textPairsRef.current = nextTextPairs;
      setTextPairs(nextTextPairs);
    }
  }, [prefill, step.fields]);

  useEffect(() => {
    onDraftChangeRef.current?.(filterCurrentStepValues(step.fields, values, groupCounts));
  }, [groupCounts, step.fields, values]);

  useEffect(() => {
    const candidates: CloudTranslationCandidate[] = [];

    for (const field of step.fields) {
      if (!isTextLikeField(field)) continue;
      const group = getRepeatGroup(field);
      const valueKeys = group
        ? Array.from({ length: groupCounts[group] ?? 1 }, (_, index) => instanceKey(field.fieldName, index))
        : [field.fieldName];

      for (const valueKey of valueKeys) {
        const pair = textPairs[valueKey];
        if (pair && shouldRequestCloudTranslation(field, pair)) {
          candidates.push({ valueKey, sourceText: pair.zh.trim() });
        }
      }
    }

    if (candidates.length === 0) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      for (const candidate of candidates) {
        const cacheKey = `zh-CN:en:${candidate.sourceText}`;
        const cached = CLOUD_TRANSLATION_CACHE.get(cacheKey);
        if (cached) {
          applyCloudTranslation(candidate.valueKey, candidate.sourceText, cached);
          continue;
        }

        if (pendingCloudTranslationsRef.current.has(cacheKey)) continue;
        pendingCloudTranslationsRef.current.add(cacheKey);

        void requestCloudEnglishTranslation(candidate.sourceText, controller.signal)
          .then((translatedText) => {
            if (!translatedText) return;
            const normalized = normalizeCloudTranslation(translatedText, candidate.sourceText);
            if (!normalized) return;
            CLOUD_TRANSLATION_CACHE.set(cacheKey, normalized);
            applyCloudTranslation(candidate.valueKey, candidate.sourceText, normalized);
          })
          .catch(() => {
            // Translation is a convenience sync; leave local fallback intact.
          })
          .finally(() => {
            pendingCloudTranslationsRef.current.delete(cacheKey);
          });
      }
    }, CLOUD_TRANSLATION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [applyCloudTranslation, groupCounts, step.fields, textPairs]);

  const undoLastFormChange = () => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return false;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current.slice(-79), getSnapshot()];
    restoreSnapshot(previous);
    return true;
  };

  const redoLastFormChange = () => {
    const next = redoStackRef.current.at(-1);
    if (!next) return false;
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current.slice(-79), getSnapshot()];
    restoreSnapshot(next);
    return true;
  };

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

  const handleChange = (fieldName: string, value: string, options?: { recordUndo?: boolean }) => {
    if (options?.recordUndo !== false && valuesRef.current[fieldName] !== value) {
      pushUndoSnapshot();
    }

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

      valuesRef.current = next;
      return next;
    });
  };

  const handleBilingualTextChange = (fieldName: string, side: BilingualSide, value: string) => {
    const currentPair = textPairsRef.current[fieldName] ?? toInitialBilingualText(valuesRef.current[fieldName]);
    const nextPair = side === "zh"
      ? { zh: value, en: toOfficialEnglishValue(value) }
      : { zh: toChineseSourceValue(value), en: value };
    if (currentPair.zh === nextPair.zh && currentPair.en === nextPair.en) return;

    pushUndoSnapshot();
    const nextTextPairs = { ...textPairsRef.current, [fieldName]: nextPair };
    textPairsRef.current = nextTextPairs;
    setTextPairs(nextTextPairs);

    const officialValue = nextPair.en || nextPair.zh || currentPair.en || currentPair.zh;
    handleChange(fieldName, officialValue, { recordUndo: false });
  };

  const addGroupInstance = (group: string) => {
    const currentCount = groupCounts[group] ?? 1;
    const max = repeatGroupMax[group] ?? Number.POSITIVE_INFINITY;
    if (currentCount >= max) return;

    pushUndoSnapshot();
    const count = currentCount + 1;
    setGroupCounts((prev) => {
      const next = { ...prev, [group]: count };
      groupCountsRef.current = next;
      return next;
    });
    // Initialize empty values for the new instance
    setValues((prev) => {
      const next = { ...prev };
      for (const field of repeatGroupFields[group] ?? []) {
        next[instanceKey(field.fieldName, count - 1)] = getDefaultFieldValue(field, country, visaType);
      }
      valuesRef.current = next;
      return next;
    });
    setTextPairs((prev) => {
      const next = { ...prev };
      for (const field of repeatGroupFields[group] ?? []) {
        if (isTextLikeField(field)) {
          next[instanceKey(field.fieldName, count - 1)] = { zh: "", en: "" };
        }
      }
      textPairsRef.current = next;
      return next;
    });
  };

  const removeGroupInstance = (group: string, instanceIdx: number) => {
    const count = groupCounts[group] ?? 1;
    if (count <= 1) return;

    pushUndoSnapshot();
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
      valuesRef.current = next;
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
      textPairsRef.current = next;
      return next;
    });
    setGroupCounts((prev) => {
      const next = { ...prev, [group]: count - 1 };
      groupCountsRef.current = next;
      return next;
    });
  };

  const handleKeyboardShortcuts = (event: React.KeyboardEvent<HTMLFormElement>) => {
    const hasShortcutModifier = event.ctrlKey || event.metaKey;
    if (!hasShortcutModifier || event.altKey || isTextEditingTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const undoRequested = key === "z" && !event.shiftKey;
    const redoRequested = key === "y" || (key === "z" && event.shiftKey);
    if (!undoRequested && !redoRequested) return;

    const handled = undoRequested ? undoLastFormChange() : redoLastFormChange();
    if (!handled) return;

    event.preventDefault();
    event.stopPropagation();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stepData = filterCurrentStepValues(step.fields, values, groupCounts);
    onDraftChangeRef.current?.(stepData);
    onComplete(stepData);
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
    const rawPlaceholder = field.placeholder ?? null;
    const zhPlaceholder = getChinesePlaceholder(rawPlaceholder, field.fieldName)
      ?? (field.fieldType === "select" ? tButtons("selectFallback") : null);
    const enPlaceholder = getEnglishPlaceholder(rawPlaceholder)
      ?? (field.fieldType === "select" ? "Select..." : null);

    // Filter purpose of trip to only show "B" option
    let fieldOptions = field.options;
    if (isPurposeOfTripField(field) && fieldOptions) {
      fieldOptions = fieldOptions.filter(isBTripPurposeOption);
    }

    const lt24Disabled = isDisabledByLT24(field, valueKey, values, step.fields);
    const isTextLike = isTextLikeField(field);
    const pair = textPairs[valueKey] ?? getBilingualPrefillText(valueKey, values, values[valueKey]);

    const renderSide = (side: BilingualSide) => {
      const sideField: VisaFormFieldRow = {
        ...field,
        fieldName: `${valueKey}-${side}`,
        label: getLocalizedFieldLabel(field, side),
        placeholder: getLocalizedPlaceholder(
          field,
          side,
          side === "zh" ? zhPlaceholder : enPlaceholder,
        ),
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
          disabled={lt24Disabled}
          displayLocale={side}
        />
      );
    };

    const guidanceField: VisaFormFieldRow = {
      ...field,
      options: fieldOptions ?? null,
    };
    const issue = getLocalFieldIssue(guidanceField, valueKey, values[valueKey] ?? "", values, locale);
    const panelOpen = activeGuidanceKey === valueKey;
    const resolvedVisaType = visaType ?? field.visaType ?? step.fields[0]?.visaType ?? "B211A";
    const buttonLabel = panelOpen
      ? (isChineseInterface ? "收起 AI 帮助" : "Hide AI help")
      : (isChineseInterface ? "问 AI" : "Ask AI");

    if (!isChineseInterface) {
      return (
        <div
          key={valueKey}
          className={cn(
            "py-3 transition-colors",
            panelOpen ? "bg-[#fbfdff]" : "",
          )}
        >
          <div className="min-w-0">
            {renderSide("en")}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            {issue.severity !== "ok" && (
              <span className={cn("text-[13px] font-medium", issueMessageClasses(issue.severity))}>
                {issue.message}
              </span>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActiveGuidanceKey((current) => current === valueKey ? null : valueKey);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
                copilotButtonClasses(),
              )}
              aria-expanded={panelOpen}
              aria-label={buttonLabel}
              data-copilot-trigger={valueKey}
            >
              <Bot className="h-3.5 w-3.5" />
              {buttonLabel}
            </button>
          </div>
          {panelOpen && (
            <div className="mt-2 w-full" data-copilot-panel-frame={valueKey}>
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
    }

    return (
      <div
        key={valueKey}
        className={cn(
          "py-3 transition-colors",
          panelOpen ? "bg-[#fbfdff]" : "",
        )}
      >
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {renderSide("zh")}
          {renderSide("en")}
        </div>
        <div className="mt-2 grid min-w-0 gap-3 md:grid-cols-2">
          <div aria-hidden="true" className="hidden md:block" />
          <div className="flex items-center justify-end gap-2">
            {issue.severity !== "ok" && (
              <span className={cn("text-[13px] font-medium", issueMessageClasses(issue.severity))}>
                {issue.message}
              </span>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActiveGuidanceKey((current) => current === valueKey ? null : valueKey);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
                copilotButtonClasses(),
              )}
              aria-expanded={panelOpen}
              aria-label={buttonLabel}
              data-copilot-trigger={valueKey}
            >
              <Bot className="h-3.5 w-3.5" />
              {buttonLabel}
            </button>
          </div>
        </div>
        {panelOpen && (
          <div className="mt-2 w-full" data-copilot-panel-frame={valueKey}>
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
    <form onSubmit={handleSubmit} onKeyDown={handleKeyboardShortcuts} className="flex flex-col gap-3">
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
                className="flex flex-col gap-3"
              >
                {blockFields.map((f) => {
                  const inlineInBlock = getInlineGroup(f);
                  if (inlineInBlock) {
                    if (renderedInlineInBlock.has(inlineInBlock)) return null;
                    renderedInlineInBlock.add(inlineInBlock);
                    const inlineFields = blockFields.filter((x) => getInlineGroup(x) === inlineInBlock);
                    if (inlineFields.length <= 1) return renderField(f, f.fieldName, true);
                    return (
                      <div key={`inline-${inlineInBlock}`} className="grid gap-3">
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
              <div key={`inline-${ig}`} className="grid gap-3">
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
                className="flex flex-col gap-3"
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
                      <div key={item.map((f) => f.fieldName).join("-")} className="grid gap-3">
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
          {isChineseInterface
            ? "对问题有疑问？点击题目旁的 AI 提示。"
            : "Need help? Click the AI tip beside any question."}
        </span>
      </div>
    </form>
  );
}
