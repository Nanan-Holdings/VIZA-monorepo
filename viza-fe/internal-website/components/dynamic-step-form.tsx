"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Bot, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { DynamicFormField } from "@/components/dynamic-form-field";
import { FieldGuidancePanel } from "@/components/field-guidance-panel";
import { type VisaFormFieldOption, type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";
import {
  getChinesePlaceholder,
  getEnglishPlaceholder,
  toChineseSourceValue,
  toOfficialEnglishValue,
} from "@/lib/ds160-translations";
import {
  resolveLocalizedFieldLabel,
  resolveLocalizedOptions,
  resolveLocalizedPlaceholder,
} from "@/lib/bilingual-schema-contract";
import { evaluateShowIf, isRequiredUnlessSatisfied } from "@/lib/form-utils";
import { isChineseLocale } from "@/lib/i18n/locale";
import {
  useRealtimeBilingualTranslate,
  type RealtimeTranslationStatus,
} from "@/lib/translation/use-realtime-bilingual-translate";
import { cn } from "@/lib/utils";
import { VIETNAM_WARDS_BY_PROVINCE } from "@/lib/vietnam-administrative-units";
import { getVnPrearrivalStaticOptions } from "@/lib/vn-prearrival/static-options";
import { countries } from "country-data-list";

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

type IndonesiaPostalLookup =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "resolved"; summaryZh: string; summaryEn: string }
  | { status: "invalid" | "unavailable"; messageZh: string; messageEn: string };

function isIndonesiaOfficialEVisaContext(country: string | null | undefined, visaType: string | undefined): boolean {
  const normalizedCountry = country?.trim().toLowerCase();
  return (normalizedCountry === "indonesia" || normalizedCountry === "id") &&
    (visaType === "ID_B1_EVOA" || visaType === "ID_C1_TOURIST");
}

function normalizeIndonesiaMobileNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 15);
}

interface CountryDataListCountry {
  alpha2: string;
  countryCallingCodes: string[];
  name: string;
  status: string;
}

let phoneCountryCodeOptionsCache: VisaFormFieldOption[] | null = null;

