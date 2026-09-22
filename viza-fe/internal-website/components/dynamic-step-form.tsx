"use client";

import { memo, useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Question as CircleHelp, CircleNotch as Loader2, Sparkle as Sparkles, Trash as Trash2 } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { DynamicFormField } from "@/components/dynamic-form-field";
import { getDs160OfficialOptionSource, resolveDs160OfficialOptionValue } from "@/lib/ds160-official-options";
import { FieldGuidancePanel } from "@/components/field-guidance-panel";
import { ApplicationConditionalFieldsPanel } from "@/components/ui/application-conditional-fields-panel";
import { AiAssistButton } from "@/components/ui/ai-assist-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type VisaFormFieldOption, type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";
import { type FieldGuidanceChatMessage } from "@/types/field-guidance";
import { type FormAssistantFieldReviewIssue } from "@/types/form-assistant";
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
  usesBilingualAnswerPair,
  US_STATE_FORM_OPTIONS,
} from "@/lib/bilingual-schema-contract";
import {
  evaluateShowIf,
  getRepeatInstanceCount,
  getRepeatInstanceValues,
  isRequiredUnlessSatisfied,
  isRequiredWhenSatisfied,
} from "@/lib/form-utils";
import { isChineseLocale } from "@/lib/i18n/locale";
import {
  useRealtimeBilingualTranslate,
  type RealtimeTranslationStatus,
} from "@/lib/translation/use-realtime-bilingual-translate";
import { cn } from "@/lib/utils";
import { VIETNAM_WARDS_BY_PROVINCE } from "@/lib/vietnam-administrative-units";
import { getVnPrearrivalStaticOptions } from "@/lib/vn-prearrival/static-options";
import { localizePhEtravelOptions } from "@/features/ph-etravel/option-labels";
import { countries } from "country-data-list";
import { getDateFieldValueState, parseDateFieldValue } from "@/lib/date-field-validation";
import { isDs160FieldVisibleForRuntime } from "@/lib/ds160-age-gate";
import { isLegacyCompatibilityOnlyField } from "@/lib/legacy-compatibility-fields";
import {
  FORMER_SPOUSE_COUNT_FIELD,
  FORMER_SPOUSE_IDENTITY_FIELDS,
  FORMER_SPOUSE_REPEAT_GROUP,
  getFormerSpouseCountIssue,
  getFormerSpouseCountValidationMessage,
  getFormerSpouseDuplicateIssue,
  getFormerSpouseDuplicateMessage,
  getFormerSpouseRepeatLimit,
} from "@/lib/former-spouse-count";
import {
  getUsContactRelationshipIssue,
  getUsContactRelationshipIssueMessage,
} from "@/lib/us-contact-validation";
import {
  getDs160ImmediateRelativeRelationshipIssue,
  getDs160ImmediateRelativeRelationshipIssueMessage,
} from "@/lib/ds160-family-validation";
import {
  DS160_TRIP_PURPOSE_FIELD,
  DS160_TRIP_PURPOSE_REPEAT_GROUP,
  getDs160TripPurposeDuplicateIssue,
  getDs160TripPurposeDuplicateMessage,
} from "@/lib/ds160-travel-validation";
import {
  getDs160NationalityDuplicateIssue,
  getDs160NationalityDuplicateMessage,
} from "@/lib/ds160-nationality-validation";
import {
  getCompiledConditionalPanelController,
  getCompiledConditionalPanelMode,
} from "@/lib/application-schema-ui-contract";

interface DynamicStepFormProps {
  step: WizardStep;
  prefill: Record<string, string>;
  onComplete: (data: Record<string, string>) => void;
  onDraftChange?: (data: Record<string, string>) => void;
  onUserChange?: () => void;
  saving?: boolean;
  showContinueButton?: boolean;
  country?: string | null;
  visaType?: string;
  focusFieldName?: string | null;
  /**
   * Field names whose input is provided by an external control (e.g. the
   * passport OCR upload card rendered above the form). These are not rendered
   * inside the form body, but still participate in required validation, so the
   * step's value must be supplied through `prefill`.
   */
  externallyHandledFieldNames?: string[];
  /**
   * Required fields surfaced by the page-level submit check. This state is
   * intentionally controlled by the page so one click can validate every
   * visible step in the long form at once.
   */
  invalidFieldNames?: ReadonlySet<string>;
  /** Localized submit-time errors keyed by the concrete answer field name. */
  invalidFieldMessages?: ReadonlyMap<string, string>;
  /** Fields last written by the form assistant. Manual edits clear this flag. */
  aiFilledFieldNames?: ReadonlySet<string>;
  /** Final-answer review issues keyed by the concrete answer field name. */
  reviewIssues?: ReadonlyMap<string, FormAssistantFieldReviewIssue>;
  /** Navigate to the next issue, or back to the assistant when the target is null. */
  onNavigateReviewIssue?: (targetFieldName: string | null) => void;
}

/**
 * A pre-0203 catalog can still hydrate the historical repeat metadata for
 * these fields. Keep that stale catalog from creating new rows while the
 * metadata-only migration rolls out; current schema rows omit the group
 * entirely, so this compatibility cap is otherwise unused.
 */
const REPEAT_GROUP_MAX_OVERRIDES: Record<string, number> = {
  specific_travel_plans: 1,
};

/**
 * Repeat groups without an explicit schema max are unbounded by the official
 * form. Keep this as a numeric sentinel so comparisons stay cheap without
 * materializing rows; rows are still created only when the applicant clicks
 * Add.
 */
const REPEAT_GROUP_DEFAULT_MAX = Number.MAX_SAFE_INTEGER;

const TAIWAN_ENTRY_PERMIT_CONTACT_ADDRESS_NOTICE =
  "可填写在台住宿酒店的地址；即使尚未预订酒店，也可以先填写预计入住的酒店地址。没有在台个人联系电话时，可将酒店电话填写在‘在台市内电话’。";

function isTaiwanEntryPermitContactAddressStep(stepName: string | null | undefined): boolean {
  return stepName?.trim().toLowerCase() === "taiwan contact address";
}

function isClearablePrefillField(field: VisaFormFieldRow): boolean {
  return ["text", "textarea", "tel", "email", "number", "date", "week"].includes(String(field.fieldType));
}

function initialAppliedPrefillValues(
  fields: VisaFormFieldRow[],
  prefill: Record<string, string>,
): Record<string, string> {
  const applied: Record<string, string> = {};
  for (const field of fields) {
    if (!isClearablePrefillField(field)) continue;
    const value = prefill[field.fieldName]?.trim();
    if (value) applied[field.fieldName] = value;
  }
  return applied;
}

export const VN_PREARRIVAL_VISA_CREDENTIALS_OPTIONAL_TYPES = [
  "TMTT",
  "MTT",
  "MMT",
  "MM2",
  "MM1",
  "MTTQ",
] as const;

const VN_PREARRIVAL_VISA_CREDENTIALS_OPTIONAL_EXPRESSION =
  `visa_type in [${VN_PREARRIVAL_VISA_CREDENTIALS_OPTIONAL_TYPES.join(", ")}]`;
const VN_PREARRIVAL_VISA_CREDENTIALS_REQUIRED_EXPRESSION =
  `visa_type not in [${VN_PREARRIVAL_VISA_CREDENTIALS_OPTIONAL_TYPES.join(", ")}]`;

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
  alpha3: string;
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
      flagCountryCode: country.alpha2.toLowerCase(),
      };
    });

  return phoneCountryCodeOptionsCache;
}

interface BilingualTextValue {
  zh: string;
  en: string;
}

function VnPrearrivalEvisaNumberHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
        >
          <CircleHelp className="h-4 w-4" />
          在哪里查看电子签证号码？
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[900px] gap-0 overflow-y-auto rounded-2xl border-0 bg-white px-8 pb-8 pt-[104px] shadow-2xl sm:translate-y-[calc(-50%+20px)] [&>button]:right-8 [&>button]:top-8 [&>button>svg]:h-8 [&>button>svg]:w-8">
        <DialogHeader className="space-y-0">
          <DialogTitle className="sr-only">电子签证号码在哪里？</DialogTitle>
          <DialogDescription className="text-left text-[clamp(18px,3vw,30px)] leading-[1.35] text-[#111827]">
            查看电子签证上的“Số / No.”一行，并输入该行显示的准确号码。电子签证号码必须是 9 位纯数字。
          </DialogDescription>
        </DialogHeader>

        <div
          role="img"
          aria-label="越南电子签证号码位于 Số / No. 一行的官网示例"
          className="mt-8 aspect-[837/468] w-full rounded-lg border border-[#e5e7eb] bg-white bg-no-repeat shadow-sm sm:mt-[72px]"
          style={{
            backgroundImage: "url('/images/vietnam/evisa-number-help-official.png')",
            backgroundPosition: "52.4% 69.5%",
            backgroundSize: "122.35% 194.44%",
          }}
        />

        <div className="flex justify-end pt-8">
          <DialogClose asChild>
            <button
              type="button"
              className="inline-flex h-[60px] min-w-[128px] items-center justify-center rounded-full bg-[#e5e5e5] px-7 text-[30px] font-medium text-[#111827] transition-colors hover:bg-[#d9d9d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            >
              关闭
            </button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
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

function getUsContactUnknownIssue(
  field: VisaFormFieldRow,
  valueKey: string,
  values: Record<string, string>,
  isZh: boolean,
): FieldIssue | null {
  if (field.visaType !== "DS160") return null;
  const role = getUsContactUnknownRole(valueKey);
  if (!role) return null;

  const suffix = getRepeatInstanceSuffix(valueKey);
  const surname = values[`us_contact_surname${suffix}`];
  const givenNames = values[`us_contact_given_names${suffix}`];
  const organization = values[`us_contact_organization${suffix}`];
  const surnameUnknown = isDoNotKnowAnswer(surname);
  const givenNamesUnknown = isDoNotKnowAnswer(givenNames);
  const organizationUnknown = isDoNotKnowAnswer(organization);

  if (role === "name" && surnameUnknown !== givenNamesUnknown) {
    return {
      severity: "error",
      message: isZh
        ? "美国联系人姓名“不知道”必须同时用于姓和名。"
        : "If the U.S. contact name is unknown, mark both surname and given names as unknown.",
    };
  }

  if (organizationUnknown && surnameUnknown && givenNamesUnknown) {
    return {
      severity: "error",
      message: getUsContactRelationshipIssueMessage({ kind: "both_unknown" }, isZh),
    };
  }

  return null;
}

function getDs160PreparerSentinelIssue(
  field: VisaFormFieldRow,
  valueKey: string,
  values: Record<string, string>,
  isZh: boolean,
): FieldIssue | null {
  if (field.visaType !== "DS160") return null;
  const role = getDs160PreparerSentinelRole(valueKey);
  if (!role) return null;

  const suffix = getRepeatInstanceSuffix(valueKey);
  const surname = values[`ds160_preparer_surname${suffix}`];
  const givenNames = values[`ds160_preparer_given_names${suffix}`];
  const organization = values[`ds160_preparer_organization_name${suffix}`];
  const surnameNotApplicable = isDoesNotApplyAnswer(surname);
  const givenNamesNotApplicable = isDoesNotApplyAnswer(givenNames);
  const organizationNotApplicable = isDoesNotApplyAnswer(organization);
  const nameNotApplicable = surnameNotApplicable || givenNamesNotApplicable;

  const issue = (messageZh: string, messageEn: string): FieldIssue => ({
    severity: "error",
    message: isZh ? messageZh : messageEn,
  });

  if (surnameNotApplicable !== givenNamesNotApplicable) {
    return issue(
      "填写人姓名的“不适用”必须同时用于姓氏和名字。",
      "The preparer's name must mark both surname and given names as not applicable.",
    );
  }

  if (nameNotApplicable && organizationNotApplicable) {
    return issue(
      "填写人姓名和机构不能同时选择“不适用”，请至少提供其中一项。",
      "The preparer's name and organization cannot both be not applicable. Provide at least one.",
    );
  }

  // A programmatically synchronized surname or given-name value has no own
  // checkbox in the schema, so allow the shared sentinel through this helper
  // before generic field-option validation runs.
  if (role === "name" && nameNotApplicable) return { severity: "ok", message: "" };
  if (role === "organization" && organizationNotApplicable) return { severity: "ok", message: "" };
  return null;
}

