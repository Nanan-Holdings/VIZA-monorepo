"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { countries } from "country-data-list";
import { ApplicationFormDatePicker } from "@/components/ui/application-form-date-picker";
import { ApplicationCheckbox, ApplicationRadio } from "@/components/ui/application-checkbox";
import {
  Select,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroupInput,
} from "@/components/ui/input-group";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { RegionSelect } from "@/components/ui/region-select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useLocale, useTranslations } from "next-intl";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";
import { resolveLocalizedOptions, resolveLocalizedPlaceholder } from "@/lib/bilingual-schema-contract";
import { convertSimplifiedToTraditional } from "@/lib/chinese-conversion";
import { cn } from "@/lib/utils";
import {
  ApplicationFormField,
  ApplicationFormLabelAction,
} from "@/components/ui/application-form-field";
import {
  ApplicationFormControlDisplay,
  ApplicationFormInputGroup,
} from "@/components/ui/application-form-input";
import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
  ApplicationSearchableMultiSelect,
  ApplicationSearchableSelect,
} from "@/components/ui/application-form-select";
import { ApplicationFormTextarea } from "@/components/ui/application-form-textarea";
import { ApplicationYesNoControl } from "@/components/ui/application-yes-no-control";
import { APPLICATION_SEARCHABLE_OPTION_MIN } from "@/lib/application-schema-ui-contract";

type CountryCodeEntry = {
  alpha2: string;
  alpha3: string;
};

const COUNTRY_ALPHA2_BY_ALPHA3 = new Map(
  countries.all.map((country: CountryCodeEntry) => [country.alpha3.toUpperCase(), country.alpha2.toLowerCase()]),
);

const COUNTRY_MULTI_SELECT_FIELD_NAMES = new Set([
  "countries_visited_last_14_days",
]);

const SCHENGEN_MEMBER_ALPHA2_CODES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
] as const;

const SCHENGEN_COUNTRY_FIELD_NAMES = new Set([
  "main_destination_country",
  "first_entry_country",
  "host_country",
  "business_company_country",
  "study_institution_country",
  "medical_facility_country",
  "event_country",
  "accommodation_country",
]);

function getFieldSource(field: VisaFormFieldRow): string | undefined {
  return (field.validationRules as { source?: string } | null)?.source;
}

function getBaseFieldName(fieldName: string): string {
  return fieldName.replace(/-(zh|en)$/, "").replace(/__\d+$/, "");
}

function usesSchengenMemberStateList(field: VisaFormFieldRow): boolean {
  const source = getFieldSource(field);
  if (source === "SCHENGEN_MEMBER_STATES") return true;
  if (source !== "ISO3166-1") return false;
  if (SCHENGEN_COUNTRY_FIELD_NAMES.has(getBaseFieldName(field.fieldName))) return true;
  return /schengen member state/i.test(field.label);
}

function extractYearFromDateValue(value: string): string {
  const trimmed = value.trim();
  const yearOnly = trimmed.match(/^(\d{4})$/);
  const iso = trimmed.match(/^(\d{4})[-/.]\d{1,2}[-/.]\d{1,2}$/);
  const official = trimmed.match(/^\d{1,2}[-/.]\d{1,2}[-/.](\d{4})$/);
  const chinese = trimmed.match(/^(\d{4})年\d{1,2}月\d{1,2}日$/);

  return yearOnly?.[1] ?? iso?.[1] ?? official?.[1] ?? chinese?.[1] ?? "";
}

type DateFieldRules = {
  allow_do_not_know?: boolean;
  allow_does_not_apply?: boolean;
  allow_year_only?: boolean;
};

type LengthRules = {
  maxLength?: number;
  max_length?: number;
};

type InlineHelperRules = {
  helper_zh?: string;
  helper_en?: string;
  helper_priority?: "critical";
};