function getChineseRegionName(alpha2: string): string {
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(alpha2.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

export function getPhoneCountryCodeOptions(): VisaFormFieldOption[] {
  if (phoneCountryCodeOptionsCache) return phoneCountryCodeOptionsCache;

  const seen = new Set<string>();
  phoneCountryCodeOptionsCache = (countries.all as CountryDataListCountry[])
    .filter((country) => country.status !== "deleted")
    .flatMap((country) =>
      country.countryCallingCodes
        .filter((code) => /^\+\d+$/.test(code))
        .map((code) => ({ country, code })),
    )
    .filter(({ country, code }) => {
      const key = `${country.alpha2}:${code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const codeCompare = Number(a.code.slice(1)) - Number(b.code.slice(1));
      return codeCompare || a.country.name.localeCompare(b.country.name);
    })
    .map(({ country, code }) => {
      const labelZh = `${getChineseRegionName(country.alpha2) || country.name} (${code})`;
      return {
      value: code,
      text: `(${code}) ${country.name}`,
      label_en: `(${code}) ${country.name}`,
      label_zh: labelZh,
      official_label: `(${code})`,
      };
    });

  return phoneCountryCodeOptionsCache;
}

interface BilingualTextValue {
  zh: string;
  en: string;
}

interface FormHistorySnapshot {
  values: Record<string, string>;
  textPairs: Record<string, BilingualTextValue>;
  groupCounts: Record<string, number>;
}

type FieldIssueSeverity = "ok" | "warning" | "error";

interface FieldIssue {
  severity: FieldIssueSeverity;
  message: string;
}

function isIndonesiaPostalAutoFillField(field: VisaFormFieldRow): boolean {
  const rules = field.validationRules as { auto_filled_by?: string } | null;
  return rules?.auto_filled_by === "postal_code";
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

const REALTIME_TRANSLATION_DEBOUNCE_MS = 400;

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

function canRequestRealtimeTranslation(field: VisaFormFieldRow, pair: BilingualTextValue): boolean {
  const sourceText = pair.zh.trim();
  if (!sourceText || !hasChineseText(sourceText)) return false;
  if (isMachineTranslationSensitiveField(field)) return false;
  return true;
}

function normalizeCloudTranslation(value: string, sourceText: string): string | null {
  const translated = value.replace(/\s+/g, " ").trim();
  if (!translated) return null;
  if (translated === sourceText.trim()) return null;
  if (hasChineseText(translated)) return null;
  return translated;
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

function getLocalizedFieldLabel(field: VisaFormFieldRow, side: BilingualSide): string {
  return resolveLocalizedFieldLabel(field, side);
}

function getLocalizedPlaceholder(
  field: VisaFormFieldRow,
  side: BilingualSide,
  fallback: string | null,
): string | null {
  return resolveLocalizedPlaceholder(field, side) ?? fallback;
}

function RealtimeTranslationStatusLine({
  status,
  error,
  isChineseInterface,
  onRetry,
}: {
  status: RealtimeTranslationStatus;
  error: string | null;
  isChineseInterface: boolean;
  onRetry: () => void;
}) {
  if (status === "idle" || status === "skipped") return null;

  const isBusy = status === "typing" || status === "translating";
  const copy = {
    typing: isChineseInterface ? "正在翻译..." : "Translating...",
    translating: isChineseInterface ? "正在翻译..." : "Translating...",
    translated: isChineseInterface ? "已翻译" : "Translated",
    failed: isChineseInterface ? "翻译失败，可重试" : "Translation failed, retry",
    user_edited: isChineseInterface ? "已手动编辑，不会自动覆盖" : "Manually edited. Auto translation will not overwrite it.",
  } satisfies Record<Exclude<RealtimeTranslationStatus, "idle" | "skipped">, string>;
  const message = copy[status];

  return (
    <div
      className={cn(
        "mt-2 flex min-h-5 flex-wrap items-center gap-2 text-[12px] font-medium",
        status === "failed" ? "text-red-600" : "text-[#667085]",
      )}
      aria-live="polite"
      data-translation-status={status}
    >
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      <span>{message}</span>
      {status === "failed" && error ? <span className="sr-only">{error}</span> : null}
      {(status === "failed" || status === "user_edited") ? (
        <button
          type="button"
          className="rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-brand-500 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
          onClick={onRetry}
        >
          {isChineseInterface ? "重新翻译" : "Retranslate"}
        </button>
      ) : null}
    </div>
  );
}

function DynamicFieldRealtimeTranslation({
  field,
  valueKey,
  pair,
  enabled,
  isChineseInterface,
  targetWasManuallyEdited,
  onApplyTranslation,
  onResetManualEdit,
}: {
  field: VisaFormFieldRow;
  valueKey: string;
  pair: BilingualTextValue;
  enabled: boolean;
  isChineseInterface: boolean;
  targetWasManuallyEdited: boolean;
  onApplyTranslation: (valueKey: string, sourceText: string, translatedText: string, force: boolean) => void;
  onResetManualEdit: (valueKey: string) => void;
}) {
  const handleTranslatedText = useCallback(
    (translatedText: string, options: { force: boolean; sourceText: string }) => {
      onApplyTranslation(valueKey, options.sourceText, translatedText, options.force);
    },
    [onApplyTranslation, valueKey],
  );
  const handleManualEditReset = useCallback(() => {
    onResetManualEdit(valueKey);
  }, [onResetManualEdit, valueKey]);

  const { status, error, retry } = useRealtimeBilingualTranslate({
    sourceValue: pair.zh,
    targetValue: pair.en,
    sourceLang: "zh",
    targetLang: "en",
    fieldId: field.fieldName,
    context: `visa_form:${field.visaType ?? "unknown"}`,
    enabled,
    fieldType: field.fieldType,
    targetWasManuallyEdited,
    debounceMs: REALTIME_TRANSLATION_DEBOUNCE_MS,
    onTranslatedText: handleTranslatedText,
    onManualEditReset: handleManualEditReset,
  });

  return (
    <RealtimeTranslationStatusLine
      status={status}
      error={error}
      isChineseInterface={isChineseInterface}
      onRetry={retry}
    />
  );
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

function isYearOnlyDateValue(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getVietnamNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function formatOfficialDateFromUtcDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function getVnPrearrivalArrivalDateOptions(): Array<Exclude<VisaFormFieldOption, string>> {
  const vietnamNow = getVietnamNow();
  const startOfVietnamToday = Date.UTC(
    vietnamNow.getUTCFullYear(),
    vietnamNow.getUTCMonth(),
    vietnamNow.getUTCDate(),
  );
  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date(startOfVietnamToday + index * 24 * 60 * 60 * 1000);
    const value = formatOfficialDateFromUtcDate(date);
    return {
      value,
      text: value,
      label_en: value,
      label_zh: value,
      official_label: value,
    };
  });
}

function normaliseVnPrearrivalArrivalDate(value: string): string | null {
  const parsed = parseFlexibleDate(value);
  if (!parsed) return null;
  return formatOfficialDateFromUtcDate(new Date(Date.UTC(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  )));
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

function isCurrentArrivalDateField(field: VisaFormFieldRow, valueKey: string): boolean {
  return currentFieldMatchesAny(field, valueKey, ARRIVAL_DATE_CANDIDATES);
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

function normaliseFieldOptions(
  options: VisaFormFieldRow["options"],
  side: BilingualSide,
): Array<{ value: string; text: string }> {
  const localizedOptions = resolveLocalizedOptions(options, side);
  if (!localizedOptions) return [];
  return localizedOptions.map((option) => {
    if (typeof option === "string") return { value: option, text: cleanOptionDisplayText(option) };
    const text = side === "zh"
      ? option.label_zh ?? option.text ?? option.label_en ?? option.official_label ?? option.value
      : option.label_en ?? option.text ?? option.official_label ?? option.value;
    return {
      value: option.value,
      text: cleanOptionDisplayText(text),
    };
  });
}

function cleanOptionDisplayText(text: string): string {
  return text.replace(/^(?:选项|Option)\s*[:：]\s*/i, "").trim();
}

function getRawFieldOptions(
  options: VisaFormFieldRow["options"],
): Array<{ value: string; text: string; labelZh: string; labelEn: string; officialLabel: string }> {
  if (!options) return [];
  return options.map((option) => {
    if (typeof option === "string") {
      return { value: option, text: option, labelZh: option, labelEn: option, officialLabel: option };
    }
    return {
      value: option.value,
      text: option.text ?? "",
      labelZh: option.label_zh ?? "",
      labelEn: option.label_en ?? "",
      officialLabel: option.official_label ?? "",
    };
  });
}

function normalizeComparableOptionValue(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(?:option|选项)\s*[:：]\s*/i, "")
    .replace(/^[a-z]{2,3}\s*[:：-]\s*/i, "")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const COUNTRY_VALUE_ALIASES: Record<string, string> = {
  china: "CHN",
  chinese: "CHN",
  prc: "CHN",
  people_s_republic_of_china: "CHN",
  peoples_republic_of_china: "CHN",
  中国: "CHN",
  中华人民共和国: "CHN",
  singapore: "SGP",
  新加坡: "SGP",
  malaysia: "MYS",
  马来西亚: "MYS",
  thailand: "THA",
  泰国: "THA",
  united_states: "USA",
  united_states_of_america: "USA",
  america: "USA",
  usa: "USA",
  美国: "USA",
};

function getVnPrearrivalOfficialSource(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { official_source?: unknown } | null;
  const source = typeof rules?.official_source === "string" ? rules.official_source : "";
  return source.startsWith("prearrival_category:") ? source : null;
}

function isVnPrearrivalContext(visaType: string | undefined, field?: VisaFormFieldRow): boolean {
  return visaType === "VN_PREARRIVAL_DECLARATION"
    || field?.visaType === "VN_PREARRIVAL_DECLARATION";
}

function getVnPrearrivalDependsOn(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { depends_on?: unknown; dependsOn?: unknown } | null;
  const dependsOn = rules?.depends_on ?? rules?.dependsOn;
  return typeof dependsOn === "string" && dependsOn.trim() ? dependsOn.trim() : null;
}

function vnPrearrivalOptionKey(field: VisaFormFieldRow): string {
  return `${field.fieldName}:${getVnPrearrivalOfficialSource(field) ?? ""}`;
}

function getVnPrearrivalLoadingText(source: string | null, side: BilingualSide): string {
  if (!source) return side === "zh" ? "正在加载官方选项..." : "Loading official options...";
  if (source.endsWith(":flight")) {
    return side === "zh" ? "正在加载官方航班列表..." : "Loading official flight list...";
  }
  if (source.endsWith(":hotel")) {
    return side === "zh" ? "正在加载官方酒店地址..." : "Loading official hotel addresses...";
  }
  if (source.endsWith(":country_code")) {
    return side === "zh" ? "正在加载电话区号..." : "Loading country calling codes...";
  }
  if (source.endsWith(":visa_issue_place")) {
    return side === "zh" ? "正在加载对应签证类型的签发地点..." : "Loading issue places for this visa type...";
  }
  return side === "zh" ? "正在加载官方选项..." : "Loading official options...";
}

function findCanonicalOptionValue(
  options: VisaFormFieldRow["options"],
  rawValue: string | null | undefined,
): string | null {
  const trimmed = rawValue?.trim();
  if (!trimmed) return null;

  const normalized = normalizeComparableOptionValue(trimmed);
  const aliasedCountryValue = COUNTRY_VALUE_ALIASES[normalized];
  const rawOptions = getRawFieldOptions(options);
  const directAliasMatch = aliasedCountryValue
    ? rawOptions.find((option) => option.value.toLowerCase() === aliasedCountryValue.toLowerCase())
    : null;
  if (directAliasMatch) return directAliasMatch.value;

  for (const option of rawOptions) {
    const candidates = [option.value, option.text, option.labelZh, option.labelEn, option.officialLabel]
      .map(normalizeComparableOptionValue)
      .filter(Boolean);
    if (candidates.includes(normalized)) return option.value;
  }

  return null;
}

function parsePhoneParts(rawPhone: string | null | undefined) {
  const value = rawPhone?.trim();
  if (!value) return { countryCode: "", localNumber: "" };
  const plusMatch = value.match(/^\+(\d{1,4})[\s-]*(.*)$/);
  if (plusMatch) {
    return {
      countryCode: plusMatch[1] ?? "",
      localNumber: (plusMatch[2] ?? "").replace(/[^\d\s-]/g, "").trim(),
    };
  }
  return { countryCode: "", localNumber: value.replace(/[^\d\s-]/g, "").trim() };
}

const TDAC_ACCOMMODATION_VALUE_KEYS = [
  "accommodation_type",
  "accommodation_type_other",
  "province",
  "district",
  "sub_district",
  "postcode",
  "address_in_thailand",
];

const TDAC_NON_TRANSIT_REQUIRED_ACCOMMODATION_KEYS = new Set([
  "accommodation_type",
  "province",
  "address_in_thailand",
]);

function isSameCalendarDayValue(left?: string, right?: string): boolean {
  const leftDate = parseFlexibleDate(left);
  const rightDate = parseFlexibleDate(right);
  return Boolean(leftDate && rightDate && startOfDay(leftDate).getTime() === startOfDay(rightDate).getTime());
}

function getAirportCodeFromFlightValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const underscoreMatch = trimmed.match(/_([A-Z]{3})$/);
  if (underscoreMatch) return underscoreMatch[1];
  const dashMatch = trimmed.match(/-\s*([A-Z]{3})$/);
  return dashMatch?.[1] ?? "";
}

function normalizeTdacTransitValue(values: Record<string, string>): Record<string, string> {
  const sameDayTransit = isSameCalendarDayValue(values.arrival_date, values.departure_date);
  const next: Record<string, string> = { ...values, is_transit_traveler: sameDayTransit ? "yes" : "" };
  if (sameDayTransit) {
    for (const fieldName of TDAC_ACCOMMODATION_VALUE_KEYS) {
      next[fieldName] = "";
    }
  }
  return next;
}

function normalizeTdacStepValues(
  fields: VisaFormFieldRow[],
  values: Record<string, string>,
  visaType?: string,
): Record<string, string> {
  if (visaType !== "TH_TDAC_ARRIVAL_CARD") return values;

  const next = { ...values };
  const fieldByName = new Map(fields.map((field) => [field.fieldName, field]));

  const normalizeOptionField = (fieldName: string, fallbackKeys: string[] = []) => {
    const field = fieldByName.get(fieldName);
    if (!field) return;
    const currentValue = next[fieldName]?.trim();
    const fallbackValue = fallbackKeys.map((key) => next[key]?.trim()).find(Boolean);
    let options = field.options;
    const rules = field.validationRules as {
      dependent_on?: string;
      dependsOn?: string;
      dependent_options?: Record<string, VisaFormFieldOption[]>;
    } | null;
    const parentFieldName = rules?.dependent_on ?? rules?.dependsOn;
    const parentValue = parentFieldName ? next[parentFieldName]?.trim() : "";
    if ((!options || options.length === 0) && rules?.dependent_options && parentValue) {
      options =
        rules.dependent_options[parentValue] ??
        rules.dependent_options[normalizeOptionKey(parentValue)] ??
        null;
    }
    if (!options || options.length === 0) return;
    const canonical = findCanonicalOptionValue(options, currentValue || fallbackValue);
    if (canonical) next[fieldName] = canonical;
  };

  normalizeOptionField("nationality", [
    "nationality_country",
    "country_of_nationality",
    "current_nationality",
    "passport_issuing_country",
  ]);
  normalizeOptionField("country_territory_of_residence", [
    "country_of_residence",
    "residence_country",
    "home_country",
    "nationality",
    "nationality_country",
  ]);
  normalizeOptionField("city_state_of_residence", [
    "residence_city_state",
    "residence_state",
    "residence_province",
    "home_address_state",
    "home_address_city",
    "residential_address_state",
    "residential_address_city",
    "birth_province",
    "state_of_birth",
    "birth_state",
  ]);
  normalizeOptionField("country_boarded", ["country_territory_of_residence", "nationality"]);
  normalizeOptionField("arrival_mode_of_travel");
  normalizeOptionField("arrival_mode_of_transport");
  normalizeOptionField("departure_mode_of_travel");
  normalizeOptionField("departure_mode_of_transport");
  normalizeOptionField("purpose_of_travel");
  normalizeOptionField("accommodation_type");
  normalizeOptionField("province");
  normalizeOptionField("district");
  normalizeOptionField("sub_district");

  const genderField = fieldByName.get("gender");
  if (genderField?.options) {
    const normalizedGender = normalizeComparableOptionValue(next.gender);
    const genderAlias =
      normalizedGender === "f" || normalizedGender === "female" || normalizedGender === "女"
        ? "female"
        : normalizedGender === "m" || normalizedGender === "male" || normalizedGender === "男"
          ? "male"
          : normalizedGender === "undefined" || normalizedGender === "other" || normalizedGender === "x"
            ? "undefined"
            : null;
    const canonical = findCanonicalOptionValue(genderField.options, genderAlias ?? next.gender);
    if (canonical) next.gender = canonical;
  }

  const sourcePhone = next.phone || next.phone_number || next.primary_phone_number || next.mobile_phone || next.telephone_number;
  const parsedPhone = parsePhoneParts(sourcePhone);
  if (!next.phone_country_code?.trim() && parsedPhone.countryCode) {
    next.phone_country_code = parsedPhone.countryCode;
  }
  if (next.phone_number?.trim()) {
    const parsedCurrentPhone = parsePhoneParts(next.phone_number);
    next.phone_number = parsedCurrentPhone.localNumber || next.phone_number.replace(/[^\d\s-]/g, "").trim();
    if (!next.phone_country_code?.trim() && parsedCurrentPhone.countryCode) {
      next.phone_country_code = parsedCurrentPhone.countryCode;
    }
  } else if (parsedPhone.localNumber) {
    next.phone_number = parsedPhone.localNumber;
  }

  return normalizeTdacTransitValue(next);
}

function isCheckedCheckboxValue(value: string): boolean {
  const normalised = value.trim().toLowerCase();
  return normalised === "true" || normalised === "yes" || normalised === "1" || normalised === "on";
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
    allow_year_only?: boolean;
    min_date?: "today";
    max_days_from_today?: number;
    submission_window_hours?: number;
    not_before_today?: boolean;
    not_before_field?: string;
    after_or_equal_field?: string;
    min_days_after_field?: string;
    min_days_after_field_days?: number;
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

  const options = normaliseFieldOptions(field.options, isZh ? "zh" : "en");
  if (field.fieldType === "checkbox" && trimmed && isCheckedCheckboxValue(trimmed)) {
    return issue("ok", "");
  }

  if (
    (field.fieldType === "select" || field.fieldType === "multi_select" || field.fieldType === "radio" || field.fieldType === "checkbox") &&
    trimmed &&
    options.length > 0
  ) {
    const selectedValues = field.fieldType === "multi_select"
      ? trimmed.split(",").map((part) => part.trim()).filter(Boolean)
      : [trimmed];
    const optionMatch = selectedValues.every((selectedValue) =>
      options.some(
        (option) =>
          option.value.toLowerCase() === selectedValue.toLowerCase() ||
          option.text.toLowerCase() === selectedValue.toLowerCase(),
      ),
    );
    if (!optionMatch) return issue("error", isZh ? "请选择题目提供的选项" : "Choose one of the provided options");
  }

  const isYearOnly = field.fieldType === "date" && Boolean(rules?.allow_year_only) && isYearOnlyDateValue(trimmed);
  const currentDate = field.fieldType === "date" && !isYearOnly ? parseFlexibleDate(trimmed) : null;
  if (field.fieldType === "date" && trimmed && !currentDate && !isYearOnly) {
    return issue("error", isZh ? "日期格式不符合要求" : "Date format does not match the requirement");
  }

  if (
    isYearOnly &&
    (valueKey.toLowerCase().includes("birth") || field.fieldName.toLowerCase().includes("birth")) &&
    Number(trimmed) > new Date().getFullYear()
  ) {
    return issue("error", isZh ? "出生年份不能晚于今年" : "Year of birth cannot be later than this year");
  }

  if (
    currentDate &&
    (valueKey.toLowerCase().includes("birth") || field.fieldName.toLowerCase().includes("birth")) &&
    currentDate > new Date()
  ) {
    return issue("error", isZh ? "出生日期不能晚于今天" : "Date of birth cannot be later than today");
  }

  if (currentDate && (rules?.min_date === "today" || rules?.not_before_today)) {
    const today = startOfDay(getVietnamNow());
    if (startOfDay(currentDate) < today) {
      return issue("error", isZh ? "日期不能早于今天" : "Date cannot be earlier than today");
    }
  }

  if (currentDate && typeof rules?.max_days_from_today === "number") {
    const today = startOfDay(getVietnamNow());
    const maxDate = startOfDay(new Date(today));
    maxDate.setDate(maxDate.getDate() + Math.max(0, rules.max_days_from_today));
    if (startOfDay(currentDate) > maxDate) {
      const hours = rules.submission_window_hours ?? (rules.max_days_from_today + 1) * 24;
      return issue(
        "error",
        isZh
          ? `此申报只能在入境前 ${hours} 小时内填写`
          : `This declaration can only be completed within ${hours} hours before arrival`,
      );
    }
  }

  const compareFieldName = rules?.not_before_field ?? rules?.after_or_equal_field;
  if (currentDate && compareFieldName) {
    const repeatSuffix = getRepeatInstanceSuffix(valueKey);
    const compareValue = values[`${compareFieldName}${repeatSuffix}`] ?? values[compareFieldName];
    const compareDate = parseFlexibleDate(compareValue);
    if (compareDate && startOfDay(currentDate) < startOfDay(compareDate)) {
      return issue("error", isZh ? "结束日期不能早于开始日期" : "End date cannot be earlier than the start date");
    }
  }

  if (currentDate && rules?.min_days_after_field) {
    const repeatSuffix = getRepeatInstanceSuffix(valueKey);
    const compareValue =
      values[`${rules.min_days_after_field}${repeatSuffix}`] ?? values[rules.min_days_after_field];
    const compareDate = parseFlexibleDate(compareValue);
    const requiredDays = Math.max(0, rules.min_days_after_field_days ?? 0);
    if (compareDate) {
      const minimumDate = startOfDay(new Date(compareDate));
      minimumDate.setDate(minimumDate.getDate() + requiredDays);
      if (startOfDay(currentDate) < minimumDate) {
        return issue(
          "error",
          isZh
            ? `日期必须至少晚于关联日期 ${requiredDays} 天`
            : `Date must be at least ${requiredDays} days after the related date`,
        );
      }
    }
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

  const isCurrentTravelDateField =
    isCurrentArrivalDateField(field, valueKey) ||
    isCurrentDepartureDateField(field, valueKey);
  if (isCurrentTravelDateField && arrivalDate && departureDate && departureDate < arrivalDate) {
    return issue("error", isZh ? "离开日期不能早于抵达日期" : "Departure date cannot be earlier than arrival date");
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
  if (typeof option === "string") return { value: option, text: cleanOptionDisplayText(option) };
  return {
    value: option.value ?? "",
    text: cleanOptionDisplayText(option.text ?? option.label_en ?? option.label_zh ?? option.official_label ?? option.value ?? ""),
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

function normalizeOptionKey(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getDynamicDependentOptions(
  field: VisaFormFieldRow,
  values: Record<string, string>,
): VisaFormFieldOption[] | null {
  const rules = field.validationRules as {
    dependent_options_key?: string;
    dependent_on?: string;
    dependsOn?: string;
    dependent_options?: Record<string, VisaFormFieldOption[]>;
  } | null;
  const parentFieldName = rules?.dependent_on ?? rules?.dependsOn;
  if (!parentFieldName) return null;

  const parentValue = values[parentFieldName];
  if (rules?.dependent_options && typeof rules.dependent_options === "object") {
    if (!parentValue) return [];
    const directOptions = rules.dependent_options[parentValue];
    const normalizedOptions = rules.dependent_options[normalizeOptionKey(parentValue)];
    const dynamicOptions = Array.isArray(directOptions)
      ? directOptions
      : Array.isArray(normalizedOptions)
        ? normalizedOptions
        : null;
    return dynamicOptions ? [...dynamicOptions] : [];
  }

  if (rules?.dependent_options_key !== "vietnam_wards_by_province") return null;

  const provinceKey = normalizeOptionKey(parentValue);
  if (!provinceKey) return [];

  const wards = VIETNAM_WARDS_BY_PROVINCE[provinceKey as keyof typeof VIETNAM_WARDS_BY_PROVINCE];
  return wards ? [...wards] : [];
}

const VIETNAMESE_PLACE_TOKEN_ZH: Record<string, string> = {
  a: "阿",
  ai: "爱",
  am: "庵",
  an: "安",
  anh: "英",
  ba: "巴",
  bac: "北",
  bach: "白",
  bai: "拜",
  ban: "板",
  bang: "邦",
  bao: "保",
  bay: "贝",
  be: "贝",
  ben: "边",
  bi: "比",
  bien: "边",
  binh: "平",
  bo: "波",
  bong: "蓬",
  bu: "布",
  buon: "邦",
  ca: "卡",
  cai: "盖",
  cam: "金",
  can: "根",
  cang: "港",
  cao: "高",
  cat: "吉",
  cau: "桥",
  cay: "盖",
  cha: "茶",
  chai: "柴",
  chau: "朱",
  chi: "芝",
  chieng: "呈",
  cho: "佐",
  chu: "朱",
  chua: "朱阿",
  chuc: "竹",
  chuong: "章",
  con: "昆",
  cong: "公",
  co: "古",
  cu: "居",
  cua: "古阿",
  cuu: "九",
  da: "大",
  dac: "得",
  dak: "得",
  dam: "潭",
  dan: "丹",
  dang: "登",
  danh: "名",
  dao: "岛",
  dat: "达",
  dau: "油",
  dien: "奠",
  dieu: "调",
  dinh: "定",
  do: "都",
  doc: "督",
  dong: "同",
  du: "游",
  duc: "德",
  duong: "阳",
  gia: "嘉",
  giang: "江",
  gion: "戎",
  go: "丘",
  ha: "河",
  hai: "海",
  ham: "咸",
  han: "汉",
  hang: "行",
  hao: "豪",
  hau: "后",
  hien: "显",
  hiep: "协",
  hieu: "孝",
  hoa: "和",
  hoai: "怀",
  hoan: "欢",
  hoang: "黄",
  hoi: "会",
  hon: "鸿",
  hong: "鸿",
  huong: "香",
  huu: "友",
  khanh: "庆",
  khiem: "谦",
  khoai: "快",
  khuong: "强",
  kien: "坚",
  kiet: "杰",
  kim: "金",
  ky: "奇",
  la: "拉",
  lai: "来",
  lak: "勒",
  lam: "林",
  lang: "郎",
  lao: "老",
  lat: "叻",
  le: "黎",
  lien: "莲",
  linh: "灵",
  loc: "禄",
  loi: "利",
  long: "隆",
  lu: "卢",
  luc: "勒",
  luong: "良",
  ly: "里",
  mai: "梅",
  minh: "明",
  mo: "摩",
  moc: "木",
  mon: "门",
  my: "美",
  nam: "南",
  nga: "娥",
  ngai: "义",
  nghi: "宜",
  nghia: "义",
  ngoc: "玉",
  ngo: "吴",
  nguyen: "阮",
  nha: "芽",
  nhon: "仁",
  ninh: "宁",
  noi: "内",
  nuoc: "渃",
  o: "乌",
  pa: "巴",
  phan: "潘",
  phat: "发",
  phi: "菲",
  phong: "丰",
  phu: "富",
  phuc: "福",
  phung: "冯",
  phuoc: "福",
  phuong: "坊",
  quang: "广",
  quan: "关",
  quy: "归",
  quyet: "决",
  rach: "沥",
  rai: "来",
  rang: "朗",
  ranh: "兰",
  ro: "罗",
  sa: "沙",
  sam: "三",
  sen: "莲",
  se: "些",
  son: "山",
  song: "江",
  so: "所",
  suoi: "溪",
  tam: "三",
  tan: "新",
  tay: "西",
  te: "祭",
  thach: "石",
  thai: "太",
  thang: "胜",
  thanh: "清",
  thao: "洮",
  thap: "塔",
  thien: "天",
  thieu: "绍",
  thinh: "盛",
  tho: "寿",
  thoi: "泰",
  thong: "通",
  thu: "守",
  thuan: "顺",
  thuong: "上",
  thuy: "水",
  tien: "前",
  tinh: "静",
  to: "苏",
  trai: "寨",
  tram: "站",
  tran: "镇",
  trang: "庄",
  trao: "朝",
  treo: "悬",
  tri: "治",
  truc: "竹",
  trung: "中",
  truong: "长",
  tu: "慈",
  tuy: "绥",
  tuyen: "宣",
  uong: "汪",
  van: "文",
  vien: "园",
  viet: "越",
  vinh: "永",
  vu: "武",
  vung: "头顿",
  xa: "社",
  xuan: "春",
  xuyen: "川",
  yen: "安",
};

const VIETNAMESE_PLACE_PHRASE_ZH: Record<string, string> = {
  "bao loc": "保禄",
  "ba ria": "巴地",
  "bac giang": "北江",
  "bac kan": "北干",
  "bac lieu": "薄寮",
  "bac ninh": "北宁",
  "ben luc": "边沥",
  "ben tre": "槟椥",
  "binh duong": "平阳",
  "binh dinh": "平定",
  "binh phuoc": "平福",
  "binh thuan": "平顺",
  "buon ma thuot": "邦美蜀",
  "ca mau": "金瓯",
  "cam ly": "甘里",
  "cam ranh": "金兰",
  "can tho": "芹苴",
  "cat bi": "吉碑",
  "chau doc": "朱笃",
  "chi lang": "芝陵",
  "da lat": "大叻",
  "da nang": "岘港",
  "dak lak": "得乐",
  "dak nong": "得农",
  "dien bien": "奠边",
  "dong nai": "同奈",
  "dong thap": "同塔",
  "gia lai": "嘉莱",
  "ha giang": "河江",
  "ha nam": "河南",
  "ha noi": "河内",
  "ha tien": "河仙",
  "ha tinh": "河静",
  "hai duong": "海阳",
  "hai phong": "海防",
  "hau giang": "后江",
  "hoa binh": "和平",
  "ho chi minh": "胡志明",
  "hoi an": "会安",
  "khanh hoa": "庆和",
  "kien giang": "坚江",
  "kon tum": "昆嵩",
  "la gi": "罗夷",
  "lai chau": "莱州",
  "lam dong": "林同",
  "lam vien": "林园",
  "lang biang": "郎边",
  "lang son": "谅山",
  "lao bao": "老保",
  "lao cai": "老街",
  "long an": "隆安",
  "long xuyen": "龙川",
  "nam can": "南根",
  "nam dinh": "南定",
  "nam giang": "南江",
  "nha trang": "芽庄",
  "nghe an": "乂安",
  "nghi son": "宜山",
  "ninh binh": "宁平",
  "ninh chu": "宁楚",
  "ninh thuan": "宁顺",
  "noi bai": "内排",
  "phu bai": "富牌",
  "phu cat": "富吉",
  "phu quoc": "富国",
  "phu tho": "富寿",
  "phu yen": "富安",
  "quang binh": "广平",
  "quang nam": "广南",
  "quang ngai": "广义",
  "quang ninh": "广宁",
  "quang tri": "广治",
  "rach gia": "迪石",
  "soc trang": "朔庄",
  "son la": "山罗",
  "tan son nhat": "新山一",
  "tay ninh": "西宁",
  "thai binh": "太平",
  "thai nguyen": "太原",
  "thanh hoa": "清化",
  "thua thien hue": "承天顺化",
  "tien giang": "前江",
  "tra vinh": "茶荣",
  "tuyen quang": "宣光",
  "vinh long": "永隆",
  "vinh phuc": "永福",
  "vung tau": "头顿",
  "yen bai": "安沛",
};

const LATIN_FALLBACK_SYLLABLE_ZH: Record<string, string> = {
  a: "阿",
  b: "布",
  c: "克",
  d: "德",
  e: "埃",
  f: "弗",
  g: "格",
  h: "河",
  i: "伊",
  j: "杰",
  k: "克",
  l: "勒",
  m: "姆",
  n: "恩",
  o: "奥",
  p: "普",
  q: "广",
  r: "尔",
  s: "斯",
  t: "特",
  u: "乌",
  v: "文",
  w: "文",
  x: "西",
  y: "伊",
  z: "泽",
};

function normalizeVietnameseLatin(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function translateVietnameseLatinToken(token: string): string {
  if (/^\d+$/.test(token)) return `第${token}`;
  const normalized = normalizeVietnameseLatin(token);
  if (!normalized) return "";
  const known = VIETNAMESE_PLACE_TOKEN_ZH[normalized];
  if (known) return known;
  return normalized
    .split("")
    .map((char) => LATIN_FALLBACK_SYLLABLE_ZH[char] ?? "")
    .join("");
}

function translateVietnamesePlaceName(text: string): string {
  const normalized = normalizeVietnameseLatin(text);
  if (!normalized) return text;
  const phrase = VIETNAMESE_PLACE_PHRASE_ZH[normalized];
  if (phrase) return phrase;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const leadingNumber = tokens[0]?.match(/^\d+$/)?.[0];
  if (leadingNumber && tokens.length > 1) {
    return `${translateVietnamesePlaceName(tokens.slice(1).join(" "))}第${leadingNumber}`;
  }

  const translated: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const three = tokens.slice(index, index + 3).join(" ");
    const two = tokens.slice(index, index + 2).join(" ");
    if (VIETNAMESE_PLACE_PHRASE_ZH[three]) {
      translated.push(VIETNAMESE_PLACE_PHRASE_ZH[three]);
      index += 2;
      continue;
    }
    if (VIETNAMESE_PLACE_PHRASE_ZH[two]) {
      translated.push(VIETNAMESE_PLACE_PHRASE_ZH[two]);
      index += 1;
      continue;
    }
    translated.push(translateVietnameseLatinToken(tokens[index]));
  }
  return translated.join("");
}

function translateVietnameseLatinFragments(text: string): string {
  return text.replace(/[A-Za-zÀ-ỹĐđ][A-Za-zÀ-ỹĐđ0-9'’.-]*(?:\s+[A-Za-zÀ-ỹĐđ0-9'’.-]+)*/g, (match) =>
    translateVietnamesePlaceName(match),
  );
}

function normalizeVietnamUnitSuffixOrder(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const prefixMatch = trimmed.match(/^(坊|公社|市镇)\s*(.+)$/);
  if (prefixMatch) return `${prefixMatch[2]}${prefixMatch[1]}`;
  return trimmed;
}

function localizeVietnamAdministrativeUnitText(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const vietnameseProvinceMatch = trimmed.match(/^Tỉnh\s+(.+)$/i);
  if (vietnameseProvinceMatch) {
    return `${translateVietnamesePlaceName(vietnameseProvinceMatch[1])}省`;
  }
  const vietnameseCityMatch = trimmed.match(/^Thành phố\s+(.+)$/i);
  if (vietnameseCityMatch) {
    return `${translateVietnamesePlaceName(vietnameseCityMatch[1])}市`;
  }
  const localizedPrefixMatch = trimmed.match(/^(坊|公社|市镇)\s+(.+)$/);
  if (localizedPrefixMatch) {
    return normalizeVietnamUnitSuffixOrder(`${translateVietnamesePlaceName(localizedPrefixMatch[2])}${localizedPrefixMatch[1]}`);
  }

  const prefixMatch = trimmed.match(/^(?:PHUONG|PHƯỜNG|XA|XÃ|THI TRAN|THỊ TRẤN)\s+(.+)$/i);
  if (prefixMatch) {
    const prefix = normalizeVietnameseLatin(trimmed.split(/\s+/).slice(0, trimmed.toUpperCase().startsWith("THI") || trimmed.toUpperCase().startsWith("THỊ") ? 2 : 1).join(" "));
    const unit = prefix === "xa" ? "公社" : prefix === "thi tran" ? "市镇" : "坊";
    return normalizeVietnamUnitSuffixOrder(`${translateVietnamesePlaceName(prefixMatch[1])}${unit}`);
  }

  const suffixMatch = trimmed.match(/^(.+?)\s+(WARD|COMMUNE|TOWN|DISTRICT|CITY)$/i);
  if (suffixMatch) {
    const unitBySuffix: Record<string, string> = {
      ward: "坊",
      commune: "公社",
      town: "市镇",
      district: "县",
      city: "市",
    };
    return normalizeVietnamUnitSuffixOrder(`${translateVietnamesePlaceName(suffixMatch[1])}${unitBySuffix[suffixMatch[2].toLowerCase()] ?? ""}`);
  }

  return normalizeVietnamUnitSuffixOrder(translateVietnameseLatinFragments(trimmed));
}

function localizeVietnamWardOptions(options: VisaFormFieldOption[]): VisaFormFieldOption[] {
  return options.map((option) => {
    if (typeof option === "string") {
      return {
        value: option,
        text: option,
        label_en: option,
        label_zh: localizeVietnamAdministrativeUnitText(option),
      };
    }

    const sourceText = option.official_label ?? option.label_en ?? option.text ?? option.value;
    const sourceZh = typeof option.label_zh === "string" ? option.label_zh.trim() : "";
    const localizedZh = sourceZh && sourceZh !== "坊/社"
      ? localizeVietnamAdministrativeUnitText(sourceZh)
      : localizeVietnamAdministrativeUnitText(sourceText);
    return {
      ...option,
      text: localizedZh,
      label_zh: localizedZh,
    };
  });
}

function isVietnamBorderGateField(field: VisaFormFieldRow): boolean {
  const key = field.fieldName.toLowerCase();
  return key.includes("border_gate") || key.includes("port_of_entry") || key.includes("port_of_exit");
}

const VIETNAM_BORDER_GATE_ZH: Record<string, string> = {
  bo_y_landport: "波伊陆路口岸",
  cam_pha_seaport: "锦普海港",
  cat_bi_int_airport_hai_phong: "吉碑国际机场（海防）",
  cau_treo_landport: "桥悬陆路口岸",
  cha_lo_landport: "茶罗陆路口岸",
  chan_may_seaport: "真美海港",
  da_nang_seaport: "岘港海港",
  hanoi_noi_bai_int_airport: "河内内排国际机场",
  ho_chi_minh_tan_son_nhat_int_airport: "胡志明市新山一国际机场",
  lao_bao_landport: "老保陆路口岸",
  moc_bai_landport: "木牌陆路口岸",
  mong_cai_landport: "芒街陆路口岸",
  nha_trang_cam_ranh_int_airport: "芽庄金兰国际机场",
  phu_bai_int_airport_hue: "富牌国际机场（顺化）",
  phu_quoc_int_airport: "富国国际机场",
  vung_tau_seaport: "头顿海港",
};

function localizeVietnamBorderGateText(text: string): string {
  const partiallyLocalized = text
    .replace(/\bInternational Border Gate\b/gi, "国际边境口岸")
    .replace(/\bBorder Gate\b/gi, "边境口岸")
    .replace(/\bInt\.?\b/gi, "国际")
    .replace(/\bInternational\b/gi, "国际")
    .replace(/\bAirport\b/gi, "机场")
    .replace(/\bSeaport\b/gi, "海港")
    .replace(/\bSea Port\b/gi, "海港")
    .replace(/\bLandport\b/gi, "陆路口岸")
    .replace(/\bLand Port\b/gi, "陆路口岸")
    .replace(/\bPort\b/gi, "口岸")
    .replace(/\bRailway Station\b/gi, "火车站")
    .replace(/\bprovince\b/gi, "省")
    .replace(/\bHa Noi\b/gi, "河内")
    .replace(/\bHanoi\b/gi, "河内")
    .replace(/\bHo Chi Minh City\b/gi, "胡志明市")
    .replace(/\bDa Nang\b/gi, "岘港")
    .replace(/\bHai Phong\b/gi, "海防")
    .replace(/\bCan Tho\b/gi, "芹苴")
    .replace(/\bPhu Quoc\b/gi, "富国")
    .replace(/\bNha Trang\b/gi, "芽庄")
    .replace(/\bHue\b/gi, "顺化")
    .replace(/\bCat Bi\b/gi, "吉碑")
    .replace(/\bNoi Bai\b/gi, "内排")
    .replace(/\bTan Son Nhat\b/gi, "新山一")
    .replace(/\bCam Ranh\b/gi, "金兰")
    .replace(/\bPhu Bai\b/gi, "富牌")
    .replace(/\bBo Y\b/gi, "波伊")
    .replace(/\bCau Treo\b/gi, "桥悬")
    .replace(/\bCha Lo\b/gi, "茶罗")
    .replace(/\bLao Bao\b/gi, "老保")
    .replace(/\bMoc Bai\b/gi, "木牌")
    .replace(/\bHuu Nghi\b/gi, "友谊")
    .replace(/\bMong Cai\b/gi, "芒街")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  return translateVietnameseLatinFragments(partiallyLocalized);
}

function localizeVietnamBorderGateOptions(options: VisaFormFieldRow["options"]): VisaFormFieldRow["options"] {
  if (!options) return options;
  return options.map((option) => {
    if (typeof option === "string") {
      const key = normalizeOptionKey(option);
      return { value: option, text: option, label_zh: VIETNAM_BORDER_GATE_ZH[key] ?? localizeVietnamBorderGateText(option), label_en: option };
    }
    const sourceText = option.text ?? option.label_en ?? option.official_label ?? option.value;
    const key = normalizeOptionKey(option.value ?? sourceText);
    return {
      ...option,
      label_zh: VIETNAM_BORDER_GATE_ZH[key] ?? localizeVietnamBorderGateText(sourceText),
    };
  });
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
    return normalizeTdacStepValues(step.fields, init, visaType);
  });

  const [textPairs, setTextPairs] = useState<Record<string, BilingualTextValue>>(() => {
    const init: Record<string, BilingualTextValue> = {};
    const normalizedPrefill = normalizeTdacStepValues(step.fields, { ...prefill }, visaType);
    for (const field of step.fields) {
      if (!isTextLikeField(field)) continue;
      const group = getRepeatGroup(field);
      if (group) {
        const count = groupCounts[group] ?? 1;
        for (let i = 0; i < count; i++) {
          const key = instanceKey(field.fieldName, i);
          init[key] = getBilingualPrefillText(key, normalizedPrefill, normalizedPrefill[key]);
        }
      } else {
        init[field.fieldName] = getBilingualPrefillText(field.fieldName, normalizedPrefill, normalizedPrefill[field.fieldName]);
      }
    }
    return init;
  });
  const [manualEnglishValueKeys, setManualEnglishValueKeys] = useState<Record<string, boolean>>({});
  const [koreaAddressOptions, setKoreaAddressOptions] = useState<VisaFormFieldOption[]>([]);
  const [koreaAddressSearchQuery, setKoreaAddressSearchQuery] = useState("");
  const [koreaAddressSearching, setKoreaAddressSearching] = useState(false);
  const [vnPrearrivalQueries, setVnPrearrivalQueries] = useState<Record<string, string>>({});
  const [vnPrearrivalOptions, setVnPrearrivalOptions] = useState<Record<string, VisaFormFieldOption[]>>({});
  const [vnPrearrivalSearching, setVnPrearrivalSearching] = useState<Record<string, boolean>>({});
  const [indonesiaPostalLookup, setIndonesiaPostalLookup] = useState<IndonesiaPostalLookup>({ status: "idle" });
  const isVnPrearrivalStep = useMemo(
    () => isVnPrearrivalContext(visaType) || step.fields.some((field) => isVnPrearrivalContext(undefined, field)),
    [step.fields, visaType],
  );
  const isIndonesiaOfficialEVisa = useMemo(
    () => isIndonesiaOfficialEVisaContext(country, visaType),
    [country, visaType],
  );

  const valuesRef = useRef(values);
  const textPairsRef = useRef(textPairs);
  const manualEnglishValueKeysRef = useRef(manualEnglishValueKeys);
  const groupCountsRef = useRef(groupCounts);
  const onDraftChangeRef = useRef(onDraftChange);
  const previousPrefillRef = useRef(prefill);
  const undoStackRef = useRef<FormHistorySnapshot[]>([]);
  const redoStackRef = useRef<FormHistorySnapshot[]>([]);

  valuesRef.current = values;
  textPairsRef.current = textPairs;
  manualEnglishValueKeysRef.current = manualEnglishValueKeys;
  groupCountsRef.current = groupCounts;

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    if (!isIndonesiaOfficialEVisa || !step.fields.some((field) => field.fieldName === "postal_code")) {
      setIndonesiaPostalLookup({ status: "idle" });
      return;
    }

    const postalCode = values.postal_code?.replace(/\D/g, "") ?? "";
    if (!postalCode) {
      setIndonesiaPostalLookup({ status: "idle" });
      return;
    }
    if (postalCode.length !== 5) {
      setIndonesiaPostalLookup({
        status: "invalid",
        messageZh: "请输入住宿地址对应的 5 位印尼邮政编码。",
        messageEn: "Enter the 5-digit Indonesian postal code for your accommodation.",
      });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIndonesiaPostalLookup({ status: "checking" });
      try {
        const response = await fetch(`/api/indonesia/postal-code?postalCode=${postalCode}`, {
          signal: controller.signal,
        });
        const payload = await response.json() as {
          ok?: boolean;
          messageZh?: string;
          messageEn?: string;
          location?: { province: string; city: string; district: string; village: string };
        };
        if (!response.ok || !payload.ok || !payload.location) {
          setIndonesiaPostalLookup({
            status: response.status === 503 ? "unavailable" : "invalid",
            messageZh: payload.messageZh ?? "无法识别该印尼邮政编码。",
            messageEn: payload.messageEn ?? "This Indonesian postal code could not be recognized.",
          });
          return;
        }

        const { province, city, district, village } = payload.location;
        const nextValues = {
          ...valuesRef.current,
          postal_code: postalCode,
          province_name: province,
          city_name: city,
          district_name: district,
          village_name: village,
        };
        valuesRef.current = nextValues;
        setValues(nextValues);
        setIndonesiaPostalLookup({
          status: "resolved",
          summaryZh: `已自动填写：${province} / ${city} / ${district} / ${village}`,
          summaryEn: `Auto-filled: ${province} / ${city} / ${district} / ${village}`,
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setIndonesiaPostalLookup({
          status: "unavailable",
          messageZh: "暂时无法校验印尼邮政编码，请稍后重试。",
          messageEn: "Indonesia postal-code validation is temporarily unavailable. Please try again shortly.",
        });
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isIndonesiaOfficialEVisa, step.fields, values.postal_code]);

  useEffect(() => {
    if (!isVnPrearrivalStep || !step.fields.some((field) => field.fieldName === "expected_arrival_date")) return;

    const allowedDates = getVnPrearrivalArrivalDateOptions();
    const allowedValues = new Set(allowedDates.map((option) => option.value));
    const currentValue = valuesRef.current.expected_arrival_date?.trim() ?? "";
    const normalisedValue = normaliseVnPrearrivalArrivalDate(currentValue);
    if (!currentValue || (normalisedValue && allowedValues.has(normalisedValue))) return;

    // A saved draft may predate the 72-hour rule. Remove it before the next
    // save so the user cannot remain trapped on an invalid date value.
    const nextValues = {
      ...valuesRef.current,
      expected_arrival_date: "",
      flight_number: "",
      border_gate_airport: "",
    };
    valuesRef.current = nextValues;
    setValues(nextValues);
  }, [isVnPrearrivalStep, step.fields]);

  useEffect(() => {
    if (
      !isVnPrearrivalStep
      || !step.fields.some((field) => field.fieldName === "flight_number")
      || !step.fields.some((field) => field.fieldName === "border_gate_airport")
    ) return;

    const derivedAirport = getAirportCodeFromFlightValue(valuesRef.current.flight_number ?? "");
    if ((valuesRef.current.border_gate_airport ?? "") === derivedAirport) return;

    const nextValues = { ...valuesRef.current, border_gate_airport: derivedAirport };
    valuesRef.current = nextValues;
    setValues(nextValues);
  }, [isVnPrearrivalStep, step.fields, values.flight_number, values.border_gate_airport]);

  const hasKoreaAddressSearchField = useMemo(
    () =>
      visaType === "KR_C39_SHORT_TERM_VISIT" &&
      step.fields.some(
        (field) =>
          field.fieldName === "address_in_korea" &&
          (field.validationRules as { source?: string } | null)?.source === "korea_visa_portal_address_search",
      ),
    [step.fields, visaType],
  );

  useEffect(() => {
    if (!hasKoreaAddressSearchField) return;
    const keyword = koreaAddressSearchQuery.trim();
    if (keyword.length < 2) {
      setKoreaAddressOptions([]);
      setKoreaAddressSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setKoreaAddressSearching(true);
        const response = await fetch(`/api/korea-addresses?keyword=${encodeURIComponent(keyword)}&limit=100`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { options?: VisaFormFieldOption[] };
        setKoreaAddressOptions(Array.isArray(payload.options) ? payload.options : []);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setKoreaAddressOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setKoreaAddressSearching(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [hasKoreaAddressSearchField, koreaAddressSearchQuery]);

  const vnPrearrivalRemoteFields = useMemo(
    () =>
      isVnPrearrivalStep
        ? step.fields.filter((field) => {
            const source = getVnPrearrivalOfficialSource(field);
            if (!source) return false;
            if (field.fieldName === "phone_country_code") return false;
            const parentKey = getVnPrearrivalDependsOn(field);
            return getVnPrearrivalStaticOptions(source, parentKey ? values[parentKey] ?? "" : "") === null;
          })
        : [],
    [isVnPrearrivalStep, step.fields, values],
  );
  const vnPrearrivalParentSnapshot = useMemo(
    () =>
      vnPrearrivalRemoteFields
        .map((field) => {
          const parentKey = getVnPrearrivalDependsOn(field);
          return parentKey ? `${parentKey}:${values[parentKey] ?? ""}` : "";
        })
        .join("|"),
    [values, vnPrearrivalRemoteFields],
  );

  useEffect(() => {
    if (vnPrearrivalRemoteFields.length === 0) return;
    setVnPrearrivalQueries((current) => {
      let changed = false;
      const next = { ...current };
      for (const field of vnPrearrivalRemoteFields) {
        const key = vnPrearrivalOptionKey(field);
        if (!(key in next)) {
          next[key] = "";
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [vnPrearrivalRemoteFields]);

  useEffect(() => {
    if (vnPrearrivalRemoteFields.length === 0) return;
    const entries = Object.entries(vnPrearrivalQueries);
    if (entries.length === 0) return;

    const controller = new AbortController();
    const timers = entries.map(([key, keyword]) => window.setTimeout(async () => {
      const field = vnPrearrivalRemoteFields.find((candidate) => vnPrearrivalOptionKey(candidate) === key);
      const source = field ? getVnPrearrivalOfficialSource(field) : null;
      if (!field || !source) return;
      const parentKey = getVnPrearrivalDependsOn(field);
      const parent = parentKey ? valuesRef.current[parentKey] ?? "" : "";
      const waitsForKeyword =
        (source.endsWith(":flight") || source.endsWith(":hotel")) &&
        keyword.trim().length < 2;
      if (waitsForKeyword) {
        setVnPrearrivalOptions((current) => ({ ...current, [key]: [] }));
        setVnPrearrivalSearching((current) => ({ ...current, [key]: false }));
        return;
      }
      if (source.endsWith("administrative_unit_level2") && !parent.trim()) {
        setVnPrearrivalOptions((current) => ({ ...current, [key]: [] }));
        setVnPrearrivalSearching((current) => ({ ...current, [key]: false }));
        return;
      }

      try {
        setVnPrearrivalSearching((current) => ({ ...current, [key]: true }));
        const params = new URLSearchParams({
          source,
          keyword,
          limit: source.endsWith(":flight") || source.endsWith(":hotel") ? "100" : "10000",
        });
        if (parent.trim()) params.set("parent", parent.trim());
        const response = await fetch(`/api/vn-prearrival/options?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { options?: VisaFormFieldOption[] };
        const options = Array.isArray(payload.options) ? payload.options : [];
        setVnPrearrivalOptions((current) => ({
          ...current,
          [key]: options,
        }));
        if (field.fieldName === "phone_country_code") {
          const currentValue = valuesRef.current[field.fieldName]?.trim();
          const matchingCodeOption = currentValue
            ? options.find((option) => {
                if (typeof option === "string") return false;
                const optionWithCode = option as { value?: string; code?: string };
                return optionWithCode.code === currentValue && optionWithCode.value !== currentValue;
              })
            : null;
          if (matchingCodeOption && typeof matchingCodeOption !== "string") {
            const normalizedValue = (matchingCodeOption as { value: string }).value;
            valuesRef.current = { ...valuesRef.current, [field.fieldName]: normalizedValue };
            setValues((current) => ({ ...current, [field.fieldName]: normalizedValue }));
          }
        }
        // A parent-field change is handled synchronously in `handleChange`.
        // Do not invalidate a selected dependent value from an asynchronous
        // refresh: an earlier response can otherwise erase the value the user
        // just selected and trap them in this step.
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setVnPrearrivalOptions((current) => ({ ...current, [key]: [] }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setVnPrearrivalSearching((current) => ({ ...current, [key]: false }));
        }
      }
    }, 300));

    return () => {
      controller.abort();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [vnPrearrivalParentSnapshot, vnPrearrivalQueries, vnPrearrivalRemoteFields]);

  const getSnapshot = (): FormHistorySnapshot => ({
    values: { ...valuesRef.current },
    textPairs: cloneTextPairs(textPairsRef.current),
    groupCounts: { ...groupCountsRef.current },
  });

  const restoreSnapshot = (snapshot: FormHistorySnapshot) => {
    const normalizedValues = normalizeTdacStepValues(step.fields, snapshot.values, visaType);
    valuesRef.current = normalizedValues;
    textPairsRef.current = snapshot.textPairs;
    groupCountsRef.current = snapshot.groupCounts;
    setValues(normalizedValues);
    setTextPairs(snapshot.textPairs);
    setGroupCounts(snapshot.groupCounts);
  };

  const pushUndoSnapshot = () => {
    undoStackRef.current = [...undoStackRef.current.slice(-79), getSnapshot()];
    redoStackRef.current = [];
  };

  const applyRealtimeTranslation = useCallback((valueKey: string, sourceText: string, translatedText: string, force: boolean) => {
    const normalized = normalizeCloudTranslation(translatedText, sourceText);
    if (!normalized) return;

    const currentPair = textPairsRef.current[valueKey];
    if (!currentPair || currentPair.zh.trim() !== sourceText) return;
    if (!force && manualEnglishValueKeysRef.current[valueKey] && currentPair.en.trim()) return;

    const nextPair = { ...currentPair, en: normalized };
    const nextTextPairs = { ...textPairsRef.current, [valueKey]: nextPair };
    textPairsRef.current = nextTextPairs;
    setTextPairs(nextTextPairs);
    if (force && manualEnglishValueKeysRef.current[valueKey]) {
      const nextManualKeys = { ...manualEnglishValueKeysRef.current, [valueKey]: false };
      manualEnglishValueKeysRef.current = nextManualKeys;
      setManualEnglishValueKeys(nextManualKeys);
    }

    const currentValue = valuesRef.current[valueKey] ?? "";
    if (force || !currentValue.trim() || currentValue === currentPair.en || hasChineseText(currentValue)) {
      const nextValues = { ...valuesRef.current, [valueKey]: normalized };
      valuesRef.current = nextValues;
      setValues(nextValues);
    }
  }, []);

  const resetManualEnglishValue = useCallback((valueKey: string) => {
    if (!manualEnglishValueKeysRef.current[valueKey]) return;
    const nextManualKeys = { ...manualEnglishValueKeysRef.current, [valueKey]: false };
    manualEnglishValueKeysRef.current = nextManualKeys;
    setManualEnglishValueKeys(nextManualKeys);
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

    const normalizedNextValues = normalizeTdacStepValues(step.fields, nextValues, visaType);
    for (const [key, value] of Object.entries(normalizedNextValues)) {
      if (nextValues[key] !== value) {
        nextValues[key] = value;
        valuesChanged = true;
      }
    }
    for (const field of step.fields) {
      if (!isTextLikeField(field)) continue;
      const group = getRepeatGroup(field);
      const keys = group
        ? Array.from({ length: groupCountsRef.current[group] ?? 1 }, (_, index) => instanceKey(field.fieldName, index))
        : [field.fieldName];
      for (const key of keys) {
        const normalizedValue = normalizedNextValues[key]?.trim();
        if (!normalizedValue) continue;
        const currentPair = textPairsRef.current[key] ?? { zh: "", en: "" };
        const previousValue = previousPrefill[key] ?? "";
        const currentValue = valuesRef.current[key] ?? "";
        const pairWasEdited = Boolean(currentPair.zh.trim() || currentPair.en.trim()) && currentValue !== previousValue;
        if (pairWasEdited) continue;
        nextTextPairs[key] = getBilingualPrefillText(key, normalizedNextValues, normalizedValue);
        textPairsChanged = true;
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
  }, [prefill, step.fields, visaType]);

  useEffect(() => {
    onDraftChangeRef.current?.(filterCurrentStepValues(step.fields, values, groupCounts));
  }, [groupCounts, step.fields, values]);

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
          const rules = f.validationRules as { dependent_on?: string; dependsOn?: string } | null;
          if (rules?.dependent_on === parentFieldName || rules?.dependsOn === parentFieldName) return true;
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
    const normalizedValue = isIndonesiaOfficialEVisa && fieldName === "mobile_phone"
      ? normalizeIndonesiaMobileNumber(value)
      : isIndonesiaOfficialEVisa && fieldName === "postal_code"
        ? value.replace(/\D/g, "").slice(0, 5)
        : value;
    if (options?.recordUndo !== false && valuesRef.current[fieldName] !== normalizedValue) {
      pushUndoSnapshot();
    }

    setValues((prev) => {
      const next = { ...prev, [fieldName]: normalizedValue };
      if (isVnPrearrivalStep && fieldName === "expected_arrival_date") {
        next.flight_number = "";
        next.border_gate_airport = "";
      }
      if (isVnPrearrivalStep && fieldName === "flight_number") {
        next.border_gate_airport = getAirportCodeFromFlightValue(value);
      }
      const dependents = getDependentFields(fieldName);
      for (const dep of dependents) {
        const depField = step.fields.find((f) => f.fieldName === dep);
        if (depField && !evaluateShowIf(depField, next, step.fields)) {
          next[dep] = "";
        } else if (depField) {
          const rules = depField.validationRules as { dependent_on?: string; dependsOn?: string } | null;
          if (rules?.dependent_on === fieldName || rules?.dependsOn === fieldName) {
            next[dep] = "";
          }
        }
      }

      // Clear inline-group sibling value fields when LESS_THAN_24_HOURS is selected
      if (normalizedValue === "LESS_THAN_24_HOURS") {
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

      const normalizedNext = normalizeTdacStepValues(step.fields, next, visaType);
      valuesRef.current = normalizedNext;
      return normalizedNext;
    });
  };

  const handleBilingualTextChange = (fieldName: string, side: BilingualSide, value: string) => {
    const currentPair = textPairsRef.current[fieldName] ?? toInitialBilingualText(valuesRef.current[fieldName]);
    const nextPair = side === "zh"
      ? { zh: value, en: toOfficialEnglishValue(value) }
      : { zh: currentPair.zh, en: value };
    if (currentPair.zh === nextPair.zh && currentPair.en === nextPair.en) return;

    pushUndoSnapshot();
    if (side === "en") {
      const nextManualKeys = { ...manualEnglishValueKeysRef.current, [fieldName]: Boolean(value.trim()) };
      manualEnglishValueKeysRef.current = nextManualKeys;
      setManualEnglishValueKeys(nextManualKeys);
    } else {
      const nextManualKeys = { ...manualEnglishValueKeysRef.current, [fieldName]: false };
      manualEnglishValueKeysRef.current = nextManualKeys;
      setManualEnglishValueKeys(nextManualKeys);
    }

    const nextTextPairs = { ...textPairsRef.current, [fieldName]: nextPair };
    textPairsRef.current = nextTextPairs;
    setTextPairs(nextTextPairs);

    const officialValue = side === "en" ? value : nextPair.en || nextPair.zh;
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
    if (indonesiaPostalLookupBlocksContinue) return;
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

  const visibleFields = step.fields.filter((f) => {
      if (isIndonesiaPostalAutoFillField(f)) return false;
      if (isGatedByUnansweredToggle(f)) return false;
      if (isDisabledByLT24(f, f.fieldName, values, step.fields)) return false;
      return evaluateShowIf(f, values, step.fields);
    });
  const isTdacSameDayTransit = visaType === "TH_TDAC_ARRIVAL_CARD"
    && isSameCalendarDayValue(values.arrival_date, values.departure_date);
  const isRequiredField = (field: VisaFormFieldRow): boolean => {
    if (
      visaType === "TH_TDAC_ARRIVAL_CARD" &&
      !isTdacSameDayTransit &&
      TDAC_NON_TRANSIT_REQUIRED_ACCOMMODATION_KEYS.has(field.fieldName)
    ) {
      return true;
    }
    return field.required;
  };

  // Required validation: only check visible fields (and all instances of repeat groups)
  const requiredFilled = visibleFields
    .filter((f) => isRequiredField(f))
    // File fields are mirrored from official portals for parity, but the
    // actual upload state is managed by Document Center.
    .filter((f) => f.fieldType !== "file")
    // Annex-I-style starred fields: required_unless exempts the field when its
    // expression evaluates true (e.g. UK Withdrawal Agreement beneficiaries
    // skip fields 21/22/30/31/32 of the Schengen form).
    .filter((f) => !isRequiredUnlessSatisfied(f, values))
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

  const blockingErrorsClear = visibleFields.every((f) => {
    if (f.fieldType === "file") return true;
    const group = getRepeatGroup(f);
    if (group) {
      const count = groupCounts[group] ?? 1;
      return Array.from({ length: count }, (_, i) => {
        const valueKey = instanceKey(f.fieldName, i);
        return getLocalFieldIssue(f, valueKey, values[valueKey] ?? "", values, locale).severity !== "error";
      }).every(Boolean);
    }
    return getLocalFieldIssue(f, f.fieldName, values[f.fieldName] ?? "", values, locale).severity !== "error";
  });
  const indonesiaPostalLookupBlocksContinue = isIndonesiaOfficialEVisa &&
    step.fields.some((field) => field.fieldName === "postal_code") &&
    (indonesiaPostalLookup.status === "checking" ||
      indonesiaPostalLookup.status === "invalid" ||
      indonesiaPostalLookup.status === "unavailable");

  /** Translate and render a single field */
  const renderField = (field: VisaFormFieldRow, valueKey: string, forceWhiteBackground = false) => {
    const rawPlaceholder = field.placeholder ?? null;
    const zhPlaceholder = getChinesePlaceholder(rawPlaceholder, field.fieldName)
      ?? (field.fieldType === "select" ? tButtons("selectFallback") : null);
    const enPlaceholder = getEnglishPlaceholder(rawPlaceholder)
      ?? (field.fieldType === "select" ? "Select..." : null);

    // Filter purpose of trip to only show "B" option
    let fieldOptions = field.options;
    if (field.fieldName === "phone_country_code" && (!fieldOptions || fieldOptions.length === 0)) {
      fieldOptions = getPhoneCountryCodeOptions();
    }
    const dynamicOptions = getDynamicDependentOptions(field, values);
    if (dynamicOptions) {
      fieldOptions = field.fieldName === "intended_ward_commune"
        ? localizeVietnamWardOptions(dynamicOptions)
        : dynamicOptions;
    }
    if (
      field.fieldName === "address_in_korea" &&
      (field.validationRules as { source?: string } | null)?.source === "korea_visa_portal_address_search"
    ) {
      const selectedValue = values[valueKey]?.trim();
      const hasSelectedValue =
        selectedValue &&
        koreaAddressOptions.some((option) => {
          if (typeof option === "string") return option === selectedValue;
          return option.value === selectedValue;
        });
      fieldOptions = selectedValue && !hasSelectedValue
        ? [{ value: selectedValue, text: selectedValue }, ...koreaAddressOptions]
        : koreaAddressOptions;
    }
    const vnPrearrivalSource = getVnPrearrivalOfficialSource(field);
    const vnPrearrivalKey = vnPrearrivalSource ? vnPrearrivalOptionKey(field) : null;
    const isVnPrearrivalField = isVnPrearrivalContext(visaType, field);
    const isVnPrearrivalArrivalDateField =
      isVnPrearrivalField && field.fieldName === "expected_arrival_date";
    let hasVnPrearrivalStaticOptions = false;
    if (isVnPrearrivalField && field.fieldName === "phone_country_code") {
      hasVnPrearrivalStaticOptions = true;
    }
    if (isVnPrearrivalArrivalDateField) {
      fieldOptions = getVnPrearrivalArrivalDateOptions();
      hasVnPrearrivalStaticOptions = true;
    }
    if (vnPrearrivalSource) {
      const parentKey = getVnPrearrivalDependsOn(field);
      const staticOptions = getVnPrearrivalStaticOptions(vnPrearrivalSource, parentKey ? values[parentKey] ?? "" : "");
      if (staticOptions) {
        hasVnPrearrivalStaticOptions = true;
        fieldOptions = field.fieldName === "phone_country_code" && staticOptions.length === 0
          ? fieldOptions
          : staticOptions;
      }
    }
    if (vnPrearrivalKey && !hasVnPrearrivalStaticOptions) {
      const remoteOptions = vnPrearrivalOptions[vnPrearrivalKey] ?? [];
      const localizedRemoteOptions = vnPrearrivalSource?.endsWith("administrative_unit_level1") ||
        vnPrearrivalSource?.endsWith("administrative_unit_level2")
        ? localizeVietnamWardOptions(remoteOptions)
        : remoteOptions;
      const selectedValue = values[valueKey]?.trim();
      const hasSelectedValue =
        selectedValue &&
        localizedRemoteOptions.some((option) => {
          if (typeof option === "string") return option === selectedValue;
          return option.value === selectedValue;
        });
      fieldOptions = localizedRemoteOptions.length > 0
        ? field.fieldName === "phone_country_code" && localizedRemoteOptions.length === 0
          ? fieldOptions
          : selectedValue && !hasSelectedValue
          ? [{ value: selectedValue, text: selectedValue }, ...localizedRemoteOptions]
          : localizedRemoteOptions
        : fieldOptions;
    }
    if (isPurposeOfTripField(field) && fieldOptions) {
      fieldOptions = fieldOptions.filter(isBTripPurposeOption);
    }
    if (isVietnamBorderGateField(field)) {
      fieldOptions = localizeVietnamBorderGateOptions(fieldOptions);
    }

    const lt24Disabled = isDisabledByLT24(field, valueKey, values, step.fields);
    const tdacTransitCheckboxLocked =
      visaType === "TH_TDAC_ARRIVAL_CARD" && field.fieldName === "is_transit_traveler";
    const isTextLike = isTextLikeField(field);
    const pair = textPairs[valueKey] ?? getBilingualPrefillText(valueKey, values, values[valueKey]);
    const targetWasManuallyEdited = Boolean(manualEnglishValueKeys[valueKey] && pair.en.trim());

    const renderSide = (side: BilingualSide) => {
      const isKoreaAddressSearchSelect =
        field.fieldName === "address_in_korea" &&
        (field.validationRules as { source?: string } | null)?.source === "korea_visa_portal_address_search";
      const isVnPrearrivalRemoteSelect = Boolean(vnPrearrivalKey && !hasVnPrearrivalStaticOptions);
      const vnReadOnlyRules = field.validationRules as { read_only?: boolean; locked_by?: string } | null;
      const isVnPrearrivalReadOnly =
        isVnPrearrivalField &&
        Boolean(vnReadOnlyRules?.read_only || (vnReadOnlyRules?.locked_by && values[vnReadOnlyRules.locked_by]));
      const sideField: VisaFormFieldRow = {
        ...field,
        fieldName: `${valueKey}-${side}`,
        fieldType: isVnPrearrivalArrivalDateField ? "radio" : field.fieldType,
        label: getLocalizedFieldLabel(field, side),
        required: isRequiredField(field),
        placeholder: getLocalizedPlaceholder(
          field,
          side,
          side === "zh" ? zhPlaceholder : enPlaceholder,
        ),
        options: resolveLocalizedOptions(fieldOptions, side),
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
          disabled={lt24Disabled || tdacTransitCheckboxLocked || isVnPrearrivalReadOnly}
          displayLocale={side}
          onSearchQuery={
            isKoreaAddressSearchSelect
              ? setKoreaAddressSearchQuery
              : isVnPrearrivalRemoteSelect && vnPrearrivalKey
                ? (query) => setVnPrearrivalQueries((current) => ({ ...current, [vnPrearrivalKey]: query }))
                : undefined
          }
          searching={
            isKoreaAddressSearchSelect
              ? koreaAddressSearching
              : vnPrearrivalKey
                ? Boolean(vnPrearrivalSearching[vnPrearrivalKey])
                : false
          }
          loadingText={
            isKoreaAddressSearchSelect
              ? side === "zh" ? "正在搜索韩国官方地址..." : "Searching official Korean addresses..."
              : isVnPrearrivalRemoteSelect
                ? getVnPrearrivalLoadingText(vnPrearrivalSource, side)
                : undefined
          }
        />
      );
    };

    const guidanceField: VisaFormFieldRow = {
      ...field,
      fieldType: isVnPrearrivalArrivalDateField ? "radio" : field.fieldType,
      label: getLocalizedFieldLabel(field, isChineseInterface ? "zh" : "en"),
      options: resolveLocalizedOptions(fieldOptions, isChineseInterface ? "zh" : "en"),
    };
    const localIssue = getLocalFieldIssue(guidanceField, valueKey, values[valueKey] ?? "", values, locale);
    const postalLookupIssue = field.fieldName === "postal_code" && indonesiaPostalLookup.status !== "idle" && indonesiaPostalLookup.status !== "resolved"
      ? indonesiaPostalLookup.status === "checking"
        ? {
            severity: "warning" as const,
            message: isChineseInterface ? "正在核验印尼邮政编码..." : "Checking the Indonesian postal code...",
          }
        : {
            severity: "error" as const,
            message: isChineseInterface ? indonesiaPostalLookup.messageZh : indonesiaPostalLookup.messageEn,
          }
      : null;
    const issue = postalLookupIssue ?? localIssue;
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
            {field.fieldName === "postal_code" && indonesiaPostalLookup.status === "resolved" && (
              <span className="text-[13px] font-medium text-emerald-700">{indonesiaPostalLookup.summaryEn}</span>
            )}
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
          <div className="flex min-w-0 flex-col items-end gap-2">
            {isTextLike ? (
              <DynamicFieldRealtimeTranslation
                field={field}
                valueKey={valueKey}
                pair={pair}
                enabled={!lt24Disabled && canRequestRealtimeTranslation(field, pair)}
                isChineseInterface={isChineseInterface}
                targetWasManuallyEdited={targetWasManuallyEdited}
                onApplyTranslation={applyRealtimeTranslation}
                onResetManualEdit={resetManualEnglishValue}
              />
            ) : null}
            <div className="flex items-center justify-end gap-2">
              {field.fieldName === "postal_code" && indonesiaPostalLookup.status === "resolved" && (
                <span className="text-[13px] font-medium text-emerald-700">
                  {indonesiaPostalLookup.summaryZh}
                </span>
              )}
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
        if (isIndonesiaPostalAutoFillField(field)) return null;
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
                !isGatedByUnansweredToggle(f) &&
                !isIndonesiaPostalAutoFillField(f),
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
                !isGatedByUnansweredToggle(f) &&
                !isIndonesiaPostalAutoFillField(f)
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
          !isIndonesiaPostalAutoFillField(f) &&
            (evaluateShowIf(f, values, step.fields) || isDisabledByLT24(f, f.fieldName, values, step.fields))
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
        disabled={!requiredFilled || !blockingErrorsClear || indonesiaPostalLookupBlocksContinue}
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
