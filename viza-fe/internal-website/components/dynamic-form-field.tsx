"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { RegionSelect } from "@/components/ui/region-select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocale, useTranslations } from "next-intl";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";
import { resolveLocalizedOptions, resolveLocalizedPlaceholder } from "@/lib/bilingual-schema-contract";
import { cn } from "@/lib/utils";

const SEARCHABLE_SELECT_MIN_OPTIONS = 12;

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
  helper_zh?: string;
  helper_en?: string;
};

interface DynamicFormFieldProps {
  field: VisaFormFieldRow;
  value: string;
  onChange: (value: string) => void;
  forceWhiteBackground?: boolean;
  disabled?: boolean;
  displayLocale?: "zh" | "en";
  onSearchQuery?: (query: string) => void;
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

function getHelperTextRule(field: VisaFormFieldRow, sideLocale: "zh" | "en"): string | undefined {
  const rules = field.validationRules as LengthRules | null;
  const helper = sideLocale === "zh" ? rules?.helper_zh : rules?.helper_en;
  return typeof helper === "string" && helper.trim() ? helper.trim() : undefined;
}

function joinHelperText(...parts: Array<string | undefined>): string | undefined {
  const filtered = parts.filter((part): part is string => Boolean(part?.trim()));
  return filtered.length > 0 ? filtered.join("\n") : undefined;
}

function FieldWrapper({
  label,
  required,
  sideLocale,
  helperText,
  children,
}: {
  label: string;
  required: boolean;
  sideLocale: "zh" | "en";
  helperText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[14px] font-medium text-gray-700 tracking-[-0.2px]">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {!required && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[12px] font-medium text-gray-500">
            {sideLocale === "zh" ? "选填" : "Optional"}
          </span>
        )}
      </div>
      {children}
      {helperText ? <p className="text-[12px] leading-5 text-gray-500">{helperText}</p> : null}
    </div>
  );
}

function normaliseOptions(
  opts: VisaFormFieldRow["options"],
  side: "zh" | "en",
): Array<{ value: string; text: string; searchText: string }> {
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
      };
    }
    return { value: String(o), text: cleanOptionDisplayText(String(o)), searchText: String(o) };
  });
}