interface DynamicFormFieldProps {
  field: VisaFormFieldRow;
  value: string;
  onChange: (value: string) => void;
  forceWhiteBackground?: boolean;
  disabled?: boolean;
  displayLocale?: "zh" | "en";
  labelAction?: ReactNode;
  onSearchQuery?: (query: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  searching?: boolean;
  loadingText?: string;
}

function getMaxLengthRule(field: VisaFormFieldRow): number | undefined {
  const rules = field.validationRules as LengthRules | null;
  const rawMaxLength = rules?.maxLength ?? rules?.max_length;
  return typeof rawMaxLength === "number" && Number.isFinite(rawMaxLength) && rawMaxLength > 0
    ? rawMaxLength
    : undefined;
}

function getCriticalInlineHelperText(
  field: VisaFormFieldRow,
  sideLocale: "zh" | "en",
): string | undefined {
  const rules = field.validationRules as InlineHelperRules | null;
  if (rules?.helper_priority !== "critical") return undefined;

  const helper = sideLocale === "zh" ? rules.helper_zh : rules.helper_en;
  return typeof helper === "string" && helper.trim() ? helper.trim() : undefined;
}

const FieldWrapper = ApplicationFormField;

function normaliseOptions(
  opts: VisaFormFieldRow["options"],
  side: "zh" | "en",
  includeCountryFlags = false,
): Array<{ value: string; text: string; searchText: string; flagCountryCode?: string }> {
  const localizedOptions = resolveLocalizedOptions(opts, side);
  if (!localizedOptions || !Array.isArray(localizedOptions)) return [];
  return localizedOptions.map((o) => {
    if (typeof o === "string") return { value: o, text: cleanOptionDisplayText(o), searchText: o };
    if (typeof o === "object" && o !== null) {
      const obj = o as { value?: string; text?: string; label_en?: string; label_zh?: string; official_label?: string };
      const text = side === "zh"
        ? obj.label_zh ?? obj.text ?? obj.label_en ?? obj.official_label ?? obj.value ?? ""
        : obj.label_en ?? obj.text ?? obj.official_label ?? obj.value ?? "";
      return {
        value: obj.value ?? "",
        text: cleanOptionDisplayText(text),
        searchText: [obj.value, obj.text, obj.label_en, obj.label_zh, obj.official_label].filter(Boolean).join(" "),
        flagCountryCode: includeCountryFlags && obj.value
          ? COUNTRY_ALPHA2_BY_ALPHA3.get(obj.value.toUpperCase())
          : undefined,
      };
    }
    return { value: String(o), text: cleanOptionDisplayText(String(o)), searchText: String(o) };
  });
}

function cleanOptionDisplayText(text: string): string {
  return text.replace(/^(?:选项|Option)\s*[:：]\s*/i, "").trim();
}

function parseSsnSegments(raw: string): [string, string, string] {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)];
}

function formatSsnSegments(part1: string, part2: string, part3: string): string {
  if (!part1 && !part2 && !part3) return "";
  if (!part2 && !part3) return part1;
  if (!part3) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
}

function isSsnField(field: VisaFormFieldRow): boolean {
  const fieldName = field.fieldName.toLowerCase();
  const label = field.label.toLowerCase();
  return (
    fieldName === "us_social_security_number"
    || label.includes("social security number")
    || label.includes("社会安全号码")
  );
}

function isEmptyDependentSelect(field: VisaFormFieldRow, options: Array<{ value: string; text: string }>): boolean {
  if (options.length > 0) return false;
  const rules = field.validationRules as {
    dependent_on?: unknown;
    depends_on?: unknown;
    dependsOn?: unknown;
    live_dom_id?: unknown;
  } | null;
  return Boolean(rules?.dependent_on || rules?.depends_on || rules?.dependsOn || rules?.live_dom_id);
}