interface EffectiveFieldState {
  validationField: VisaFormFieldRow;
  fieldOptions: VisaFormFieldRow["options"];
  phEtravelSource: string | null;
  isKoreaAddressSearchSelect: boolean;
  vnPrearrivalSource: string | null;
  vnPrearrivalKey: string | null;
  isVnPrearrivalField: boolean;
  isVnPrearrivalArrivalDateField: boolean;
  hasVnPrearrivalStaticOptions: boolean;
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

function hasChineseText(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function isMachineTranslationSensitiveField(field: VisaFormFieldRow): boolean {
  const fieldName = field.fieldName.toLowerCase();
  const label = field.label.toLowerCase();
  return (
    /(?:^|_)(email|phone|telephone|number|identifier|password|url|ssn|taxpayer)(?:_|$)/.test(fieldName)
    || /\b(email|phone|telephone|number|identifier|password|url|ssn|taxpayer)\b/.test(label)
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
  const storedChinese = prefill[`${key}_zh`]?.trim();
  const rawEnglish = prefill[`${key}_en`]?.trim();
  const inputPrompt = /^(?:请(?:填写|输入|选择|提供|填入)|please\s+(?:enter|provide|fill(?:\s+in)?|select)\b|enter\s+your\b)/i;
  const savedAnswer = fallbackValue?.trim() ?? "";
  const canRepairMirror = Boolean(savedAnswer && !inputPrompt.test(savedAnswer));
  // A later official-side edit can leave an old input prompt in a companion
  // column. Recover only that invalid mirror from the saved canonical answer;
  // genuine Chinese answers must survive official-side edits unchanged.
  const zh = canRepairMirror && storedChinese && inputPrompt.test(storedChinese)
    ? toChineseSourceValue(savedAnswer) : storedChinese;
  const storedEnglish = canRepairMirror && rawEnglish && inputPrompt.test(rawEnglish)
    ? toOfficialEnglishValue(savedAnswer) : rawEnglish;
  const en = storedEnglish && !hasChineseText(storedEnglish) ? storedEnglish : "";
  if (zh || en) {
    return {
      zh: zh || toChineseSourceValue(en || fallbackValue || ""),
      en: en || toOfficialEnglishValue(zh || storedEnglish || fallbackValue || ""),
    };
  }
  return toInitialBilingualText(storedEnglish || fallbackValue);
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
  if (status === "idle" || status === "skipped" || status === "translated") return null;

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
      {status === "failed" && error ? <span className="text-[12px] font-normal">{error}</span> : null}
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
  onWarningChange,
}: {
  field: VisaFormFieldRow;
  valueKey: string;
  pair: BilingualTextValue;
  enabled: boolean;
  isChineseInterface: boolean;
  targetWasManuallyEdited: boolean;
  onApplyTranslation: (valueKey: string, sourceText: string, translatedText: string, force: boolean) => void;
  onResetManualEdit: (valueKey: string) => void;
  onWarningChange: (valueKey: string, hasWarning: boolean) => void;
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
  const hasWarning = status === "failed" || status === "user_edited";

  useEffect(() => {
    onWarningChange(valueKey, hasWarning);
  }, [hasWarning, onWarningChange, valueKey]);

  useEffect(() => () => {
    onWarningChange(valueKey, false);
  }, [onWarningChange, valueKey]);

  return (
    <RealtimeTranslationStatusLine
      status={status}
      error={error}
      isChineseInterface={isChineseInterface}
      onRetry={retry}
    />
  );
}

function parseFlexibleDate(value?: string): Date | null {
  return parseDateFieldValue(value);
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

function formatIsoDateFromUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    const value = formatIsoDateFromUtcDate(date);
    const officialLabel = formatOfficialDateFromUtcDate(date);
    return {
      value,
      text: officialLabel,
      label_en: officialLabel,
      label_zh: officialLabel,
      official_label: officialLabel,
    };
  });
}

function normaliseVnPrearrivalArrivalDate(value: string): string | null {
  const parsed = parseFlexibleDate(value);
  if (!parsed) return null;
  return formatIsoDateFromUtcDate(new Date(Date.UTC(
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

const DOCUMENT_EXPIRY_DISPLAY_KEY_CANDIDATES = [
  "date_of_expiry",
  "expiration_date",
  "expiry_date",
] as const;

function getRepeatInstanceSuffix(key: string): string {
  return key.match(/__\d+$/)?.[0] ?? "";
}

function stripRepeatInstanceSuffix(key: string): string {
  return key.replace(/__\d+$/, "");
}

function isPrefillMirrorKey(key: string): boolean {
  return /_(?:zh|en)$/u.test(key);
}

type UsContactUnknownRole = "name" | "organization";

interface UsContactUnknownSnapshot {
  values: Record<string, string>;
  textPairs: Record<string, BilingualTextValue>;
}

function getUsContactUnknownRole(fieldName: string): UsContactUnknownRole | null {
  switch (stripRepeatInstanceSuffix(fieldName)) {
    case "us_contact_surname":
    case "us_contact_given_names":
      return "name";
    case "us_contact_organization":
      return "organization";
    default:
      return null;
  }
}

type Ds160PreparerSentinelRole = "name" | "organization";

function getDs160PreparerSentinelRole(fieldName: string): Ds160PreparerSentinelRole | null {
  switch (stripRepeatInstanceSuffix(fieldName)) {
    case "ds160_preparer_surname":
    case "ds160_preparer_given_names":
      return "name";
    case "ds160_preparer_organization_name":
      return "organization";
    default:
      return null;
  }
}

function isDoNotKnowAnswer(value: string | undefined): boolean {
  return value?.trim() === "DO_NOT_KNOW";
}

function isDoesNotApplyAnswer(value: string | undefined): boolean {
  return value?.trim() === "DOES_NOT_APPLY";
}

type NormalisedFieldCandidates = readonly string[];

// Schema field names are stable and bounded by the loaded form. Keep only a
// small FIFO cache for normalized keys so repeated validation passes avoid the
// regexp/lowercase work without retaining arbitrary answer data.
const NORMALISED_FIELD_KEY_CACHE_LIMIT = 1024;
const normalisedFieldKeyCache = new Map<string, string>();
const normalisedFieldCandidatesCache = new WeakMap<
  readonly string[],
  NormalisedFieldCandidates
>();

function normaliseFieldKey(key: string): string {
  const cached = normalisedFieldKeyCache.get(key);
  if (cached !== undefined) return cached;

  const normalised = stripRepeatInstanceSuffix(key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (normalisedFieldKeyCache.size >= NORMALISED_FIELD_KEY_CACHE_LIMIT) {
    const oldestKey = normalisedFieldKeyCache.keys().next().value;
    if (oldestKey !== undefined) normalisedFieldKeyCache.delete(oldestKey);
  }
  normalisedFieldKeyCache.set(key, normalised);
  return normalised;
}

function getNormalisedFieldCandidates(
  candidates: readonly string[],
): NormalisedFieldCandidates {
  const cached = normalisedFieldCandidatesCache.get(candidates);
  if (cached) return cached;

  const normalised = candidates.map(normaliseFieldKey);
  normalisedFieldCandidatesCache.set(candidates, normalised);
  return normalised;
}

function normalisedFieldKeyMatchesCandidate(
  normalisedKey: string,
  normalisedCandidate: string,
): boolean {
  return (
    normalisedKey === normalisedCandidate ||
    normalisedKey.endsWith(`_${normalisedCandidate}`) ||
    normalisedKey.includes(`_${normalisedCandidate}_`)
  );
}

function fieldKeyMatchesAny(key: string, candidates: readonly string[]): boolean {
  const normalisedKey = normaliseFieldKey(key);
  return getNormalisedFieldCandidates(candidates).some((candidate) =>
    normalisedFieldKeyMatchesCandidate(normalisedKey, candidate)
  );
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
    fieldKeyMatchesAny(valueKey, DOCUMENT_EXPIRY_DISPLAY_KEY_CANDIDATES)
  );
}

function isUkAccommodationStayDateField(_field: VisaFormFieldRow, valueKey: string): boolean {
  const baseKey = stripRepeatInstanceSuffix(valueKey).toLowerCase();
  return baseKey === "uk_accommodation_arrival_date" || baseKey === "uk_accommodation_departure_date";
}

function isCurrentDepartureDateField(field: VisaFormFieldRow, valueKey: string): boolean {
  if (isUkAccommodationStayDateField(field, valueKey)) return false;
  return currentFieldMatchesAny(field, valueKey, DEPARTURE_DATE_CANDIDATES);
}

function isCurrentArrivalDateField(field: VisaFormFieldRow, valueKey: string): boolean {
  if (isUkAccommodationStayDateField(field, valueKey)) return false;
  return currentFieldMatchesAny(field, valueKey, ARRIVAL_DATE_CANDIDATES);
}

function isCurrentNationalityConsistencyField(field: VisaFormFieldRow, valueKey: string): boolean {
  return currentFieldMatchesAny(field, valueKey, NATIONALITY_CONSISTENCY_CANDIDATES);
}

interface ValueLookupIndex {
  entries: ReadonlyArray<[string, string]>;
  usesDefaultEntries: boolean;
  normalisedEntries: Array<{ key: string; value: string; normalisedKey: string }>;
  fallbackValues: Map<string, string | null>;
}

// Field-level validation asks for the same cross-field answers repeatedly.
// Keep normalized fallback keys with the values object so a render pays the
// normalization cost once instead of once per field and candidate alias.
// The WeakMap avoids retaining completed renders while preserving the exact
// Object.entries order used by the legacy fallback matcher.
const valueLookupIndexCache = new WeakMap<Record<string, string>, ValueLookupIndex>();

function getValueLookupIndex(
  values: Record<string, string>,
  valueEntries?: ReadonlyArray<[string, string]>,
): ValueLookupIndex {
  const usesDefaultEntries = !valueEntries;
  const cached = valueLookupIndexCache.get(values);
  if (
    cached &&
    cached.usesDefaultEntries === usesDefaultEntries &&
    (usesDefaultEntries || cached.entries === valueEntries)
  ) {
    return cached;
  }

  const entries = valueEntries ?? Object.entries(values);
  const index: ValueLookupIndex = {
    entries,
    usesDefaultEntries,
    normalisedEntries: entries.map(([key, value]) => ({
      key,
      value,
      normalisedKey: normaliseFieldKey(key),
    })),
    fallbackValues: new Map(),
  };
  valueLookupIndexCache.set(values, index);
  return index;
}

function findIndexedFallbackValue(
  index: ValueLookupIndex,
  candidate: string,
  repeatSuffix: string,
): string | null {
  const normalisedCandidate = normaliseFieldKey(candidate);
  const cacheKey = `${repeatSuffix}\u0000${normalisedCandidate}`;
  if (index.fallbackValues.has(cacheKey)) {
    return index.fallbackValues.get(cacheKey) ?? null;
  }

  const matched = index.normalisedEntries.find(({ key, value, normalisedKey }) =>
    (!repeatSuffix || key.endsWith(repeatSuffix)) &&
    normalisedFieldKeyMatchesCandidate(normalisedKey, normalisedCandidate) &&
    Boolean(value.trim()),
  )?.value ?? null;
  index.fallbackValues.set(cacheKey, matched);
  return matched;
}

function findAnswerValue(
  values: Record<string, string>,
  candidates: readonly string[],
  repeatSuffix = "",
  valueEntries?: ReadonlyArray<[string, string]>,
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

  const index = getValueLookupIndex(values, valueEntries);
  for (const candidate of candidates) {
    const found = findIndexedFallbackValue(index, candidate, repeatSuffix);
    if (found) return found;
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

const VN_PREARRIVAL_FLIGHT_PAGE_SIZE = 10;
const VN_PREARRIVAL_OTHER_FLIGHT_OPTION: VisaFormFieldOption = {
  value: "other",
  text: "Other",
  label_en: "Other",
  label_zh: "其他",
  official_label: "Other",
  code: "other",
};
const VN_PREARRIVAL_OTHER_HOTEL_OPTION: VisaFormFieldOption = {
  value: "other",
  text: "Other",
  label_en: "Other",
  label_zh: "其他",
  official_label: "Other",
  code: "other",
};

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function withVnPrearrivalOtherFlightOption(
  options: VisaFormFieldOption[],
): VisaFormFieldOption[] {
  return [
    ...options.filter((option) => optionValue(option).toLowerCase() !== "other"),
    VN_PREARRIVAL_OTHER_FLIGHT_OPTION,
  ];
}

export function withVnPrearrivalOtherHotelOption(
  options: VisaFormFieldOption[],
): VisaFormFieldOption[] {
  return [
    ...options.filter((option) => optionValue(option).toLowerCase() !== "other"),
    VN_PREARRIVAL_OTHER_HOTEL_OPTION,
  ];
}

export function ensureVnPrearrivalOtherFlightFlow(
  steps: WizardStep[],
): WizardStep[] {
  const visaTypeOptions =
    getVnPrearrivalStaticOptions("prearrival_category:visa_type") ?? [];
  const visaCredentialsOptionalExpression =
    VN_PREARRIVAL_VISA_CREDENTIALS_OPTIONAL_EXPRESSION;
  const visaCredentialsRequiredExpression =
    VN_PREARRIVAL_VISA_CREDENTIALS_REQUIRED_EXPRESSION;

  return steps.map((step) => {
    const isVnPrearrivalStep = step.fields.some(
      (field) => field.visaType === "VN_PREARRIVAL_DECLARATION",
    );
    if (!isVnPrearrivalStep) return step;

    const flightField = step.fields.find((field) => field.fieldName === "flight_number");
    let changed = false;
    let hasCustomFlightField = false;
    const fields = step.fields.map((field) => {
      if (field.fieldName === "visa_type") {
        changed = true;
        return {
          ...field,
          required: true,
          options: visaTypeOptions.length > 0 ? visaTypeOptions : field.options,
          validationRules: {
            ...(field.validationRules ?? {}),
            official: true,
            official_source: "prearrival_category:visa_type",
          },
        };
      }

      if (field.fieldName === "visa_number") {
        changed = true;
        return {
          ...field,
          required: true,
          conditionalLogic: { showIf: visaCredentialsRequiredExpression },
          validationRules: {
            ...(field.validationRules ?? {}),
            official: true,
            maxLength: 64,
            required_unless: visaCredentialsOptionalExpression,
            numeric_length_when: { field: "visa_type", equals: "EV", length: 9 },
          },
        };
      }

      if (field.fieldName === "visa_expiry_date") {
        changed = true;
        return {
          ...field,
          required: true,
          conditionalLogic: { showIf: visaCredentialsRequiredExpression },
          validationRules: {
            ...(field.validationRules ?? {}),
            official: true,
            required_unless: visaCredentialsOptionalExpression,
          },
        };
      }

      if (field.fieldName === "visa_issue_date") {
        const expectedCondition = { showIf: visaCredentialsRequiredExpression };
        if (!field.required && field.conditionalLogic?.showIf === expectedCondition.showIf) return field;
        changed = true;
        return { ...field, required: false, conditionalLogic: expectedCondition };
      }

      if (field.fieldName === "visa_issued_place") {
        changed = true;
        return {
          ...field,
          required: false,
          conditionalLogic: { showIf: visaCredentialsRequiredExpression },
          validationRules: {
            ...(field.validationRules ?? {}),
            official: true,
            official_source: "prearrival_category:visa_issue_place",
            remote_search: true,
            depends_on: "visa_type",
          },
        };
      }

      if (
        field.fieldName === "nationality"
        || field.fieldName === "departure_country_before_arrival"
      ) {
        const rules = field.validationRules ?? {};
        if (
          rules.official === true
          && rules.official_source === "prearrival_category:nationality"
          && rules.remote_search === true
        ) {
          return field;
        }
        changed = true;
        return {
          ...field,
          validationRules: {
            ...rules,
            official: true,
            official_source: "prearrival_category:nationality",
            remote_search: true,
          },
        };
      }

      if (field.fieldName === "custom_flight_number") {
        hasCustomFlightField = true;
        const expectedCondition = "mode_of_travel === air && flight_number === other";
        const currentCondition = (field.conditionalLogic as { showIf?: string } | null)?.showIf;
        if (currentCondition === expectedCondition) return field;
        changed = true;
        return {
          ...field,
          conditionalLogic: { ...field.conditionalLogic, showIf: expectedCondition },
        };
      }

      if (field.fieldName !== "border_gate_airport") return field;

      const rules = field.validationRules ?? {};
      if (
        rules.locked_by === "flight_number"
        && rules.read_only === true
        && rules.editable_when_value === "other"
      ) {
        return field;
      }

      changed = true;
      return {
        ...field,
        validationRules: {
          ...rules,
          locked_by: "flight_number",
          read_only: true,
          editable_when_value: "other",
        },
      };
    });

    if (flightField && !hasCustomFlightField) {
      changed = true;
      fields.push({
        id: `${flightField.id}:custom-flight-number`,
        visaType: flightField.visaType,
        fieldName: "custom_flight_number",
        label: "Flight Number",
        fieldType: "text",
        required: true,
        stepNumber: flightField.stepNumber,
        stepName: flightField.stepName,
        displayOrder: flightField.displayOrder + 1,
        placeholder: "Enter flight number",
        validationRules: {
          label_zh: "手动填写航班号",
          official: true,
          maxLength: 40,
          helper_zh: "仅当官网航班列表中没有你的航班时填写。",
          helper_en: "Enter this only when your flight is not available in the official list.",
        },
        options: null,
        conditionalLogic: {
          showIf: "mode_of_travel === air && flight_number === other",
        },
      });
    }

    if (!changed) return step;
    return {
      ...step,
      fields: fields.sort((left, right) => left.displayOrder - right.displayOrder),
    };
  });
}

export function reconcileVnPrearrivalNationalityValue(
  currentValue: string,
  options: VisaFormFieldOption[],
): string {
  const trimmed = currentValue.trim();
  if (!trimmed || options.length === 0) return currentValue;

  const normalized = normalizeComparableOptionValue(trimmed);
  const directMatch = options.find((option) => {
    if (typeof option === "string") {
      return normalizeComparableOptionValue(option) === normalized;
    }
    return [
      option.value,
      option.code,
      option.text,
      option.label_en,
      option.official_label,
    ].some((candidate) => normalizeComparableOptionValue(candidate) === normalized);
  });
  if (directMatch) return optionValue(directMatch);

  const country = (countries.all as CountryDataListCountry[]).find((candidate) =>
    [candidate.alpha2, candidate.alpha3, candidate.name]
      .some((candidateValue) => normalizeComparableOptionValue(candidateValue) === normalized),
  );
  if (!country?.alpha3) return currentValue;

  const officialCode = country.alpha3.toUpperCase();
  const officialMatch = options.find((option) => {
    if (typeof option === "string") return option.toUpperCase() === officialCode;
    return option.value.toUpperCase() === officialCode || option.code?.toUpperCase() === officialCode;
  });
  return officialMatch ? optionValue(officialMatch) : currentValue;
}

function mergeVnPrearrivalFlightPages(
  current: VisaFormFieldOption[],
  incoming: VisaFormFieldOption[],
): VisaFormFieldOption[] {
  const merged = new Map<string, VisaFormFieldOption>();
  for (const option of [...current, ...incoming]) {
    const value = optionValue(option);
    if (!value || value.toLowerCase() === "other") continue;
    merged.set(value, option);
  }
  return withVnPrearrivalOtherFlightOption([...merged.values()]);
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

function getPhEtravelOfficialOptionSource(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { official_options_source?: unknown } | null;
  return rules?.official_options_source === "ph_etravel:flight_numbers"
    ? rules.official_options_source
    : null;
}

function isKoreaOfficialAddressSearchField(field: VisaFormFieldRow): boolean {
  const source = (field.validationRules as { source?: unknown } | null)?.source;
  return (
    (field.fieldName === "address_in_korea" && source === "korea_visa_portal_address_search")
    || (field.fieldName === "stay_address_search" && source === "korea_e_arrival_card_address_search")
  );
}

function getPhEtravelDependsOn(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { depends_on?: unknown; dependsOn?: unknown } | null;
  const dependsOn = rules?.depends_on ?? rules?.dependsOn;
  return typeof dependsOn === "string" && dependsOn.trim() ? dependsOn.trim() : null;
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

function normalizeFixedChoiceStepValues(
  fields: VisaFormFieldRow[],
  values: Record<string, string>,
  changedFieldName?: string,
): Record<string, string> {
  if (changedFieldName) {
    const baseFieldName = stripRepeatInstanceSuffix(changedFieldName);
    const changedField = fields.find((field) => field.fieldName === baseFieldName);
    // Text edits cannot make a previously saved select label non-canonical.
    // Keep the full option canonicalization for select edits and hydration,
    // but avoid rescanning every select option for every typed character.
    if (changedField?.fieldType !== "select") return values;
  }

  const next = { ...values };

  for (const field of fields) {
    if (field.fieldType !== "select" || !field.options?.length) continue;

    const officialSource = getDs160OfficialOptionSource(field);
    if (officialSource) {
      // Resolve legacy ISO names/codes without discarding saved answers when
      // an old value is ambiguous in the current official catalog.
      for (const key of Object.keys(next)) {
        if (key === field.fieldName || new RegExp(`^${field.fieldName}__\\d+$`).test(key)) {
          next[key] = resolveDs160OfficialOptionValue(officialSource, next[key]);
        }
      }
      continue;
    }

    const rules = field.validationRules as {
      source?: unknown;
      dependent_on?: unknown;
      depends_on?: unknown;
      dependsOn?: unknown;
      official_options_source?: unknown;
      official_source?: unknown;
      remote_search?: unknown;
    } | null;
    // US_STATES controls resolve their options from RegionSelect's catalog.
    // The schema can contain only a placeholder; it is not an allowlist for
    // the persisted official code (for example CA).
    if (rules?.source === "US_STATES") continue;
    const optionsAreLoadedOrDependent = Boolean(
      rules?.dependent_on
      || rules?.depends_on
      || rules?.dependsOn
      || rules?.official_options_source
      || rules?.official_source
      || rules?.remote_search,
    );
    if (optionsAreLoadedOrDependent) continue;

    const currentValue = next[field.fieldName]?.trim();
    if (!currentValue) continue;

    // Universal Profile and legacy answers may contain a displayed label (for
    // example "Employed") or unrelated free text instead of the option's
    // stored value ("employed"). Radix Select cannot display such a value, so
    // canonicalize known labels and discard stale values that the user cannot
    // actually see or select.
    next[field.fieldName] = findCanonicalOptionValue(field.options, currentValue) ?? "";
  }

  return next;
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

export function reconcileVnPrearrivalFlightAfterCatalogRefresh(
  currentValues: Record<string, string>,
  checkedFlightValue: string,
  result: { catalogSource?: string; selectedExists?: boolean | null },
): Record<string, string> {
  const checkedValue = checkedFlightValue.trim();
  if (!checkedValue || checkedValue.toLowerCase() === "other") return currentValues;
  if ((currentValues.flight_number ?? "").trim() !== checkedValue) return currentValues;
  if (result.catalogSource !== "official_live" || result.selectedExists !== false) return currentValues;
  return {
    ...currentValues,
    flight_number: "",
    custom_flight_number: "",
    border_gate_airport: "",
  };
}

function restoreVnPrearrivalHotelHierarchy(values: Record<string, string>): Record<string, string> {
  const hotelCode = values.hotel_accommodation_address?.trim() ?? "";
  if (!hotelCode) return values;

  const hotelOptions = getVnPrearrivalStaticOptions("prearrival_category:hotel") ?? [];
  const selectedHotel = hotelOptions.find((option) =>
    typeof option !== "string" && option.value === hotelCode,
  );
  if (!selectedHotel || typeof selectedHotel === "string") return values;

  const provinceCity = selectedHotel.province_city?.trim() ?? "";
  const ward = selectedHotel.ward?.trim() ?? "";
  if (!provinceCity || !ward) return values;
  if (
    values.province_city_of_hotel === provinceCity &&
    values.ward_commune_of_hotel === ward
  ) return values;

  return {
    ...values,
    province_city_of_hotel: provinceCity,
    ward_commune_of_hotel: ward,
  };
}

function getVnPrearrivalSelectedHotelWardOption(
  values: Record<string, string>,
): VisaFormFieldOption | null {
  const hotelCode = values.hotel_accommodation_address?.trim() ?? "";
  const wardCode = values.ward_commune_of_hotel?.trim() ?? "";
  if (!hotelCode || !wardCode) return null;

  const hotelOptions = getVnPrearrivalStaticOptions("prearrival_category:hotel") ?? [];
  const selectedHotel = hotelOptions.find((option) =>
    typeof option !== "string" && option.value === hotelCode,
  );
  if (!selectedHotel || typeof selectedHotel === "string") return null;

  const englishAddress = selectedHotel.label_en ?? selectedHotel.text ?? "";
  const wardLabel = englishAddress
    .split(",")
    .map((part) => part.trim())
    .find((part) => /\b(?:ward|commune|town|village)$/i.test(part));
  if (!wardLabel) return null;

  return {
    value: wardCode,
    text: wardLabel,
    label_en: wardLabel,
    label_zh: localizeVietnamAdministrativeUnitText(wardLabel),
    official_label: wardLabel,
    searchText: `${wardLabel} ${wardCode}`,
  };
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
  changedFieldName?: string,
): Record<string, string> {
  const resolvedVisaType = visaType ?? fields[0]?.visaType;
  const fixedChoiceValues = normalizeFixedChoiceStepValues(fields, values, changedFieldName);
  if (resolvedVisaType === "VN_E_VISA" || resolvedVisaType === "evisa_tourism") {
    const next = { ...fixedChoiceValues };
    const legacyChinaAliases = new Set([
      "hk",
      "hkg",
      "hong_kong",
      "hong_kong_sar",
      "hong_kong_special_administrative_region",
      "mo",
      "mac",
      "macao",
      "macao_sar",
      "macau",
      "macau_sar",
    ]);
    for (const field of fields) {
      if (![
        "nationality",
        "other_nationality",
        "other_vietnam_passport_nationality",
        "relative_nationality",
      ].includes(field.fieldName)) {
        continue;
      }
      const currentValue = next[field.fieldName]?.trim();
      if (!currentValue || !field.options?.length) continue;
      const normalizedValue = normalizeComparableOptionValue(currentValue);
      if (legacyChinaAliases.has(normalizedValue)) {
        next[field.fieldName] = "CHN";
        continue;
      }
      const canonical = findCanonicalOptionValue(field.options, currentValue);
      if (canonical) next[field.fieldName] = canonical;
    }
    return next;
  }
  if (resolvedVisaType !== "TH_TDAC_ARRIVAL_CARD") return fixedChoiceValues;

  const next = { ...fixedChoiceValues };
  const fieldByName = new Map(fields.map((field) => [field.fieldName, field]));

  const normalizeOptionField = (fieldName: string, fallbackKeys: string[] = []) => {
    const field = fieldByName.get(fieldName);
    if (!field) return;
    const currentValue = next[fieldName]?.trim();
    const fallbackValue = fallbackKeys.map((key) => next[key]?.trim()).find(Boolean);
    let options = field.options;
    const rules = field.validationRules as {
      dependent_on?: string;
      depends_on?: string;
      dependsOn?: string;
      dependent_options?: Record<string, VisaFormFieldOption[]>;
    } | null;
    const parentFieldName = rules?.dependent_on ?? rules?.depends_on ?? rules?.dependsOn;
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
    // `allowedKeys` contains only canonical schema field names. A canonical
    // field may legitimately end in `_en` (for example Korea's
    // `stay_address_en`), so suffix-based auxiliary filtering here would drop
    // an official answer before it reaches the runner. Generated bilingual
    // companion keys are added later and are never part of this set.
    filtered[key] = values[key] ?? "";
  }
  return filtered;
}

function buildCurrentStepAnswerPatch(
  fields: VisaFormFieldRow[],
  values: Record<string, string>,
  groupCounts: Record<string, number>,
  textPairs: Record<string, BilingualTextValue>,
): Record<string, string> {
  const answers = filterCurrentStepValues(fields, values, groupCounts);

  for (const field of fields) {
    if (isKoreaOfficialAddressSearchField(field)) {
      answers[`${field.fieldName}_zh`] = values[`${field.fieldName}_zh`] ?? "";
      answers[`${field.fieldName}_en`] = values[`${field.fieldName}_en`] ?? values[field.fieldName] ?? "";
    }
    if (!usesBilingualAnswerPair(field)) continue;
    const group = getRepeatGroup(field);
    const keys = group
      ? Array.from(
          { length: groupCounts[group] ?? 1 },
          (_, index) => instanceKey(field.fieldName, index),
        )
      : [field.fieldName];

    for (const key of keys) {
      const pair = textPairs[key];
      if (!pair) continue;
      answers[`${key}_zh`] = pair.zh;
      answers[`${key}_en`] = pair.en;
    }
  }

  return answers;
}

function getLocalFieldIssue(
  field: VisaFormFieldRow,
  valueKey: string,
  value: string,
  values: Record<string, string>,
  locale: string,
  valueEntries?: ReadonlyArray<[string, string]>,
  allValues: Record<string, string> = values,
): FieldIssue {
  const isZh = isChineseLocale(locale);
  const trimmed = value.trim();
  const rules = field.validationRules as {
    maxLength?: number;
    pattern?: string;
    at_least_one_of?: string[];
    allow_do_not_know?: boolean;
    allow_unknown?: boolean;
    allow_does_not_apply?: boolean;
    has_does_not_apply?: boolean;
    allow_year_only?: boolean;
    minimum_date_precision?: "day" | "month" | "year";
    min_date?: "today";
    max_days_from_today?: number;
    submission_window_hours?: number;
    not_before_today?: boolean;
    not_before_field?: string;
    after_or_equal_field?: string;
    min_days_after_field?: string;
    min_days_after_field_days?: number;
    official_source?: string;
    numeric_length_when?: {
      field?: string;
      equals?: string;
      length?: number;
    };
    specific_error_zh?: string;
    specific_error_en?: string;
  } | null;
  const issue = (severity: FieldIssueSeverity, message: string): FieldIssue => ({ severity, message });

  if (field.fieldName === FORMER_SPOUSE_COUNT_FIELD) {
    const formerSpouseCountIssue = getFormerSpouseCountIssue(values);
    if (formerSpouseCountIssue) {
      return issue(
        "error",
        getFormerSpouseCountValidationMessage(formerSpouseCountIssue, isZh),
      );
    }
  }

  if (
    field.visaType === "DS160" &&
    FORMER_SPOUSE_IDENTITY_FIELDS.some((fieldName) => fieldName === field.fieldName) &&
    getRepeatGroup(field) === FORMER_SPOUSE_REPEAT_GROUP
  ) {
    const formerSpouseDuplicateIssue = getFormerSpouseDuplicateIssue(allValues, valueKey);
    if (formerSpouseDuplicateIssue) {
      return issue(
        "error",
        getFormerSpouseDuplicateMessage(formerSpouseDuplicateIssue, isZh),
      );
    }
  }

  const ds160PreparerSentinelIssue = getDs160PreparerSentinelIssue(field, valueKey, values, isZh);
  if (ds160PreparerSentinelIssue) return ds160PreparerSentinelIssue;

  if (field.required && !trimmed) {
    return issue("warning", isZh ? "必填项" : "Required");
  }

  const usContactUnknownIssue = getUsContactUnknownIssue(field, valueKey, values, isZh);
  if (usContactUnknownIssue) return usContactUnknownIssue;

  if (field.visaType === "DS160" && field.fieldName === "us_contact_relationship") {
    const usContactRelationshipIssue = getUsContactRelationshipIssue(values, valueKey);
    if (usContactRelationshipIssue) {
      return issue(
        "error",
        getUsContactRelationshipIssueMessage(usContactRelationshipIssue, isZh),
      );
    }
  }

  if (field.visaType === "DS160" && field.fieldName === "us_relative_relationship") {
    const immediateRelativeRelationshipIssue = getDs160ImmediateRelativeRelationshipIssue(values, valueKey);
    if (immediateRelativeRelationshipIssue) {
      return issue(
        "error",
        getDs160ImmediateRelativeRelationshipIssueMessage(immediateRelativeRelationshipIssue, isZh),
      );
    }
  }

  if (
    field.visaType === "DS160" &&
    field.fieldName === DS160_TRIP_PURPOSE_FIELD &&
    getRepeatGroup(field) === DS160_TRIP_PURPOSE_REPEAT_GROUP
  ) {
    const duplicateIssue = getDs160TripPurposeDuplicateIssue(allValues, valueKey);
    if (duplicateIssue) {
      return issue(
        "error",
        getDs160TripPurposeDuplicateMessage(duplicateIssue, isZh),
      );
    }
  }

  if (field.visaType === "DS160" && (
    field.fieldName === "nationality_country" ||
    field.fieldName === "other_nationality_country" ||
    field.fieldName === "other_permanent_resident_country"
  )) {
    const duplicateIssue = getDs160NationalityDuplicateIssue(allValues, valueKey);
    if (duplicateIssue) {
      return issue(
        "error",
        getDs160NationalityDuplicateMessage(duplicateIssue, isZh),
      );
    }
  }

  // Date sentinels are canonical answers only when the schema explicitly
  // exposes the corresponding unknown/not-applicable branch. They must skip
  // date parsing and every date-specific constraint, while arbitrary strings
  // still follow the normal strict date validation below.
  if (field.fieldType === "date" && getDateFieldValueState(trimmed, rules) === "allowed_sentinel") {
    return issue("ok", "");
  }

  // Non-date controls use the same official sentinel answers as date fields
  // (for example DS-160 SSN may explicitly be DOES_NOT_APPLY). Once the
  // schema opts into that branch, skip ordinary length/pattern/option checks;
  // the sentinel is the completed canonical answer for that field.
  const isAllowedNonDateSentinel =
    (trimmed === "DO_NOT_KNOW" && (rules?.allow_do_not_know === true || rules?.allow_unknown === true))
    || (trimmed === "DOES_NOT_APPLY" && (rules?.allow_does_not_apply === true || rules?.has_does_not_apply === true));
  if (isAllowedNonDateSentinel) {
    return issue("ok", "");
  }

  if (rules?.maxLength && trimmed.length > rules.maxLength) {
    return issue("error", isZh ? `最多 ${rules.maxLength} 个字符` : `Maximum ${rules.maxLength} characters`);
  }

  if (
    !trimmed &&
    rules?.at_least_one_of?.length &&
    !rules.at_least_one_of.some((fieldName) => (values[fieldName] ?? "").trim())
  ) {
    const isKoreaStayAddressGroup = rules.at_least_one_of.includes("stay_address_ko")
      && rules.at_least_one_of.includes("stay_address_en");
    return issue(
      "error",
      isKoreaStayAddressGroup
        ? isZh
          ? "请填写韩国住宿地址（韩文或英文任选一项）"
          : "Enter the address in Korea in either Korean or English"
        : isZh
          ? "请至少填写这组字段中的一项"
          : "Complete at least one field in this group",
    );
  }

  const numericLengthRule = rules?.numeric_length_when
    ?? (
      isVnPrearrivalContext(undefined, field)
      && field.fieldName === "visa_number"
      && values.visa_type?.trim() === "EV"
        ? { field: "visa_type", equals: "EV", length: 9 }
        : undefined
    );
  if (
    trimmed &&
    numericLengthRule?.field &&
    numericLengthRule.equals &&
    numericLengthRule.length &&
    values[numericLengthRule.field]?.trim() === numericLengthRule.equals &&
    !new RegExp(`^\\d{${numericLengthRule.length}}$`).test(trimmed)
  ) {
    return issue(
      "error",
      isZh
        ? `电子签证编号必须是“Số / No.”后的 ${numericLengthRule.length} 位纯数字`
        : `The E-Visa number must be the ${numericLengthRule.length}-digit numeric value on the “Số / No.” line`,
    );
  }

  if (rules?.pattern && trimmed) {
    try {
      if (!new RegExp(rules.pattern).test(trimmed)) {
        const exactDigitLength = rules.pattern.match(/^\^\[0-9\]\{(\d+)\}\$$/u)?.[1]
          ?? rules.pattern.match(/^\^\\d\{(\d+)\}\$$/u)?.[1];
        return issue(
          "error",
          (isZh ? rules.specific_error_zh : rules.specific_error_en)
            ?? (exactDigitLength
            ? isZh
              ? `请输入 ${exactDigitLength} 位数字`
              : `Enter exactly ${exactDigitLength} digits`
            : isZh
              ? "格式不符合要求"
              : "Format does not match the requirement"),
        );
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
    options.length > 0 &&
    !rules?.official_source
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

  const dateValueState = field.fieldType === "date" ? getDateFieldValueState(trimmed, rules) : null;
  const isPartialDate = dateValueState === "year_only" || dateValueState === "month_only";
  const isYearOnly = dateValueState === "year_only";
  const currentDate = field.fieldType === "date" && !isPartialDate ? parseFlexibleDate(trimmed) : null;
  if (field.fieldType === "date" && trimmed && (dateValueState === "invalid" || (!currentDate && !isPartialDate))) {
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

  if (isUkAccommodationStayDateField(field, valueKey)) {
    const accArrival = parseFlexibleDate(values[`uk_accommodation_arrival_date${repeatSuffix}`] ?? "");
    const accDeparture = parseFlexibleDate(values[`uk_accommodation_departure_date${repeatSuffix}`] ?? "");
    if (accArrival && accDeparture && accDeparture < accArrival) {
      return issue("error", isZh ? "离开日期不能早于抵达日期" : "Departure date cannot be earlier than arrival date");
    }
    return issue("ok", isZh ? "AI 填写帮助" : "AI field guidance");
  }

  const issueDate = parseFlexibleDate(findAnswerValue(
    values,
    DOCUMENT_ISSUE_DATE_CANDIDATES,
    repeatSuffix,
    valueEntries,
  ) ?? undefined);
  const expiryDate = parseFlexibleDate(findAnswerValue(
    values,
    DOCUMENT_EXPIRY_DATE_CANDIDATES,
    repeatSuffix,
    valueEntries,
  ) ?? undefined);

  if (isCurrentDocumentExpiryField(field, valueKey) && issueDate && expiryDate && expiryDate <= issueDate) {
    return issue("error", isZh ? "到期日必须晚于签发日" : "Expiry date must be after the issue date");
  }

  const arrivalDate = parseFlexibleDate(findAnswerValue(
    values,
    ARRIVAL_DATE_CANDIDATES,
    repeatSuffix,
    valueEntries,
  ) ?? undefined);
  const departureDate = parseFlexibleDate(findAnswerValue(
    values,
    DEPARTURE_DATE_CANDIDATES,
    repeatSuffix,
    valueEntries,
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

  const currentNationality = findAnswerValue(
    values,
    ["current_nationality", "nationality_country", "nationality"],
    "",
    valueEntries,
  );
  const nationalityAtBirth = findAnswerValue(values, ["nationality_at_birth"], "", valueEntries);
  const nationalityDifferent = findAnswerValue(values, ["nationality_at_birth_different"], "", valueEntries);
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
    depends_on?: string;
    dependsOn?: string;
    dependent_options?: Record<string, VisaFormFieldOption[]>;
  } | null;
  const parentFieldName = rules?.dependent_on ?? rules?.depends_on ?? rules?.dependsOn;
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
  const configuredDefault = (field.validationRules as { defaultValue?: unknown } | null)?.defaultValue;
  if (typeof configuredDefault === "string" && configuredDefault.trim()) {
    return configuredDefault.trim();
  }

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

function repeatInstanceIndex(field: VisaFormFieldRow, valueKey: string): number {
  const suffix = valueKey.slice(field.fieldName.length);
  const match = /^__(\d+)$/.exec(suffix);
  if (!match) return 0;
  return Math.max(0, Number(match[1]) - 1);
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

function hasConditionalDependency(field: VisaFormFieldRow): boolean {
  const showIf = (field.conditionalLogic as { showIf?: string } | null)?.showIf;
  const rules = field.validationRules as {
    dependent_on?: string;
    depends_on?: string;
    dependsOn?: string;
  } | null;

  return Boolean(showIf || rules?.dependent_on || rules?.depends_on || rules?.dependsOn);
}

function hasConditionalVisibility(field: VisaFormFieldRow): boolean {
  return Boolean((field.conditionalLogic as { showIf?: string } | null)?.showIf);
}

function shouldOwnConditionalPanel(field: VisaFormFieldRow): boolean {
  return hasConditionalVisibility(field) && getCompiledConditionalPanelMode(field) !== "outer_only";
}

function getDataDependencies(field: VisaFormFieldRow): string[] {
  const dependencies = new Set<string>();
  const rules = field.validationRules as {
    dependent_on?: string;
    depends_on?: string;
    dependsOn?: string;
  } | null;
  for (const dependency of [rules?.dependent_on, rules?.depends_on, rules?.dependsOn]) {
    if (dependency) dependencies.add(dependency);
  }
  return [...dependencies];
}

function getConditionalDependencies(field: VisaFormFieldRow): string[] {
  const visibilityDependencies = new Set<string>();
  const showIf = (field.conditionalLogic as { showIf?: string } | null)?.showIf;
  if (showIf) {
    const atoms = showIf.matchAll(
      /(?:^|\|\||&&)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:===|!==|not\s+in\b|in\b|contains_any\b)/g,
    );
    for (const atom of atoms) visibilityDependencies.add(atom[1]);
  }

  // Visual grouping follows the field's visibility controller. Data-loading
  // dependencies (for example a flight list keyed by arrival date) must not
  // split fields that are revealed by the same radio/dropdown branch.
  if (visibilityDependencies.size > 0) return [...visibilityDependencies];
  return getDataDependencies(field);
}

const GATING_TOGGLE_LABEL_PATTERNS = [
  "specific travel plan",
  "part of a group",
  "traveling with",
  "persons traveling with",
] as const;

function getConditionalControllerFieldNames(fields: VisaFormFieldRow[]): Set<string> {
  const names = new Set<string>();
  const activeFields = fields.filter((field) => !isLegacyCompatibilityOnlyField(field));
  const fieldsByName = new Map(activeFields.map((field) => [field.fieldName, field]));
  const yesNoControllers = activeFields.filter(
    (field) =>
      (field.fieldType === "radio" || field.fieldType === "select") &&
      field.options?.some((option) =>
        (typeof option === "string" ? option : option.value).toLowerCase() === "yes"
      ),
  );

  for (const field of fields) {
    for (const dependency of getConditionalDependencies(field)) names.add(dependency);

    // Keep the legacy inference contract in form-utils hydrated too. Older
    // country schemas may omit showIf and rely on repeat-group or field-name
    // relationships to a yes/no controller.
    if (!field.conditionalLogic) {
      const repeatGroup = getRepeatGroup(field);
      if (repeatGroup) {
        for (const candidate of [`${repeatGroup}_used`, `has_${repeatGroup}`]) {
          if (fieldsByName.has(candidate)) names.add(candidate);
        }
      }

      for (const controller of yesNoControllers) {
        if (controller.fieldName === field.fieldName) continue;
        const stems = new Set<string>([controller.fieldName]);
        const withoutUsed = controller.fieldName.replace(/_used$/, "");
        const withoutHas = controller.fieldName.replace(/^has_/, "");
        for (const stem of [withoutUsed, withoutHas]) {
          if (stem === controller.fieldName) continue;
          stems.add(stem);
          if (stem.endsWith("s")) stems.add(stem.slice(0, -1));
        }
        if ([...stems].some((stem) => field.fieldName.startsWith(stem))) {
          names.add(controller.fieldName);
        }
      }
    }
  }

  for (const field of fields) {
    if (
      (field.fieldType === "radio" || field.fieldType === "select") &&
      GATING_TOGGLE_LABEL_PATTERNS.some((pattern) => field.label.toLowerCase().includes(pattern))
    ) {
      names.add(field.fieldName);
    }
  }

  return names;
}

/**
 * Some DS-160 visibility gates are encoded in validation metadata instead of
 * a field's showIf expression. Their answers still arrive from another page,
 * so the current step must hydrate those controllers when the parent snapshot
 * changes. Keep this list limited to the controls used by the shared runtime
 * gates; ordinary fields remain governed by the step-local prefill merge.
 */
function getDs160RuntimeControllerFieldNames(
  step: Pick<WizardStep, "stepName" | "fields">,
  visaType?: string,
): Set<string> {
  const names = new Set<string>();
  const isDs160 = visaType === "DS160" || step.fields.some((field) => field.visaType === "DS160");
  if (!isDs160) return names;

  if (step.fields.some((field) => field.validationRules?.nationality_gate === "CEAC_ESTA")) {
    for (const fieldName of [
      "nationality_country",
      "nationality",
      "current_nationality",
      "other_nationality",
      "other_nationality_country",
    ]) {
      names.add(fieldName);
    }
  }

  const stepText = `${step.stepName} ${step.fields[0]?.stepName ?? ""}`.trim();
  if (/(?:work\s*[/&]\s*education|work\s+education|education\s*[/&]\s*employment|^occupation\b)/iu.test(stepText)) {
    names.add("date_of_birth");
    names.add("dateOfBirth");
  }

  if (/(?:u\.?\s*s\.?\s*)?(?:point\s+of\s+)?contact/iu.test(stepText)) {
    for (const fieldName of [
      "has_specific_plans",
      "has_specific_travel_plans",
      "intended_length_of_stay_unit",
      "intended_length_of_stay_units",
    ]) {
      names.add(fieldName);
    }
  }

  return names;
}

function getMultiOptionConditionalRoot(
  field: VisaFormFieldRow,
  allFields: VisaFormFieldRow[],
): string | null {
  if (getCompiledConditionalPanelMode(field) === "outer_only") return null;
  const compiledController = getCompiledConditionalPanelController(field);
  if (compiledController) return compiledController;
  if (!hasConditionalDependency(field)) return null;

  const fieldsByName = new Map(allFields.map((candidate) => [candidate.fieldName, candidate]));
  const roots = new Set<string>();
  const visited = new Set<string>();

  const visit = (fieldName: string) => {
    if (visited.has(fieldName)) return;
    visited.add(fieldName);

    const dependencyField = fieldsByName.get(fieldName);
    if (!dependencyField) return;
    const dependencies = getConditionalDependencies(dependencyField);
    if (dependencies.length === 0) {
      roots.add(fieldName);
      return;
    }
    dependencies.forEach(visit);
  };

  getConditionalDependencies(field).forEach(visit);
  if (roots.size !== 1) return null;

  const rootFieldName = [...roots][0];
  const rootField = fieldsByName.get(rootFieldName);
  if (rootField?.fieldType !== "select" && rootField?.fieldType !== "radio") return null;

  const optionValues = new Set(
    (rootField.options ?? []).map((option) =>
      typeof option === "string" ? option : option.value,
    ),
  );
  // Every option controller owns one shared panel for its active descendants.
  // This includes two-option radios such as yes/no: rendering each dependent
  // field separately would create adjacent nested panels for the same branch.
  return optionValues.size > 1 ? rootFieldName : null;
}

function findVerticalScrollContainer(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}

function getScrollMetrics(container: HTMLElement | null) {
  return container
    ? {
        offset: container.scrollTop,
        viewportSize: container.clientHeight,
        scrollSize: container.scrollHeight,
      }
    : {
        offset: window.scrollY,
        viewportSize: window.innerHeight,
        scrollSize: document.documentElement.scrollHeight,
      };
}

function setScrollOffset(container: HTMLElement | null, offset: number) {
  if (container) {
    container.scrollTop = offset;
    return;
  }
  window.scrollTo({ top: offset, behavior: "auto" });
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

function inlineGroupGridStyle(fieldCount: number) {
  return {
    gridTemplateColumns: `repeat(${Math.max(fieldCount, 1)}, minmax(0, 1fr))`,
  };
}

function DynamicStepFormImpl({
  step,
  prefill,
  onComplete,
  onDraftChange,
  onUserChange,
  saving,
  showContinueButton = true,
  country,
  visaType,
  focusFieldName,
  externallyHandledFieldNames,
  invalidFieldNames,
  invalidFieldMessages,
  aiFilledFieldNames,
  reviewIssues,
  onNavigateReviewIssue,
}: DynamicStepFormProps) {
  const tButtons = useTranslations("application.dynamicButtons");
  const externallyHandled = useMemo(
    () => new Set(externallyHandledFieldNames ?? []),
    [externallyHandledFieldNames],
  );
  const locale = useLocale();
  const isChineseInterface = isChineseLocale(locale);
  const [activeGuidanceKey, setActiveGuidanceKey] = useState<string | null>(null);
  const [highlightedFieldName, setHighlightedFieldName] = useState<string | null>(null);
  const [guidanceConversations, setGuidanceConversations] = useState<
    Record<string, FieldGuidanceChatMessage[]>
  >({});
  const formContentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const previousContentHeightRef = useRef(0);
  const measuredStepKeyRef = useRef(`${step.stepNumber}:${step.stepName}`);
  const lastScrollYRef = useRef(0);
  const preMutationScrollOffsetRef = useRef<number | null>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const [preservedFormHeight, setPreservedFormHeight] = useState(0);

  const captureScrollOffsetBeforeMutation = () => {
    const content = formContentRef.current;
    if (!content) return;
    const scrollContainer = findVerticalScrollContainer(content);
    scrollContainerRef.current = scrollContainer;
    preMutationScrollOffsetRef.current = getScrollMetrics(scrollContainer).offset;
  };

  useEffect(() => {
    if (preservedFormHeight <= 0) return;

    const handleScroll = () => {
      const scrollContainer = scrollContainerRef.current;
      const metrics = getScrollMetrics(scrollContainer);
      const nextScrollY = metrics.offset;
      const scrollingUp = nextScrollY < lastScrollYRef.current - 1;
      lastScrollYRef.current = nextScrollY;
      if (!scrollingUp) return;

      const contentHeight = formContentRef.current?.getBoundingClientRect().height ?? 0;
      const retainedSpace = Math.max(0, preservedFormHeight - contentHeight);
      const naturalPageBottom = metrics.scrollSize - retainedSpace;
      if (nextScrollY + metrics.viewportSize <= naturalPageBottom + 1) {
        setPreservedFormHeight(0);
      }
    };

    const scrollTarget = scrollContainerRef.current ?? window;
    lastScrollYRef.current = getScrollMetrics(scrollContainerRef.current).offset;
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener("scroll", handleScroll);
  }, [preservedFormHeight]);

  // Track how many instances each repeat_group has (min 1)
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group && !counts[group]) {
        // Detect prefilled instances across every member of the repeat group.
        // A partially filled later row must still render so the user can
        // finish it; checking only the first member loses that row.
        counts[group] = getRepeatInstanceCount(field, prefill, step.fields);
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
    const normalizedValues = normalizeTdacStepValues(step.fields, init, visaType);
    return isVnPrearrivalContext(visaType) || step.fields.some((field) => isVnPrearrivalContext(undefined, field))
      ? restoreVnPrearrivalHotelHierarchy(normalizedValues)
      : normalizedValues;
  });

  const [textPairs, setTextPairs] = useState<Record<string, BilingualTextValue>>(() => {
    const init: Record<string, BilingualTextValue> = {};
    const normalizedPrefill = normalizeTdacStepValues(step.fields, { ...prefill }, visaType);
    for (const field of step.fields) {
      if (!usesBilingualAnswerPair(field)) continue;
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
  const [translationWarningValueKeys, setTranslationWarningValueKeys] = useState<Record<string, boolean>>({});
  const [koreaAddressOptions, setKoreaAddressOptions] = useState<VisaFormFieldOption[]>([]);
  const [koreaAddressSearchQuery, setKoreaAddressSearchQuery] = useState("");
  const [koreaAddressSearching, setKoreaAddressSearching] = useState(false);
  const [vnPrearrivalQueries, setVnPrearrivalQueries] = useState<Record<string, string>>({});
  const [vnPrearrivalOptions, setVnPrearrivalOptions] = useState<Record<string, VisaFormFieldOption[]>>({});
  const [vnPrearrivalSearching, setVnPrearrivalSearching] = useState<Record<string, boolean>>({});
  const [vnPrearrivalPagination, setVnPrearrivalPagination] = useState<
    Record<string, { page: number; hasMore: boolean }>
  >({});
  const [vnPrearrivalLoadingMore, setVnPrearrivalLoadingMore] = useState<Record<string, boolean>>({});
  const [phEtravelOptions, setPhEtravelOptions] = useState<Record<string, VisaFormFieldOption[]>>({});
  const [phEtravelSearching, setPhEtravelSearching] = useState<Record<string, boolean>>({});
  const [indonesiaPostalLookup, setIndonesiaPostalLookup] = useState<IndonesiaPostalLookup>({ status: "idle" });
  const isVnPrearrivalStep = useMemo(
    () => isVnPrearrivalContext(visaType) || step.fields.some((field) => isVnPrearrivalContext(undefined, field)),
    [step.fields, visaType],
  );
  const isPhEtravelStep = visaType === "PH_ETRAVEL_ARRIVAL_CARD"
    || visaType === "PH_ETRAVEL_DEPARTURE_CARD"
    || step.fields.some((field) =>
      field.visaType === "PH_ETRAVEL_ARRIVAL_CARD" || field.visaType === "PH_ETRAVEL_DEPARTURE_CARD"
    );
  const isIndonesiaOfficialEVisa = useMemo(
    () => isIndonesiaOfficialEVisaContext(country, visaType),
    [country, visaType],
  );

  const valuesRef = useRef(values);
  const textPairsRef = useRef(textPairs);
  const manualEnglishValueKeysRef = useRef(manualEnglishValueKeys);
  const groupCountsRef = useRef(groupCounts);
  const vnPrearrivalLoadingMoreRef = useRef<Record<string, boolean>>({});
  const vnPrearrivalQueriesRef = useRef(vnPrearrivalQueries);
  const onDraftChangeRef = useRef(onDraftChange);
  const lastDraftPatchRef = useRef<Record<string, string> | null>(null);
  const previousPrefillRef = useRef(prefill);
  const appliedPrefillValuesRef = useRef<Record<string, string>>(
    initialAppliedPrefillValues(step.fields, prefill),
  );
  // Keep explicit local edits authoritative while asynchronous parent
  // snapshots catch up. Empty strings are meaningful here: clearing a field
  // must not be mistaken for an untouched input when the old prefill arrives.
  const userEditedValueKeysRef = useRef<Set<string>>(new Set());
  const userClearedValueKeysRef = useRef<Set<string>>(new Set());
  const userClearPrefillBaselineRef = useRef<Record<string, string>>({});
  // Keep deleted repeat-tail tombstones in every replacement patch until a
  // later add restores the same concrete row. The page draft is replaced per
  // step, so a one-shot empty patch would otherwise be lost on the next
  // values-effect publish.
  const removedRepeatKeysRef = useRef<Set<string>>(new Set());
  const undoStackRef = useRef<FormHistorySnapshot[]>([]);
  const redoStackRef = useRef<FormHistorySnapshot[]>([]);
  const usContactUnknownRestoreRef = useRef<Record<string, UsContactUnknownSnapshot>>({});
  const ds160PreparerSentinelRestoreRef = useRef<Record<string, UsContactUnknownSnapshot>>({});

  const buildDraftPatch = (
    patchFields: VisaFormFieldRow[],
    patchValues: Record<string, string>,
    patchGroupCounts: Record<string, number>,
    patchTextPairs: Record<string, BilingualTextValue>,
  ): Record<string, string> => {
    const patch = buildCurrentStepAnswerPatch(
      patchFields,
      patchValues,
      patchGroupCounts,
      patchTextPairs,
    );
    for (const key of removedRepeatKeysRef.current) patch[key] = "";
    return patch;
  };

  const conditionalControllerFieldNames = useMemo(() => {
    const names = getConditionalControllerFieldNames(step.fields);
    for (const fieldName of getDs160RuntimeControllerFieldNames(step, visaType)) {
      names.add(fieldName);
    }
    return names;
  }, [step.fields, step.stepName, visaType]);
  const layoutControllerFieldNames = useMemo(() => {
    const names = new Set(conditionalControllerFieldNames);

    // LESS_THAN_24_HOURS changes whether the sibling controls are disabled,
    // which can also change their rendered height. Keep those select values in
    // the structural signature used by the scroll-preservation effect.
    for (const field of step.fields) {
      if (field.fieldType !== "select") continue;
      const inlineGroup = getInlineGroup(field);
      if (!inlineGroup) continue;
      const hasLessThan24Option = field.options?.some((option) =>
        (typeof option === "string" ? option : option.value) === "LESS_THAN_24_HOURS",
      );
      if (hasLessThan24Option) names.add(field.fieldName);
    }

    return [...names].sort();
  }, [conditionalControllerFieldNames, step.fields]);
  const layoutControllerFieldNameSet = useMemo(
    () => new Set(layoutControllerFieldNames),
    [layoutControllerFieldNames],
  );

  // Ordinary text edits must not force a synchronous layout read. This
  // signature contains only values that can change field visibility or the
  // rendered disabled/conditional structure, plus repeat counts. It changes
  // when a structural branch changes, while remaining stable during normal
  // typing in an unrelated field.
  const layoutSignature = useMemo(() => {
    const structuralValues = Object.entries(values)
      .filter(([key]) => layoutControllerFieldNameSet.has(stripRepeatInstanceSuffix(key)))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const repeatCounts = Object.entries(groupCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([group, count]) => `${group}=${count}`)
      .join("&");
    return `${step.stepNumber}:${step.stepName}|${repeatCounts}|${structuralValues}`;
  }, [groupCounts, layoutControllerFieldNameSet, step.stepName, step.stepNumber, values]);

  valuesRef.current = values;
  textPairsRef.current = textPairs;
  manualEnglishValueKeysRef.current = manualEnglishValueKeys;
  groupCountsRef.current = groupCounts;
  vnPrearrivalQueriesRef.current = vnPrearrivalQueries;

  useLayoutEffect(() => {
    const content = formContentRef.current;
    if (!content) return;

    const nextHeight = content.getBoundingClientRect().height;
    const scrollContainer = findVerticalScrollContainer(content);
    scrollContainerRef.current = scrollContainer;

    if (preservedFormHeight > 0 && pendingScrollRestoreRef.current !== null) {
      const restoreOffset = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
      setScrollOffset(scrollContainer, restoreOffset);
      lastScrollYRef.current = restoreOffset;
    }

    const stepKey = `${step.stepNumber}:${step.stepName}`;
    if (measuredStepKeyRef.current !== stepKey) {
      measuredStepKeyRef.current = stepKey;
      previousContentHeightRef.current = nextHeight;
      preMutationScrollOffsetRef.current = null;
      pendingScrollRestoreRef.current = null;
      if (preservedFormHeight > 0) setPreservedFormHeight(0);
      return;
    }

    const previousHeight = previousContentHeightRef.current;
    previousContentHeightRef.current = nextHeight;

    if (previousHeight <= nextHeight + 1) {
      preMutationScrollOffsetRef.current = null;
      if (preservedFormHeight > 0 && nextHeight >= preservedFormHeight - 1) {
        setPreservedFormHeight(0);
      }
      return;
    }

    const metrics = getScrollMetrics(scrollContainer);
    const offsetBeforeMutation = preMutationScrollOffsetRef.current ?? metrics.offset;
    preMutationScrollOffsetRef.current = null;
    const viewportBottom = offsetBeforeMutation + metrics.viewportSize;
    const naturalPageBottom = metrics.scrollSize;
    if (viewportBottom < naturalPageBottom - 1) return;

    pendingScrollRestoreRef.current = offsetBeforeMutation;
    lastScrollYRef.current = offsetBeforeMutation;
    setPreservedFormHeight((current) => Math.max(current, previousHeight));
  }, [layoutSignature, preservedFormHeight, step.stepName, step.stepNumber]);

  // Saved answers can arrive just after the form component mounts. Hydrate
  // visibility controllers in a layout effect so their dependent panels are
  // present on the first visible paint instead of appearing only after the
  // user toggles the controller again.
  useLayoutEffect(() => {
    const controllerKeys = new Set<string>();
    for (const key of [
      ...Object.keys(prefill),
      ...Object.keys(valuesRef.current),
    ]) {
      if (isPrefillMirrorKey(key)) continue;
      if (conditionalControllerFieldNames.has(stripRepeatInstanceSuffix(key))) {
        controllerKeys.add(key);
      }
    }

    let nextValues = valuesRef.current;
    let changed = false;

    for (const fieldName of controllerKeys) {
      // The active step owns these refs. A local clear (including a repeat-row
      // deletion) must survive an older parent snapshot until that tombstone
      // is acknowledged by the save queue.
      if (
        userEditedValueKeysRef.current.has(fieldName) ||
        userClearedValueKeysRef.current.has(fieldName)
      ) continue;

      const savedValue = prefill[fieldName]?.trim() ?? "";
      if ((nextValues[fieldName] ?? "") === savedValue) continue;
      if (!changed) nextValues = { ...nextValues };
      nextValues[fieldName] = savedValue;
      changed = true;
    }

    if (!changed) return;
    valuesRef.current = nextValues;
    setValues(nextValues);
  }, [conditionalControllerFieldNames, prefill]);

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
        const address = valuesRef.current.address_in_indonesia?.trim() ?? "";
        const query = new URLSearchParams({ postalCode });
        if (address) query.set("address", address);
        const response = await fetch(`/api/indonesia/postal-code?${query.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json() as {
          ok?: boolean;
          messageZh?: string;
          messageEn?: string;
          location?: { province: string; city: string; district: string; village: string };
          addressCheck?: { status?: "valid" | "invalid" | "indeterminate"; messageZh?: string; messageEn?: string };
        };
        if (!response.ok || !payload.ok || !payload.location) {
          setIndonesiaPostalLookup({
            status: response.status === 503 ? "unavailable" : "invalid",
            messageZh: payload.messageZh ?? "无法识别该印尼邮政编码。",
            messageEn: payload.messageEn ?? "This Indonesian postal code could not be recognized.",
          });
          return;
        }

        if (payload.addressCheck?.status === "invalid") {
          setIndonesiaPostalLookup({
            status: "invalid",
            messageZh: payload.addressCheck.messageZh ?? "住宿地址必须位于印度尼西亚。",
            messageEn: payload.addressCheck.messageEn ?? "The accommodation address must be in Indonesia.",
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
  }, [isIndonesiaOfficialEVisa, step.fields, values.address_in_indonesia, values.postal_code]);

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
      custom_flight_number: "",
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

    if ((valuesRef.current.flight_number ?? "").toLowerCase() === "other") return;
    const derivedAirport = getAirportCodeFromFlightValue(valuesRef.current.flight_number ?? "");
    if ((valuesRef.current.border_gate_airport ?? "") === derivedAirport) return;

    const nextValues = { ...valuesRef.current, border_gate_airport: derivedAirport };
    valuesRef.current = nextValues;
    setValues(nextValues);
  }, [isVnPrearrivalStep, step.fields, values.flight_number, values.border_gate_airport]);

  useEffect(() => {
    if (
      !isVnPrearrivalStep ||
      !step.fields.some((field) => field.fieldName === "hotel_accommodation_address")
    ) return;

    const nextValues = restoreVnPrearrivalHotelHierarchy(valuesRef.current);
    if (nextValues === valuesRef.current) return;
    valuesRef.current = nextValues;
    setValues(nextValues);
  }, [
    isVnPrearrivalStep,
    step.fields,
    values.hotel_accommodation_address,
    values.province_city_of_hotel,
    values.ward_commune_of_hotel,
  ]);

  const hasKoreaAddressSearchField = useMemo(
    () =>
      (visaType === "KR_C39_SHORT_TERM_VISIT" || visaType === "KR_E_ARRIVAL_CARD") &&
      step.fields.some(isKoreaOfficialAddressSearchField),
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

  useEffect(() => {
    if (!hasKoreaAddressSearchField) return;
    const addressField = step.fields.find(isKoreaOfficialAddressSearchField);
    if (!addressField) return;

    const fieldName = addressField.fieldName;
    const selectedValue = valuesRef.current[fieldName]?.trim() ?? "";
    const savedChineseLabel = valuesRef.current[`${fieldName}_zh`]?.trim() ?? "";
    if (!selectedValue || savedChineseLabel) return;

    // Older Korea applications saved only the official English/Korean values.
    // Re-resolve that same official address once so the shared C-3-9/EAC
    // selector can display and persist the newer Chinese-only label without
    // changing any official submission value.
    const keyword = selectedValue.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/korea-addresses?keyword=${encodeURIComponent(keyword)}&limit=20`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { options?: VisaFormFieldOption[] };
        const options = Array.isArray(payload.options) ? payload.options : [];
        const selected = options.find((option) => {
          if (typeof option === "string") return option === selectedValue;
          return option.value === selectedValue
            || option.englishAddress === selectedValue
            || option.koreanAddress === valuesRef.current.stay_address_ko;
        });
        if (!selected || typeof selected === "string") return;
        const chineseLabel = selected.label_zh?.trim();
        if (!chineseLabel) return;

        setKoreaAddressOptions((current) => {
          const withoutDuplicate = current.filter((option) =>
            typeof option === "string" ? option !== selected.value : option.value !== selected.value,
          );
          return [selected, ...withoutDuplicate];
        });
        const next = {
          ...valuesRef.current,
          [`${fieldName}_zh`]: chineseLabel,
          [`${fieldName}_en`]: selected.label_en ?? selected.englishAddress ?? selectedValue,
        };
        valuesRef.current = next;
        setValues(next);
        onDraftChangeRef.current?.(buildDraftPatch(
          step.fields,
          next,
          groupCountsRef.current,
          textPairsRef.current,
        ));
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          // The saved official value remains usable even if label enrichment is unavailable.
        }
      }
    })();

    return () => controller.abort();
  }, [
    hasKoreaAddressSearchField,
    step.fields,
    values.address_in_korea,
    values.stay_address_ko,
    values.stay_address_search,
  ]);

  const vnPrearrivalRemoteFields = useMemo(
    () =>
      isVnPrearrivalStep
        ? step.fields.filter((field) => {
            const source = getVnPrearrivalOfficialSource(field);
            if (!source) return false;
            if (field.fieldName === "phone_country_code") return false;
            if (source.endsWith(":flight") || source.endsWith(":hotel")) return true;
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
  const vnPrearrivalFlightField = useMemo(
    () => vnPrearrivalRemoteFields.find((field) =>
      getVnPrearrivalOfficialSource(field)?.endsWith(":flight")
    ),
    [vnPrearrivalRemoteFields],
  );

  useEffect(() => {
    if (!isVnPrearrivalStep || !vnPrearrivalFlightField) return;
    const source = getVnPrearrivalOfficialSource(vnPrearrivalFlightField);
    if (!source) return;

    const key = vnPrearrivalOptionKey(vnPrearrivalFlightField);
    const selectedAtRequest = valuesRef.current.flight_number?.trim() ?? "";
    const controller = new AbortController();

    void (async () => {
      try {
        const params = new URLSearchParams({
          source,
          keyword: "",
          page: "0",
          size: String(VN_PREARRIVAL_FLIGHT_PAGE_SIZE),
          refresh: "1",
        });
        if (selectedAtRequest) params.set("selected", selectedAtRequest);
        const response = await fetch(`/api/vn-prearrival/options?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          options?: VisaFormFieldOption[];
          page?: number;
          hasMore?: boolean;
          catalogSource?: string;
          selectedExists?: boolean | null;
          selectedOption?: VisaFormFieldOption | null;
        };
        const options = Array.isArray(payload.options) ? payload.options : [];
        const currentFlight = valuesRef.current.flight_number?.trim() ?? "";
        const queryStillEmpty = !(vnPrearrivalQueriesRef.current[key]?.trim());
        if (currentFlight === selectedAtRequest && queryStillEmpty) {
          let nextOptions = options;
          const selectedOption = payload.selectedOption;
          if (
            payload.selectedExists === true &&
            selectedOption &&
            !nextOptions.some((option) => optionValue(option) === optionValue(selectedOption))
          ) {
            nextOptions = [selectedOption, ...nextOptions];
          }
          setVnPrearrivalOptions((current) => ({
            ...current,
            [key]: withVnPrearrivalOtherFlightOption(nextOptions),
          }));
          setVnPrearrivalPagination((current) => ({
            ...current,
            [key]: {
              page: payload.page ?? 0,
              hasMore: Boolean(payload.hasMore),
            },
          }));
        }

        const nextValues = reconcileVnPrearrivalFlightAfterCatalogRefresh(
          valuesRef.current,
          selectedAtRequest,
          payload,
        );
        if (nextValues !== valuesRef.current) {
          valuesRef.current = nextValues;
          setValues(nextValues);
        }
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        // A failed refresh is not proof that a saved official option was removed.
      }
    })();

    return () => controller.abort();
  }, [
    isVnPrearrivalStep,
    prefill.flight_number,
    step.stepName,
    step.stepNumber,
    vnPrearrivalFlightField,
  ]);

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
        source.endsWith(":hotel") &&
        !parent.trim() &&
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
          limit: source.endsWith(":hotel") ? "100" : "10000",
        });
        if (source.endsWith(":flight")) {
          params.set("page", "0");
          params.set("size", String(VN_PREARRIVAL_FLIGHT_PAGE_SIZE));
        }
        if (parent.trim()) params.set("parent", parent.trim());
        if (source.endsWith(":hotel")) {
          const province = valuesRef.current.province_city_of_hotel?.trim() ?? "";
          if (province) params.set("province", province);
        }
        const response = await fetch(`/api/vn-prearrival/options?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as {
          options?: VisaFormFieldOption[];
          page?: number;
          hasMore?: boolean;
        };
        const options = Array.isArray(payload.options) ? payload.options : [];
        setVnPrearrivalOptions((current) => {
          const selectedValue = valuesRef.current[field.fieldName]?.trim();
          const selectedOption = selectedValue
            ? (current[key] ?? []).find((option) =>
                typeof option === "string" ? option === selectedValue : option.value === selectedValue,
              ) ?? (
                source.endsWith(":flight")
                  ? getVnPrearrivalStaticOptions(source)?.find((option) =>
                      typeof option === "string" ? option === selectedValue : option.value === selectedValue,
                    )
                  : null
              )
            : null;
          let nextOptions = selectedOption && !options.some((option) =>
            typeof option === "string" ? option === selectedValue : option.value === selectedValue
          )
            ? [selectedOption, ...options]
            : options;
          if (source.endsWith(":flight")) {
            nextOptions = withVnPrearrivalOtherFlightOption(nextOptions);
          } else if (source.endsWith(":hotel")) {
            nextOptions = withVnPrearrivalOtherHotelOption(nextOptions);
          }
          return {
            ...current,
            [key]: nextOptions,
          };
        });
        setVnPrearrivalPagination((current) => ({
          ...current,
          [key]: {
            page: payload.page ?? 0,
            hasMore: Boolean(payload.hasMore),
          },
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
        if (source.endsWith(":nationality")) {
          const currentValue = valuesRef.current[field.fieldName] ?? "";
          const normalizedValue = reconcileVnPrearrivalNationalityValue(currentValue, options);
          if (normalizedValue !== currentValue) {
            const nextValues = { ...valuesRef.current, [field.fieldName]: normalizedValue };
            valuesRef.current = nextValues;
            setValues(nextValues);
          }
        }
        // A parent-field change is handled synchronously in `handleChange`.
        // Do not invalidate a selected dependent value from an asynchronous
        // refresh: an earlier response can otherwise erase the value the user
        // just selected and trap them in this step.
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setVnPrearrivalOptions((current) => ({
            ...current,
            [key]: source.endsWith(":flight")
              ? [VN_PREARRIVAL_OTHER_FLIGHT_OPTION]
              : source.endsWith(":hotel")
                ? [VN_PREARRIVAL_OTHER_HOTEL_OPTION]
                : [],
          }));
          setVnPrearrivalPagination((current) => ({
            ...current,
            [key]: { page: 0, hasMore: false },
          }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setVnPrearrivalSearching((current) => ({ ...current, [key]: false }));
        }
      }
    }, 0));

    return () => {
      controller.abort();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [vnPrearrivalParentSnapshot, vnPrearrivalQueries, vnPrearrivalRemoteFields]);

  const loadMoreVnPrearrivalOptions = async (key: string) => {
    const pagination = vnPrearrivalPagination[key];
    if (!pagination?.hasMore || vnPrearrivalLoadingMoreRef.current[key]) return;
    const field = vnPrearrivalRemoteFields.find((candidate) => vnPrearrivalOptionKey(candidate) === key);
    const source = field ? getVnPrearrivalOfficialSource(field) : null;
    if (!field || !source?.endsWith(":flight")) return;

    vnPrearrivalLoadingMoreRef.current[key] = true;
    setVnPrearrivalLoadingMore((current) => ({ ...current, [key]: true }));
    try {
      const nextPage = pagination.page + 1;
      const params = new URLSearchParams({
        source,
        keyword: vnPrearrivalQueries[key] ?? "",
        page: String(nextPage),
        size: String(VN_PREARRIVAL_FLIGHT_PAGE_SIZE),
      });
      const response = await fetch(`/api/vn-prearrival/options?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as {
        options?: VisaFormFieldOption[];
        page?: number;
        hasMore?: boolean;
      };
      const options = Array.isArray(payload.options) ? payload.options : [];
      setVnPrearrivalOptions((current) => ({
        ...current,
        [key]: mergeVnPrearrivalFlightPages(current[key] ?? [], options),
      }));
      setVnPrearrivalPagination((current) => ({
        ...current,
        [key]: {
          page: payload.page ?? nextPage,
          hasMore: Boolean(payload.hasMore),
        },
      }));
    } catch {
      setVnPrearrivalPagination((current) => ({
        ...current,
        [key]: {
          page: current[key]?.page ?? pagination.page,
          hasMore: false,
        },
      }));
    } finally {
      vnPrearrivalLoadingMoreRef.current[key] = false;
      setVnPrearrivalLoadingMore((current) => ({ ...current, [key]: false }));
    }
  };

  const phEtravelRemoteFields = useMemo(
    () => isPhEtravelStep
      ? step.fields.filter((field) => Boolean(getPhEtravelOfficialOptionSource(field)))
      : [],
    [isPhEtravelStep, step.fields],
  );
  const phEtravelParentSnapshot = phEtravelRemoteFields
    .map((field) => {
      const parentKey = getPhEtravelDependsOn(field);
      return `${field.fieldName}:${parentKey ? values[parentKey] ?? "" : ""}`;
    })
    .join("|");

  useEffect(() => {
    if (phEtravelRemoteFields.length === 0) return;
    const controller = new AbortController();
    for (const field of phEtravelRemoteFields) {
      const source = getPhEtravelOfficialOptionSource(field);
      const parentKey = getPhEtravelDependsOn(field);
      const parent = parentKey ? valuesRef.current[parentKey]?.trim() ?? "" : "";
      if (!source || !parent) {
        setPhEtravelOptions((current) => ({ ...current, [field.fieldName]: [] }));
        continue;
      }
      void (async () => {
        try {
          setPhEtravelSearching((current) => ({ ...current, [field.fieldName]: true }));
          const params = new URLSearchParams({ source, parent });
          const response = await fetch(`/api/ph-etravel/options?${params.toString()}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json() as { options?: VisaFormFieldOption[] };
          setPhEtravelOptions((current) => ({
            ...current,
            [field.fieldName]: Array.isArray(payload.options) ? payload.options : [],
          }));
        } catch (error) {
          if ((error as { name?: string }).name !== "AbortError") {
            setPhEtravelOptions((current) => ({ ...current, [field.fieldName]: [] }));
          }
        } finally {
          if (!controller.signal.aborted) {
            setPhEtravelSearching((current) => ({ ...current, [field.fieldName]: false }));
          }
        }
      })();
    }
    return () => controller.abort();
  }, [phEtravelParentSnapshot, phEtravelRemoteFields]);

  const getSnapshot = (): FormHistorySnapshot => ({
    values: { ...valuesRef.current },
    textPairs: cloneTextPairs(textPairsRef.current),
    groupCounts: { ...groupCountsRef.current },
  });

  const restoreSnapshot = (snapshot: FormHistorySnapshot) => {
    const normalizedValues = normalizeTdacStepValues(step.fields, snapshot.values, visaType);
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (!group) continue;
      const restoredCount = snapshot.groupCounts[group] ?? 1;
      for (let index = 0; index < restoredCount; index++) {
        const restoredKey = instanceKey(field.fieldName, index);
        removedRepeatKeysRef.current.delete(restoredKey);
        if (usesBilingualAnswerPair(field)) {
          removedRepeatKeysRef.current.delete(`${restoredKey}_zh`);
          removedRepeatKeysRef.current.delete(`${restoredKey}_en`);
        }
      }
    }
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

  const handleTranslationWarningChange = useCallback((valueKey: string, hasWarning: boolean) => {
    setTranslationWarningValueKeys((current) => {
      if (Boolean(current[valueKey]) === hasWarning) return current;
      if (hasWarning) return { ...current, [valueKey]: true };

      const next = { ...current };
      delete next[valueKey];
      return next;
    });
  }, []);

  useEffect(() => {
    const previousPrefill = previousPrefillRef.current;
    let valuesChanged = false;
    let textPairsChanged = false;
    let groupCountsChanged = false;
    const nextGroupCounts = { ...groupCountsRef.current };

    // A step can mount before its latest saved snapshot arrives. Merge newly
    // observed, contiguous repeat rows into the local count, but keep rows
    // whose keys were explicitly removed by this form collapsed until the
    // parent acknowledges the empty tombstone.
    const seenGroups = new Set<string>();
    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (!group || seenGroups.has(group)) continue;
      seenGroups.add(group);

      const currentCount = nextGroupCounts[group] ?? 1;
      const incomingCount = getRepeatInstanceCount(field, prefill, step.fields);
      let mergedCount = currentCount;
      for (let index = currentCount; index < incomingCount; index++) {
        const rowWasRemovedLocally = step.fields.some((member) =>
          getRepeatGroup(member) === group
          && userEditedValueKeysRef.current.has(instanceKey(member.fieldName, index)),
        );
        if (rowWasRemovedLocally) break;
        mergedCount = index + 1;
      }
      if (mergedCount > currentCount) {
        nextGroupCounts[group] = mergedCount;
        groupCountsChanged = true;
      }
    }
    if (groupCountsChanged) {
      groupCountsRef.current = nextGroupCounts;
      setGroupCounts(nextGroupCounts);
    }

    const nextValues = { ...valuesRef.current };
    const nextTextPairs = cloneTextPairs(textPairsRef.current);

    const applyPrefillValue = (key: string, field: VisaFormFieldRow) => {
      const nextPrefill = prefill[key]?.trim() ?? "";
      const currentValue = valuesRef.current[key] ?? "";
      const previousValue = previousPrefill[key] ?? "";
      const userEdited = userEditedValueKeysRef.current.has(key);
      const currentPair = usesBilingualAnswerPair(field)
        ? (textPairsRef.current[key] ?? { zh: "", en: "" })
        : null;
      const incomingPair = currentPair
        ? getBilingualPrefillText(key, prefill, nextPrefill)
        : null;
      const pairMatchesPrefill = !currentPair || (
        currentPair.zh === incomingPair?.zh && currentPair.en === incomingPair?.en
      );
      const clearBaseline = userClearPrefillBaselineRef.current[key] ?? previousValue;
      const acceptsChangedExternalPrefill = userEdited
        && userClearedValueKeysRef.current.has(key)
        && !currentValue.trim()
        && Boolean(nextPrefill)
        && nextPrefill !== clearBaseline;
      if (acceptsChangedExternalPrefill) {
        userEditedValueKeysRef.current.delete(key);
        userClearedValueKeysRef.current.delete(key);
        delete userClearPrefillBaselineRef.current[key];
      } else if (userEdited && currentValue.trim() === nextPrefill && pairMatchesPrefill) {
        userEditedValueKeysRef.current.delete(key);
        userClearedValueKeysRef.current.delete(key);
        delete userClearPrefillBaselineRef.current[key];
      }
      if (userEditedValueKeysRef.current.has(key)) return;
      if (!nextPrefill) return;

      const isClearableField = isClearablePrefillField(field);
      if (
        isClearableField &&
        appliedPrefillValuesRef.current[key] === nextPrefill &&
        currentValue !== nextPrefill
      ) {
        return;
      }
      if (currentValue.trim() && currentValue !== previousValue) return;

      if (isClearableField) appliedPrefillValuesRef.current[key] = nextPrefill;

      if (nextValues[key] !== nextPrefill) {
        nextValues[key] = nextPrefill;
        valuesChanged = true;
      }

      if (usesBilingualAnswerPair(field)) {
        const pairWasEdited = Boolean(currentPair?.zh.trim() || currentPair?.en.trim()) && currentValue !== previousValue;
        if (!pairWasEdited) {
          const repairedPair = getBilingualPrefillText(key, prefill, nextPrefill);
          nextTextPairs[key] = repairedPair;
          textPairsChanged = true;

          // Older applications can contain Chinese text in an `_en` answer.
          // The official submission value must immediately follow the repaired
          // English side, even if the translation request is unavailable.
          const officialValue = repairedPair.en.trim();
          const currentNormalizedValue = nextValues[key]?.trim() ?? "";
          if (
            officialValue &&
            !hasChineseText(officialValue) &&
            (!currentNormalizedValue || hasChineseText(currentNormalizedValue) || currentNormalizedValue === repairedPair.zh.trim())
          ) {
            nextValues[key] = officialValue;
            valuesChanged = true;
          }
        }
      }
    };

    for (const field of step.fields) {
      const group = getRepeatGroup(field);
      if (group) {
        const count = nextGroupCounts[group] ?? 1;
        for (let i = 0; i < count; i++) {
          applyPrefillValue(instanceKey(field.fieldName, i), field);
        }
      } else {
        applyPrefillValue(field.fieldName, field);
      }
    }

    // TDAC arrival/departure dates live on the preceding trip step. When the
    // user navigates immediately, this accommodation step can mount before
    // that step's draft finishes saving. Once the full prefill catches up,
    // copy the two cross-step inputs so transit status is recalculated here.
    if (visaType === "TH_TDAC_ARRIVAL_CARD") {
      const currentStepFieldNames = new Set(step.fields.map((field) => field.fieldName));
      for (const fieldName of ["arrival_date", "departure_date"] as const) {
        const prefillValue = prefill[fieldName]?.trim();
        if (
          !currentStepFieldNames.has(fieldName) &&
          prefillValue !== undefined &&
          nextValues[fieldName] !== prefillValue
        ) {
          nextValues[fieldName] = prefillValue;
          valuesChanged = true;
        }
      }
    }

    const normalizedStepValues = normalizeTdacStepValues(step.fields, nextValues, visaType);
    const normalizedNextValues = isVnPrearrivalStep
      ? restoreVnPrearrivalHotelHierarchy(normalizedStepValues)
      : normalizedStepValues;
    for (const [key, value] of Object.entries(normalizedNextValues)) {
      if (nextValues[key] !== value) {
        nextValues[key] = value;
        valuesChanged = true;
      }
    }
    for (const field of step.fields) {
      if (!usesBilingualAnswerPair(field)) continue;
      const group = getRepeatGroup(field);
      const keys = group
        ? Array.from({ length: nextGroupCounts[group] ?? 1 }, (_, index) => instanceKey(field.fieldName, index))
        : [field.fieldName];
      for (const key of keys) {
        const normalizedValue = normalizedNextValues[key]?.trim();
        if (!normalizedValue) continue;
        if (userEditedValueKeysRef.current.has(key)) continue;
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
  }, [isVnPrearrivalStep, prefill, step.fields, visaType]);

  useEffect(() => {
    const nextPatch = buildDraftPatch(step.fields, values, groupCounts, textPairs);
    const previousPatch = lastDraftPatchRef.current;
    if (
      previousPatch &&
      Object.keys(previousPatch).length === Object.keys(nextPatch).length &&
      Object.entries(nextPatch).every(([key, value]) => previousPatch[key] === value)
    ) {
      return;
    }
    lastDraftPatchRef.current = nextPatch;
    onDraftChangeRef.current?.(nextPatch);
  }, [groupCounts, step.fields, textPairs, values]);

  const undoLastFormChange = () => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return false;
    onUserChange?.();
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current.slice(-79), getSnapshot()];
    restoreSnapshot(previous);
    return true;
  };

  const redoLastFormChange = () => {
    const next = redoStackRef.current.at(-1);
    if (!next) return false;
    onUserChange?.();
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

  const multiOptionConditionalGroups = useMemo(() => {
    const fieldToRoot: Record<string, string> = {};
    const fieldsByRoot: Record<string, VisaFormFieldRow[]> = {};

    for (const field of step.fields) {
      if (getRepeatGroup(field)) continue;
      const root = getMultiOptionConditionalRoot(field, step.fields);
      if (!root) continue;
      fieldToRoot[field.fieldName] = root;
      if (!fieldsByRoot[root]) fieldsByRoot[root] = [];
      fieldsByRoot[root].push(field);
    }

    return { fieldToRoot, fieldsByRoot };
  }, [step.fields]);

  // Compile the visibility graph once for the schema. Previously every click
  // scanned every field (and repeatedly evaluated legacy inference rules) for
  // every descendant. Large UK forms made that work visible as multi-second
  // input lag.
  const dependentFieldsByParent = useMemo(() => {
    const graph = new Map<string, Set<string>>();
    const addDependency = (parent: string, child: string) => {
      if (!parent || parent === child) return;
      const children = graph.get(parent) ?? new Set<string>();
      children.add(child);
      graph.set(parent, children);
    };

    for (const field of step.fields) {
      for (const dependency of getConditionalDependencies(field)) {
        addDependency(dependency, field.fieldName);
      }
      // A field can be both visibility-gated and data-dependent. Keep the
      // data edge as well so changing a parent select synchronously clears
      // stale descendants (province -> ward -> hotel, for example).
      for (const dependency of getDataDependencies(field)) {
        addDependency(dependency, field.fieldName);
      }
    }

    // Preserve the legacy schemas that rely on form-utils field-name
    // inference instead of an explicit showIf expression, but pay that cost
    // once when the schema is loaded rather than on every interaction.
    const currentValues = valuesRef.current;
    for (const candidateParent of conditionalControllerFieldNames) {
      const withYes = { ...currentValues, [candidateParent]: "yes" };
      const withNo = { ...currentValues, [candidateParent]: "" };
      for (const field of step.fields) {
        if (field.fieldName === candidateParent || field.conditionalLogic) continue;
        if (evaluateShowIf(field, withYes, step.fields) !== evaluateShowIf(field, withNo, step.fields)) {
          addDependency(candidateParent, field.fieldName);
        }
      }
    }

    return graph;
  }, [conditionalControllerFieldNames, step.fields]);

  const getDependentFields = useCallback((parentFieldName: string): string[] => {
    const parentBaseFieldName = stripRepeatInstanceSuffix(parentFieldName);
    const parentField = step.fields.find((field) => field.fieldName === parentBaseFieldName);
    const parentGroup = parentField ? getRepeatGroup(parentField) : null;
    const parentSuffix = getRepeatInstanceSuffix(parentFieldName);
    const dependents = new Set<string>();
    const queue = [parentBaseFieldName];
    while (queue.length > 0) {
      const candidateParent = queue.shift();
      if (!candidateParent) continue;
      for (const fieldName of dependentFieldsByParent.get(candidateParent) ?? []) {
        const dependentField = step.fields.find((field) => field.fieldName === fieldName);
        const dependentGroup = dependentField ? getRepeatGroup(dependentField) : null;
        const isSameRepeatInstance = Boolean(parentGroup && parentSuffix && dependentGroup === parentGroup);
        const concreteFieldName = isSameRepeatInstance ? `${fieldName}${parentSuffix}` : fieldName;
        if (dependents.has(concreteFieldName)) continue;
        dependents.add(concreteFieldName);
        queue.push(fieldName);
      }
    }
    return [...dependents];
  }, [dependentFieldsByParent, step.fields]);

  const handleChange = (
    fieldName: string,
    value: string,
    options?: { recordUndo?: boolean; publishDraft?: boolean },
  ) => {
    const normalizedValue = isIndonesiaOfficialEVisa && fieldName === "mobile_phone"
      ? normalizeIndonesiaMobileNumber(value)
      : isIndonesiaOfficialEVisa && fieldName === "postal_code"
        ? value.replace(/\D/g, "").slice(0, 5)
        : value;
    const valueChanged = valuesRef.current[fieldName] !== normalizedValue;
    if (valueChanged && layoutControllerFieldNameSet.has(stripRepeatInstanceSuffix(fieldName))) {
      captureScrollOffsetBeforeMutation();
    }
    if (options?.recordUndo !== false && valueChanged) {
      onUserChange?.();
      pushUndoSnapshot();
    }

    if (valueChanged) {
      userEditedValueKeysRef.current.add(fieldName);
      if (!normalizedValue.trim()) {
        userClearedValueKeysRef.current.add(fieldName);
        userClearPrefillBaselineRef.current[fieldName] = prefill[fieldName]?.trim()
          ?? previousPrefillRef.current[fieldName]
          ?? "";
      } else {
        userClearedValueKeysRef.current.delete(fieldName);
        delete userClearPrefillBaselineRef.current[fieldName];
      }
    }

    const next = { ...valuesRef.current, [fieldName]: normalizedValue };
    if (isVnPrearrivalStep && fieldName === "expected_arrival_date") {
      next.flight_number = "";
      next.custom_flight_number = "";
      next.border_gate_airport = "";
    }
    if (isVnPrearrivalStep && fieldName === "flight_number") {
      next.border_gate_airport = getAirportCodeFromFlightValue(value);
      next.custom_flight_number = "";
    }
    let nextTextPairs: Record<string, BilingualTextValue> | null = null;
    const dependents = getDependentFields(fieldName);
    for (const dep of dependents) {
      const depBaseFieldName = stripRepeatInstanceSuffix(dep);
      const depField = step.fields.find((f) => f.fieldName === depBaseFieldName);
      const depSuffix = getRepeatInstanceSuffix(dep);
      const depInstanceIndex = depSuffix ? Math.max(0, Number(depSuffix.slice(2)) - 1) : 0;
      const depValues = depField && depSuffix
        ? getRepeatInstanceValues(depField, depInstanceIndex, next, step.fields)
        : next;
      if (depField && !evaluateShowIf(depField, depValues, step.fields)) {
        // Clearing a dependent answer is a user-authored branch change. Mark
        // the concrete key so an older asynchronous prefill cannot restore
        // the hidden value before the save queue acknowledges the controller.
        userEditedValueKeysRef.current.add(dep);
        userClearedValueKeysRef.current.delete(dep);
        delete userClearPrefillBaselineRef.current[dep];
        next[dep] = "";
      } else if (depField) {
        const rules = depField.validationRules as {
          dependent_on?: string;
          depends_on?: string;
          dependsOn?: string;
        } | null;
        if (rules?.dependent_on || rules?.depends_on || rules?.dependsOn) {
          userEditedValueKeysRef.current.add(dep);
          userClearedValueKeysRef.current.delete(dep);
          delete userClearPrefillBaselineRef.current[dep];
          next[dep] = "";
        }
      }
      if (depField && userEditedValueKeysRef.current.has(dep) && usesBilingualAnswerPair(depField)) {
        next[`${dep}_zh`] = "";
        next[`${dep}_en`] = "";
        nextTextPairs ??= { ...textPairsRef.current };
        nextTextPairs[dep] = { zh: "", en: "" };
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

    const normalizedNext = normalizeTdacStepValues(step.fields, next, visaType, fieldName);
    valuesRef.current = normalizedNext;
    setValues(normalizedNext);
    if (nextTextPairs) {
      textPairsRef.current = nextTextPairs;
      setTextPairs(nextTextPairs);
    }
    if (options?.publishDraft) {
      const nextPatch = buildDraftPatch(
        step.fields,
        normalizedNext,
        groupCountsRef.current,
        textPairsRef.current,
      );
      // Discrete selections can be followed by an immediate page-level
      // submit. Keep the parent's draft buffer current without publishing
      // every keystroke from text-like controls.
      lastDraftPatchRef.current = nextPatch;
      onDraftChangeRef.current?.(nextPatch);
    }
  };

  const handleKoreaOfficialAddressSelection = (fieldName: string, value: string) => {
    if (!value) {
      onUserChange?.();
      pushUndoSnapshot();
      const next = {
        ...valuesRef.current,
        [fieldName]: "",
        [`${fieldName}_zh`]: "",
        [`${fieldName}_en`]: "",
        stay_address_ko: "",
        stay_address_en: "",
        stay_postal_code: "",
      };
      valuesRef.current = next;
      setValues(next);
      onDraftChangeRef.current?.(buildDraftPatch(
        step.fields,
        next,
        groupCountsRef.current,
        textPairsRef.current,
      ));
      return;
    }
    const selected = koreaAddressOptions.find((option) =>
      typeof option === "string" ? option === value : option.value === value,
    );
    if (typeof selected === "string" || !selected) {
      handleChange(fieldName, value);
      return;
    }

    onUserChange?.();
    pushUndoSnapshot();
    const next = {
      ...valuesRef.current,
      [fieldName]: value,
      [`${fieldName}_zh`]: selected.label_zh ?? selected.text ?? value,
      [`${fieldName}_en`]: selected.label_en ?? selected.englishAddress ?? value,
      stay_address_ko: selected.koreanAddress ?? selected.official_label ?? "",
      stay_address_en: selected.englishAddress ?? selected.value,
      stay_postal_code: selected.postalCode ?? "",
    };
    valuesRef.current = next;
    setValues(next);
    // Publish the derived official values synchronously. Waiting for React's
    // values effect creates a small race where an immediate click on the
    // page-level Submit button can enqueue before the Korean/English address
    // and postal code have reached the parent draft buffer.
    onDraftChangeRef.current?.(buildDraftPatch(
      step.fields,
      next,
      groupCountsRef.current,
      textPairsRef.current,
    ));
  };

  const handleUsContactUnknownChange = (
    field: VisaFormFieldRow,
    fieldName: string,
    value: string,
  ): boolean => {
    if (field.visaType !== "DS160") return false;
    const role = getUsContactUnknownRole(fieldName);
    if (!role || (value !== "" && value !== "DO_NOT_KNOW")) return false;

    const suffix = getRepeatInstanceSuffix(fieldName);
    const cacheKey = `us_contact${suffix}`;
    const nameKeys = [`us_contact_surname${suffix}`, `us_contact_given_names${suffix}`];
    const organizationKey = `us_contact_organization${suffix}`;
    const allKeys = [...nameKeys, organizationKey];
    let snapshot = usContactUnknownRestoreRef.current[cacheKey];
    if (value === "DO_NOT_KNOW" && !snapshot) {
      snapshot = {
        values: Object.fromEntries(allKeys.map((key) => [key, valuesRef.current[key] ?? ""])),
        textPairs: Object.fromEntries(
          allKeys
            .filter((key) => textPairsRef.current[key])
            .map((key) => [key, { ...textPairsRef.current[key] }]),
        ),
      };
      usContactUnknownRestoreRef.current[cacheKey] = snapshot;
    }

    const nextValues = { ...valuesRef.current };
    const nextTextPairs = { ...textPairsRef.current };
    const fieldUsesBilingualPair = (key: string): boolean => {
      const baseName = stripRepeatInstanceSuffix(key);
      return step.fields.some((candidate) => candidate.fieldName === baseName && usesBilingualAnswerPair(candidate));
    };
    const setUnknown = (key: string) => {
      nextValues[key] = "DO_NOT_KNOW";
      if (fieldUsesBilingualPair(key) || nextTextPairs[key] || snapshot?.textPairs[key]) {
        nextTextPairs[key] = { zh: "DO_NOT_KNOW", en: "DO_NOT_KNOW" };
      }
    };
    const restore = (key: string) => {
      const restoredValue = snapshot?.values[key] ?? "";
      const safeValue = isDoNotKnowAnswer(restoredValue) ? "" : restoredValue;
      nextValues[key] = safeValue;
      if (fieldUsesBilingualPair(key) || nextTextPairs[key] || snapshot?.textPairs[key]) {
        const restoredPair = snapshot?.textPairs[key];
        nextTextPairs[key] = restoredPair && !isDoNotKnowAnswer(restoredPair.en) && !isDoNotKnowAnswer(restoredPair.zh)
          ? { ...restoredPair }
          : toInitialBilingualText(safeValue);
      }
    };

    if (role === "name") {
      if (value === "DO_NOT_KNOW") {
        nameKeys.forEach(setUnknown);
        if (isDoNotKnowAnswer(valuesRef.current[organizationKey])) restore(organizationKey);
      } else if (nameKeys.some((key) => isDoNotKnowAnswer(valuesRef.current[key]))) {
        nameKeys.forEach(restore);
      }
    } else if (value === "DO_NOT_KNOW") {
      setUnknown(organizationKey);
      if (nameKeys.some((key) => isDoNotKnowAnswer(valuesRef.current[key]))) nameKeys.forEach(restore);
    } else if (isDoNotKnowAnswer(valuesRef.current[organizationKey])) {
      restore(organizationKey);
    }

    const changedKeys = allKeys.filter((key) => nextValues[key] !== valuesRef.current[key]);
    const changedPairs = allKeys.some((key) => {
      const currentPair = textPairsRef.current[key];
      const nextPair = nextTextPairs[key];
      return Boolean(currentPair || nextPair) && (
        currentPair?.zh !== nextPair?.zh || currentPair?.en !== nextPair?.en
      );
    });
    if (changedKeys.length === 0 && !changedPairs) return true;

    onUserChange?.();
    pushUndoSnapshot();
    for (const key of changedKeys) {
      userEditedValueKeysRef.current.add(key);
      if (!nextValues[key]?.trim()) {
        userClearedValueKeysRef.current.add(key);
        userClearPrefillBaselineRef.current[key] = prefill[key]?.trim()
          ?? previousPrefillRef.current[key]
          ?? "";
      } else {
        userClearedValueKeysRef.current.delete(key);
        delete userClearPrefillBaselineRef.current[key];
      }
    }

    const normalizedNext = normalizeTdacStepValues(step.fields, nextValues, visaType);
    valuesRef.current = normalizedNext;
    textPairsRef.current = nextTextPairs;
    setValues(normalizedNext);
    setTextPairs(nextTextPairs);

    const stillUnknown = nameKeys.some((key) => isDoNotKnowAnswer(normalizedNext[key]))
      || isDoNotKnowAnswer(normalizedNext[organizationKey]);
    if (!stillUnknown) delete usContactUnknownRestoreRef.current[cacheKey];

    const nextPatch = buildDraftPatch(step.fields, normalizedNext, groupCountsRef.current, nextTextPairs);
    lastDraftPatchRef.current = nextPatch;
    onDraftChangeRef.current?.(nextPatch);
    return true;
  };

  const handleDs160PreparerSentinelChange = (
    field: VisaFormFieldRow,
    fieldName: string,
    value: string,
  ): boolean => {
    if (field.visaType !== "DS160") return false;
    const role = getDs160PreparerSentinelRole(fieldName);
    if (!role || (value !== "" && value !== "DOES_NOT_APPLY")) return false;

    const suffix = getRepeatInstanceSuffix(fieldName);
    const cacheKey = `ds160_preparer${suffix}`;
    const nameKeys = [`ds160_preparer_surname${suffix}`, `ds160_preparer_given_names${suffix}`];
    const organizationKey = `ds160_preparer_organization_name${suffix}`;
    const allKeys = [...nameKeys, organizationKey];
    let snapshot = ds160PreparerSentinelRestoreRef.current[cacheKey];
    if (value === "DOES_NOT_APPLY" && !snapshot) {
      snapshot = {
        values: Object.fromEntries(allKeys.map((key) => [key, valuesRef.current[key] ?? ""])),
        textPairs: Object.fromEntries(
          allKeys
            .filter((key) => textPairsRef.current[key])
            .map((key) => [key, { ...textPairsRef.current[key] }]),
        ),
      };
      ds160PreparerSentinelRestoreRef.current[cacheKey] = snapshot;
    }

    const nextValues = { ...valuesRef.current };
    const nextTextPairs = { ...textPairsRef.current };
    const fieldUsesBilingualPair = (key: string): boolean => {
      const baseName = stripRepeatInstanceSuffix(key);
      return step.fields.some((candidate) => candidate.fieldName === baseName && usesBilingualAnswerPair(candidate));
    };
    const setNotApplicable = (key: string) => {
      nextValues[key] = "DOES_NOT_APPLY";
      if (fieldUsesBilingualPair(key) || nextTextPairs[key] || snapshot?.textPairs[key]) {
        nextTextPairs[key] = { zh: "DOES_NOT_APPLY", en: "DOES_NOT_APPLY" };
      }
    };
    const restore = (key: string) => {
      const restoredValue = snapshot?.values[key] ?? "";
      const safeValue = isDoesNotApplyAnswer(restoredValue) ? "" : restoredValue;
      nextValues[key] = safeValue;
      if (fieldUsesBilingualPair(key) || nextTextPairs[key] || snapshot?.textPairs[key]) {
        const restoredPair = snapshot?.textPairs[key];
        nextTextPairs[key] = restoredPair &&
          !isDoesNotApplyAnswer(restoredPair.en) &&
          !isDoesNotApplyAnswer(restoredPair.zh)
          ? { ...restoredPair }
          : toInitialBilingualText(safeValue);
      }
    };

    if (role === "name") {
      if (value === "DOES_NOT_APPLY") {
        nameKeys.forEach(setNotApplicable);
        if (isDoesNotApplyAnswer(valuesRef.current[organizationKey])) restore(organizationKey);
      } else if (nameKeys.some((key) => isDoesNotApplyAnswer(valuesRef.current[key]))) {
        nameKeys.forEach(restore);
      }
    } else if (value === "DOES_NOT_APPLY") {
      setNotApplicable(organizationKey);
      if (nameKeys.some((key) => isDoesNotApplyAnswer(valuesRef.current[key]))) nameKeys.forEach(restore);
    } else if (isDoesNotApplyAnswer(valuesRef.current[organizationKey])) {
      restore(organizationKey);
    }

    const changedKeys = allKeys.filter((key) => nextValues[key] !== valuesRef.current[key]);
    const changedPairs = allKeys.some((key) => {
      const currentPair = textPairsRef.current[key];
      const nextPair = nextTextPairs[key];
      return Boolean(currentPair || nextPair) && (
        currentPair?.zh !== nextPair?.zh || currentPair?.en !== nextPair?.en
      );
    });
    if (changedKeys.length === 0 && !changedPairs) return true;

    onUserChange?.();
    pushUndoSnapshot();
    for (const key of changedKeys) {
      userEditedValueKeysRef.current.add(key);
      if (!nextValues[key]?.trim()) {
        userClearedValueKeysRef.current.add(key);
        userClearPrefillBaselineRef.current[key] = prefill[key]?.trim()
          ?? previousPrefillRef.current[key]
          ?? "";
      } else {
        userClearedValueKeysRef.current.delete(key);
        delete userClearPrefillBaselineRef.current[key];
      }
    }

    const normalizedNext = normalizeTdacStepValues(step.fields, nextValues, visaType);
    valuesRef.current = normalizedNext;
    textPairsRef.current = nextTextPairs;
    setValues(normalizedNext);
    setTextPairs(nextTextPairs);

    const stillNotApplicable = nameKeys.some((key) => isDoesNotApplyAnswer(normalizedNext[key]))
      || isDoesNotApplyAnswer(normalizedNext[organizationKey]);
    if (!stillNotApplicable) delete ds160PreparerSentinelRestoreRef.current[cacheKey];

    const nextPatch = buildDraftPatch(step.fields, normalizedNext, groupCountsRef.current, nextTextPairs);
    lastDraftPatchRef.current = nextPatch;
    onDraftChangeRef.current?.(nextPatch);
    return true;
  };

  const handleBilingualTextChange = (fieldName: string, side: BilingualSide, value: string) => {
    const currentPair = textPairsRef.current[fieldName] ?? toInitialBilingualText(valuesRef.current[fieldName]);
    const nextPair = side === "zh"
      ? { zh: value, en: toOfficialEnglishValue(value) }
      : { zh: currentPair.zh, en: value };
    if (currentPair.zh === nextPair.zh && currentPair.en === nextPair.en) return;

    onUserChange?.();
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
    // A source-language edit can change only the visible pair while leaving
    // the canonical official value unchanged. Treat the pair as dirty too so
    // an unrelated prefill refresh cannot replace it with an older mirror.
    userEditedValueKeysRef.current.add(fieldName);
    handleChange(fieldName, officialValue, { recordUndo: false });

    // Keep the bilingual companion answers in the same ref-backed snapshot as
    // the canonical value.  The prefill reconciliation effect may run after
    // an unrelated field changes (or after navigation) and uses valuesRef as
    // its baseline; leaving the old *_zh/*_en values there would let that
    // effect restore stale mirrors over the pair the applicant just edited.
    const nextValues = {
      ...valuesRef.current,
      [`${fieldName}_zh`]: nextPair.zh,
      [`${fieldName}_en`]: nextPair.en,
    };
    valuesRef.current = nextValues;
    setValues(nextValues);

    // Clearing a text answer is a submit-critical transition: the page-level
    // review action can run before React's normal values effect publishes the
    // next draft. Publish this empty answer immediately while retaining the
    // existing deferred path for ordinary typing.
    if (!officialValue.trim()) {
      const nextPatch = buildDraftPatch(
        step.fields,
        nextValues,
        groupCountsRef.current,
        nextTextPairs,
      );
      lastDraftPatchRef.current = nextPatch;
      onDraftChangeRef.current?.(nextPatch);
    }
  };

  const addGroupInstance = (group: string) => {
    const currentCount = groupCounts[group] ?? 1;
    const configuredMax = repeatGroupMax[group] ?? REPEAT_GROUP_DEFAULT_MAX;
    const max = group === FORMER_SPOUSE_REPEAT_GROUP
      ? getFormerSpouseRepeatLimit(valuesRef.current, configuredMax)
      : configuredMax;
    if (currentCount >= max) return;

    captureScrollOffsetBeforeMutation();
    onUserChange?.();
    pushUndoSnapshot();
    const count = currentCount + 1;
    for (const field of repeatGroupFields[group] ?? []) {
      const restoredKey = instanceKey(field.fieldName, count - 1);
      removedRepeatKeysRef.current.delete(restoredKey);
      if (usesBilingualAnswerPair(field)) {
        removedRepeatKeysRef.current.delete(`${restoredKey}_zh`);
        removedRepeatKeysRef.current.delete(`${restoredKey}_en`);
      }
    }
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
        if (usesBilingualAnswerPair(field)) {
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

    captureScrollOffsetBeforeMutation();
    onUserChange?.();
    pushUndoSnapshot();
    // Removing any row shifts later values down and drops the old tail. Mark
    // that dropped tail as locally edited so a stale asynchronous prefill
    // cannot recreate it before the save queue acknowledges the deletion.
    const removedTailIndex = count - 1;
    for (let index = instanceIdx; index < count; index++) {
      for (const field of repeatGroupFields[group] ?? []) {
        const concreteKey = instanceKey(field.fieldName, index);
        // Rows after a removed middle row shift into an earlier key. Protect
        // those shifted answers from a stale prefill as well as the dropped
        // tail itself.
        if (index < removedTailIndex) userEditedValueKeysRef.current.add(concreteKey);
        if (index !== removedTailIndex) continue;
        userEditedValueKeysRef.current.add(concreteKey);
        removedRepeatKeysRef.current.add(concreteKey);
        if (usesBilingualAnswerPair(field)) {
          removedRepeatKeysRef.current.add(`${concreteKey}_zh`);
          removedRepeatKeysRef.current.add(`${concreteKey}_en`);
        }
      }
    }
    const fields = repeatGroupFields[group] ?? [];
    const nextValues = { ...valuesRef.current };
    // Shift values down from instanceIdx+1..count-1.
    for (let i = instanceIdx; i < count - 1; i++) {
      for (const field of fields) {
        nextValues[instanceKey(field.fieldName, i)] = nextValues[instanceKey(field.fieldName, i + 1)] ?? "";
      }
    }
    // Remove last instance keys from the live form snapshot.
    for (const field of fields) {
      delete nextValues[instanceKey(field.fieldName, count - 1)];
    }

    const nextTextPairs = { ...textPairsRef.current };
    for (let i = instanceIdx; i < count - 1; i++) {
      for (const field of fields) {
        if (usesBilingualAnswerPair(field)) {
          nextTextPairs[instanceKey(field.fieldName, i)] = nextTextPairs[instanceKey(field.fieldName, i + 1)] ?? { zh: "", en: "" };
        }
      }
    }
    for (const field of fields) {
      if (usesBilingualAnswerPair(field)) {
        delete nextTextPairs[instanceKey(field.fieldName, count - 1)];
      }
    }

    const nextGroupCounts = { ...groupCountsRef.current, [group]: count - 1 };
    valuesRef.current = nextValues;
    textPairsRef.current = nextTextPairs;
    groupCountsRef.current = nextGroupCounts;
    setValues(nextValues);
    setTextPairs(nextTextPairs);
    setGroupCounts(nextGroupCounts);

    // The reduced group count means the normal effect patch no longer contains
    // the dropped tail. Send explicit empty tombstones in the same immediate
    // draft so a merge-based parent/save queue cannot leave old __N answers in
    // the persisted application.
    const nextPatch = buildDraftPatch(
      step.fields,
      nextValues,
      nextGroupCounts,
      nextTextPairs,
    );
    for (const field of fields) {
      const removedKey = instanceKey(field.fieldName, removedTailIndex);
      nextPatch[removedKey] = "";
      if (usesBilingualAnswerPair(field)) {
        nextPatch[`${removedKey}_zh`] = "";
        nextPatch[`${removedKey}_en`] = "";
      }
    }
    lastDraftPatchRef.current = nextPatch;
    onDraftChangeRef.current?.(nextPatch);
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
    // The long-form page hides the per-step Continue button, but the form can
    // still receive an implicit submit (for example, Enter from a text input).
    // Keep that path subject to the same required/field validation gate as the
    // visible button so incomplete Vietnam expense answers cannot be saved as
    // a completed step.
    if (!requiredFilled || !blockingErrorsClear || indonesiaPostalLookupBlocksContinue) return;
    const stepData = buildDraftPatch(
      step.fields,
      valuesRef.current,
      groupCountsRef.current,
      textPairsRef.current,
    );
    onDraftChangeRef.current?.(stepData);
    onComplete(stepData);
  };

  // Detect yes/no toggles that gate subsequent fields until answered.
  // These are toggles where following fields should be hidden until the user picks Yes or No.
  const gatingToggles = useMemo(() => {
    return step.fields
      .filter((f) =>
        (f.fieldType === "radio" || f.fieldType === "select") &&
        GATING_TOGGLE_LABEL_PATTERNS.some((p) => f.label.toLowerCase().includes(p))
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [step.fields]);

  /** Check whether a field should be hidden because a preceding yes/no toggle is unanswered
   *  or because it requires a specific toggle answer (e.g. companion fields only for "No"). */
  const isGatedByUnansweredToggle = useCallback((
    field: VisaFormFieldRow,
    fieldValues: Record<string, string> = values,
  ): boolean => {
    if (field.conditionalLogic) return false; // has explicit DB logic, skip gating

    // Find the nearest preceding gating toggle
    const precedingToggle = gatingToggles
      .filter((t) => t.displayOrder < field.displayOrder && t.fieldName !== field.fieldName)
      .at(-1); // last one = nearest preceding

    if (!precedingToggle) return false;

    const toggleValue = (fieldValues[precedingToggle.fieldName] ?? "").trim();

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

  // A repeat instance is consulted by visibility, requiredness, validation,
  // and rendering during the same pass. Rebuilding its scoped answer object
  // for each consumer makes large DS-160 steps noticeably expensive while
  // typing. Keep one lazy cache per values/schema snapshot; instance zero
  // still returns the live values object without cloning.
  const getScopedFieldValues = useMemo(() => {
    const scopedRepeatValues = new Map<string, Record<string, string>>();
    return (field: VisaFormFieldRow, valueKey: string) => {
      const instanceIndex = repeatInstanceIndex(field, valueKey);
      const group = getRepeatGroup(field);
      if (!group || instanceIndex === 0) return values;

      const cacheKey = `${group}\u0000${instanceIndex}`;
      const cached = scopedRepeatValues.get(cacheKey);
      if (cached) return cached;

      const scoped = getRepeatInstanceValues(field, instanceIndex, values, step.fields);
      scopedRepeatValues.set(cacheKey, scoped);
      return scoped;
    };
  }, [step.fields, values]);

  const isFieldConditionallyVisible = useCallback((field: VisaFormFieldRow, valueKey: string) => {
    if (isLegacyCompatibilityOnlyField(field)) return false;
    const fieldValues = getScopedFieldValues(field, valueKey);
    if (!isDs160FieldVisibleForRuntime(field, step, visaType, fieldValues)) return false;
    if (isGatedByUnansweredToggle(field, fieldValues)) return false;
    if (isDisabledByLT24(field, valueKey, fieldValues, step.fields)) return false;
    return evaluateShowIf(field, fieldValues, step.fields);
  }, [getScopedFieldValues, isGatedByUnansweredToggle, step, visaType]);

  const shouldRenderField = useCallback((field: VisaFormFieldRow, valueKey: string) => {
    if (isLegacyCompatibilityOnlyField(field)) return false;
    const fieldValues = getScopedFieldValues(field, valueKey);
    if (!isDs160FieldVisibleForRuntime(field, step, visaType, fieldValues)) return false;
    if (isGatedByUnansweredToggle(field, fieldValues)) return false;
    return evaluateShowIf(field, fieldValues, step.fields)
      || isDisabledByLT24(field, valueKey, fieldValues, step.fields);
  }, [getScopedFieldValues, isGatedByUnansweredToggle, step, visaType]);

  const isRequiredField = (
    field: VisaFormFieldRow,
    fieldValues: Record<string, string> = values,
  ): boolean => {
    const fieldIsTdacSameDayTransit = visaType === "TH_TDAC_ARRIVAL_CARD"
      && isSameCalendarDayValue(fieldValues.arrival_date, fieldValues.departure_date);
    if (
      visaType === "TH_TDAC_ARRIVAL_CARD" &&
      !fieldIsTdacSameDayTransit &&
      TDAC_NON_TRANSIT_REQUIRED_ACCOMMODATION_KEYS.has(field.fieldName)
    ) {
      return true;
    }
    return (field.required && !isRequiredUnlessSatisfied(field, fieldValues))
      || isRequiredWhenSatisfied(field, fieldValues);
  };

  // Rendered controls and local validation must use the same effective option
  // list. Build it once per field/value key so dependent options and remote
  // catalog branches do not disappear from the precomputed issue map.
  const effectiveFieldStateCache = new Map<string, EffectiveFieldState>();
  const getEffectiveFieldState = (
    field: VisaFormFieldRow,
    valueKey: string,
  ): EffectiveFieldState => {
    const cacheKey = `${field.fieldName}\u0000${valueKey}`;
    const cached = effectiveFieldStateCache.get(cacheKey);
    if (cached) return cached;

    const fieldValues = getScopedFieldValues(field, valueKey);
    let fieldOptions = (field.validationRules as { source?: unknown } | null)?.source === "US_STATES"
      ? US_STATE_FORM_OPTIONS : field.options;
    if (field.fieldName === "phone_country_code" && (!fieldOptions || fieldOptions.length === 0)) {
      fieldOptions = getPhoneCountryCodeOptions();
    }
    const dynamicOptions = getDynamicDependentOptions(field, fieldValues);
    if (dynamicOptions) {
      fieldOptions = field.fieldName === "intended_ward_commune"
        ? localizeVietnamWardOptions(dynamicOptions)
        : dynamicOptions;
    }

    const phEtravelSource = getPhEtravelOfficialOptionSource(field);
    if (phEtravelSource) {
      const remoteOptions = phEtravelOptions[field.fieldName] ?? [];
      const selectedValue = values[valueKey]?.trim();
      const hasSelectedValue = selectedValue && remoteOptions.some((option) =>
        typeof option === "string" ? option === selectedValue : option.value === selectedValue,
      );
      fieldOptions = selectedValue && !hasSelectedValue
        ? [{ value: selectedValue, text: selectedValue }, ...remoteOptions]
        : remoteOptions;
    }

    const isKoreaAddressSearchSelect = isKoreaOfficialAddressSearchField(field);
    if (isKoreaAddressSearchSelect) {
      const selectedValue = values[valueKey]?.trim();
      const hasSelectedValue =
        selectedValue &&
        koreaAddressOptions.some((option) => {
          if (typeof option === "string") return option === selectedValue;
          return option.value === selectedValue;
        });
      fieldOptions = selectedValue && !hasSelectedValue
        ? [{
            value: selectedValue,
            text: values[`${valueKey}_zh`] || selectedValue,
            label_zh: values[`${valueKey}_zh`] || selectedValue,
            label_en: values[`${valueKey}_en`] || selectedValue,
          }, ...koreaAddressOptions]
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
      const staticOptions = vnPrearrivalSource.endsWith(":flight") || vnPrearrivalSource.endsWith(":hotel")
        ? null
        : getVnPrearrivalStaticOptions(vnPrearrivalSource, parentKey ? values[parentKey] ?? "" : "");
      if (staticOptions) {
        hasVnPrearrivalStaticOptions = true;
        fieldOptions = field.fieldName === "phone_country_code" && staticOptions.length === 0
          ? fieldOptions
          : staticOptions;
      }
    }
    if (vnPrearrivalKey && !hasVnPrearrivalStaticOptions) {
      const remoteOptions = vnPrearrivalOptions[vnPrearrivalKey] ?? [];
      const isLiveFlightSource = vnPrearrivalSource?.endsWith(":flight") ?? false;
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
      const selectedHotelWardOption =
        field.fieldName === "ward_commune_of_hotel" && selectedValue && !hasSelectedValue
          ? getVnPrearrivalSelectedHotelWardOption(values)
          : null;
      fieldOptions = localizedRemoteOptions.length > 0
        ? field.fieldName === "phone_country_code" && localizedRemoteOptions.length === 0
          ? fieldOptions
          : selectedValue && !hasSelectedValue
          ? [
              selectedHotelWardOption ?? { value: selectedValue, text: selectedValue },
              ...localizedRemoteOptions,
            ]
          : localizedRemoteOptions
        : isLiveFlightSource
          ? []
          : selectedHotelWardOption
            ? [selectedHotelWardOption]
            : fieldOptions;
    }
    if (isPurposeOfTripField(field) && fieldOptions) {
      fieldOptions = fieldOptions.filter(isBTripPurposeOption);
    }
    if (isVietnamBorderGateField(field)) {
      fieldOptions = localizeVietnamBorderGateOptions(fieldOptions);
    }
    if (visaType === "PH_ETRAVEL_ARRIVAL_CARD" || visaType === "PH_ETRAVEL_DEPARTURE_CARD") {
      fieldOptions = localizePhEtravelOptions(field.fieldName, fieldOptions);
    }

    const validationField: VisaFormFieldRow = {
      ...field,
      required: isRequiredField(field, fieldValues),
      fieldType: isKoreaAddressSearchSelect
        ? "select"
        : isVnPrearrivalArrivalDateField ? "radio" : field.fieldType,
      options: fieldOptions,
    };
    const state: EffectiveFieldState = {
      validationField,
      fieldOptions,
      phEtravelSource,
      isKoreaAddressSearchSelect,
      vnPrearrivalSource,
      vnPrearrivalKey,
      isVnPrearrivalField,
      isVnPrearrivalArrivalDateField,
      hasVnPrearrivalStaticOptions,
    };
    effectiveFieldStateCache.set(cacheKey, state);
    return state;
  };

  // Required validation uses each repeat instance's own branch values. A
  // later row may have a different controller answer from row one, so a
  // group-level visibility check would either hide a required row or require
  // a row that is intentionally not active.
  const requiredFilled = step.fields
    // File fields are mirrored from official portals for parity, but the
    // actual upload state is managed by Document Center.
    .filter((f) => f.fieldType !== "file")
    .every((f) => {
      const group = getRepeatGroup(f);
      if (group) {
        const count = groupCounts[group] ?? 1;
        return Array.from({ length: count }, (_, index) => {
          const valueKey = instanceKey(f.fieldName, index);
          const fieldValues = getScopedFieldValues(f, valueKey);
          if (!isFieldConditionallyVisible(f, valueKey) || !isRequiredField(f, fieldValues)) return true;
          return Boolean((values[valueKey] ?? "").trim());
        }).every(Boolean);
      }
      if (!isFieldConditionallyVisible(f, f.fieldName) || !isRequiredField(f)) return true;
      return Boolean((values[f.fieldName] ?? "").trim());
    });

  const valueEntries = Object.entries(values);

  // Required-button state and field footers used to validate the same field
  // twice on every keystroke. Build one issue map for the current render and
  // let both consumers reuse it. Fields that are rendered while disabled by a
  // conditional branch are added lazily below because they are intentionally
  // excluded from the submit gate.
  const fieldIssues = new Map<string, FieldIssue>();
  for (const field of step.fields) {
    if (field.fieldType === "file") continue;
    const group = getRepeatGroup(field);
    if (group) {
      const count = groupCounts[group] ?? 1;
      for (let index = 0; index < count; index++) {
        const valueKey = instanceKey(field.fieldName, index);
        if (!isFieldConditionallyVisible(field, valueKey)) continue;
        const fieldValues = getScopedFieldValues(field, valueKey);
        fieldIssues.set(
          valueKey,
          getLocalFieldIssue(
            getEffectiveFieldState(field, valueKey).validationField,
            valueKey,
            values[valueKey] ?? "",
            fieldValues,
            locale,
            index === 0 ? valueEntries : Object.entries(fieldValues),
            values,
          ),
        );
      }
      continue;
    }
    if (!isFieldConditionallyVisible(field, field.fieldName)) continue;
    fieldIssues.set(
      field.fieldName,
      getLocalFieldIssue(
        getEffectiveFieldState(field, field.fieldName).validationField,
        field.fieldName,
        values[field.fieldName] ?? "",
        values,
        locale,
        valueEntries,
      ),
    );
  }
  const getCachedFieldIssue = (field: VisaFormFieldRow, valueKey: string): FieldIssue => {
    const cached = fieldIssues.get(valueKey);
    if (cached) return cached;
    const fieldValues = getScopedFieldValues(field, valueKey);
    const issue = getLocalFieldIssue(
      getEffectiveFieldState(field, valueKey).validationField,
      valueKey,
      fieldValues[valueKey] ?? "",
      fieldValues,
      locale,
      valueKey === field.fieldName ? valueEntries : Object.entries(fieldValues),
      values,
    );
    fieldIssues.set(valueKey, issue);
    return issue;
  };

  const blockingErrorsClear = step.fields.every((f) => {
    if (f.fieldType === "file") return true;
    const group = getRepeatGroup(f);
    if (group) {
      const count = groupCounts[group] ?? 1;
      return Array.from({ length: count }, (_, index) => {
        const valueKey = instanceKey(f.fieldName, index);
        if (!isFieldConditionallyVisible(f, valueKey)) return true;
        return getCachedFieldIssue(f, valueKey).severity !== "error";
      }).every(Boolean);
    }
    if (!isFieldConditionallyVisible(f, f.fieldName)) return true;
    return getCachedFieldIssue(f, f.fieldName).severity !== "error";
  });
  const indonesiaPostalLookupBlocksContinue = isIndonesiaOfficialEVisa &&
    step.fields.some((field) => field.fieldName === "postal_code") &&
    (indonesiaPostalLookup.status === "checking" ||
      indonesiaPostalLookup.status === "invalid" ||
      indonesiaPostalLookup.status === "unavailable");

  /** Translate and render a single field */
  const renderField = (field: VisaFormFieldRow, valueKey: string, forceWhiteBackground = false) => {
    const reviewIssue = reviewIssues?.get(valueKey) ?? reviewIssues?.get(field.fieldName);
    const submitCheckMessage = invalidFieldMessages?.get(valueKey)
      ?? invalidFieldMessages?.get(field.fieldName);
    const submitCheckInvalid = Boolean(
      submitCheckMessage ||
      invalidFieldNames?.has(field.fieldName) ||
      invalidFieldNames?.has(valueKey) ||
      reviewIssue?.severity === "error",
    );
    const reviewWarning = reviewIssue?.severity === "warning";
    const rawPlaceholder = field.placeholder ?? null;
    const zhPlaceholder = getChinesePlaceholder(rawPlaceholder, field.fieldName)
      ?? (field.fieldType === "select" ? tButtons("selectFallback") : null);
    const enPlaceholder = getEnglishPlaceholder(rawPlaceholder)
      ?? (field.fieldType === "select" ? "Select..." : null);

    const effectiveFieldState = getEffectiveFieldState(field, valueKey);
    const fieldValues = getScopedFieldValues(field, valueKey);
    const {
      fieldOptions,
      phEtravelSource,
      isKoreaAddressSearchSelect,
      vnPrearrivalSource,
      vnPrearrivalKey,
      isVnPrearrivalField,
      isVnPrearrivalArrivalDateField,
      hasVnPrearrivalStaticOptions,
    } = effectiveFieldState;

    const lt24Disabled = isDisabledByLT24(field, valueKey, fieldValues, step.fields);
    const tdacTransitCheckboxLocked =
      visaType === "TH_TDAC_ARRIVAL_CARD" && field.fieldName === "is_transit_traveler";
    const isTextLike = usesBilingualAnswerPair(field);
    const pair = textPairs[valueKey] ?? getBilingualPrefillText(valueKey, values, values[valueKey]);
    const targetWasManuallyEdited = Boolean(manualEnglishValueKeys[valueKey] && pair.en.trim());
    const isAiFilled = Boolean(aiFilledFieldNames?.has(field.fieldName) && values[valueKey]?.trim());
    const aiFilledBadge = isAiFilled ? (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        {isChineseInterface ? "AI 已填写" : "AI filled"}
      </span>
    ) : null;
    let guidancePopover: ReactNode = null;

    const renderSide = (side: BilingualSide) => {
      const isTaiwanEntryPermit = (visaType ?? field.visaType) === "TW_ENTRY_PERMIT";
      const isVnPrearrivalRemoteSelect = Boolean(vnPrearrivalKey && !hasVnPrearrivalStaticOptions);
      const vnReadOnlyRules = field.validationRules as {
        read_only?: boolean;
        locked_by?: string;
        editable_when_value?: string;
      } | null;
      const lockedByValue = vnReadOnlyRules?.locked_by
        ? fieldValues[vnReadOnlyRules.locked_by]?.trim().toLowerCase()
        : "";
      const editableWhenValue = vnReadOnlyRules?.editable_when_value?.trim().toLowerCase();
      const isVnPrearrivalEditableOverride = Boolean(
        editableWhenValue && lockedByValue === editableWhenValue,
      );
      const isFieldReadOnly =
        !isVnPrearrivalEditableOverride &&
        Boolean(vnReadOnlyRules?.read_only || (vnReadOnlyRules?.locked_by && lockedByValue));
      const sideField: VisaFormFieldRow = {
        ...field,
        fieldName: isTaiwanEntryPermit ? field.fieldName : `${valueKey}-${side}`,
        fieldType: isKoreaAddressSearchSelect
          ? "select"
        : isVnPrearrivalArrivalDateField ? "radio" : field.fieldType,
        label: isTaiwanEntryPermit && field.fieldName === "name_english"
          ? "英文姓名（依护照大写拼写）"
          : isTaiwanEntryPermit && field.fieldName === "name_chinese"
            ? "中文姓名（繁体字）"
            : getLocalizedFieldLabel(field, side),
        required: effectiveFieldState.validationField.required,
        placeholder: getLocalizedPlaceholder(
          field,
          side,
          side === "zh" ? zhPlaceholder : enPlaceholder,
        ),
        options: resolveLocalizedOptions(fieldOptions, side),
      };
      if (
        isPhEtravelStep &&
        side === "zh" &&
        field.fieldName === "surname" &&
        !field.validationRules &&
        field.label === "Surname"
      ) {
        sideField.label = "姓氏";
      }

      return (
        <div
          className="min-w-0"
          data-guidance-label-space={side === (isChineseInterface ? "zh" : "en") ? "true" : undefined}
        >
          <DynamicFormField
            key={`${valueKey}-${side}`}
            field={sideField}
            value={isTextLike ? pair[side] : (values[valueKey] ?? "")}
            onChange={(nextValue) => {
              if (handleUsContactUnknownChange(field, valueKey, nextValue)) return;
              if (handleDs160PreparerSentinelChange(field, valueKey, nextValue)) return;
              if (isTextLike) {
                handleBilingualTextChange(valueKey, side, nextValue);
                return;
              }
              if (isKoreaAddressSearchSelect && field.fieldName === "stay_address_search") {
                handleKoreaOfficialAddressSelection(valueKey, nextValue);
                return;
              }
              handleChange(valueKey, nextValue, {
                publishDraft:
                  field.fieldType === "select"
                  || field.fieldType === "multi_select"
                  || field.fieldType === "country"
                  || field.fieldType === "radio",
              });
            }}
            forceWhiteBackground={forceWhiteBackground}
            disabled={lt24Disabled || tdacTransitCheckboxLocked || isFieldReadOnly}
            displayLocale={side}
            labelMeta={side === (isChineseInterface ? "zh" : "en") ? aiFilledBadge : undefined}
            labelAction={side === (isChineseInterface ? "zh" : "en") ? guidancePopover : undefined}
            onSearchQuery={
              isKoreaAddressSearchSelect
                ? setKoreaAddressSearchQuery
                : isVnPrearrivalRemoteSelect && vnPrearrivalKey
                  ? (query) => setVnPrearrivalQueries((current) => ({ ...current, [vnPrearrivalKey]: query }))
                  : undefined
            }
            onLoadMore={
              isVnPrearrivalRemoteSelect
                && vnPrearrivalKey
                && vnPrearrivalSource?.endsWith(":flight")
                ? () => void loadMoreVnPrearrivalOptions(vnPrearrivalKey)
                : undefined
            }
            hasMore={
              Boolean(
                vnPrearrivalKey
                && vnPrearrivalSource?.endsWith(":flight")
                && vnPrearrivalPagination[vnPrearrivalKey]?.hasMore,
              )
            }
            loadingMore={
              Boolean(vnPrearrivalKey && vnPrearrivalLoadingMore[vnPrearrivalKey])
            }
            searching={
              isKoreaAddressSearchSelect
                ? koreaAddressSearching
                : phEtravelSource
                  ? Boolean(phEtravelSearching[field.fieldName])
                : vnPrearrivalKey
                  ? Boolean(vnPrearrivalSearching[vnPrearrivalKey])
                  : false
            }
            loadingText={
              isKoreaAddressSearchSelect
                ? side === "zh" ? "正在搜索韩国官方地址..." : "Searching official Korean addresses..."
                : phEtravelSource
                  ? side === "zh" ? "正在加载菲律宾 eTravel 官方航班..." : "Loading official Philippines eTravel flights..."
                : isVnPrearrivalRemoteSelect
                  ? getVnPrearrivalLoadingText(vnPrearrivalSource, side)
                  : undefined
            }
          />
        </div>
      );
    };

    const guidanceField: VisaFormFieldRow = {
      ...effectiveFieldState.validationField,
      label: getLocalizedFieldLabel(field, isChineseInterface ? "zh" : "en"),
      options: resolveLocalizedOptions(fieldOptions, isChineseInterface ? "zh" : "en"),
    };
    const localIssue = getCachedFieldIssue(field, valueKey);
    const requiredIssue = effectiveFieldState.validationField.required && !field.required && !(fieldValues[valueKey] ?? "").trim()
      ? { severity: "warning" as const, message: isChineseInterface ? "必填项" : "Required" }
      : null;
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
    const issue = postalLookupIssue ?? requiredIssue ?? localIssue;
    // Requiredness is already communicated by the canonical red asterisk on
    // the field label. Do not repeat a bare "Required"/"必填项" tag below the
    // control for any country; submit-time invalid styling remains separate.
    const isBareRequiredIssue = issue.message === "Required" || issue.message === "必填项";
    const showIssue = issue.severity !== "ok" && !isBareRequiredIssue;
    const translationWarning = isChineseInterface && Boolean(translationWarningValueKeys[valueKey]);
    const highlightControlAsWarning = submitCheckInvalid || showIssue || translationWarning;
    const panelOpen = activeGuidanceKey === valueKey;
    const resolvedVisaType = visaType ?? field.visaType ?? step.fields[0]?.visaType ?? "ID_C1_TOURIST";
    const buttonLabel = isChineseInterface ? "问 AI" : "Ask AI";
    const showVnPrearrivalEvisaHelp =
      isVnPrearrivalField &&
      field.fieldName === "visa_number" &&
      fieldValues.visa_type?.trim() === "EV";
    const showChineseFieldFooter = isTextLike
      || showVnPrearrivalEvisaHelp
      || (field.fieldName === "postal_code" && indonesiaPostalLookup.status === "resolved")
      || showIssue
      || Boolean(submitCheckMessage);
    guidancePopover = (
      <Popover
        open={panelOpen}
        onOpenChange={(open) => setActiveGuidanceKey(open ? valueKey : null)}
      >
        <PopoverTrigger asChild>
          <AiAssistButton
            label={buttonLabel}
            variant="field"
            onClick={(event) => event.stopPropagation()}
            className="application-form-ai-trigger"
            data-copilot-trigger={valueKey}
          />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(448px,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none"
          sideOffset={10}
        >
          <div data-copilot-panel-frame={valueKey}>
            <FieldGuidancePanel
              country={country}
              visaType={resolvedVisaType}
              locale={locale}
              field={guidanceField}
              answer={values[valueKey] ?? ""}
              allAnswers={values}
              initialConversation={guidanceConversations[valueKey]}
              onConversationChange={(messages) => {
                setGuidanceConversations((current) => ({
                  ...current,
                  [valueKey]: messages,
                }));
              }}
              onClose={() => setActiveGuidanceKey(null)}
            />
          </div>
        </PopoverContent>
      </Popover>
    );

    if (!isChineseInterface) {
      return (
        <div
          key={valueKey}
          data-field-name={valueKey}
          data-application-field-name={valueKey}
          data-validation-invalid={submitCheckInvalid ? "true" : "false"}
          data-field-warning={showIssue || translationWarning ? "true" : "false"}
          data-review-issue={reviewIssue?.severity}
          aria-invalid={submitCheckInvalid || undefined}
          className={cn(
            "application-form-field group/field relative transition-colors",
            forceWhiteBackground && "py-1.5",
            panelOpen ? "bg-[#fbfdff]" : "",
            isAiFilled && "-mx-2 rounded-lg bg-brand-50/50 px-2 py-2",
            highlightControlAsWarning && "rounded-lg [&_.application-form-control]:!border-red-500 [&_.application-form-control]:!shadow-[0_0_0_1px_rgb(239_68_68)] [&_[role=checkbox]]:!border-red-500 [&_[data-application-checkbox]]:!border-red-500 [&_[data-application-radio]]:!border-red-500",
            reviewIssue && "-mx-3 px-3 py-3",
            reviewIssue?.severity === "error" && "rounded-lg bg-red-50",
            reviewWarning && "rounded-lg bg-amber-50 [&_.application-form-control]:!border-amber-500 [&_.application-form-control]:!shadow-[0_0_0_1px_rgb(245_158_11)] [&_[role=checkbox]]:!border-amber-500 [&_[data-application-checkbox]]:!border-amber-500 [&_[data-application-radio]]:!border-amber-500",
          )}
        >
          <div className="min-w-0">
            {renderSide("en")}
          </div>
          {(showVnPrearrivalEvisaHelp ||
            (field.fieldName === "postal_code" && indonesiaPostalLookup.status === "resolved") ||
            showIssue ||
            submitCheckMessage) && (
            <div className="mt-2 flex items-center justify-end gap-2">
              {showVnPrearrivalEvisaHelp && <VnPrearrivalEvisaNumberHelp />}
              {field.fieldName === "postal_code" && indonesiaPostalLookup.status === "resolved" && (
                <span className="text-[13px] font-medium text-emerald-700">{indonesiaPostalLookup.summaryEn}</span>
              )}
              {showIssue && (
                <span className={cn("text-[13px] font-medium", issueMessageClasses(issue.severity))}>
                  {issue.message}
                </span>
              )}
              {submitCheckMessage && (
                <p role="alert" className="text-[13px] font-medium text-red-600">
                  {submitCheckMessage}
                </p>
              )}
            </div>
          )}
          {reviewIssue ? (
            <div className={cn(
              "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2",
              reviewIssue.severity === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}>
              <p className="text-sm leading-5">{reviewIssue.message}</p>
              {onNavigateReviewIssue ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateReviewIssue(reviewIssue.nextFieldName)}
                >
                  {reviewIssue.nextFieldName
                    ? tButtons("reviewRepair.nextIssue")
                    : tButtons("reviewRepair.returnToAssistant")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div
        key={valueKey}
        data-field-name={valueKey}
        data-application-field-name={valueKey}
        data-validation-invalid={submitCheckInvalid ? "true" : "false"}
        data-field-warning={showIssue || translationWarning ? "true" : "false"}
        data-review-issue={reviewIssue?.severity}
        aria-invalid={submitCheckInvalid || undefined}
        className={cn(
          "application-form-field group/field relative transition-colors",
          forceWhiteBackground && "py-1.5",
          panelOpen ? "bg-[#fbfdff]" : "",
          isAiFilled && "-mx-2 rounded-lg bg-brand-50/50 px-2 py-2",
          highlightControlAsWarning && "rounded-lg [&_.application-form-control]:!border-red-500 [&_.application-form-control]:!shadow-[0_0_0_1px_rgb(239_68_68)] [&_[role=checkbox]]:!border-red-500 [&_[data-application-checkbox]]:!border-red-500 [&_[data-application-radio]]:!border-red-500",
          reviewIssue && "-mx-3 px-3 py-3",
          reviewIssue?.severity === "error" && "rounded-lg bg-red-50",
          reviewWarning && "rounded-lg bg-amber-50 [&_.application-form-control]:!border-amber-500 [&_.application-form-control]:!shadow-[0_0_0_1px_rgb(245_158_11)] [&_[role=checkbox]]:!border-amber-500 [&_[data-application-checkbox]]:!border-amber-500 [&_[data-application-radio]]:!border-amber-500",
          highlightedFieldName === valueKey && "rounded-lg ring-2 ring-amber-300 ring-offset-2",
        )}
      >
        <div className="min-w-0">
          {renderSide("zh")}
        </div>
        {showChineseFieldFooter ? (
          <div className="mt-1 flex min-w-0 flex-col items-end gap-2">
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
                onWarningChange={handleTranslationWarningChange}
              />
            ) : null}
            <div className="flex items-center justify-end gap-2">
              {showVnPrearrivalEvisaHelp && <VnPrearrivalEvisaNumberHelp />}
              {field.fieldName === "postal_code" && indonesiaPostalLookup.status === "resolved" && (
                <span className="text-[13px] font-medium text-emerald-700">
                  {indonesiaPostalLookup.summaryZh}
                </span>
              )}
              {showIssue && (
                <span className={cn("text-[13px] font-medium", issueMessageClasses(issue.severity))}>
                  {issue.message}
                </span>
              )}
              {submitCheckMessage && (
                <p role="alert" className="text-[13px] font-medium text-red-600">
                  {submitCheckMessage}
                </p>
              )}
            </div>
          </div>
        ) : null}
        {reviewIssue ? (
          <div className={cn(
            "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2",
            reviewIssue.severity === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}>
            <p className="text-sm leading-5">{reviewIssue.message}</p>
            {onNavigateReviewIssue ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateReviewIssue(reviewIssue.nextFieldName)}
              >
                {reviewIssue.nextFieldName
                  ? tButtons("reviewRepair.nextIssue")
                  : tButtons("reviewRepair.returnToAssistant")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  // Build the ordered list of render items (fields + repeat groups)
  const renderedGroups = new Set<string>();
  const renderedInlineGroups = new Set<string>();
  const renderedBlockGroups = new Set<string>();
  const renderedMultiOptionConditionalGroups = new Set<string>();
  const formVisaType = visaType ?? step.fields[0]?.visaType;
  const showTaiwanContactAddressNotice = formVisaType === "TW_ENTRY_PERMIT"
    && isTaiwanEntryPermitContactAddressStep(step.stepName);

  useEffect(() => {
    if (!focusFieldName) return;
    const timer = window.setTimeout(() => {
      const container = document.querySelector<HTMLElement>(`[data-field-name="${CSS.escape(focusFieldName)}"]`);
      if (!container) return;
      container.scrollIntoView?.({ block: "center", behavior: "smooth" });
      setHighlightedFieldName(focusFieldName);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusFieldName, step.stepNumber]);

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyboardShortcuts}
      onClickCapture={captureScrollOffsetBeforeMutation}
      style={preservedFormHeight > 0 ? { minHeight: `${preservedFormHeight}px` } : undefined}
    >
      <div
        ref={formContentRef}
        className="flex flex-col gap-2"
        data-scroll-height-content="true"
      >
      {showTaiwanContactAddressNotice ? (
        <section className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-5 py-4 text-[15px] leading-7 text-sky-950">
          {TAIWAN_ENTRY_PERMIT_CONTACT_ADDRESS_NOTICE}
        </section>
      ) : null}
      {step.fields.map((field) => {
        // Skip fields handled by an external control (e.g. passport OCR upload
        // card). They stay in required validation but are not rendered here.
        if (isLegacyCompatibilityOnlyField(field)) return null;
        if (externallyHandled.has(field.fieldName)) return null;
        if (isIndonesiaPostalAutoFillField(field)) return null;
        const group = getRepeatGroup(field);

        // Repeat groups evaluate visibility once per instance below. Applying
        // row zero's condition here would hide the whole group when only a
        // later row is active.
        if (!group && !shouldRenderField(field, field.fieldName)) return null;

        // Non-repeatable field
        if (!group) {
          const multiOptionRoot = multiOptionConditionalGroups.fieldToRoot[field.fieldName];
          if (multiOptionRoot) {
            if (renderedMultiOptionConditionalGroups.has(multiOptionRoot)) return null;
            renderedMultiOptionConditionalGroups.add(multiOptionRoot);

            const visibleConditionalFields = (
              multiOptionConditionalGroups.fieldsByRoot[multiOptionRoot] ?? []
            ).filter(
              (candidate) =>
                !isLegacyCompatibilityOnlyField(candidate) &&
                !externallyHandled.has(candidate.fieldName) &&
                !isIndonesiaPostalAutoFillField(candidate) &&
                isDs160FieldVisibleForRuntime(candidate, step, visaType, values) &&
                (evaluateShowIf(candidate, values, step.fields) ||
                  isDisabledByLT24(candidate, candidate.fieldName, values, step.fields)) &&
                !isGatedByUnansweredToggle(candidate),
            );
            if (visibleConditionalFields.length === 0) return null;

            return (
              <ApplicationConditionalFieldsPanel
                key={`multi-option-conditional-${multiOptionRoot}`}
                className="-mt-1"
                data-conditional-controller={multiOptionRoot}
              >
                {groupFieldsInline(visibleConditionalFields).map((item) => {
                  if (Array.isArray(item)) {
                    return (
                      <div
                        key={item.map((candidate) => candidate.fieldName).join("-")}
                        className="grid gap-2"
                        style={inlineGroupGridStyle(item.length)}
                      >
                        {item.map((candidate) => renderField(candidate, candidate.fieldName, true))}
                      </div>
                    );
                  }
                  return renderField(item, item.fieldName, true);
                })}
              </ApplicationConditionalFieldsPanel>
            );
          }

          // Block group: wrap a consecutive set of non-repeatable fields in a
          // container box, rendered once for the group.
          const bg = getBlockGroup(field);
          if (bg) {
            if (renderedBlockGroups.has(bg)) return null;
            renderedBlockGroups.add(bg);

            const blockFields = step.fields.filter(
              (f) =>
                !getRepeatGroup(f) &&
                !isLegacyCompatibilityOnlyField(f) &&
                getBlockGroup(f) === bg &&
                isDs160FieldVisibleForRuntime(f, step, visaType, values) &&
                (evaluateShowIf(f, values, step.fields) || isDisabledByLT24(f, f.fieldName, values, step.fields)) &&
                !isGatedByUnansweredToggle(f) &&
                !isIndonesiaPostalAutoFillField(f),
            );

            if (blockFields.length === 0) return null;

            const blockOwnsConditionalPanel = blockFields.some(shouldOwnConditionalPanel);
            const renderedInlineInBlock = new Set<string>();
            const blockContent = (
              <div
                key={`block-${bg}`}
                className="flex flex-col gap-2"
              >
                {blockFields.map((f) => {
                  const inlineInBlock = getInlineGroup(f);
                  if (inlineInBlock) {
                    if (renderedInlineInBlock.has(inlineInBlock)) return null;
                    renderedInlineInBlock.add(inlineInBlock);
                    const inlineFields = blockFields.filter((x) => getInlineGroup(x) === inlineInBlock);
                    if (inlineFields.length <= 1) {
                      return renderField(f, f.fieldName, blockOwnsConditionalPanel);
                    }
                    return (
                      <div
                        key={`inline-${inlineInBlock}`}
                        className="grid gap-2"
                        style={inlineGroupGridStyle(inlineFields.length)}
                      >
                        {inlineFields.map((x) => renderField(
                          x,
                          x.fieldName,
                          blockOwnsConditionalPanel,
                        ))}
                      </div>
                    );
                  }
                  return renderField(f, f.fieldName, blockOwnsConditionalPanel);
                })}
              </div>
            );

            if (blockOwnsConditionalPanel) {
              return (
                <ApplicationConditionalFieldsPanel
                  key={`block-${bg}`}
                  className="-mt-1"
                >
                  {blockContent}
                </ApplicationConditionalFieldsPanel>
              );
            }

            return blockContent;
          }

          const ig = getInlineGroup(field);
          if (ig) {
            // Inline group: render all visible fields in this group together, once
            if (renderedInlineGroups.has(ig)) return null;
            renderedInlineGroups.add(ig);

            const inlineFields = step.fields.filter(
              (f) =>
                !getRepeatGroup(f) &&
                !isLegacyCompatibilityOnlyField(f) &&
                getInlineGroup(f) === ig &&
                isDs160FieldVisibleForRuntime(f, step, visaType, values) &&
                (evaluateShowIf(f, values, step.fields) || isDisabledByLT24(f, f.fieldName, values, step.fields)) &&
                !isGatedByUnansweredToggle(f) &&
                !isIndonesiaPostalAutoFillField(f)
            );

            if (inlineFields.length <= 1) {
              const inlineField = inlineFields[0];
              const renderedInlineField = renderField(
                inlineField,
                inlineField.fieldName,
                shouldOwnConditionalPanel(inlineField),
              );

              return shouldOwnConditionalPanel(inlineField) ? (
                <ApplicationConditionalFieldsPanel
                  key={`inline-${ig}`}
                  className="-mt-1"
                >
                  {renderedInlineField}
                </ApplicationConditionalFieldsPanel>
              ) : renderedInlineField;
            }

            const isConditionalInlineGroup = inlineFields.some(shouldOwnConditionalPanel);
            const inlineContent = (
              <div
                key={`inline-${ig}`}
                className="grid gap-2"
                style={inlineGroupGridStyle(inlineFields.length)}
              >
                {inlineFields.map((f) => renderField(
                  f,
                  f.fieldName,
                  isConditionalInlineGroup,
                ))}
              </div>
            );

            return isConditionalInlineGroup ? (
              <ApplicationConditionalFieldsPanel
                key={`inline-${ig}`}
                className="-mt-1"
              >
                {inlineContent}
              </ApplicationConditionalFieldsPanel>
            ) : inlineContent;
          }

          const renderedField = renderField(
            field,
            field.fieldName,
            shouldOwnConditionalPanel(field),
          );

          return shouldOwnConditionalPanel(field) ? (
            <ApplicationConditionalFieldsPanel
              key={`conditional-${field.fieldName}`}
              className="-mt-1"
            >
              {renderedField}
            </ApplicationConditionalFieldsPanel>
          ) : renderedField;
        }

        // Repeatable group: render the whole group container once
        if (renderedGroups.has(group)) return null;
        renderedGroups.add(group);

        const count = groupCounts[group] ?? 1;
        const groupFields = repeatGroupFields[group] ?? [];
        const visibleGroupFieldsByInstance = Array.from({ length: count }, (_, instanceIdx) =>
          groupFields.filter((f) => {
            if (isIndonesiaPostalAutoFillField(f)) return false;
            return shouldRenderField(f, instanceKey(f.fieldName, instanceIdx));
          }),
        );
        if (!visibleGroupFieldsByInstance.some((fields) => fields.length > 0)) return null;

        const isConditionalGroup = groupFields.some(hasConditionalDependency);
        const configuredRepeatMax = repeatGroupMax[group] ?? REPEAT_GROUP_DEFAULT_MAX;
        const effectiveRepeatMax = group === FORMER_SPOUSE_REPEAT_GROUP
          ? getFormerSpouseRepeatLimit(values, configuredRepeatMax)
          : configuredRepeatMax;
        const canAddGroupInstance =
          (groupCounts[group] ?? 1) < effectiveRepeatMax;

        return (
          <ApplicationConditionalFieldsPanel
            key={`group-${group}`}
            className={cn(isConditionalGroup && "-mt-1")}
            canAdd={canAddGroupInstance}
            onAdd={() => addGroupInstance(group)}
            addLabel={tButtons("addAnother")}
          >
            {Array.from({ length: count }, (_, instanceIdx) => {
              const visibleGroupFields = visibleGroupFieldsByInstance[instanceIdx] ?? [];
              if (visibleGroupFields.length === 0) return null;
              return (
                <div
                  key={`${group}-${instanceIdx}`}
                  className="flex flex-col gap-2"
                  data-repeat-group-instance="true"
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
                        <div
                          key={item.map((f) => f.fieldName).join("-")}
                          className="grid gap-2"
                          style={inlineGroupGridStyle(item.length)}
                        >
                          {item.map((f) => renderField(f, instanceKey(f.fieldName, instanceIdx), true))}
                        </div>
                      );
                    }
                    return renderField(item, instanceKey(item.fieldName, instanceIdx), true);
                  })}
                </div>
              );
            })}
          </ApplicationConditionalFieldsPanel>
        );
      })}

      {showContinueButton && (
        <BrandActionButton
          type="submit"
          disabled={!requiredFilled || !blockingErrorsClear || indonesiaPostalLookupBlocksContinue}
          data-required-filled={requiredFilled ? "true" : "false"}
          data-blocking-errors-clear={blockingErrorsClear ? "true" : "false"}
          data-postal-lookup-blocked={indonesiaPostalLookupBlocksContinue ? "true" : "false"}
          loading={saving}
          loadingText={tButtons("saving")}
          className="mt-2"
        >
          {tButtons("continue")}
        </BrandActionButton>
      )}
      </div>
    </form>
  );
}

// The long-form page keeps the step, draft, and callback props stable while a
// sibling step changes. Preserve that boundary so an unrelated keystroke does
// not rerender every step's field tree. React's default shallow comparison is
// intentional here: each controlled prop remains part of the comparison.
export const DynamicStepForm = memo(DynamicStepFormImpl);