function cleanOptionDisplayText(text: string): string {
  return text.replace(/^(?:选项|Option)\s*[:：]\s*/i, "").trim();
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function SearchableSelectControl({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  whiteControlClass,
  sideLocale,
  onSearchQuery,
  searching,
  loadingText,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; text: string; searchText?: string }>;
  placeholder: string;
  disabled: boolean;
  whiteControlClass: string;
  sideLocale: "zh" | "en";
  onSearchQuery?: (query: string) => void;
  searching?: boolean;
  loadingText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = normalizeSearchText(query);
  const matchedOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options
      .filter((option) => {
        const haystack = normalizeSearchText(`${option.text} ${option.value} ${option.searchText ?? ""}`);
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const rank = (option: { value: string; text: string }) => {
          const normalizedValue = normalizeSearchText(option.value);
          const valueWithoutPlus = normalizedValue.replace(/^\+/, "");
          const normalizedText = normalizeSearchText(option.text);
          if (normalizedValue === normalizedQuery || valueWithoutPlus === normalizedQuery) return 0;
          if (normalizedText.startsWith(normalizedQuery)) return 1;
          if (normalizedText.includes(`(${normalizedQuery})`) || normalizedText.includes(`(+${normalizedQuery})`)) return 2;
          return 3;
        };
        return rank(left) - rank(right);
      });
  }, [normalizedQuery, options]);
  const visibleOptions = matchedOptions.slice(0, 100);
  const searchPlaceholder = sideLocale === "zh"
    ? "搜索中文、英文或官方选项..."
    : "Search Chinese, English, or official option...";
  const emptyText = sideLocale === "zh" ? "没有匹配选项" : "No matching options";

  useEffect(() => {
    if (!open || !onSearchQuery) return;
    const timer = window.setTimeout(() => onSearchQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [onSearchQuery, open, query]);

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-lg border border-[#e8e8e8] px-3 text-left text-[15px] focus:outline-none focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]",
            whiteControlClass,
            disabled ? "cursor-not-allowed opacity-70" : "hover:bg-gray-50",
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.text || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={24}
        className="w-[--radix-popover-trigger-width] overflow-hidden p-0"
        style={{ maxHeight: "min(300px, calc(100vh - 180px))" }}
      >
        <div className="border-b p-2">
          <div className="flex h-10 items-center gap-2 rounded-md border border-[#e8e8e8] px-3">
            <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-gray-400"
              autoFocus
            />
          </div>
        </div>
        <div
          className="overscroll-auto overflow-y-auto p-1"
          style={{ maxHeight: "min(220px, calc(100vh - 270px))" }}
        >
          {searching && options.length === 0 ? (
            <div className="px-3 py-3 text-[14px] text-gray-500">
              {loadingText ?? (sideLocale === "zh" ? "正在加载官方选项..." : "Loading official options...")}
            </div>
          ) : matchedOptions.length === 0 ? (
            <div className="px-3 py-3 text-[14px] text-gray-500">{emptyText}</div>
          ) : (
            visibleOptions.map((option, index) => (
              <button
                key={`${option.value}-${option.text}-${index}`}
                type="button"
                className={cn(
                  "flex min-h-10 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[14px] hover:bg-gray-100",
                  value === option.value ? "bg-gray-100" : "",
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Check
                  className={cn("h-4 w-4 shrink-0 text-[#03346E]", value === option.value ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words">{option.text}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseMultiSelectValue(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function SearchableMultiSelectControl({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  whiteControlClass,
  sideLocale,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; text: string }>;
  placeholder: string;
  disabled: boolean;
  whiteControlClass: string;
  sideLocale: "zh" | "en";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedValues = useMemo(() => parseMultiSelectValue(value), [value]);
  const selectedSet = useMemo(() => new Set(selectedValues.map((item) => item.toLowerCase())), [selectedValues]);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value.toLowerCase()));
  const normalizedQuery = normalizeSearchText(query);
  const matchedOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeSearchText(`${option.text} ${option.value}`).includes(normalizedQuery));
  }, [normalizedQuery, options]);
  const searchPlaceholder = sideLocale === "zh"
    ? "搜索中文、英文或官方选项..."
    : "Search Chinese, English, or official option...";
  const emptyText = sideLocale === "zh" ? "没有匹配选项" : "No matching options";
  const summary = selectedOptions.length > 0
    ? selectedOptions.slice(0, 2).map((option) => option.text).join(", ") + (selectedOptions.length > 2 ? ` +${selectedOptions.length - 2}` : "")
    : placeholder;

  const toggleValue = (nextValue: string) => {
    const normalized = nextValue.toLowerCase();
    const nextValues = selectedSet.has(normalized)
      ? selectedValues.filter((item) => item.toLowerCase() !== normalized)
      : [...selectedValues, nextValue];
    onChange(nextValues.join(","));
  };

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-12 w-full items-center justify-between rounded-lg border border-[#e8e8e8] px-3 py-2 text-left text-[15px] focus:outline-none focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]",
            whiteControlClass,
            disabled ? "cursor-not-allowed opacity-70" : "hover:bg-gray-50",
          )}
        >
          <span className={cn("line-clamp-2", selectedOptions.length === 0 && "text-muted-foreground")}>
            {summary}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={24}
        className="w-[--radix-popover-trigger-width] overflow-hidden p-0"
        style={{ maxHeight: "min(320px, calc(100vh - 180px))" }}
      >
        <div className="border-b p-2">
          <div className="flex h-10 items-center gap-2 rounded-md border border-[#e8e8e8] px-3">
            <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-gray-400"
              autoFocus
            />
          </div>
          {selectedOptions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedOptions.slice(0, 6).map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className="rounded-full bg-[#edf4fb] px-2 py-1 text-xs text-[#03346E]"
                  onClick={() => toggleValue(option.value)}
                >
                  {option.text}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div
          className="overscroll-auto overflow-y-auto p-1"
          style={{ maxHeight: "min(200px, calc(100vh - 280px))" }}
        >
          {matchedOptions.length === 0 ? (
            <div className="px-3 py-3 text-[14px] text-gray-500">{emptyText}</div>
          ) : (
            matchedOptions.map((option, index) => {
              const checked = selectedSet.has(option.value.toLowerCase());
              return (
                <button
                  key={`${option.value}-${option.text}-${index}`}
                  type="button"
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[14px] hover:bg-gray-100",
                    checked ? "bg-gray-100" : "",
                  )}
                  onClick={() => toggleValue(option.value)}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0 text-[#03346E]", checked ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">{option.text}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
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
  const rules = field.validationRules as { dependent_on?: unknown; dependsOn?: unknown; live_dom_id?: unknown } | null;
  return Boolean(rules?.dependent_on || rules?.dependsOn || rules?.live_dom_id);
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
  onSearchQuery,
  searching = false,
  loadingText,
}: DynamicFormFieldProps) {
  const t = useTranslations("applicationSteps");
  const locale = useLocale();
  const { label, fieldType, required, placeholder, options } = field;
  const whiteControlClass = forceWhiteBackground ? "bg-white hover:bg-white" : "";
  const sideLocale = displayLocale ?? (locale.startsWith("zh") ? "zh" : "en");
  const selectFallback = sideLocale === "zh" ? "请选择..." : "Select...";
  const localizedPlaceholder = resolveLocalizedPlaceholder(field, sideLocale) ?? placeholder ?? undefined;
  const doNotKnowLabel = sideLocale === "zh" ? t("dynamicField.doNotKnow") : "Do not know";
  const doesNotApplyLabel = sideLocale === "zh" ? t("dynamicField.doesNotApply") : "Does not apply";
  const [dateModeByField, setDateModeByField] = useState<Record<string, "full" | "year">>({});
  const maxLength = getMaxLengthRule(field);
  const configuredHelperText = getHelperTextRule(field, sideLocale);
  const normalizedSelectOptions = useMemo(
    () => fieldType === "select" ? normaliseOptions(options, sideLocale) : [],
    [fieldType, options, sideLocale],
  );
  const lengthHelperText = maxLength
    ? sideLocale === "zh"
      ? `最多 ${maxLength} 个字符，当前 ${value.length}/${maxLength}`
      : `Maximum ${maxLength} characters, currently ${value.length}/${maxLength}`
    : undefined;
  const helperText = joinHelperText(configuredHelperText, lengthHelperText);

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
        <DatePicker
          value={value}
          onChange={onChange}
          placeholder={localizedPlaceholder}
          className={whiteControlClass}
          displayLocale={sideLocale}
        />
      ) : (
        <div className={`h-12 rounded-lg border border-[#e8e8e8] flex items-center px-3 text-[15px] text-gray-400 ${forceWhiteBackground ? "bg-white" : "bg-gray-50"}`}>
          {dateIsDoNotKnow ? doNotKnowLabel : doesNotApplyLabel}
        </div>
      );
      const dateInputNode = dateIsYearOnly ? (
        <InputGroup className={whiteControlClass}>
          <InputGroupInput
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="YYYY"
            inputMode="numeric"
            pattern="[0-9]{4}"
            disabled={disabled}
          />
        </InputGroup>
      ) : datePickerNode;
      const sideCheckbox = dateAllowDoNotKnow ? (
        <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
          <Checkbox
            checked={dateIsDoNotKnow}
            onCheckedChange={(checked) => onChange(checked ? "DO_NOT_KNOW" : "")}
          />
          {doNotKnowLabel}
        </label>
      ) : dateAllowDoesNotApply ? (
        <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
          <Checkbox
            checked={dateIsDoesNotApply}
            onCheckedChange={(checked) => onChange(checked ? "DOES_NOT_APPLY" : "")}
          />
          {doesNotApplyLabel}
        </label>
      ) : null;

      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
          {dateAllowYearOnly && !dateIsDoNotKnow && !dateIsDoesNotApply && (
            <div className="mb-1 flex flex-wrap items-center gap-4 text-[13px] text-gray-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="h-4 w-4 accent-[#004080]"
                  checked={!dateIsYearOnly}
                  onChange={() => {
                    setDateModeByField((prev) => ({ ...prev, [field.fieldName]: "full" }));
                    if (/^\d{4}$/.test(value.trim())) onChange("");
                  }}
                />
                {fullDateLabel}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="h-4 w-4 accent-[#004080]"
                  checked={dateIsYearOnly}
                  onChange={() => {
                    setDateModeByField((prev) => ({ ...prev, [field.fieldName]: "year" }));
                    onChange(extractYearFromDateValue(value));
                  }}
                />
                {yearOnlyLabel}
              </label>
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
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
            <CountryDropdown
              placeholder={localizedPlaceholder ?? selectFallback}
              defaultValue={value}
              onChange={(country) => onChange(country.name)}
              className={whiteControlClass}
              displayLocale={sideLocale}
              allowedCountryCodes={isSchengenMemberState ? SCHENGEN_MEMBER_ALPHA2_CODES : undefined}
            />
          </FieldWrapper>
        );
      }
      if (isUsState) {
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
            <RegionSelect
              countryCode="US"
              placeholder={localizedPlaceholder ?? selectFallback}
              defaultValue={value}
              onChange={(region) => onChange(region.shortCode)}
              className={`h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground ${whiteControlClass}`}
            />
          </FieldWrapper>
        );
      }
      const opts = normalizedSelectOptions;
      const rules = field.validationRules as { remote_search?: unknown } | null;
      const usesRemoteSearch = rules?.remote_search === true;
      if (isEmptyDependentSelect(field, opts)) {
        const dependentMessage = sideLocale === "zh"
          ? "请先选择上级选项，或联系 VIZA 检查官方下拉列表。"
          : "Select the parent option first, or contact VIZA to check the official dropdown list.";
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
            <div
              className={cn(
                "flex min-h-12 items-center rounded-lg border border-red-200 px-3 text-[14px] leading-5 text-red-700",
                forceWhiteBackground ? "bg-white" : "bg-red-50",
              )}
              role="alert"
            >
              {dependentMessage}
            </div>
          </FieldWrapper>
        );
      }
      if (usesRemoteSearch || opts.length >= SEARCHABLE_SELECT_MIN_OPTIONS) {
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
            <SearchableSelectControl
              value={value}
              onChange={onChange}
              options={opts}
              placeholder={localizedPlaceholder ?? selectFallback}
              disabled={disabled}
              whiteControlClass={whiteControlClass}
              sideLocale={sideLocale}
              onSearchQuery={onSearchQuery}
              searching={searching}
              loadingText={loadingText}
            />
          </FieldWrapper>
        );
      }
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className={`h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground ${whiteControlClass} ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}>
              <SelectValue placeholder={localizedPlaceholder ?? selectFallback} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || "_empty"}>
                  {opt.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldWrapper>
      );
    }

    case "multi_select": {
      const opts = normaliseOptions(options, sideLocale);
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
          <SearchableMultiSelectControl
            value={value}
            onChange={onChange}
            options={opts}
            placeholder={localizedPlaceholder ?? selectFallback}
            disabled={disabled}
            whiteControlClass={whiteControlClass}
            sideLocale={sideLocale}
          />
        </FieldWrapper>
      );
    }

    case "textarea":
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
          <Textarea
            value={value}
            onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
            placeholder={localizedPlaceholder}
            maxLength={maxLength}
            className={`rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] ${whiteControlClass}`}
          />
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Checkbox
              id={field.fieldName}
              checked={isChecked}
              onCheckedChange={(checked) => onChange(checked ? checkedValue : "")}
            />
            <Label htmlFor={field.fieldName} className="text-[14px] font-medium text-gray-700 cursor-pointer">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
          {helperText ? <p className="whitespace-pre-line text-[12px] leading-5 text-gray-500">{helperText}</p> : null}
        </div>
      );
      }

    case "file":
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
          <div className={`h-12 rounded-lg border border-dashed border-[#e8e8e8] flex items-center justify-center text-[14px] text-gray-400 ${forceWhiteBackground ? "bg-white" : "bg-gray-50"}`}>
            {t("upload")}: {label}
          </div>
        </FieldWrapper>
      );

    case "country":
      {
        const isSchengenMemberState = usesSchengenMemberStateList(field);
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
            <CountryDropdown
              placeholder={localizedPlaceholder ?? (sideLocale === "zh" ? t("dynamicField.selectCountry") : "Select country...")}
              defaultValue={value}
              onChange={(country) => onChange(country.name)}
              className={whiteControlClass}
              displayLocale={sideLocale}
              allowedCountryCodes={isSchengenMemberState ? SCHENGEN_MEMBER_ALPHA2_CODES : undefined}
            />
          </FieldWrapper>
        );
      }

    case "radio": {
      const opts = normaliseOptions(options, sideLocale);
      return (
        <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
          <div className={`flex ${opts.length <= 2 ? "flex-row gap-6" : "flex-col gap-2"}`}>
            {opts.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-[14px]">
                <input
                  type="radio"
                  name={field.fieldName}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="accent-[#03346E]"
                />
                {opt.text}
              </label>
            ))}
          </div>
        </FieldWrapper>
      );
    }

    default: // text, number, email, tel, etc.
      if (isSsnField(field)) {
        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
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

        const inputNode = (
          <InputGroup className={`h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E] ${forceWhiteBackground ? "bg-white" : ""} ${(isOverridden || disabled) ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}`}>
            <InputGroupInput
              type={fieldType === "text" ? "text" : fieldType}
              placeholder={localizedPlaceholder}
              value={isOverridden ? "" : value}
              onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
              required={required && !isOverridden}
              disabled={isOverridden || disabled}
              maxLength={maxLength}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        );

        const sideCheckbox = allowDoNotKnow ? (
          <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
            <Checkbox
              checked={isDoNotKnow}
              onCheckedChange={(checked) => onChange(checked ? "DO_NOT_KNOW" : "")}
            />
            {doNotKnowLabel}
          </label>
        ) : allowDoesNotApply ? (
          <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
            <Checkbox
              checked={isDoesNotApply}
              onCheckedChange={(checked) => onChange(checked ? "DOES_NOT_APPLY" : "")}
            />
            {doesNotApplyLabel}
          </label>
        ) : null;

        return (
          <FieldWrapper label={label} required={required} sideLocale={sideLocale} helperText={helperText}>
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