function SsnSegmentedInput({
  value,
  onChange,
  required,
  whiteControlClass,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  required: boolean;
  whiteControlClass: string;
  ariaLabel: string;
}) {
  const [part1, part2, part3] = parseSsnSegments(value);
  const digits = `${part1}${part2}${part3}`;

  return (
    <InputOTP
      maxLength={9}
      value={digits}
      onChange={(nextDigits) => {
        const clean = nextDigits.replace(/\D/g, "").slice(0, 9);
        const [a, b, c] = parseSsnSegments(clean);
        onChange(formatSsnSegments(a, b, c));
      }}
      pattern="[0-9]*"
      inputMode="numeric"
      containerClassName="h-12"
      className="w-full"
      required={required}
      aria-label={ariaLabel}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={1} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={2} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
      </InputOTPGroup>
      <InputOTPSeparator className="mx-0 text-gray-500" />
      <InputOTPGroup>
        <InputOTPSlot index={3} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={4} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
      </InputOTPGroup>
      <InputOTPSeparator className="mx-0 text-gray-500" />
      <InputOTPGroup>
        <InputOTPSlot index={5} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={6} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={7} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={8} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
      </InputOTPGroup>
    </InputOTP>
  );
}

export function DynamicFormField({
  field,
  value,
  onChange,
  forceWhiteBackground = false,
  disabled = false,
  displayLocale,
  labelAction,
  onSearchQuery,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  searching = false,
  loadingText,
}: DynamicFormFieldProps) {
  const t = useTranslations("applicationSteps");
  const locale = useLocale();
  const { label, fieldType, required, placeholder, options } = field;
  const sideLocale = displayLocale ?? (locale.startsWith("zh") ? "zh" : "en");
  const selectFallback = sideLocale === "zh" ? "请选择..." : "Select...";
  const localizedPlaceholder = resolveLocalizedPlaceholder(field, sideLocale) ?? placeholder ?? undefined;
  const doNotKnowLabel = sideLocale === "zh" ? t("dynamicField.doNotKnow") : "Do not know";
  const doesNotApplyLabel = sideLocale === "zh" ? t("dynamicField.doesNotApply") : "Does not apply";
  const [dateModeByField, setDateModeByField] = useState<Record<string, "full" | "year">>({});
  const [optimisticSelectionValue, setOptimisticSelectionValue] = useState(value);
  const selectionChangeRef = useRef(onChange);
  const pendingSelectionFrameRef = useRef<number | null>(null);
  const pendingSelectionTimerRef = useRef<number | null>(null);
  const maxLength = getMaxLengthRule(field);
  const criticalInlineHelperText = getCriticalInlineHelperText(field, sideLocale);
  const normalizedSelectOptions = useMemo(
    () => fieldType === "select" ? normaliseOptions(options, sideLocale) : [],
    [fieldType, options, sideLocale],
  );
  const helperText = criticalInlineHelperText;
  const characterCount = maxLength ? `${value.length}/${maxLength}` : undefined;

  useEffect(() => {
    selectionChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setOptimisticSelectionValue(value);
  }, [field.fieldName, value]);

  useEffect(() => () => {
    if (pendingSelectionFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingSelectionFrameRef.current);
    }
    if (pendingSelectionTimerRef.current !== null) {
      window.clearTimeout(pendingSelectionTimerRef.current);
    }
  }, []);

  const commitSelection = useCallback((nextValue: string) => {
    setOptimisticSelectionValue(nextValue);
    if (pendingSelectionFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingSelectionFrameRef.current);
    }
    if (pendingSelectionTimerRef.current !== null) {
      window.clearTimeout(pendingSelectionTimerRef.current);
    }
    pendingSelectionFrameRef.current = window.requestAnimationFrame(() => {
      pendingSelectionFrameRef.current = null;
      pendingSelectionTimerRef.current = window.setTimeout(() => {
        pendingSelectionTimerRef.current = null;
        // The long form can contain hundreds of controls. Let this field paint
        // its selected state before React recalculates conditional visibility
        // and autosave state for the enclosing application.
        startTransition(() => selectionChangeRef.current(nextValue));
      }, 0);
    });
  }, []);

  switch (fieldType) {
    case "date": {
      const dateRules = (field.validationRules as DateFieldRules | null);
      const dateAllowDoNotKnow = dateRules?.allow_do_not_know;
      const dateAllowDoesNotApply = dateRules?.allow_does_not_apply;
      const dateAllowYearOnly = Boolean(dateRules?.allow_year_only);
      const dateIsDoNotKnow = value === "DO_NOT_KNOW";
      const dateIsDoesNotApply = value === "DOES_NOT_APPLY";
      const currentDateMode = dateModeByField[field.fieldName] ?? (/^\d{4}$/.test(value.trim()) ? "year" : "full");
      const dateIsYearOnly = dateAllowYearOnly && currentDateMode === "year";
      const dateHasSideCheckbox = dateAllowDoNotKnow || dateAllowDoesNotApply;
      const fullDateLabel = sideLocale === "zh" ? "完整日期" : "Full";
      const yearOnlyLabel = sideLocale === "zh" ? "只知道年份" : "Only year is known";
      const datePickerNode = !dateIsDoNotKnow && !dateIsDoesNotApply ? (
        <ApplicationFormDatePicker
          value={value}
          onChange={onChange}
          placeholder={localizedPlaceholder}
          forceWhiteBackground={forceWhiteBackground}
          displayLocale={sideLocale}
          disabled={disabled}
        />
      ) : (
        <ApplicationFormControlDisplay className={`h-12 text-[15px] text-gray-400 ${forceWhiteBackground ? "bg-white" : "bg-gray-50"}`}>
          {dateIsDoNotKnow ? doNotKnowLabel : doesNotApplyLabel}
        </ApplicationFormControlDisplay>
      );
      const dateInputNode = dateIsYearOnly ? (
        <ApplicationFormInputGroup
          filled={Boolean(value)}
          forceWhiteBackground={forceWhiteBackground}
        >
          <InputGroupInput
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="YYYY"
            inputMode="numeric"
            pattern="[0-9]{4}"
            disabled={disabled}
          />
        </ApplicationFormInputGroup>
      ) : datePickerNode;
      const sideCheckbox = dateAllowDoNotKnow ? (
        <ApplicationCheckbox
          checked={dateIsDoNotKnow}
          label={doNotKnowLabel}
          className="shrink-0 whitespace-nowrap text-[13px] text-gray-500"
          onCheckedChange={(checked) => onChange(checked ? "DO_NOT_KNOW" : "")}
        />
      ) : dateAllowDoesNotApply ? (
        <ApplicationCheckbox
          checked={dateIsDoesNotApply}
          label={doesNotApplyLabel}
          className="shrink-0 whitespace-nowrap text-[13px] text-gray-500"
          onCheckedChange={(checked) => onChange(checked ? "DOES_NOT_APPLY" : "")}
        />
      ) : null;

      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
          {dateAllowYearOnly && !dateIsDoNotKnow && !dateIsDoesNotApply && (
            <div className="mb-1 flex flex-wrap items-center gap-4 text-[13px] text-gray-700">
              <ApplicationRadio
                name={`${field.fieldName}-date-mode`}
                checked={!dateIsYearOnly}
                label={fullDateLabel}
                className="text-[13px] text-gray-700"
                onCheckedChange={() => {
                  setDateModeByField((prev) => ({ ...prev, [field.fieldName]: "full" }));
                  if (/^\d{4}$/.test(value.trim())) onChange("");
                }}
              />
              <ApplicationRadio
                name={`${field.fieldName}-date-mode`}
                checked={dateIsYearOnly}
                label={yearOnlyLabel}
                className="text-[13px] text-gray-700"
                onCheckedChange={() => {
                  setDateModeByField((prev) => ({ ...prev, [field.fieldName]: "year" }));
                  onChange(extractYearFromDateValue(value));
                }}
              />
            </div>
          )}
          {dateHasSideCheckbox ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">{dateInputNode}</div>
              {sideCheckbox}
            </div>
          ) : (
            dateInputNode
          )}
        </FieldWrapper>
      );
    }

    case "select": {
      // Country fields use source metadata — render CountryDropdown
      const source = getFieldSource(field);
      const isSchengenMemberState = usesSchengenMemberStateList(field);
      const isCountry = source === "ISO3166-1" || isSchengenMemberState;
      const isUsState = source === "US_STATES";
      if (isCountry) {
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
            <CountryDropdown
              placeholder={localizedPlaceholder ?? selectFallback}
              defaultValue={value}
              onChange={(country) => commitSelection(country.name)}
              forceWhiteBackground={forceWhiteBackground}
              displayLocale={sideLocale}
              allowedCountryCodes={isSchengenMemberState ? SCHENGEN_MEMBER_ALPHA2_CODES : undefined}
            />
          </FieldWrapper>
        );
      }
      if (isUsState) {
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
            <RegionSelect
              countryCode="US"
              placeholder={localizedPlaceholder ?? selectFallback}
              defaultValue={value}
              onChange={(region) => commitSelection(region.shortCode)}
              className="h-12 text-[15px] data-[placeholder]:text-muted-foreground"
              forceWhiteBackground={forceWhiteBackground}
            />
          </FieldWrapper>
        );
      }
      const opts = normalizedSelectOptions;
      const rules = field.validationRules as { remote_search?: unknown } | null;
      const usesRemoteSearch = rules?.remote_search === true;
      if (isEmptyDependentSelect(field, opts) && !usesRemoteSearch && !onSearchQuery) {
        const dependentMessage = sideLocale === "zh"
          ? "请先选择上级选项，或联系 VIZA 检查官方下拉列表。"
          : "Select the parent option first, or contact VIZA to check the official dropdown list.";
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
            <ApplicationFormControlDisplay
              className={cn(
                "min-h-12 bg-white text-[#71717a]",
              )}
              role="alert"
            >
              {dependentMessage}
            </ApplicationFormControlDisplay>
          </FieldWrapper>
        );
      }
      if (usesRemoteSearch || opts.length >= APPLICATION_SEARCHABLE_OPTION_MIN) {
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
            <ApplicationSearchableSelect
              value={optimisticSelectionValue}
              onValueChange={commitSelection}
              options={opts}
              placeholder={localizedPlaceholder ?? selectFallback}
              disabled={disabled}
              forceWhiteBackground={forceWhiteBackground}
              sideLocale={sideLocale}
              onSearchQuery={onSearchQuery}
              onLoadMore={onLoadMore}
              hasMore={hasMore}
              loadingMore={loadingMore}
              searching={searching}
              loadingText={loadingText}
            />
          </FieldWrapper>
        );
      }
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
          <Select value={optimisticSelectionValue} onValueChange={commitSelection} disabled={disabled}>
            <ApplicationFormSelectTrigger
              className={`h-12 text-[15px] data-[placeholder]:text-muted-foreground ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}
              filled={opts.some((option) => option.value === optimisticSelectionValue)}
              forceWhiteBackground={forceWhiteBackground}
            >
              <SelectValue placeholder={localizedPlaceholder ?? selectFallback} />
            </ApplicationFormSelectTrigger>
            <ApplicationFormSelectContent>
              {opts.map((opt) => (
                <ApplicationFormSelectItem key={opt.value} value={opt.value || "_empty"}>
                  {opt.text}
                </ApplicationFormSelectItem>
              ))}
            </ApplicationFormSelectContent>
          </Select>
        </FieldWrapper>
      );
    }

    case "multi_select": {
      const opts = normaliseOptions(
        options,
        sideLocale,
        COUNTRY_MULTI_SELECT_FIELD_NAMES.has(getBaseFieldName(field.fieldName)),
      );
      const rules = field.validationRules as { exclusive_option?: string } | null;
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
          <ApplicationSearchableMultiSelect
            value={optimisticSelectionValue}
            onValueChange={commitSelection}
            options={opts}
            placeholder={localizedPlaceholder ?? selectFallback}
            disabled={disabled}
            forceWhiteBackground={forceWhiteBackground}
            sideLocale={sideLocale}
            exclusiveOption={rules?.exclusive_option}
          />
        </FieldWrapper>
      );
    }

    case "textarea":
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
          <div className="relative">
            <ApplicationFormTextarea
              value={value}
              onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
              placeholder={localizedPlaceholder}
              maxLength={maxLength}
              className="pb-7 text-[15px]"
              forceWhiteBackground={forceWhiteBackground}
            />
            {characterCount ? (
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] leading-none text-gray-400">
                {characterCount}
              </span>
            ) : null}
          </div>
        </FieldWrapper>
      );

    case "checkbox":
      {
        const opts = normaliseOptions(options, sideLocale);
        const checkedValue = opts[0]?.value || "true";
        const normalisedValue = value.trim().toLowerCase();
        const isChecked = normalisedValue === checkedValue.toLowerCase()
          || normalisedValue === "true"
          || normalisedValue === "yes"
          || normalisedValue === "1"
          || normalisedValue === "on";

      return (
        <div className="application-form-field group/field relative flex flex-col gap-2">
          <div className="relative">
            <ApplicationCheckbox
              id={field.fieldName}
              checked={isChecked}
              disabled={disabled}
              required={required}
              label={label}
              description={helperText}
              className={cn("application-form-question-label", labelAction && "pr-10")}
              onCheckedChange={(checked) => onChange(checked ? checkedValue : "")}
            />
            {labelAction ? (
              <ApplicationFormLabelAction>{labelAction}</ApplicationFormLabelAction>
            ) : null}
          </div>
        </div>
      );
      }

    case "file":
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
          <ApplicationFormControlDisplay className={`h-12 justify-center border-dashed text-gray-400 ${forceWhiteBackground ? "bg-white" : "bg-gray-50"}`}>
            {t("upload")}: {label}
          </ApplicationFormControlDisplay>
        </FieldWrapper>
      );

    case "country":
      {
        const opts = normaliseOptions(options, sideLocale);
        const isSchengenMemberState = usesSchengenMemberStateList(field);
        if (opts.length > 0) {
          return (
            <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
              <ApplicationSearchableSelect
                value={optimisticSelectionValue}
                onValueChange={commitSelection}
                options={opts}
                placeholder={localizedPlaceholder ?? (sideLocale === "zh" ? t("dynamicField.selectCountry") : "Select country...")}
                disabled={disabled}
                forceWhiteBackground={forceWhiteBackground}
                sideLocale={sideLocale}
              />
            </FieldWrapper>
          );
        }
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
            <CountryDropdown
              placeholder={localizedPlaceholder ?? (sideLocale === "zh" ? t("dynamicField.selectCountry") : "Select country...")}
              defaultValue={value}
              onChange={(country) => commitSelection(country.name)}
              forceWhiteBackground={forceWhiteBackground}
              displayLocale={sideLocale}
              allowedCountryCodes={isSchengenMemberState ? SCHENGEN_MEMBER_ALPHA2_CODES : undefined}
            />
          </FieldWrapper>
        );
      }

    case "radio": {
      const opts = normaliseOptions(options, sideLocale);
      const isSelectionToggle = opts.length === 2;
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
          {isSelectionToggle ? (
            <ApplicationYesNoControl
              name={field.fieldName}
              options={opts}
              value={optimisticSelectionValue}
              disabled={disabled}
              onValueChange={commitSelection}
            />
          ) : opts.length >= APPLICATION_SEARCHABLE_OPTION_MIN ? (
            <ApplicationSearchableSelect
              value={optimisticSelectionValue}
              onValueChange={commitSelection}
              options={opts}
              placeholder={localizedPlaceholder ?? selectFallback}
              disabled={disabled}
              forceWhiteBackground={forceWhiteBackground}
              sideLocale={sideLocale}
            />
          ) : (
          <div className={cn("flex", opts.length < 2 ? "flex-row gap-6" : "flex-col gap-2")}>
            {opts.map((opt) => (
              <ApplicationRadio
                key={opt.value}
                name={field.fieldName}
                value={opt.value}
                checked={optimisticSelectionValue === opt.value}
                label={opt.text}
                disabled={disabled}
                className="flex"
                onCheckedChange={() => commitSelection(opt.value)}
              />
            ))}
          </div>
          )}
        </FieldWrapper>
      );
    }

    default: // text, number, email, tel, etc.
      if (isSsnField(field)) {
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
            <SsnSegmentedInput
              value={value}
              onChange={onChange}
              required={required}
              whiteControlClass={forceWhiteBackground ? "bg-white" : ""}
              ariaLabel={t("dynamicField.usSocialSecurityNumber")}
            />
          </FieldWrapper>
        );
      }

      {
        const rules = field.validationRules as { allow_do_not_know?: boolean; allow_does_not_apply?: boolean; has_does_not_apply?: boolean } | null;
        const allowDoNotKnow = rules?.allow_do_not_know;
        const allowDoesNotApply = rules?.allow_does_not_apply || rules?.has_does_not_apply;
        const isDoNotKnow = value === "DO_NOT_KNOW";
        const isDoesNotApply = value === "DOES_NOT_APPLY";
        const isOverridden = isDoNotKnow || isDoesNotApply;
        const hasSideCheckbox = allowDoNotKnow || allowDoesNotApply;

        const isTaiwanEnglishName = field.visaType === "TW_ENTRY_PERMIT" && field.fieldName === "name_english";
        const isTaiwanChineseName = field.visaType === "TW_ENTRY_PERMIT" && field.fieldName === "name_chinese";
        const inputNode = (
          <ApplicationFormInputGroup
            className={`h-12 ${(isOverridden || disabled) ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}`}
            filled={Boolean(value) && !isOverridden}
            forceWhiteBackground={forceWhiteBackground}
          >
            <InputGroupInput
              type={fieldType === "text" ? "text" : fieldType}
              placeholder={localizedPlaceholder}
              value={isOverridden ? "" : value}
              onChange={(e) => {
                let nextValue = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
                if (isTaiwanEnglishName) nextValue = nextValue.toUpperCase();
                onChange(nextValue);
              }}
              onBlur={isTaiwanChineseName ? () => {
                void convertSimplifiedToTraditional(value).then((converted) => {
                  if (converted !== value) onChange(converted);
                });
              } : undefined}
              required={required && !isOverridden}
              disabled={isOverridden || disabled}
              maxLength={maxLength}
              className={`h-12 text-[15px] ${characterCount ? "pr-14" : ""}`}
            />
            {characterCount ? (
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] leading-none text-gray-400">
                {characterCount}
              </span>
            ) : null}
          </ApplicationFormInputGroup>
        );

        const sideCheckbox = allowDoNotKnow ? (
          <ApplicationCheckbox
            checked={isDoNotKnow}
            label={doNotKnowLabel}
            className="shrink-0 whitespace-nowrap text-[13px] text-gray-500"
            onCheckedChange={(checked) => onChange(checked ? "DO_NOT_KNOW" : "")}
          />
        ) : allowDoesNotApply ? (
          <ApplicationCheckbox
            checked={isDoesNotApply}
            label={doesNotApplyLabel}
            className="shrink-0 whitespace-nowrap text-[13px] text-gray-500"
            onCheckedChange={(checked) => onChange(checked ? "DOES_NOT_APPLY" : "")}
          />
        ) : null;

        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText} labelAction={labelAction}>
            {hasSideCheckbox ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">{inputNode}</div>
                {sideCheckbox}
              </div>
            ) : (
              inputNode
            )}
          </FieldWrapper>
        );
      }
  }
}
